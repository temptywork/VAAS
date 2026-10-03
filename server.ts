import express, { Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

// Check ffmpeg availability
let ffmpegAvailable = false;
let ffmpegVersionStr = 'Unknown';
try {
  const v = execSync('ffmpeg -version', { encoding: 'utf-8', timeout: 3000 });
  ffmpegAvailable = true;
  ffmpegVersionStr = v.split('\n')[0] || 'FFmpeg 4.4.2';
} catch (e) {
  console.warn('FFmpeg binary check warning:', e);
}

// Global FFmpeg process state
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
let ffmpegStartTime = 0;
let ffmpegLogs: string[] = ['System started. FFmpeg ready.'];
let activeStreamSubscribers: Response[] = [];
let framesCount = 0;

function addFfmpegLog(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg.trim()}`;
  ffmpegLogs.push(line);
  if (ffmpegLogs.length > 50) ffmpegLogs.shift();
}

// ----------------------------------------------------
// ONVIF Gateway & SOAP Proxy Endpoints
// ----------------------------------------------------

interface VirtualPtzState {
  pan: number;
  tilt: number;
  zoom: number;
  moveStatus: 'IDLE' | 'MOVING' | 'HOMING' | 'PRESET_SLEW';
  lastCommand: string;
  utcTime: string;
}

const virtualCameraState: VirtualPtzState = {
  pan: 0,
  tilt: 0,
  zoom: 1.0,
  moveStatus: 'IDLE',
  lastCommand: 'Initial',
  utcTime: new Date().toISOString(),
};

app.post('/api/onvif/status', (req: Request, res: Response) => {
  const { host, port, username } = req.body || {};
  res.json({
    connected: true,
    isVirtual: !host || host.includes('127.0.0.1') || host.includes('192.168.1.108'),
    deviceInfo: {
      manufacturer: 'MIL-SPEC SENSORS / ONVIF PROFILE S/T',
      model: 'OPTIX-PTZ-TACTICAL-4K',
      firmwareVersion: 'v4.18.2-ONVIF-COMPLIANT',
      serialNumber: 'TAC-8829-9941',
      hardwareId: 'ONVIF-IP-CAM',
    },
    ptzStatus: {
      pan: virtualCameraState.pan,
      tilt: virtualCameraState.tilt,
      zoom: virtualCameraState.zoom,
      moveStatus: virtualCameraState.moveStatus,
      utcTime: new Date().toISOString(),
    },
    lastCommand: virtualCameraState.lastCommand,
  });
});

app.post('/api/onvif/ptz/move', (req: Request, res: Response) => {
  const { panVel = 0, tiltVel = 0, zoomVel = 0 } = req.body || {};
  virtualCameraState.moveStatus =
    Math.abs(panVel) > 0.01 || Math.abs(tiltVel) > 0.01 || Math.abs(zoomVel) > 0.01
      ? 'MOVING'
      : 'IDLE';
  virtualCameraState.lastCommand = `ContinuousMove(x=${panVel}, y=${tiltVel}, z=${zoomVel})`;
  res.json({ ok: true, state: virtualCameraState });
});

app.post('/api/onvif/ptz/absolute', (req: Request, res: Response) => {
  const { pan = 0, tilt = 0, zoom = 1.0 } = req.body || {};
  virtualCameraState.pan = Math.max(-180, Math.min(180, pan));
  virtualCameraState.tilt = Math.max(-90, Math.min(90, tilt));
  virtualCameraState.zoom = Math.max(0.6, Math.min(30.0, zoom));
  virtualCameraState.moveStatus = 'MOVING';
  virtualCameraState.lastCommand = `AbsoluteMove(pan=${pan}°, tilt=${tilt}°, zoom=${zoom}x)`;
  setTimeout(() => {
    virtualCameraState.moveStatus = 'IDLE';
  }, 400);
  res.json({ ok: true, state: virtualCameraState });
});

app.post('/api/onvif/ptz/stop', (req: Request, res: Response) => {
  virtualCameraState.moveStatus = 'IDLE';
  virtualCameraState.lastCommand = 'Stop(PanTilt=true, Zoom=true)';
  res.json({ ok: true, state: virtualCameraState });
});

// ----------------------------------------------------
// FFmpeg Gateway & Transcoder Endpoints
// ----------------------------------------------------

app.get('/api/ffmpeg/status', (_req: Request, res: Response) => {
  const uptime = ffmpegStartTime > 0 ? Math.floor((Date.now() - ffmpegStartTime) / 1000) : 0;
  res.json({
    available: ffmpegAvailable,
    active: ffmpegProcess !== null && !ffmpegProcess.killed,
    pid: ffmpegProcess?.pid,
    version: ffmpegVersionStr,
    uptimeSec: uptime,
    fps: 30,
    bitrate: '2.5 Mbps',
    framesProcessed: framesCount,
    droppedFrames: 0,
    logs: ffmpegLogs,
    streamUrl: '/api/ffmpeg/stream',
  });
});

app.post('/api/ffmpeg/start', (req: Request, res: Response) => {
  const {
    sourceType = 'synthetic_tactical',
    rtspUrl = 'rtsp://192.168.1.100:554/live',
    resolution = '1280x720',
    fps = 30,
  } = req.body || {};

  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGTERM');
    } catch {}
    ffmpegProcess = null;
  }

  addFfmpegLog(`Starting FFmpeg ingestion pipeline [Source: ${sourceType}]`);

  let args: string[] = [];
  if (sourceType === 'rtsp' && rtspUrl) {
    args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffserver',
      '-q:v', '4',
      '-r', String(fps),
      '-s', resolution,
      'pipe:1',
    ];
  } else {
    const filter = `testsrc2=size=${resolution}:rate=${fps},drawtext=text='MIL-SPEC ONVIF PTZ STREAM %{pts\\:hms}':fontcolor=white:box=1:boxcolor=black@0.65:x=24:y=24,drawgrid=width=128:height=72:thickness=1:color=cyan@0.15`;
    args = [
      '-re',
      '-f', 'lavfi',
      '-i', filter,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffserver',
      '-q:v', '4',
      '-r', String(fps),
      'pipe:1',
    ];
  }

  try {
    ffmpegProcess = spawn('ffmpeg', args);
    ffmpegStartTime = Date.now();
    framesCount = 0;

    addFfmpegLog(`FFmpeg pipeline started with PID: ${ffmpegProcess.pid}`);

    ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
      framesCount += 1;
      for (let i = activeStreamSubscribers.length - 1; i >= 0; i--) {
        const subscriber = activeStreamSubscribers[i];
        if (subscriber.writableEnded || subscriber.destroyed) {
          activeStreamSubscribers.splice(i, 1);
        } else {
          subscriber.write(chunk);
        }
      }
    });

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      if (str.includes('frame=') || str.includes('fps=') || str.includes('Error')) {
        addFfmpegLog(str.slice(0, 100));
      }
    });

    ffmpegProcess.on('close', (code) => {
      addFfmpegLog(`FFmpeg process exited with code ${code}`);
      ffmpegProcess = null;
    });

    res.json({
      ok: true,
      pid: ffmpegProcess.pid,
      command: `ffmpeg ${args.join(' ')}`,
      streamUrl: '/api/ffmpeg/stream',
    });
  } catch (err: any) {
    addFfmpegLog(`Failed to spawn FFmpeg: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ffmpeg/stop', (_req: Request, res: Response) => {
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGTERM');
      addFfmpegLog('FFmpeg process terminated by operator.');
    } catch (e: any) {
      addFfmpegLog(`Error terminating FFmpeg: ${e.message}`);
    }
    ffmpegProcess = null;
  }
  activeStreamSubscribers.forEach((sub) => {
    try {
      sub.end();
    } catch {}
  });
  activeStreamSubscribers = [];
  res.json({ ok: true, active: false });
});

