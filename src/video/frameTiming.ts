import type { PtzCalibration } from '../types';

/** Frame and telemetry timestamps share the browser monotonic clock. */
export function frameTimestamp(now:number,metadata:VideoFrameCallbackMetadata|undefined,c:PtzCalibration|null,transport:'webrtc'|'hls') {
  const capture=(metadata as (VideoFrameCallbackMetadata & {captureTime?:number})|undefined)?.captureTime;
  if(transport==='webrtc'&&c?.useCaptureTime&&Number.isFinite(capture)&&capture!<=now&&now-capture!<10000)return capture!;
  const delay=c?.videoDelayByTransport?.[transport]??(transport==='webrtc'?c?.videoDelayMs??150:2000);
  return now-Math.max(0,Math.min(5000,delay));
}
