/**
 * High-precision PTZ Kinematics & Spherical Projection Math
 * Maps between Tactical Screen Space (x, y) and Camera PTZ Spherical Coordinates
 * (Azimuth deg, Elevation deg, Optical Zoom).
 */

import { PtzAnchor } from '../types';

export const BASE_HORIZONTAL_FOV_DEG = 62.0; // Typical tactical PTZ camera 1x FOV
export const BASE_ASPECT_RATIO = 16 / 9;

/**
 * Normalizes an angle to [-180, +180) degrees
 */
export function normalizeAngleDeg(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

/**
 * Calculates current horizontal and vertical FOV given optical zoom factor
 */
export function getCameraFov(
  zoom: number,
  baseFovDeg: number = BASE_HORIZONTAL_FOV_DEG,
  aspectRatio: number = BASE_ASPECT_RATIO
): { fovH: number; fovV: number } {
  const safeZoom = Math.max(0.5, zoom);
  const fovH = baseFovDeg / safeZoom;
  const fovHRad = (fovH * Math.PI) / 180;
  const fovVRad = 2 * Math.atan(Math.tan(fovHRad / 2) / aspectRatio);
  const fovV = (fovVRad * 180) / Math.PI;
  return { fovH, fovV };
}

/**
 * Convert a point placed on screen (screenX, screenY) into an absolute PTZ Anchor
 * based on current camera pan, tilt, zoom.
 */
export function screenToPtzAnchor(
  screenX: number,
  screenY: number,
  screenWidth: number,
  screenHeight: number,
  camPanDeg: number,
  camTiltDeg: number,
  camZoom: number,
  baseFovDeg: number = BASE_HORIZONTAL_FOV_DEG
): PtzAnchor {
  const { fovH, fovV } = getCameraFov(camZoom, baseFovDeg, screenWidth / screenHeight);
  const fovHRad = (fovH * Math.PI) / 180;
  const fovVRad = (fovV * Math.PI) / 180;

  // Normalized screen coords from center: [-1, +1]
  const u = (screenX - screenWidth / 2) / (screenWidth / 2);
  const v = -(screenY - screenHeight / 2) / (screenHeight / 2);

  // Angular offset from camera optical boresight
  const deltaPanRad = Math.atan(u * Math.tan(fovHRad / 2));
  const deltaTiltRad = Math.atan(v * Math.tan(fovVRad / 2));

  const deltaPanDeg = (deltaPanRad * 180) / Math.PI;
  const deltaTiltDeg = (deltaTiltRad * 180) / Math.PI;

  const worldPanDeg = normalizeAngleDeg(camPanDeg + deltaPanDeg);
  const worldTiltDeg = Math.max(-90, Math.min(90, camTiltDeg + deltaTiltDeg));

  return {
    panDeg: worldPanDeg,
    tiltDeg: worldTiltDeg,
    placedAtPan: camPanDeg,
    placedAtTilt: camTiltDeg,
    placedAtZoom: camZoom,
    placedAtFovH: fovH,
    distanceMeters: 500, // Tactical baseline
  };
}

export interface PtzProjectionResult {
  x: number;
  y: number;
  inFrustum: boolean;
  deltaPanDeg: number;
  deltaTiltDeg: number;
  scaleFactor: number;
  // Edge indicator info when out of frustum:
  edgeIndicator?: {
    edgeX: number;
    edgeY: number;
    angleDeg: number; // direction arrow
    distanceDeg: number; // angular distance off-center
  };
}

/**
 * Projects an object's PTZ Anchor onto the current screen given current camera state.
 */
export function ptzAnchorToScreen(
  anchor: PtzAnchor,
  camPanDeg: number,
  camTiltDeg: number,
  camZoom: number,
  screenWidth: number,
  screenHeight: number,
  baseFovDeg: number = BASE_HORIZONTAL_FOV_DEG
): PtzProjectionResult {
  const { fovH, fovV } = getCameraFov(camZoom, baseFovDeg, screenWidth / screenHeight);
  const fovHRad = (fovH * Math.PI) / 180;
  const fovVRad = (fovV * Math.PI) / 180;

  const deltaPanDeg = normalizeAngleDeg(anchor.panDeg - camPanDeg);
  const deltaTiltDeg = anchor.tiltDeg - camTiltDeg;

  const deltaPanRad = (deltaPanDeg * Math.PI) / 180;
  const deltaTiltRad = (deltaTiltDeg * Math.PI) / 180;

  // Projection onto image plane
  const u = Math.tan(deltaPanRad) / Math.tan(fovHRad / 2);
  const v = Math.tan(deltaTiltRad) / Math.tan(fovVRad / 2);

  // Check if inside forward hemisphere (within 85° of boresight)
  const isForward = Math.abs(deltaPanDeg) < 85 && Math.abs(deltaTiltDeg) < 85;
  const inFrustum = isForward && Math.abs(u) <= 1.05 && Math.abs(v) <= 1.05;

  const screenX = screenWidth / 2 + u * (screenWidth / 2);
  const screenY = screenHeight / 2 - v * (screenHeight / 2);

  const scaleFactor = camZoom / Math.max(0.1, anchor.placedAtZoom || 1.0);

  let edgeIndicator: PtzProjectionResult['edgeIndicator'] = undefined;

  if (!inFrustum) {
    // Calculate 2D bearing towards target on screen
    const bearingRad = Math.atan2(-deltaTiltDeg, deltaPanDeg);
    const angleDeg = (bearingRad * 180) / Math.PI;
    const distanceDeg = Math.hypot(deltaPanDeg, deltaTiltDeg);

    // Clamp indicator to viewport border with 36px padding
    const pad = 36;
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;
    const maxHalfW = screenWidth / 2 - pad;
    const maxHalfH = screenHeight / 2 - pad;

    let edgeX = cx + Math.cos(bearingRad) * maxHalfW;
    let edgeY = cy + Math.sin(bearingRad) * maxHalfH;

    // Constrain to rectangle bounds
    const slope = Math.tan(bearingRad);
    if (Math.abs(Math.cos(bearingRad)) * maxHalfH > Math.abs(Math.sin(bearingRad)) * maxHalfW) {
      // Hits left or right edge
      edgeX = Math.cos(bearingRad) >= 0 ? cx + maxHalfW : cx - maxHalfW;
      edgeY = cy + (edgeX - cx) * slope;
    } else {
      // Hits top or bottom edge
      edgeY = Math.sin(bearingRad) >= 0 ? cy + maxHalfH : cy - maxHalfH;
      edgeX = cy !== edgeY && slope !== 0 ? cx + (edgeY - cy) / slope : cx;
    }

    edgeX = Math.max(pad, Math.min(screenWidth - pad, edgeX));
    edgeY = Math.max(pad, Math.min(screenHeight - pad, edgeY));

    edgeIndicator = {
      edgeX,
      edgeY,
      angleDeg,
      distanceDeg,
    };
  }

  return {
    x: screenX,
    y: screenY,
    inFrustum,
    deltaPanDeg,
    deltaTiltDeg,
    scaleFactor,
    edgeIndicator,
  };
}

/**
 * Fuse PTZ kinematic prediction with Visual Registration (CV Homography)
 * When CV tracking is degraded or lost, seamlessly falls back 100% to PTZ kinematics.
 */
export function fusePtzAndHomography(
  ptzPoint: [number, number],
  cvPoint: [number, number] | null,
  cvQuality: 'GOOD' | 'DEGRADED' | 'LOST' | 'UNINITIALIZED',
  isPtzMoving: boolean
): [number, number] {
  if (!cvPoint || cvQuality === 'LOST' || cvQuality === 'UNINITIALIZED') {
    return ptzPoint;
  }

  if (isPtzMoving) {
    // When camera is actively slewing, PTZ telemetry has zero lag
    return [
      0.85 * ptzPoint[0] + 0.15 * cvPoint[0],
      0.85 * ptzPoint[1] + 0.15 * cvPoint[1],
    ];
  }

  if (cvQuality === 'GOOD') {
    // Steady state: CV provides sub-pixel accuracy anchored to visual terrain texture
    return [
      0.15 * ptzPoint[0] + 0.85 * cvPoint[0],
      0.15 * ptzPoint[1] + 0.85 * cvPoint[1],
    ];
  }

  // Degraded state: 50/50 blending
  return [
    0.5 * ptzPoint[0] + 0.5 * cvPoint[0],
    0.5 * ptzPoint[1] + 0.5 * cvPoint[1],
  ];
}
