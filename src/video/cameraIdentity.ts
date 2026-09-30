import type { OnvifCameraConfig, OnvifMediaProfile } from '../types';
export function cameraIdentity(config:OnvifCameraConfig,profile:OnvifMediaProfile):string {
  return JSON.stringify([config.host.trim().toLowerCase(),config.port,profile.token,profile.width,profile.height,profile.crop||null]);
}
