import { spawn, type ChildProcess } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import nodeOnvif from 'node-onvif';
import type { CameraPtzPose, OnvifCameraConfig, OnvifMediaProfile } from '../src/types.ts';

interface OnvifSession {
  device: any;
  config: OnvifCameraConfig;
  configKey: string;
  profileToken: string;
  profiles: OnvifMediaProfile[];
  deviceInfo: Record<string, string>;
  ffmpeg: ChildProcess | null;
  streamDirectory: string | null;
  ffmpegError: string;
}

let activeSession: OnvifSession | null = null;

function reply(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isSameOriginRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (!host) return false;
  try {
    if (req.headers.origin && new URL(req.headers.origin).host === host) return true;
    if (req.headers['sec-fetch-site'] === 'same-origin') return true;
    if (req.headers.referer && new URL(req.headers.referer).host === host) return true;
  } catch {
    return false;
  }
  return false;
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > 16_384) throw new Error('The ONVIF setup request is too large.');
    chunks.push(data);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function normalizeConfig(value: Partial<OnvifCameraConfig>): OnvifCameraConfig {
  const host = String(value.host || '').trim().replace(/^\[|\]$/g, '');
  const port = Number(value.port || 80);
  const rtspPort = Number(value.rtspPort ?? 554);
  const endpointPath = String(value.endpointPath || '/onvif/device_service').trim();
  if (!host || /[\s/@?#]/.test(host)) throw new Error('Enter the camera IP address or host name.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The ONVIF port must be between 1 and 65535.');
  if (!Number.isInteger(rtspPort) || rtspPort < 1 || rtspPort > 65535) throw new Error('The RTSP port must be between 1 and 65535.');
  if (!endpointPath.startsWith('/') || endpointPath.includes('..') || /[?#]/.test(endpointPath)) {
    throw new Error('Enter a valid ONVIF device service path.');
  }
  return {
    host,
    port,
    rtspPort,
    endpointPath,
    username: String(value.username || ''),
    password: String(value.password || ''),
    profileToken: value.profileToken || undefined,
  };
}

function configKey(config: OnvifCameraConfig): string {
  return JSON.stringify([config.host, config.port, config.rtspPort, config.endpointPath, config.username, config.password]);
}

function normalizeIncompleteProfileMetadata(result: any): any {
  const profiles = result?.data?.GetProfilesResponse?.Profiles;
  if (!profiles) return result;

  for (const profile of Array.isArray(profiles) ? profiles : [profiles]) {
    if (!profile || typeof profile !== 'object') continue;
    if (!profile.$ || typeof profile.$ !== 'object') profile.$ = {};

    const source = profile.VideoSourceConfiguration;
    if (source) {
      if (!source.$ || typeof source.$ !== 'object') source.$ = {};
      if (!source.Bounds || typeof source.Bounds !== 'object') source.Bounds = {};
      if (!source.Bounds.$ || typeof source.Bounds.$ !== 'object') {
        source.Bounds.$ = {width: '0', height: '0', x: '0', y: '0'};
      }
    }

    const encoder = profile.VideoEncoderConfiguration;
    if (encoder) {
      if (!encoder.$ || typeof encoder.$ !== 'object') encoder.$ = {};
      if (!encoder.Resolution || typeof encoder.Resolution !== 'object') encoder.Resolution = {};
      if (encoder.Resolution.Width == null) encoder.Resolution.Width = '0';
      if (encoder.Resolution.Height == null) encoder.Resolution.Height = '0';
      if (!encoder.RateControl || typeof encoder.RateControl !== 'object') encoder.RateControl = {};
      if (encoder.RateControl.FrameRateLimit == null) encoder.RateControl.FrameRateLimit = '0';
      if (encoder.RateControl.BitrateLimit == null) encoder.RateControl.BitrateLimit = '0';
    }

    const audioSource = profile.AudioSourceConfiguration;
    if (audioSource && (!audioSource.$ || typeof audioSource.$ !== 'object')) audioSource.$ = {};
  }

  return result;
}

function tolerateIncompleteProfileMetadata(device: any): void {
  const readProfiles = device._mediaGetProfiles.bind(device);
  device._mediaGetProfiles = () => {
    const media = device.services.media;
    if (!media) return readProfiles();

    const getProfiles = media.getProfiles.bind(media);
    media.getProfiles = (callback?: (error: unknown, result?: any) => void) => {
      if (!callback) return getProfiles().then(normalizeIncompleteProfileMetadata);
      return getProfiles((error: unknown, result: any) => {
        callback(error, error ? result : normalizeIncompleteProfileMetadata(result));
      });
    };

    return readProfiles();
  };
}

function makeDevice(config: OnvifCameraConfig, rebaseSameHostServices = false): any {
  const host = config.host.includes(':') ? `[${config.host}]` : config.host;
  const device = new nodeOnvif.OnvifDevice({
    xaddr: `http://${host}:${config.port}${config.endpointPath}`,
    user: config.username,
    pass: config.password,
  });
  tolerateIncompleteProfileMetadata(device);

  if (rebaseSameHostServices) {
    const getXaddr = device._getXaddr.bind(device);
    device._getXaddr = (advertisedXaddr: string) => {
      const serviceUrl = new URL(getXaddr(advertisedXaddr), `http://${host}:${config.port}`);
      const configuredHost = config.host.replace(/^\[|\]$/g, '').toLowerCase();
      const serviceHost = serviceUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      if (serviceHost === configuredHost && serviceUrl.port !== String(config.port)) {
        serviceUrl.port = String(config.port);
      }
      return serviceUrl.toString();
    };
  }

  return device;
}

function refusedAtAlternatePort(error: unknown, config: OnvifCameraConfig): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const match = /connect ECONNREFUSED (?:\[([^\]]+)\]|([^:\s]+)):(\d+)/.exec(message);
  if (!match) return false;
  const failedHost = (match[1] || match[2]).replace(/^\[|\]$/g, '').toLowerCase();
  return failedHost === config.host.replace(/^\[|\]$/g, '').toLowerCase() && Number(match[3]) !== config.port;
}

async function initializeDevice(config: OnvifCameraConfig): Promise<{device: any; deviceInfo: Record<string, string>}> {
  const device = makeDevice(config);
  try {
    return {device, deviceInfo: await device.init()};
  } catch (error) {
    if (!refusedAtAlternatePort(error, config)) throw error;

    // Some cameras advertise media/PTZ endpoints on an unreachable alternate port.
    const rebasedDevice = makeDevice(config, true);
    return {device: rebasedDevice, deviceInfo: await rebasedDevice.init()};
  }
}

function summarizeProfile(profile: any): OnvifMediaProfile {
  const resolution = profile?.video?.encoder?.resolution || {};
  return {
    token: String(profile?.token || profile?.Token || ''),
    name: String(profile?.name || profile?.Name || profile?.token || 'ONVIF profile'),
    width: Number(resolution.width || 0),
    height: Number(resolution.height || 0),
    encoding: String(profile?.video?.encoder?.encoding || 'Unknown').toUpperCase(),
    frameRate: Number(profile?.video?.encoder?.framerate || 0),
  };
}

function chooseProfile(profiles: OnvifMediaProfile[]): OnvifMediaProfile | undefined {
  return [...profiles].sort((a, b) => {
    const aH264 = a.encoding === 'H264' ? 1 : 0;
    const bH264 = b.encoding === 'H264' ? 1 : 0;
    if (aH264 !== bH264) return bH264 - aH264;
    return (b.width * b.height) - (a.width * a.height);
  })[0];
}

async function stopStream(session: OnvifSession): Promise<void> {
  if (session.ffmpeg && session.ffmpeg.exitCode === null) {
    session.ffmpeg.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        session.ffmpeg?.kill('SIGKILL');
        resolve();
      }, 1500);
      session.ffmpeg?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  session.ffmpeg = null;
  if (session.streamDirectory) {
    await rm(session.streamDirectory, { recursive: true, force: true });
    session.streamDirectory = null;
  }
}

