export type FeatureType = 
  | 'tank'
  | 'bunker'
  | 'gun'
  | 'comm'
  | 'personnel'
  | 'vehicle'
  | 'observation_post'
  | 'headquarters'
  | 'generic_marker'
  | 'text_label'
  | 'custom';

export interface FeatureDefinition {
  type: FeatureType;
  name: string;
  symbol: string;
  shape: 'diamond' | 'square' | 'cross' | 'comm' | 'circle' | 'rectangle' | 'triangle' | 'star' | 'marker' | 'text' | 'custom';
  defaultLabel: string;
  description: string;
  color: string;
}

export interface PtzAnchor {
  panDeg: number;       // Absolute world azimuth angle in degrees [-180, +180]
  tiltDeg: number;      // Absolute world elevation angle in degrees [-90, +90]
  placedAtPan: number;  // Camera pan when created (deg)
  placedAtTilt: number; // Camera tilt when created (deg)
  placedAtZoom: number; // Camera zoom factor when created
  placedAtFovH: number; // Camera horizontal FOV in degrees
  distanceMeters?: number; // Estimated tactical distance
}

export interface ExerciseFeature {
  id: string;
  type: FeatureType;
  x: number; // Reference frame coordinate X (pixel_x)
  y: number; // Reference frame coordinate Y (pixel_y)
  label: string;
  layer?: 'symbols' | 'labels' | 'boundary' | 'base';
  rotation?: number; // 0-360 deg
  scale?: number;
  opacity?: number; // 0.1 - 1.0
  flipH?: boolean;
  flipV?: boolean;
  locked?: boolean;
  visible: boolean;
  symbol?: string;
  color?: string;
  customImage?: string; // Base64 data URL for SVG / JPG / PNG custom symbol
  customImageType?: 'svg' | 'jpg' | 'png' | 'other';
  createdAt: number;
  timestampStr?: string; // Formatted HH:mm:ss.SSS video/telemetry timestamp
  ptzAnchor?: PtzAnchor;
  calibrationId?: string;
  confidence?: 'GOOD' | 'DEGRADED' | 'LOST';
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
  ptzAnchors?: PtzAnchor[];
}

export type RegistrationQuality = 'GOOD' | 'DEGRADED' | 'LOST' | 'UNINITIALIZED';

export type RegistrationMode = 'RTSP' | 'PTZ' | 'PTZ_CALIBRATION' | 'PTZ_HYBRID' | 'PTZ_GEO';

export type HomographyMotionModel =
  | 'HYBRID'
  | 'PROJECTIVE_8DOF'
  | 'AFFINE_6DOF'
  | 'SIMILARITY_4DOF';

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
  activeMotionModel?: HomographyMotionModel;
  keyframeCount?: number;
  cornerVelocityPx?: number;
}

export type VideoSourceType = 'simulator' | 'rear_camera' | 'webcam' | 'rtsp' | 'onvif_ffmpeg';

export interface PtzCoordinates {
  pan: number;   // Azimuth angle in degrees [-180, 180]
  tilt: number;  // Elevation angle in degrees [-90, 90]
  zoom: number;  // Magnification factor [0.6, 30.0]
}

export interface OnvifConfig {
  enabled: boolean;
  host: string;
  port: number;
  rtspPort: number;
  username: string;
  password?: string;
  profileToken?: string;
  useTls: boolean;
  authMode: 'digest' | 'ws_security' | 'none';
  cameraName?: string;
}

export interface OnvifPreset {
  token: string;
  name: string;
  pan: number;
  tilt: number;
  zoom: number;
  thumbnail?: string;
  createdAt?: number;
}

export interface OnvifStatus {
  connected: boolean;
  isVirtual: boolean;
  deviceInfo?: {
    manufacturer: string;
    model: string;
    firmwareVersion: string;
    serialNumber: string;
    hardwareId?: string;
  };
  ptzStatus: {
    pan: number;   // Current Pan in degrees
    tilt: number;  // Current Tilt in degrees
    zoom: number;  // Current Zoom factor
    moveStatus: 'IDLE' | 'MOVING' | 'HOMING' | 'PRESET_SLEW';
    utcTime: string;
  };
  lastSoapCommand?: string;
  lastSoapResponse?: string;
  error?: string | null;
}

export interface ZoomFovPoint {
  zoom: number;
  fovH: number;
  fovV: number;
}