app.get('/api/ffmpeg/stream', (req: Request, res: Response) => {
  if (!ffmpegProcess) {
    const filter = `testsrc2=size=1280x720:rate=25,drawtext=text='MIL-SPEC ONVIF PTZ STREAM %{pts\\:hms}':fontcolor=white:box=1:boxcolor=black@0.65:x=24:y=24`;
    const args = [
      '-re',
      '-f', 'lavfi',
      '-i', filter,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffserver',
      '-q:v', '5',
      '-r', '25',
      'pipe:1',
    ];
    try {
      ffmpegProcess = spawn('ffmpeg', args);
      ffmpegStartTime = Date.now();
      ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        for (let i = activeStreamSubscribers.length - 1; i >= 0; i--) {
          const sub = activeStreamSubscribers[i];
          if (sub.writableEnded || sub.destroyed) {
            activeStreamSubscribers.splice(i, 1);
          } else {
            sub.write(chunk);
          }
        }
      });
      ffmpegProcess.on('close', () => {
        ffmpegProcess = null;
      });
    } catch (e) {
      console.warn('Auto-start ffmpeg failed:', e);
    }
  }

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=ffserver',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    Connection: 'close',
  });

  activeStreamSubscribers.push(res);

  req.on('close', () => {
    const idx = activeStreamSubscribers.indexOf(res);
    if (idx !== -1) activeStreamSubscribers.splice(idx, 1);
  });
});

app.get('/api/ffmpeg/snapshot', (_req: Request, res: Response) => {
  try {
    const snapshotProc = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'testsrc2=size=1280x720:rate=1',
      '-vframes', '1',
      '-f', 'image2',
      'pipe:1',
    ]);
    res.setHeader('Content-Type', 'image/jpeg');
    snapshotProc.stdout.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Dev vs Production Setup (Vite integration on port 3000)
// ----------------------------------------------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const PORT = 3000;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VAAS Server] Tactical Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VAAS Server] FFmpeg Available: ${ffmpegAvailable} (${ffmpegVersionStr})`);
  });
}

startServer();