async function closeSession(): Promise<void> {
  if (!activeSession) return;
  const previous = activeSession;
  activeSession = null;
  await stopStream(previous);
}

async function waitForPlaylist(session: OnvifSession, playlistPath: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12_000) {
    if (session.ffmpeg?.exitCode !== null && session.ffmpeg?.exitCode !== undefined) {
      throw new Error(session.ffmpegError || 'FFmpeg stopped before the live stream was ready.');
    }
    try {
      const playlist = await readFile(playlistPath, 'utf8');
      if (playlist.includes('#EXTM3U')) return;
    } catch {
      // FFmpeg is still opening the camera stream.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(session.ffmpegError || 'No video arrived from the camera. Check its stream profile and RTSP access.');
}

function applyStreamSettings(streamUri: string, config: OnvifCameraConfig): string {
  const uri = new URL(streamUri);
  if (uri.protocol === 'rtsp:' || uri.protocol === 'rtsps:') uri.port = String(config.rtspPort);
  if (!uri.username && config.username) uri.username = config.username;
  if (!uri.password && config.password) uri.password = config.password;
  return uri.toString();
}

async function startStream(session: OnvifSession, profileToken?: string): Promise<OnvifMediaProfile> {
  const requested = profileToken && session.profiles.find((profile) => profile.token === profileToken);
  const selected = requested || chooseProfile(session.profiles);
  if (!selected) throw new Error('The camera did not return a video profile.');

  const profile = session.device.changeProfile(selected.token);
  if (!profile) throw new Error('The selected ONVIF video profile is unavailable.');
  session.profileToken = selected.token;
  const streamUri = profile.stream?.rtsp || profile.stream?.udp || session.device.getUdpStreamUrl();
  if (!streamUri) throw new Error('The selected ONVIF profile did not provide an RTSP stream URI.');

  await stopStream(session);
  const directory = await mkdtemp(path.join(tmpdir(), 'vaas-onvif-'));
  session.streamDirectory = directory;
  session.ffmpegError = '';
  const playlistPath = path.join(directory, 'index.m3u8');
  const segmentPath = path.join(directory, 'segment_%06d.ts');
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const videoCodecArgs = selected.encoding === 'H264'
    ? ['-c:v', 'copy']
    : ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p'];
  const ffmpeg = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'warning',
    '-rtsp_transport', 'tcp',
    '-i', applyStreamSettings(streamUri, session.config),
    '-map', '0:v:0', '-an', ...videoCodecArgs,
    '-f', 'hls', '-hls_time', '1', '-hls_list_size', '4',
    '-hls_flags', 'delete_segments+append_list+independent_segments',
    '-hls_segment_filename', segmentPath,
    playlistPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  session.ffmpeg = ffmpeg;
  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    session.ffmpegError = `${session.ffmpegError}${chunk.toString('utf8')}`.slice(-4000);
  });
  ffmpeg.on('error', (error) => {
    session.ffmpegError = error.message;
  });
  try {
    await waitForPlaylist(session, playlistPath);
  } catch (error) {
    await stopStream(session);
    throw error;
  }
  return selected;
}

