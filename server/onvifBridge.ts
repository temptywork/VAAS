import { randomUUID } from 'node:crypto';
import { VideoGateway } from './videoGateway.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import nodeOnvif from 'node-onvif';
import type { CameraPtzPose, OnvifCameraConfig, OnvifMediaProfile } from '../src/types.ts';

interface OnvifSession {
  id: string;
  gateway?: VideoGateway;
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
let lifecycle = Promise.resolve();
async function lockLifecycle() {
  let release!: () => void;
  const prior = lifecycle;
  lifecycle = new Promise<void>(resolve => { release = resolve; });
  await prior;
  return release;
}

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
    if (size > 131_072) throw new Error('The ONVIF setup request is too large.');
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
    transport: value.transport === 'hls' ? 'hls' : 'webrtc',
  };
}

function configKey(config: OnvifCameraConfig): string {
  return JSON.stringify([config.host, config.port, config.rtspPort, config.endpointPath, config.username, config.password, config.transport, config.profileToken]);
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

export function summarizeProfile(profile: any): OnvifMediaProfile {
  const resolution = profile?.video?.encoder?.resolution || {};
  return {
    token: String(profile?.token || profile?.Token || ''),
    name: String(profile?.name || profile?.Name || profile?.token || 'ONVIF profile'),
    width: Number(resolution.width || 0),
    height: Number(resolution.height || 0),
    encoding: String(profile?.video?.encoder?.encoding || 'Unknown').toUpperCase(),
    frameRate: Number(profile?.video?.encoder?.framerate || 0),
    bitrate: Number(profile?.video?.encoder?.bitrate || 0),
    encoderToken: profile?.video?.encoder?.token,
    crop: profile?.video?.source?.bounds,
  };
}

const asArray = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
async function discoverProfiles(device: any): Promise<OnvifMediaProfile[]> {
  const profiles: OnvifMediaProfile[] = (device.getProfileList() || []).map(summarizeProfile).filter((p: OnvifMediaProfile) => p.token);
  let raw: any[] = [];
  try { raw = asArray((await device.services.media.getProfiles())?.data?.GetProfilesResponse?.Profiles); } catch { /* Profile summaries remain usable. */ }
  for (const p of profiles) {
    const original = raw.find(r => r?.$?.token === p.token);
    const rawEncoder=original?.VideoEncoderConfiguration;
    p.encoderToken=rawEncoder?.$?.token||p.encoderToken;
    p.width=Number(rawEncoder?.Resolution?.Width)||p.width;p.height=Number(rawEncoder?.Resolution?.Height)||p.height;
    p.frameRate=Number(rawEncoder?.RateControl?.FrameRateLimit)||p.frameRate;
    p.bitrate=Number(rawEncoder?.RateControl?.BitrateLimit)||p.bitrate;
    p.encoding=String(rawEncoder?.Encoding||p.encoding).toUpperCase();
    if ((!p.width || !p.height || p.encoding === 'UNKNOWN') && p.encoderToken) {
      try {
        const response = await device.services.media.getVideoEncoderConfiguration({ ConfigurationToken: p.encoderToken });
        const encoder = response?.data?.GetVideoEncoderConfigurationResponse?.Configuration;
        p.width = Number(encoder?.Resolution?.Width) || p.width;
        p.height = Number(encoder?.Resolution?.Height) || p.height;
        p.frameRate = Number(encoder?.RateControl?.FrameRateLimit) || p.frameRate;
        p.bitrate = Number(encoder?.RateControl?.BitrateLimit) || p.bitrate;
        p.encoding = String(encoder?.Encoding || p.encoding).toUpperCase();
      } catch { /* Zero dimensions mean unknown, never an invented default. */ }
    }
    const encoder=original?.VideoEncoderConfiguration;
    p.encoderToken=encoder?.$?.token||p.encoderToken;
    p.h264Profile=encoder?.H264?.H264Profile;
    p.keyframeInterval=Number(encoder?.H264?.GovLength)||undefined;
    const bounds=original?.VideoSourceConfiguration?.Bounds?.$;
    if(bounds&&Number(bounds.width)>0&&Number(bounds.height)>0)p.crop={x:Number(bounds.x)||0,y:Number(bounds.y)||0,width:Number(bounds.width),height:Number(bounds.height)};
    const config = original?.PTZConfiguration;
    if (!config) continue;
    p.ptz = { configurationToken: config.$?.token, panTiltSpace: config.DefaultAbsolutePantTiltPositionSpace || config.DefaultAbsolutePanTiltPositionSpace,
      zoomSpace: config.DefaultAbsoluteZoomPositionSpace, nodeToken:config.NodeToken,
      continuousPanTiltSpace:config.DefaultContinuousPanTiltVelocitySpace,
      continuousZoomSpace:config.DefaultContinuousZoomVelocitySpace };
    try {
      const response = await device.services.ptz.getConfigurationOptions({ ConfigurationToken: config.$.token });
      const spaces = response?.data?.GetConfigurationOptionsResponse?.PTZConfigurationOptions?.Spaces;
      const pan = asArray(spaces?.AbsolutePanTiltPositionSpace).find(s => s.URI === p.ptz!.panTiltSpace) || asArray(spaces?.AbsolutePanTiltPositionSpace)[0];
      const zoom = asArray(spaces?.AbsoluteZoomPositionSpace).find(s => s.URI === p.ptz!.zoomSpace) || asArray(spaces?.AbsoluteZoomPositionSpace)[0];
      const range = (v: any): [number,number] | undefined => v && Number.isFinite(Number(v.Min)) && Number.isFinite(Number(v.Max)) && Number(v.Max) > Number(v.Min) ? [Number(v.Min),Number(v.Max)] : undefined;
      p.ptz = { ...p.ptz, panTiltSpace: pan?.URI, zoomSpace: zoom?.URI,
        panRange: range(config.PanTiltLimits?.Range?.XRange)||range(pan?.XRange),
        tiltRange: range(config.PanTiltLimits?.Range?.YRange)||range(pan?.YRange),
        zoomRange: range(config.ZoomLimits?.Range?.XRange)||range(zoom?.XRange) };
      const velocity=asArray(spaces?.ContinuousPanTiltVelocitySpace).find(v=>v.URI===p.ptz!.continuousPanTiltSpace)||asArray(spaces?.ContinuousPanTiltVelocitySpace)[0];
      const zoomVelocity=asArray(spaces?.ContinuousZoomVelocitySpace).find(v=>v.URI===p.ptz!.continuousZoomSpace)||asArray(spaces?.ContinuousZoomVelocitySpace)[0];
      p.ptz={...p.ptz,continuousPanTiltSpace:velocity?.URI,continuousZoomSpace:zoomVelocity?.URI,
        continuousPanRange:range(velocity?.XRange),continuousTiltRange:range(velocity?.YRange),continuousZoomRange:range(zoomVelocity?.XRange)};
    } catch { /* Some Profile S cameras omit optional configuration operations. */ }
  }
  if(device.services?.ptz) {
    try {
      let nodes:any[]=[];
      try{nodes=asArray((await device.services.ptz.getNodes())?.data?.GetNodesResponse?.PTZNode);}
      catch{
        for(const token of new Set(profiles.map(p=>p.ptz?.nodeToken).filter(Boolean))){
          try{nodes.push((await device.services.ptz.getNode({NodeToken:token}))?.data?.GetNodeResponse?.PTZNode);}catch{}
        }
        nodes=nodes.filter(Boolean);
      }
      const range=(v:any):[number,number]|undefined=>v&&Number.isFinite(Number(v.Min))&&Number.isFinite(Number(v.Max))&&Number(v.Max)>Number(v.Min)?[Number(v.Min),Number(v.Max)]:undefined;
      for(const p of profiles){
        if(!p.ptz)continue;
        const node=nodes.find(n=>n.$?.token===p.ptz!.nodeToken)||(nodes.length===1?nodes[0]:null);
        if(!node)continue;
        const spaces=node.SupportedPTZSpaces;
        const pan=asArray(spaces?.AbsolutePanTiltPositionSpace).find(v=>v.URI===p.ptz!.panTiltSpace)||asArray(spaces?.AbsolutePanTiltPositionSpace)[0];
        const zoom=asArray(spaces?.AbsoluteZoomPositionSpace).find(v=>v.URI===p.ptz!.zoomSpace)||asArray(spaces?.AbsoluteZoomPositionSpace)[0];
        p.ptz={...p.ptz,nodeToken:node.$?.token,homeSupported:node.HomeSupported===true||node.HomeSupported==='true',
          panTiltSpace:p.ptz.panTiltSpace||pan?.URI,zoomSpace:p.ptz.zoomSpace||zoom?.URI,
          panRange:p.ptz.panRange||range(pan?.XRange),tiltRange:p.ptz.tiltRange||range(pan?.YRange),zoomRange:p.ptz.zoomRange||range(zoom?.XRange)};
      }
    }catch{/* Configuration spaces remain available when GetNodes is unsupported. */}
  }
  return profiles;
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
  await session.gateway?.stop();
  session.gateway = undefined;
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
  if(previous.profileToken&&previous.device?.services?.ptz)await previous.device.services.ptz.stop({ProfileToken:previous.profileToken,PanTilt:true,Zoom:true}).catch(()=>{});
  await stopStream(previous);
}

async function waitForPlaylist(session: OnvifSession, playlistPath: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12_000) {
    if(session.ffmpegError.includes('ENOENT'))throw new Error('FFmpeg is not available. Select WebRTC, or set FFMPEG_PATH to the full ffmpeg executable path and restart Vite.');
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
  if(profileToken&&!requested)throw new Error('The selected stream profile no longer exists. Discover the camera profiles again.');
  const selected = requested || chooseProfile(session.profiles);
  if (!selected) throw new Error('The camera did not return a video profile.');

  const profile = session.device.changeProfile(selected.token);
  if (!profile) throw new Error('The selected ONVIF video profile is unavailable.');
  session.profileToken = selected.token;
  const streamUri = profile.stream?.rtsp || profile.stream?.udp || session.device.getUdpStreamUrl();
  if (!streamUri) throw new Error('The selected ONVIF profile did not provide an RTSP stream URI.');

  await stopStream(session);
  if (session.config.transport !== 'hls') {
    if (selected.encoding !== 'H264') throw new Error('Choose a standard H.264 camera profile for WebRTC playback without FFmpeg.');
    session.gateway = new VideoGateway();
    await session.gateway.start(applyStreamSettings(streamUri, session.config));
    return selected;
  }
  const toolsDirectory = path.resolve('.tools');
  await mkdir(toolsDirectory, { recursive: true });
  const directory = path.join(toolsDirectory, `onvif-${randomUUID()}`);
  await mkdir(directory, { mode: 0o700 });
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
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide:true });
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

