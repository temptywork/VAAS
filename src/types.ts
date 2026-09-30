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
  x: number; // Normalized source-image X in the anchor's saved view
  y: number; // Normalized source-image Y in the anchor's saved view
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

export type BoundaryPoint = [number, number]; // Normalized source-image [x, y]

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
  anchorViewId?: string;
}

export type RegistrationQuality = 'GOOD' | 'DEGRADED' | 'LOST' | 'UNINITIALIZED';

export interface RegistrationMetrics {
  mode?: 'visual' | 'ptz' | 'ptz+visual' | 'uncertain' | 'simulator';
  poseAgeMs?: number;
  frameWidth?: number;
  frameHeight?: number;
  trackingHint?: string;
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

export interface CameraPtzPose {
  pan: number;
  tilt: number;
  zoom: number;
  panTiltSpace?: string;
  zoomSpace?: string;
  moving?: boolean;
  deviceTime?: string;
  roll?: number; // Optional image roll in radians, supplied by a pose adapter
}

export interface PtzCapabilities {
  configurationToken?: string;
  panTiltSpace?: string;
  zoomSpace?: string;
  panRange?: [number, number];
  tiltRange?: [number, number];
  zoomRange?: [number, number];
  nodeToken?: string;
  continuousPanTiltSpace?: string;
  continuousZoomSpace?: string;
  continuousPanRange?: [number, number];
  continuousTiltRange?: [number, number];
  continuousZoomRange?: [number, number];
  homeSupported?: boolean;
}

/** Calibration uses camera-to-world yaw/pitch and square pixels. Focal length is in image widths. */
export interface PtzCalibration {
  version: 1;
  cameraKey: string;
  panRadiansPerUnit: number;
  tiltRadiansPerUnit: number;
  tiltOffsetRadians: number;
  panPeriod: number;
  principalX: number;
  principalY: number;
  radialK1: number;
  zoomPoints: Array<{ zoom: number; focal: number }>;
  aspect: number;
  rmsErrorPx: number;
  validated: boolean;
  videoDelayMs: number;
  useCaptureTime: boolean;
  videoDelayByTransport?: Partial<Record<'webrtc' | 'hls', number>>;
  imageRotationDegrees?: 0 | 90 | 180 | 270;
  /** Optional camera-specific image flip rule in reported tilt units. */
  autoFlip?: { tiltThreshold: number; above: boolean };
  updatedAt: string;
}

export interface ReferenceView {
  id: string;
  image: string;
  width?: number;
  height?: number;
  ptzPose?: CameraPtzPose;
  cameraKey?: string;
  capturedAt?: number;
  simulatorPose?: { panX: number; tiltY: number; zoom: number; jitter: number; time: number; flirThermal: boolean; autoPatrol: boolean };
}

export interface OnvifCameraConfig {
  host: string;
  port: number;
  rtspPort: number;
  endpointPath: string;
  username: string;
  password: string;
  profileToken?: string;
  transport?: 'webrtc' | 'hls';
  calibration?: PtzCalibration;
}

export interface OnvifMediaProfile {
  token: string;
  name: string;
  width: number;
  height: number;
  encoding: string;
  frameRate: number;
  bitrate?: number;
  encoderToken?: string;
  crop?: { x: number; y: number; width: number; height: number };
  ptz?: PtzCapabilities;
  h264Profile?: string;
  keyframeInterval?: number;
  pixelAspect?: number;
}

export type VideoSourceType = 'simulator' | 'rear_camera' | 'webcam' | 'rtsp' | 'onvif';

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
  processingLongEdge?: number;
  ptzResidualLimitPx?: number;
  poseMaxAgeMs?: number;
  visualSearchViews?: number;
  descriptorIntervalFrames?: number;
  residualHoldMs?: number;
  residualDecayMs?: number;
  transformMaxAgeMs?: number;
  maxAutoKeyframes?: number;
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
  coordinate_space?: 'normalized-source';
  anchor_dimensions?: [number, number];
  version: number;
  scenario_name: string;
  description?: string;
  created_at: string;
  camera: {
    rtsp_url: string;
    resolution: [number, number];
    source_type?: VideoSourceType;
    device_id?: string;
    camera_key?: string;
    profile_token?: string;
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
  reference_views?: ReferenceView[];
}
