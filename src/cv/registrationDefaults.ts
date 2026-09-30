import type { RegistrationSettings } from '../types';

export const REGISTRATION_DEFAULTS: RegistrationSettings = {
  enabled: true, maxFeatures: 450, fastThreshold: 16, matchRatioThreshold: 0.78,
  ransacThresholdPx: 3, minInliers: 10, ransacIterations: 240,
  lostFrameToleranceFrames: 8, smoothingFactor: 0.65, leastSquaresRefine: true,
  adaptiveReference: true, updateIntervalMs: 33, processingLongEdge: 960,
  // Pixel thresholds are defined at a 960-pixel long edge and scaled at runtime.
  ptzResidualLimitPx: 24, poseMaxAgeMs: 400,
  visualSearchViews: 3, descriptorIntervalFrames: 5,
  residualHoldMs: 250, residualDecayMs: 750, transformMaxAgeMs: 500,
  maxAutoKeyframes: 8,
};

/** One normalization boundary for persisted settings, UI values and every feed. */
export function registrationSettings(value: Partial<RegistrationSettings> = {}): RegistrationSettings {
  const s = { ...REGISTRATION_DEFAULTS, ...value };
  const limit = (n: number | undefined, fallback: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(n) ? n! : fallback));
  return { ...s, maxFeatures: Math.round(limit(s.maxFeatures,450,100,1000)),
    fastThreshold: limit(s.fastThreshold,16,5,50), matchRatioThreshold: limit(s.matchRatioThreshold,.78,.5,.95),
    ransacThresholdPx: limit(s.ransacThresholdPx,3,1,10), minInliers: Math.round(limit(s.minInliers,10,6,50)),
    ransacIterations: Math.round(limit(s.ransacIterations,240,60,600)),
    updateIntervalMs: limit(s.updateIntervalMs,33,16,250), processingLongEdge: limit(s.processingLongEdge,960,320,1280),
    smoothingFactor: limit(s.smoothingFactor,.65,.1,1), poseMaxAgeMs: limit(s.poseMaxAgeMs,400,100,2000),
    ptzResidualLimitPx: limit(s.ptzResidualLimitPx,24,2,80),
    visualSearchViews: Math.round(limit(s.visualSearchViews,3,1,8)),
    descriptorIntervalFrames: Math.round(limit(s.descriptorIntervalFrames,5,1,30)),
    lostFrameToleranceFrames: Math.round(limit(s.lostFrameToleranceFrames,8,0,30)),
    residualHoldMs: limit(s.residualHoldMs,250,0,1000), residualDecayMs: limit(s.residualDecayMs,750,100,3000),
    transformMaxAgeMs: limit(s.transformMaxAgeMs,500,100,2000),
    maxAutoKeyframes: Math.round(limit(s.maxAutoKeyframes,8,0,24)) };
}
