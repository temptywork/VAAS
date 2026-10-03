import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Square,
  RefreshCw,
  Camera,
  Terminal,
  Activity,
  Cpu,
  Layers,
  Settings2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { FfmpegStatus, FfmpegStreamConfig } from '../types';
import { ffmpegService } from '../services/ffmpegService';

interface FfmpegStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsSource?: () => void;
}

export const FfmpegStreamModal: React.FC<FfmpegStreamModalProps> = ({
  isOpen,
  onClose,
  onSelectAsSource,
}) => {
  const [config, setConfig] = useState<FfmpegStreamConfig>(ffmpegService.getConfig());
  const [status, setStatus] = useState<FfmpegStatus>(ffmpegService.getStatus());
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'preview' | 'logs'>('pipeline');
  const [snapshotPreview, setSnapshotPreview] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ffmpegService.subscribe((s) => {
      setStatus(s);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleStartPipeline = async () => {
    setIsStarting(true);
    ffmpegService.updateConfig(config);
    await ffmpegService.startStream(config);
    setIsStarting(false);
  };

  const handleStopPipeline = async () => {
    await ffmpegService.stopStream();
  };

  const handleGrabSnapshot = async () => {
    try {
      const snapUrl = ffmpegService.getSnapshotUrl();
      setSnapshotPreview(snapUrl);
      setActiveTab('preview');
    } catch (e) {
      console.warn('Snapshot grab failed:', e);
    }
  };

  const generatedCommand =
    config.sourceType === 'rtsp'
      ? `ffmpeg -rtsp_transport ${config.transport} -i ${config.rtspUrl} -f mpjpeg -boundary_tag ffserver -q:v 4 -r ${config.fps} -s ${config.resolution} pipe:1`
      : `ffmpeg -re -f lavfi -i "testsrc2=size=${config.resolution}:rate=${config.fps},drawtext=text='MIL-SPEC ONVIF PTZ STREAM %{pts\\:hms}':fontcolor=white:box=1:boxcolor=black@0.65:x=24:y=24" -f mpjpeg -boundary_tag ffserver -q:v 4 pipe:1`;

  return (
    <div
      id="ffmpeg-integration-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/40">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-slate-100 flex items-center gap-2">
                <span>FFmpeg Ingestion & Transcoder Engine</span>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    status.active
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {status.active ? 'PIPELINE ACTIVE' : 'STANDBY'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {status.version || 'FFmpeg 4.4.2 (Ubuntu Linux)'} • Remuxes RTSP & ONVIF feeds to zero-latency stream
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 text-xs font-mono">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-2 px-3 border-b-2 font-medium flex items-center gap-1.5 ${
              activeTab === 'pipeline'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Pipeline Configuration</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-3 border-b-2 font-medium flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Stream Monitor</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 border-b-2 font-medium flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Process Logs ({status.logs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs font-mono text-slate-200 space-y-4">
          {/* Active Status Dashboard */}
          <div className="grid grid-cols-4 gap-2.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">PROCESS PID</span>
              <span className="text-sky-400 font-bold">{status.pid ? `#${status.pid}` : 'NONE'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">UPTIME</span>
              <span className="text-slate-200 font-bold">{status.uptimeSec}s</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">OUTPUT FPS</span>
              <span className="text-emerald-400 font-bold">{status.active ? status.fps : 0} FPS</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">FRAMES INGESTED</span>
              <span className="text-amber-400 font-bold">{status.framesProcessed}</span>
            </div>
          </div>

          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {/* Ingest Source Selection */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                  INGEST STREAM SOURCE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, sourceType: 'synthetic_tactical' })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      config.sourceType === 'synthetic_tactical'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Tactical Synthetic Grid</div>
                    <div className="text-[9px] text-slate-400">Integrated test pattern with MIL grid</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, sourceType: 'rtsp' })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      config.sourceType === 'rtsp'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Physical RTSP / IP Camera</div>
                    <div className="text-[9px] text-slate-400">RTSP H.264 from ONVIF camera</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, sourceType: 'testsrc' })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      config.sourceType === 'testsrc'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-[11px]">SMPTE Color Bars</div>
                    <div className="text-[9px] text-slate-400">Standard broadcast calibration</div>
                  </button>
                </div>
              </div>

              {/* RTSP Stream URL (if selected) */}
              {config.sourceType === 'rtsp' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-slate-300 font-semibold">
                      CAMERA RTSP STREAM URL
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Transport:</span>
                      <select
                        value={config.transport}
                        onChange={(e) => setConfig({ ...config, transport: e.target.value as 'tcp' | 'udp' })}
                        className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-amber-300"
                      >
                        <option value="tcp">TCP (Reliable / No packet drop)</option>
                        <option value="udp">UDP (Low Latency)</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={config.rtspUrl}
                    onChange={(e) => setConfig({ ...config, rtspUrl: e.target.value })}
                    placeholder="rtsp://user:password@192.168.1.108:554/Streaming/Channels/101"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono"
                  />
                </div>
              )}

              {/* Encoding Parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">TARGET RESOLUTION</label>
                  <select
                    value={config.resolution}
                    onChange={(e) => setConfig({ ...config, resolution: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="1920x1080">1080p FHD (1920x1080)</option>
                    <option value="1280x720">720p HD (1280x720) [Recommended]</option>
                    <option value="854x480">480p SD (854x480) [High FPS]</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">TARGET FRAMERATE</label>
                  <select
                    value={config.fps}
                    onChange={(e) => setConfig({ ...config, fps: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    <option value={15}>15 FPS (Low Bandwidth)</option>
                    <option value={25}>25 FPS (PAL Standard)</option>
                    <option value={30}>30 FPS (NTSC Standard)</option>
                    <option value={60}>60 FPS (Ultra Smooth)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">STREAM PROTOCOL</label>
                  <select
                    value={config.videoCodec}
                    onChange={(e) => setConfig({ ...config, videoCodec: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="mjpeg">MJPEG Stream (Zero-Latency Browser Native)</option>
                    <option value="h264">H.264 AVC (Transcoded)</option>
                    <option value="copy">Direct Passthrough (Copy)</option>
                  </select>
                </div>
              </div>

              {/* Generated FFmpeg CLI Command Preview */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  EXECUTING SHELL COMMAND (LINUX CONTAINER)
                </label>
                <div className="p-2.5 bg-black/90 border border-slate-800 rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto select-text">
                  <code>{generatedCommand}</code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {status.active ? (
                  <img
                    src={`/api/ffmpeg/stream?t=${Date.now()}`}
                    alt="Live FFmpeg Transcoded Stream"
                    className="w-full h-full object-contain"
                  />
                ) : snapshotPreview ? (
                  <img
                    src={snapshotPreview}
                    alt="Snapshot Capture"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>FFmpeg pipeline is currently stopped</div>
                    <div className="text-[10px]">Start the pipeline to view real-time feed</div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[10px]">
                  Direct HTTP Endpoint: <span className="text-sky-300">/api/ffmpeg/stream</span>
                </span>
                <button
                  onClick={handleGrabSnapshot}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1.5 text-[11px]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Grab Snapshot Frame</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-black/90 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 h-64 overflow-y-auto space-y-1">
              {status.logs.length === 0 ? (
                <div className="text-slate-600">No log entries recorded yet.</div>
              ) : (
                status.logs.map((log: string, i: number) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {onSelectAsSource && (
              <button
                onClick={() => {
                  onSelectAsSource();
                  onClose();
                }}
                className="px-3 py-1.5 bg-sky-950 border border-sky-500/50 hover:bg-sky-900 text-sky-200 rounded-lg text-xs font-mono font-medium transition"
              >
                Set FFmpeg as Active Viewport Source
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status.active ? (
              <button
                onClick={handleStopPipeline}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>TERMINATE PIPELINE</span>
              </button>
            ) : (
              <button
                onClick={handleStartPipeline}
                disabled={isStarting}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isStarting ? 'SPAWNING...' : 'START FFMPEG PIPELINE'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