export function extractPtzPose(result: any): CameraPtzPose | null {
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
  return { pan, tilt, zoom: zoomValue,
    panTiltSpace: panTilt?.$?.space, zoomSpace: zoom?.$?.space,
    deviceTime: status.UtcTime,
    moving: status.MoveStatus && [status.MoveStatus.PanTilt,status.MoveStatus.Zoom].some(v=>v==='MOVING')?true:
      status.MoveStatus && [status.MoveStatus.PanTilt,status.MoveStatus.Zoom].some(v=>v==='IDLE') && [status.MoveStatus.PanTilt,status.MoveStatus.Zoom].filter(Boolean).every(v=>v==='IDLE')?false:undefined,
  };
}

export function onvifBridge(): Plugin {
  return {
    name: 'vaas-onvif-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        if (!requestUrl.pathname.startsWith('/api/onvif/')) return next();
        if (!isSameOriginRequest(req)) return reply(res, 403, { error: 'ONVIF requests must come from this VAAS page.' });
        const release = /\/(discover|connect|disconnect|rtsp|ptz)$/.test(requestUrl.pathname) ? await lockLifecycle() : () => {};
        try {
          if (requestUrl.pathname.startsWith('/api/onvif/stream/')) {
            const [streamSessionId,encodedFilename]=requestUrl.pathname.slice('/api/onvif/stream/'.length).split('/');
            if(streamSessionId!==activeSession?.id)return reply(res,410,{error:'Camera stream session has changed.'});
            const filename=path.basename(decodeURIComponent(encodedFilename||''));
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
            const profiles = await discoverProfiles(device);
            if (!profiles.length) throw new Error('The camera did not return any ONVIF media profiles.');
            activeSession = {
              id: randomUUID(),
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
              const profiles = await discoverProfiles(device);
              activeSession = {
                id: randomUUID(),
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
            // A new owner always receives a new ID, including reuse of a discovered device.
            activeSession.id=randomUUID();activeSession.config=config;
            const selected = await startStream(activeSession, config.profileToken);
            if(res.destroyed){await closeSession();return;}
            return reply(res, 200, {
              device: { manufacturer: activeSession.deviceInfo?.Manufacturer || '', model: activeSession.deviceInfo?.Model || '' },
              profile: selected,
              profiles: activeSession.profiles,
              ptzSupported: true,
              sessionId: activeSession.id,
              transport: config.transport,
              streamPath: `/api/onvif/stream/${activeSession.id}/index.m3u8`,
            });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/webrtc') {
            const body = await readJson(req);
            if (!activeSession?.gateway || body.sessionId !== activeSession.id) throw new Error('Camera session changed. Reconnect the camera.');
            if (typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0')) throw new Error('Invalid WebRTC offer.');
            const session=activeSession,id=session.id;
            const sdp=await session.gateway!.offer(body.sdp);
            if(activeSession!==session||activeSession.id!==id)return reply(res,409,{error:'Camera session changed during WebRTC negotiation.'});
            return reply(res,200,{sdp});
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/rtsp') {
            const body = await readJson(req);
            const url = new URL(String(body.url || ''));
            if (!['rtsp:', 'rtsps:'].includes(url.protocol)) throw new Error('Enter an RTSP camera URL.');
            await closeSession();
            const gateway = new VideoGateway();
            const id = randomUUID();
            activeSession = { id, device: null, gateway, config: { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } as OnvifCameraConfig,
              configKey: '', profileToken: '', profiles: [], deviceInfo: {}, ffmpeg: null, streamDirectory: null, ffmpegError: '' };
            await gateway.start(url.toString());
            if(res.destroyed){await closeSession();return;}
            return reply(res, 200, { sessionId: id, transport: 'webrtc' });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/ptz') {
            if (!activeSession?.profileToken) throw new Error('Connect the ONVIF camera before moving it.');
            const command = await readJson(req);
            if (command.sessionId !== activeSession.id) throw new Error('Camera session changed.');
            if (command.action === 'stop') {
              await activeSession.device.services.ptz.stop({ ProfileToken: activeSession.profileToken, PanTilt: true, Zoom: true });
            } else if (command.action === 'home') {
              await activeSession.device.services.ptz.gotoHomePosition({ ProfileToken: activeSession.profileToken, Speed: 0.5 });
            } else {
              const clamp = (value: unknown) => Math.max(-1, Math.min(1, Number(value) || 0));
              await activeSession.device.services.ptz.continuousMove({
                ProfileToken: activeSession.profileToken,
                Velocity: (()=>{
                  const p=activeSession!.profiles.find(p=>p.token===activeSession!.profileToken)?.ptz;
                  const speed=(v:unknown,range?:[number,number])=>{const n=clamp(v);return n*(n>=0?(range?.[1]??1):-(range?.[0]??-1));};
                  return {x:speed(command.pan,p?.continuousPanRange),y:speed(command.tilt,p?.continuousTiltRange),z:speed(command.zoom,p?.continuousZoomRange)};
                })(),
                Timeout: 1,
              });
            }
            return reply(res, 200, { ok: true });
          }

          if (req.method === 'GET' && requestUrl.pathname === '/api/onvif/status') {
            if (!activeSession?.profileToken) return reply(res, 200, { connected: false, ptzPose: null });
            const session = activeSession;
            if (requestUrl.searchParams.has('sessionId') && requestUrl.searchParams.get('sessionId') !== session.id) return reply(res, 409, { error: 'Camera session changed.' });
            const sessionId=session.id,profileToken=session.profileToken;
            const requestedAt = Date.now();
            const result = await session.device.services.ptz.getStatus({ ProfileToken: profileToken });
            const receivedAt = Date.now();
            return reply(res, 200, { connected: activeSession === session && session.id===sessionId && session.profileToken===profileToken, sessionId, ptzPose: extractPtzPose(result), requestedAt, receivedAt });
          }

          if (req.method === 'POST' && requestUrl.pathname === '/api/onvif/disconnect') {
            const body = await readJson(req);
            if (activeSession && body.sessionId === activeSession.id) await closeSession();
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
          if(/\/(connect|rtsp)$/.test(requestUrl.pathname))await closeSession().catch(()=>{});
          return reply(res, 502, { error: message.slice(0, 500) });
        } finally { release(); }
      });

      server.httpServer?.once('close', () => {
        void closeSession();
      });
    },
  };
}