function numericAttribute(value: any, key: string): number | null {
  const object = value?.$ || value;
  const parsed = Number(object?.[key]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPtzPose(result: any): CameraPtzPose | null {
  const data = result?.data || {};
  const response = data.GetStatusResponse || data;
  const status = response.PTZStatus || response.PtzStatus || response;
  const position = status.Position || status.position;
  const panTilt = position?.PanTilt || position?.PanTiltPosition;
  const zoom = position?.Zoom;
  const pan = numericAttribute(panTilt, 'x');
  const tilt = numericAttribute(panTilt, 'y');
  const zoomValue = numericAttribute(zoom, 'x');
  if (pan === null || tilt === null || zoomValue === null) return null;
  return { pan, tilt, zoom: zoomValue };
}

export function onvifBridge(): Plugin {
  return {
    name: 'vaas-onvif-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        if (!requestUrl.pathname.startsWith('/api/onvif/')) return next();
        if (!isSameOriginRequest(req)) return reply(res, 403, { error: 'ONVIF requests must come from this VAAS page.' });
        try {
          if (requestUrl.pathname.startsWith('/api/onvif/stream/')) {
            const filename = path.basename(decodeURIComponent(requestUrl.pathname.slice('/api/onvif/stream/'.length)));
            if (!/^(index\.m3u8|segment_\d+\.ts)$/.test(filename) || !activeSession?.streamDirectory) {
              return reply(res, 404, { error: 'Live camera stream is not available.' });
            }
            const body = await readFile(path.join(activeSession.streamDirectory, filename));
            res.statusCode = 200;
            res.setHeader('Content-Type', filename.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
            return;
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/discover') {
            const config = normalizeConfig(await readJson(req));
            await closeSession();
            const {device, deviceInfo} = await initializeDevice(config);
            if (!device.services?.ptz) throw new Error('The camera responds to ONVIF but does not expose the PTZ service.');
            const profiles = (device.getProfileList() || []).map(summarizeProfile).filter((profile: OnvifMediaProfile) => profile.token);
            if (!profiles.length) throw new Error('The camera did not return any ONVIF media profiles.');
            activeSession = {
              device,
              config,
              configKey: configKey(config),
              profileToken: '',
              profiles,
              deviceInfo: deviceInfo || {},
              ffmpeg: null,
              streamDirectory: null,
              ffmpegError: '',
            } as OnvifSession;
            return reply(res, 200, {
              device: { manufacturer: deviceInfo?.Manufacturer || '', model: deviceInfo?.Model || '' },
              profiles,
              ptzSupported: true,
            });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/connect') {
            const config = normalizeConfig(await readJson(req));
            if (!activeSession || activeSession.configKey !== configKey(config)) {
              await closeSession();
              const {device, deviceInfo} = await initializeDevice(config);
              if (!device.services?.ptz) throw new Error('The camera responds to ONVIF but does not expose the PTZ service.');
              const profiles = (device.getProfileList() || []).map(summarizeProfile).filter((profile: OnvifMediaProfile) => profile.token);
              activeSession = {
                device,
                config,
                configKey: configKey(config),
                profileToken: '',
                profiles,
                deviceInfo: deviceInfo || {},
                ffmpeg: null,
                streamDirectory: null,
                ffmpegError: '',
              } as OnvifSession;
            }
            if (!activeSession) throw new Error('ONVIF initialization did not complete.');
            const selected = await startStream(activeSession, config.profileToken);
            return reply(res, 200, {
              device: { manufacturer: activeSession.deviceInfo?.Manufacturer || '', model: activeSession.deviceInfo?.Model || '' },
              profile: selected,
              profiles: activeSession.profiles,
              ptzSupported: true,
              streamPath: '/api/onvif/stream/index.m3u8',
            });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/ptz') {
            if (!activeSession?.profileToken) throw new Error('Connect the ONVIF camera before moving it.');
            const command = await readJson(req);
            if (command.action === 'stop') {
              await activeSession.device.services.ptz.stop({ ProfileToken: activeSession.profileToken, PanTilt: true, Zoom: true });
            } else if (command.action === 'home') {
              await activeSession.device.services.ptz.gotoHomePosition({ ProfileToken: activeSession.profileToken, Speed: 0.5 });
            } else {
              const clamp = (value: unknown) => Math.max(-1, Math.min(1, Number(value) || 0));
              await activeSession.device.services.ptz.continuousMove({
                ProfileToken: activeSession.profileToken,
                Velocity: { x: clamp(command.pan), y: clamp(command.tilt), z: clamp(command.zoom) },
                Timeout: 1,
              });
            }
            return reply(res, 200, { ok: true });
          }

          if (req.method === 'GET' && requestUrl.pathname === '/api/onvif/status') {
            if (!activeSession?.profileToken) return reply(res, 200, { connected: false, ptzPose: null });
            const result = await activeSession.device.services.ptz.getStatus({ ProfileToken: activeSession.profileToken });
            return reply(res, 200, { connected: true, ptzPose: extractPtzPose(result) });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/disconnect') {
            await closeSession();
            return reply(res, 200, { ok: true });
          }

          return reply(res, 404, { error: 'Unknown ONVIF endpoint.' });
        } catch (error) {
          let message = error instanceof Error ? error.message : 'Unknown ONVIF error.';
          if (activeSession) {
            for (const secret of [activeSession.config.username, activeSession.config.password]) {
              if (secret) {
                message = message.replaceAll(secret, '[hidden]').replaceAll(encodeURIComponent(secret), '[hidden]');
              }
            }
          }
          return reply(res, 502, { error: message.slice(0, 500) });
        }
      });

      server.httpServer?.once('close', () => {
        void closeSession();
      });
    },
  };
}
