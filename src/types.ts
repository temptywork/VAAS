export type FeatureType = 
  | 'tank'
  | 'bunker'
  | 'gun'
  | 'comm'
  | 'personnel'
  | 'vehicle'
  | 'observation_post'
  | 'headquarters'
  | 'custom';

export interface FeatureDefinition {
  type: FeatureType;
  name: string;
  symbol: string;
  shape: 'diamond' | 'square' | 'cross' | 'comm' | 'circle' | 'rectangle' | 'triangle' | 'star' | 'custom';
  defaultLabel: string;
  description: string;
  color: string;
}

export interface ExerciseFeature {
  id: string;
  type: FeatureType;
  x: number; // Reference frame coordinate X
  y: number; // Reference frame coordinate Y
  label: string;
  rotation?: number; // 0-360 deg
  scale?: number;
  visible: boolean;
  symbol?: string;
  color?: string;
  customImage?: string; // Base64 data URL for SVG / JPG / PNG custom symbol
  customImageType?: 'svg' | 'jpg' | 'png' | 'other';
  createdAt: number;
  /** Camera view in which this anchor point was placed during registration setup. */
  anchorViewId?: string;
}

export type BoundaryPoint = [number, number]; // [x, y] in reference frame

export interface BoundaryConfig {
  name: string;
  color: string;
  thickness: number; // px line width (1 to 12)
  closed?: boolean;
  fillOpacity?: number; // 0 to 0.4
}

export interface ExerciseBoundary {
  id: string;
  name: string;
  points: BoundaryPoint[];
  color: string;
  thickness: number;
  visible: boolean;
  isClosed: boolean;
  fillOpacity?: number;
}

export type RegistrationQuality = 'GOOD' | 'DEGRADED' | 'LOST' | 'UNINITIALIZED';

export interface RegistrationMetrics {
  quality: RegistrationQuality;
  inliers: number;
  totalMatches: number;
  candidateKeypointsRef: number;
  candidateKeypointsCur: number;
  reprojectionError: number;
  homography: number[] | null; // 9 elements (3x3 row-major)
  fps: number;
  processingTimeMs: number;
  scaleEstimate: number;
  rotationEstimateDeg: number;
  translationEstimate: [number, number];
}

export type VideoSourceType = 'simulator' | 'rear_camera' | 'webcam' | 'rtsp';

export interface CameraConfig {
  sourceType: VideoSourceType;
  facingMode?: 'environment' | 'user';
  deviceId?: string;
  rtspUrl: string;
  resolution: [number, number];
  fps: number;
  bufferSize: number;
  reconnectIntervalSec: number;
  torchEnabled?: boolean;
}

export interface RegistrationSettings {
  enabled: boolean;
  maxFeatures: number;
  fastThreshold?: number; // Lower values detect more FAST corners
  matchRatioThreshold: number; // Lowe's ratio e.g. 0.70-0.85
  ransacThresholdPx: number; // Reprojection distance e.g. 2.0-8.0 px
  minInliers: number; // Inliers threshold for GOOD state e.g. 6-25
  ransacIterations?: number; // RANSAC trials e.g. 80-350
  lostFrameToleranceFrames?: number; // Brief weak-match grace before LOST
  smoothingFactor?: number; // Temporal filter alpha (0.1 = heavy filter/stable, 0.9 = high responsive)
  leastSquaresRefine?: boolean; // Refine homography over all inliers
  adaptiveReference: boolean;
  updateIntervalMs: number;
}

export interface OverlaySettings {
  symbolScale: number;
  textSize: number;
  opacity: number;
  boundaryThickness: number;
  showAllLayers?: boolean; // Master switch: when false, suppresses all AR tactical overlays at once
  showLabels: boolean;
  showSymbols: boolean;
  showBoundary: boolean;
  showTrackingFeatures: boolean;
  showMatchVectors: boolean;
  showHUD: boolean;
  flirThermalMode: boolean;
}

export interface ScenarioData {
  version: number;
  scenario_name: string;
  description?: string;
  created_at: string;
  camera: {
    rtsp_url: string;
    resolution: [number, number];
  };
  features: Array<{
    id: string;
    type: FeatureType;
    x: number;
    y: number;
    label: string;
    rotation?: number;
    scale?: number;
    color?: string;
    customImage?: string;
    customImageType?: 'svg' | 'jpg' | 'png' | 'other';
    anchorViewId?: string;
  }>;
  boundary?: BoundaryPoint[];
  boundary_config?: BoundaryConfig;
  boundaries?: ExerciseBoundary[];
  registration: {
    method: string;
    match_threshold: number;
    min_inliers: number;
  };
  reference_image?: string; // base64 data URL
  reference_views?: Array<{ id: string; image: string }>;
}