export interface CameraCalibration {
  calibrationId: string;
  cameraModel: string;
  panZeroOffsetDeg: number;
  tiltZeroOffsetDeg: number;
  rollOffsetDeg: number;
  mountingHeightMeters: number;
  zoomFovTable: ZoomFovPoint[];
  cameraGeo?: {
    lat: number;
    lng: number;
    altMeters: number;
    headingDeg: number;
  };
  notes?: string;
}

export interface PtzTolerances {
  panToleranceDeg: number;     // Acceptable pan difference (e.g. ±3.5°)
  tiltToleranceDeg: number;    // Acceptable tilt difference (e.g. ±2.0°)
  zoomTolerance: number;       // Acceptable zoom difference (e.g. ±1.5x)
  visualThreshold: number;     // Minimum visual confidence / inliers
  telemetryTimeoutMs: number;  // Maximum age of PTZ state in ms
}

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export interface SystemLayers {
  baseVideo: LayerState & { contrast?: number; brightness?: number };
  boundary: LayerState;
  symbols: LayerState;
  labels: LayerState;
  status: LayerState;
}

export interface FfmpegStreamConfig {
  enabled: boolean;
  sourceType: 'rtsp' | 'testsrc' | 'synthetic_tactical';
  rtspUrl: string;
  resolution: '1920x1080' | '1280x720' | '854x480';
  fps: number;
  videoCodec: 'mjpeg' | 'h264' | 'copy';
  transport: 'tcp' | 'udp';
  preset: 'ultrafast' | 'veryfast' | 'medium';
  bitrate: string;
}

export interface FfmpegStatus {
  available: boolean;
  active: boolean;
  pid?: number;
  version?: string;
  streamUrl?: string;
  uptimeSec: number;
  fps: number;
  bitrate: string;
  framesProcessed: number;
  droppedFrames: number;
  logs: string[];
  error?: string | null;
}

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
  onvif?: OnvifConfig;
  ffmpeg?: FfmpegStreamConfig;
}

export interface RegistrationSettings {
  enabled: boolean;
  maxFeatures: number;
  matchRatioThreshold: number; // Lowe's ratio e.g. 0.70-0.85
  ransacThresholdPx: number; // Reprojection distance e.g. 2.0-8.0 px
  minInliers: number; // Inliers threshold for GOOD state e.g. 6-25
  ransacIterations?: number; // RANSAC trials e.g. 80-350
  smoothingFactor?: number; // Temporal filter alpha (0.1 = heavy filter/stable, 0.9 = high responsive)
  leastSquaresRefine?: boolean; // Refine homography over all inliers
  adaptiveReference: boolean;
  updateIntervalMs: number;
  usePtzAssistance?: boolean;
  registrationMode?: RegistrationMode;
  motionModel?: HomographyMotionModel;
  enableKeyframeChaining?: boolean;
  adaptiveCornerFiltering?: boolean;
  orientedOrbDescriptors?: boolean;
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
  showOffscreenPtzIndicators?: boolean;
  showPtzCompassOverlay?: boolean;
  showWatermark?: boolean; // Persistent "SIMULATED / EXERCISE USE ONLY" watermark
}

export interface ScenarioFeatureItem {
  id: string;
  type: FeatureType;
  x?: number;
  y?: number;
  pixel_x?: number;
  pixel_y?: number;
  pan?: number;
  tilt?: number;
  zoom?: number;
  label: string;
  layer?: string;
  rotation?: number;
  scale?: number;
  opacity?: number;
  flipH?: boolean;
  flipV?: boolean;
  locked?: boolean;
  color?: string;
  asset?: string;
  customImage?: string;
  customImageType?: 'svg' | 'jpg' | 'png' | 'other';
  ptzAnchor?: PtzAnchor;
}

export interface ScenarioData {
  version: string | number; // "2.0"
  scenario_name: string;
  description?: string;
  created_at: string;
  camera: {
    rtsp_url: string;
    onvif_enabled?: boolean;
    profile_token?: string;
    calibration_id?: string;
    resolution: [number, number];
    ptz?: PtzCoordinates;
  };
  features: ScenarioFeatureItem[];
  boundary?: BoundaryPoint[];
  boundary_config?: BoundaryConfig;
  boundaries?: ExerciseBoundary[];
  registration: {
    mode: string; // e.g. "PTZ_HYBRID"
    reference_image?: string; // "reference.jpg"
    match_threshold?: number;
    min_inliers?: number;
  };
  calibration?: CameraCalibration;
  reference_image?: string; // base64 data URL
}
