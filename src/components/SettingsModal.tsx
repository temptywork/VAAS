import React, { useState } from 'react';
import { CameraCalibration, CameraConfig, OverlaySettings, PtzTolerances, RegistrationSettings, VideoSourceType } from '../types';
import { DEFAULT_CAMERA_CALIBRATIONS } from '../data/cameraCalibrations';
import {
  Settings,
  ShieldAlert,
  Camera,
  Activity,
  Layers,
  Eye,
  EyeOff,
  Info,
  Check,
  Smartphone,
  RotateCw,
  Zap,
  Compass,
  Sliders,
  Target,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraConfig: CameraConfig;
  onUpdateCameraConfig: (config: CameraConfig) => void;
  regSettings: RegistrationSettings;
  onUpdateRegSettings: (settings: RegistrationSettings) => void;
  overlaySettings: OverlaySettings;
  onUpdateOverlaySettings: (settings: OverlaySettings) => void;
  onSetCurrentAsReference: () => void;
  sourceType?: VideoSourceType;
  onChangeSourceType?: (type: VideoSourceType) => void;
  cameraFacingMode?: 'environment' | 'user';
  onChangeFacingMode?: (mode: 'environment' | 'user') => void;
  availableCameras?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string | null;
  onSelectCameraDevice?: (id: string) => void;
  isTorchOn?: boolean;
  hasTorchSupport?: boolean;
  onToggleTorch?: () => void;
  cameraCalibration?: CameraCalibration;
  onUpdateCameraCalibration?: (calib: CameraCalibration) => void;
  ptzTolerances?: PtzTolerances;
  onUpdatePtzTolerances?: (tol: PtzTolerances) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  cameraConfig,
  onUpdateCameraConfig,
  regSettings,
  onUpdateRegSettings,
  overlaySettings,
  onUpdateOverlaySettings,
  onSetCurrentAsReference,
  sourceType = 'simulator',
  onChangeSourceType,
  cameraFacingMode = 'environment',
  onChangeFacingMode,
  availableCameras = [],
  selectedCameraDeviceId,
  onSelectCameraDevice,
  isTorchOn = false,
  hasTorchSupport = false,
  onToggleTorch,
  cameraCalibration = DEFAULT_CAMERA_CALIBRATIONS[0],
  onUpdateCameraCalibration,
  ptzTolerances = {
    panToleranceDeg: 3.5,
    tiltToleranceDeg: 2.0,
    zoomTolerance: 1.5,
    visualThreshold: 8,
    telemetryTimeoutMs: 2500,
  },
  onUpdatePtzTolerances,
}) => {
  const [activeSection, setActiveSection] = useState<'reg' | 'calib' | 'tolerances' | 'overlay' | 'camera' | 'limitations'>('reg');

  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-slate-200"
    >
      <div
        id="settings-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              System Settings &amp; Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-[11px] overflow-x-auto">
          <button
            onClick={() => setActiveSection('reg')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'reg'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Registration</span>
          </button>
          <button
            onClick={() => setActiveSection('calib')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'calib'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Calibration</span>
          </button>
          <button
            onClick={() => setActiveSection('tolerances')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'tolerances'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Tolerances</span>
          </button>
          <button
            onClick={() => setActiveSection('overlay')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'overlay'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Overlays</span>
          </button>
          <button
            onClick={() => setActiveSection('camera')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'camera'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>RTSP Cam</span>
          </button>
          <button
            onClick={() => setActiveSection('limitations')}
            className={`flex-1 min-w-[95px] py-2 px-2 flex items-center justify-center gap-1 font-mono border-b-2 transition ${
              activeSection === 'limitations'
                ? 'border-amber-500 text-amber-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Limitations</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Visual Registration Settings (PRD Section 30) */}
          {activeSection === 'reg' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200 text-xs">
                    Enable Visual Registration Engine
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Oriented ORB + Hartley DLT + MSAC + Huber IRLS Homography
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={regSettings.enabled}
                  onChange={(e) =>
                    onUpdateRegSettings({
                      ...regSettings,
                      enabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-sky-500 rounded"
                />
              </div>

              {/* User-Selectable Geometric Motion Model */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">
                    Geometric Motion Model (Solver DOF)
                  </span>
                  <span className="font-mono text-[10px] text-sky-400 tabular-nums">
                    {regSettings.motionModel || 'HYBRID'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                  {(
                    [
                      {
                        id: 'HYBRID',
                        label: 'Hybrid Adaptive',
                        sub: 'Auto 4/6/8-DOF promotion',
                      },
                      {
                        id: 'PROJECTIVE_8DOF',
                        label: '8-DOF Projective',
                        sub: 'Hartley DLT + 3D perspective',
                      },
                      {
                        id: 'AFFINE_6DOF',
                        label: '6-DOF Affine',
                        sub: 'Shear & tilt without warp',
                      },
                      {
                        id: 'SIMILARITY_4DOF',
                        label: '4-DOF Similarity',
                        sub: 'Rigid Pan / Zoom / Roll',
                      },
                    ] as const
                  ).map((mode) => {
                    const isSelected = (regSettings.motionModel || 'HYBRID') === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          onUpdateRegSettings({
                            ...regSettings,
                            motionModel: mode.id,
                          })
                        }
                        className={`text-left px-2.5 py-2 rounded-md transition border ${
                          isSelected
                            ? 'bg-sky-950/70 border-sky-500/60 text-sky-200 shadow-sm'
                            : 'bg-slate-950/40 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        <div className="font-mono font-semibold text-[11px] whitespace-nowrap">
                          {mode.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {mode.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">Feature Count (Max Features)</span>
                    <span className="text-sky-400 font-bold">{regSettings.maxFeatures}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    step="20"
                    value={regSettings.maxFeatures}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        maxFeatures: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Controls number of FAST/ORB keypoints extracted across 16×12 spatial bins.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">Lowe's Ratio Test Threshold</span>
                    <span className="text-sky-400 font-bold">
                      {regSettings.matchRatioThreshold.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.60"
                    max="0.85"
                    step="0.02"
                    value={regSettings.matchRatioThreshold}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        matchRatioThreshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Ratio test distance(best) &lt; ratio × distance(second_best) + circular orientation filter.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">MSAC / RANSAC Reprojection Threshold</span>
                    <span className="text-sky-400 font-bold">
                      {regSettings.ransacThresholdPx.toFixed(1)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="8.0"
                    step="0.5"
                    value={regSettings.ransacThresholdPx}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        ransacThresholdPx: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">Minimum Inlier Requirement</span>
                    <span className="text-sky-400 font-bold">{regSettings.minInliers} inliers</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="25"
                    step="1"
                    value={regSettings.minInliers}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        minInliers: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Threshold for GOOD registration state (PRD recommends ≥ 8, higher = stricter lock).
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">MSAC Iteration Trials</span>
                    <span className="text-emerald-400 font-bold">{regSettings.ransacIterations ?? 160} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="320"
                    step="20"
                    value={regSettings.ransacIterations ?? 160}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        ransacIterations: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-400">Temporal Smoothing Responsiveness (α)</span>
                    <span className="text-emerald-400 font-bold">{((regSettings.smoothingFactor ?? 0.65) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.95"
                    step="0.05"
                    value={regSettings.smoothingFactor ?? 0.65}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        smoothingFactor: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Base responsiveness gain for the adaptive 4-corner velocity stabilizer.
                  </span>
                </div>

                {/* Algorithmic Pipeline Toggles */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                  <label className="flex items-center justify-between text-[11px] cursor-pointer">
                    <div>
                      <span className="text-slate-200 font-medium block">
                        Hartley-Normalized DLT + Huber IRLS Refinement
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Centers &amp; scales coordinates to √2 and runs 3-step Huber IRLS over all consensus inliers.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regSettings.leastSquaresRefine !== false}
                      onChange={(e) =>
                        onUpdateRegSettings({
                          ...regSettings,
                          leastSquaresRefine: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between text-[11px] cursor-pointer">
                    <div>
                      <span className="text-slate-200 font-medium block">
                        Oriented ORB Descriptors (Rotation Invariance)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Steers 128-bit BRIEF sampling by patch intensity centroid angle θ = atan2(m01, m10).
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regSettings.orientedOrbDescriptors !== false}
                      onChange={(e) =>
                        onUpdateRegSettings({
                          ...regSettings,
                          orientedOrbDescriptors: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between text-[11px] cursor-pointer">
                    <div>
                      <span className="text-slate-200 font-medium block">
                        Automatic Keyframe Chaining (Wide Camera Panning)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Spawns intermediate keyframes during wide pans and relocks to root reference on return.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regSettings.enableKeyframeChaining !== false}
                      onChange={(e) =>
                        onUpdateRegSettings({
                          ...regSettings,
                          enableKeyframeChaining: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between text-[11px] cursor-pointer">
                    <div>
                      <span className="text-slate-200 font-medium block">
                        Adaptive 4-Corner Velocity Stabilization
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Filters canonical viewport corners in screen space with deadband damping to stop stationary jitter.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regSettings.adaptiveCornerFiltering !== false}
                      onChange={(e) =>
                        onUpdateRegSettings({
                          ...regSettings,
                          adaptiveCornerFiltering: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">Re-Anchor Root Reference Frame</div>
                  <div className="text-[10px] text-slate-400">
                    Clears keyframe chain and captures current camera view as new root anchor (F₀)
                  </div>
                </div>
                <button
                  onClick={() => {
                    onSetCurrentAsReference();
                    onClose();
                  }}
                  className="bg-sky-700 hover:bg-sky-600 text-white font-medium px-3 py-1.5 rounded transition whitespace-nowrap"
                >
                  Re-Anchor Now
                </button>
              </div>
            </div>
          )}

          {/* Camera Calibration Profile (PRD Section 9, 13, 38) */}
          {activeSection === 'calib' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 text-xs">
                    Camera Calibration Profile (CP PLUS / Speed Dome)
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-mono border border-sky-500/40">
                    PRD SEC-13
                  </span>
                </div>
                <select
                  value={cameraCalibration?.calibrationId}
                  onChange={(e) => {
                    const found = DEFAULT_CAMERA_CALIBRATIONS.find((c) => c.calibrationId === e.target.value);
                    if (found && onUpdateCameraCalibration) onUpdateCameraCalibration(found);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                >
                  {DEFAULT_CAMERA_CALIBRATIONS.map((c) => (
                    <option key={c.calibrationId} value={c.calibrationId}>
                      {c.cameraModel} ({c.calibrationId})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 font-mono">
                  {cameraCalibration?.notes || 'Versioned optical calibration profile.'}
                </div>
              </div>

              {/* Physical Offsets & Mounting */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-3 font-mono">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Physical Offsets &amp; Geometry
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Pan Zero Offset (deg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cameraCalibration?.panZeroOffsetDeg ?? 0}
                      onChange={(e) =>
                        onUpdateCameraCalibration &&
                        onUpdateCameraCalibration({
                          ...cameraCalibration,
                          panZeroOffsetDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Tilt Zero Offset (deg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cameraCalibration?.tiltZeroOffsetDeg ?? 0}
                      onChange={(e) =>
                        onUpdateCameraCalibration &&
                        onUpdateCameraCalibration({
                          ...cameraCalibration,
                          tiltZeroOffsetDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Mounting Height (meters)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={cameraCalibration?.mountingHeightMeters ?? 14.5}
                      onChange={(e) =>
                        onUpdateCameraCalibration &&
                        onUpdateCameraCalibration({
                          ...cameraCalibration,
                          mountingHeightMeters: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Roll Correction (deg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cameraCalibration?.rollOffsetDeg ?? 0}
                      onChange={(e) =>
                        onUpdateCameraCalibration &&
                        onUpdateCameraCalibration({
                          ...cameraCalibration,
                          rollOffsetDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Geographic Anchor when available */}
                {cameraCalibration?.cameraGeo && (
                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
                    <span className="text-slate-300 font-semibold block">Geographic Mast Coordinates:</span>
                    <div>Lat: {cameraCalibration.cameraGeo.lat.toFixed(5)}° • Lng: {cameraCalibration.cameraGeo.lng.toFixed(5)}°</div>
                    <div>Elevation: {cameraCalibration.cameraGeo.altMeters}m MSL • Boresight Heading: {cameraCalibration.cameraGeo.headingDeg}°</div>
                  </div>
                )}
              </div>

              {/* Optical Zoom-to-FOV Lookup Table */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Optical Zoom-to-FOV Calibration Table
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center bg-slate-900/80 p-1.5 rounded border border-slate-800">
                  <span className="font-bold text-slate-400">Zoom</span>
                  <span className="font-bold text-sky-400">FOV H</span>
                  <span className="font-bold text-amber-400">FOV V</span>
                  <span className="font-bold text-slate-400">Type</span>
                  {cameraCalibration?.zoomFovTable?.slice(0, 5).map((row, i) => (
                    <React.Fragment key={i}>
                      <span className="text-slate-200">{row.zoom.toFixed(1)}x</span>
                      <span className="text-sky-300">{row.fovH.toFixed(1)}°</span>
                      <span className="text-amber-300">{row.fovV.toFixed(1)}°</span>
                      <span className="text-slate-500">Optical</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PTZ Revisit & Tolerances Settings (PRD Section 26 & 27) */}
          {activeSection === 'tolerances' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 text-xs">
                    PTZ Revisit &amp; Angle Tolerances
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                    PRD SEC-27
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Defines the spherical angular envelope for detecting when the camera has returned near a stored exercise tag to trigger CV visual refinement.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Pan Angle Tolerance</span>
                      <span className="text-sky-400 font-bold">±{ptzTolerances.panToleranceDeg.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.5"
                      value={ptzTolerances.panToleranceDeg}
                      onChange={(e) =>
                        onUpdatePtzTolerances &&
                        onUpdatePtzTolerances({
                          ...ptzTolerances,
                          panToleranceDeg: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Tilt Angle Tolerance</span>
                      <span className="text-amber-400 font-bold">±{ptzTolerances.tiltToleranceDeg.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="6.0"
                      step="0.5"
                      value={ptzTolerances.tiltToleranceDeg}
                      onChange={(e) =>
                        onUpdatePtzTolerances &&
                        onUpdatePtzTolerances({
                          ...ptzTolerances,
                          tiltToleranceDeg: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Zoom Factor Tolerance</span>
                      <span className="text-emerald-400 font-bold">±{ptzTolerances.zoomTolerance.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="4.0"
                      step="0.25"
                      value={ptzTolerances.zoomTolerance}
                      onChange={(e) =>
                        onUpdatePtzTolerances &&
                        onUpdatePtzTolerances({
                          ...ptzTolerances,
                          zoomTolerance: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Telemetry Stale Timeout</span>
                      <span className="text-slate-200 font-bold">{ptzTolerances.telemetryTimeoutMs}ms</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="250"
                      value={ptzTolerances.telemetryTimeoutMs}
                      onChange={(e) =>
                        onUpdatePtzTolerances &&
                        onUpdatePtzTolerances({
                          ...ptzTolerances,
                          telemetryTimeoutMs: parseInt(e.target.value),
                        })
                      }
                      className="w-full accent-slate-400 h-1.5 bg-slate-800 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Overlay Rendering Settings (PRD Section 30) */}
          {activeSection === 'overlay' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Symbol Scale</span>
                    <span className="text-sky-400 font-bold">
                      {overlaySettings.symbolScale.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="2.0"
                    step="0.1"
                    value={overlaySettings.symbolScale}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        symbolScale: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Text Label Size</span>
                    <span className="text-sky-400 font-bold">
                      {overlaySettings.textSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="9"
                    max="18"
                    step="1"
                    value={overlaySettings.textSize}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        textSize: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400">Boundary Line Thickness</span>
                  <span className="text-sky-400 font-bold">
                    {overlaySettings.boundaryThickness}px
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={overlaySettings.boundaryThickness}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      boundaryThickness: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              {/* Master Toggle */}
              <div className="bg-slate-950/80 border border-slate-700/80 rounded-lg p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    {overlaySettings.showAllLayers !== false ? (
                      <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-slate-100 font-semibold text-xs flex items-center gap-2">
                        <span>All Layers Visibility (Master Switch)</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            overlaySettings.showAllLayers !== false
                              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                              : 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                          }`}
                        >
                          {overlaySettings.showAllLayers !== false ? 'VISIBLE' : 'HIDDEN'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Instantly hide or unhide all tactical AR overlay graphics, symbols, and boundaries.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showAllLayers !== false}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showAllLayers: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-sky-500 rounded ml-3"
                  />
                </label>
              </div>

              {/* Persistent Simulation Watermark (PRD Section 36) */}
              <div className="bg-slate-950/80 border border-slate-700/80 rounded-lg p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-slate-100 font-semibold text-xs flex items-center gap-2">
                      <span>Persistent Simulation Watermark</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-950/80 border border-amber-500/40 text-amber-300">
                        PRD SEC-36
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Displays explicit "SIMULATED / EXERCISE USE ONLY • NOT VERIFIED TARGETS" warning watermark banner across video viewport.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showWatermark !== false}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showWatermark: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-amber-500 rounded ml-3"
                  />
                </label>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 cursor-pointer">
                  <span className="text-slate-300">Show Military Text Labels</span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showLabels}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showLabels: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 cursor-pointer">
                  <span className="text-slate-300">Show Simulated Exercise Boundary</span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showBoundary}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showBoundary: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 cursor-pointer">
                  <span className="text-slate-300">Show CV Tracking Keypoints (Cyan)</span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showTrackingFeatures}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showTrackingFeatures: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 cursor-pointer">
                  <span className="text-slate-300">Show Inlier Match Vectors (Yellow)</span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showMatchVectors}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showMatchVectors: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 cursor-pointer">
                  <span className="text-slate-300">FLIR Thermal IR Palette Mode</span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.flirThermalMode}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        flirThermalMode: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Camera Settings (PRD Section 30 & 31) */}
          {activeSection === 'camera' && (
            <div className="space-y-4">
              {/* Primary Video Feed Selection */}
              <div className="bg-slate-950/70 border border-slate-800 rounded p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    Video Feed Source
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">
                    Active: {sourceType.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeSourceType?.('rear_camera')}
                    className={`flex items-start gap-2.5 p-2.5 rounded border text-left transition ${
                      sourceType === 'rear_camera'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>Mobile Rear Camera</span>
                        <span className="text-[9px] bg-emerald-900/80 text-emerald-300 px-1 rounded font-mono">
                          RECOMMENDED
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Uses mobile device's back camera (environment-facing) for tactical terrain and boundary tracking.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeSourceType?.('webcam')}
                    className={`flex items-start gap-2.5 p-2.5 rounded border text-left transition ${
                      sourceType === 'webcam'
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Camera className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold">Webcam / Front Camera</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Standard webcam or front-facing sensor for operator console / indoor testing.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeSourceType?.('simulator')}
                    className={`flex items-start gap-2.5 p-2.5 rounded border text-left transition ${
                      sourceType === 'simulator'
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold">Exercise Simulator</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Synthetic procedural range environment with Pan-Tilt-Zoom and FLIR thermal simulation.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeSourceType?.('rtsp')}
                    className={`flex items-start gap-2.5 p-2.5 rounded border text-left transition ${
                      sourceType === 'rtsp'
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold">RTSP IP Camera Stream</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Connect to external PTZ camera or drone stream over local RTSP network.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Mobile / Hardware Camera Controls (when mobile rear cam or webcam selected) */}
              {(sourceType === 'rear_camera' || sourceType === 'webcam') && (
                <div className="bg-slate-950/70 border border-slate-800 rounded p-3 space-y-3">
                  <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      Mobile Lens & Hardware Parameters
                    </span>
                    {hasTorchSupport && (
                      <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-amber-400" /> Flashlight Ready
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Facing Mode Selector */}
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                        Lens Orientation
                      </label>
                      <div className="flex rounded border border-slate-800 overflow-hidden bg-slate-900 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeFacingMode?.('environment');
                            onChangeSourceType?.('rear_camera');
                          }}
                          className={`flex-1 py-1 px-2 text-xs font-mono rounded transition flex items-center justify-center gap-1 ${
                            sourceType === 'rear_camera' || cameraFacingMode === 'environment'
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          Rear Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onChangeFacingMode?.('user');
                            onChangeSourceType?.('webcam');
                          }}
                          className={`flex-1 py-1 px-2 text-xs font-mono rounded transition flex items-center justify-center gap-1 ${
                            sourceType === 'webcam' && cameraFacingMode === 'user'
                              ? 'bg-sky-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Camera className="w-3 h-3" />
                          Front / Selfie
                        </button>
                      </div>
                    </div>

                    {/* Physical Device / Sensor Picker */}
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                        Camera Sensor Device
                      </label>
                      <select
                        value={selectedCameraDeviceId || ''}
                        onChange={(e) => onSelectCameraDevice?.(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value="">Default System Lens</option>
                        {availableCameras.map((cam, idx) => (
                          <option key={cam.deviceId || idx} value={cam.deviceId}>
                            {cam.label || `Camera Sensor ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Resolution and Torch Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                        Capture Stream Resolution
                      </label>
                      <select
                        value={`${cameraConfig.resolution[0]}x${cameraConfig.resolution[1]}`}
                        onChange={(e) => {
                          const [w, h] = e.target.value.split('x').map(Number);
                          onUpdateCameraConfig({ ...cameraConfig, resolution: [w, h] });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value="1920x1080">1080p Full HD (1920 x 1080) [Default]</option>
                        <option value="1280x720">720p HD (1280 x 720) [High FPS]</option>
                        <option value="3840x2160">4K Ultra HD (3840 x 2160) [High Precision]</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                        Tactical Torch / Flashlight
                      </label>
                      {hasTorchSupport && onToggleTorch ? (
                        <button
                          type="button"
                          onClick={onToggleTorch}
                          className={`w-full py-1.5 px-3 rounded border text-xs font-mono flex items-center justify-center gap-1.5 transition ${
                            isTorchOn
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTorchOn ? 'fill-current' : 'text-amber-400'}`} />
                          <span>{isTorchOn ? 'Mobile Torch: ACTIVE' : 'Enable Mobile Torch'}</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-500 font-mono py-1.5 px-2 bg-slate-900/50 rounded border border-slate-800">
                          Torch available when mobile rear camera is active
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* RTSP Stream Settings */}
              <div className="bg-slate-950/70 border border-slate-800 rounded p-3 space-y-3">
                <div className="text-xs font-semibold text-slate-200">RTSP IP Camera Parameters</div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    RTSP Stream URL
                  </label>
                  <input
                    type="text"
                    value={cameraConfig.rtspUrl}
                    onChange={(e) =>
                      onUpdateCameraConfig({ ...cameraConfig, rtspUrl: e.target.value })
                    }
                    placeholder="rtsp://admin:pass@192.168.1.100:554/stream"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Reconnect Interval (sec)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={cameraConfig.reconnectIntervalSec}
                      onChange={(e) =>
                        onUpdateCameraConfig({
                          ...cameraConfig,
                          reconnectIntervalSec: parseInt(e.target.value) || 5,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Buffer Size (frames)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={cameraConfig.bufferSize}
                      onChange={(e) =>
                        onUpdateCameraConfig({
                          ...cameraConfig,
                          bufferSize: parseInt(e.target.value) || 2,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Technical Limitations (PRD Section 46 & 19) */}
          {activeSection === 'limitations' && (
            <div className="space-y-3">
              <div className="bg-amber-950/50 border border-amber-500/40 rounded-lg p-3 text-amber-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Mandatory Technical Limitations (PRD Section 46)</span>
                </div>
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  The application operates strictly as an exercise visualization tool without requiring GPS/INS equipment. Operators must be aware of the following technical boundaries:
                </p>
              </div>

              <div className="space-y-2 text-[11px] text-slate-300">
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <strong className="text-sky-400 block">1. No Geographic Awareness:</strong>
                  The system does not know the camera's true latitude or longitude. Coordinates are pixel-based reference scene positions.
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <strong className="text-sky-400 block">2. No Absolute Heading:</strong>
                  The system does not detect true north. Directional symbols reflect operator exercise orientation.
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <strong className="text-sky-400 block">3. Homography &amp; Parallax Limitation (Sec 19):</strong>
                  A single 3x3 homography matrix assumes a predominantly planar scene. For large depth variation (near vs far objects), near objects move faster than far objects. System performs best with moderate pan, tilt, and zoom.
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <strong className="text-sky-400 block">4. Featureless Terrain:</strong>
                  Registration requires stable visual contrast. Low-texture terrain or complete occlusion causes "REGISTRATION: LOST" state, freezing overlays safely until recovery or manual re-reference.
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <strong className="text-sky-400 block">5. Simulated Boundary Notice (Sec 38):</strong>
                  Boundaries drawn by operators are strictly designated as "SIMULATED / EXERCISE BOUNDARY" and are not verified international borders.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 px-4 py-3 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-1.5 rounded transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
