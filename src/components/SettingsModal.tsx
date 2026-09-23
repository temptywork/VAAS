import React, { useState } from 'react';
import { CameraConfig, OverlaySettings, RegistrationSettings, VideoSourceType } from '../types';
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
}) => {
  const [activeSection, setActiveSection] = useState<'camera' | 'reg' | 'overlay' | 'limitations'>('reg');

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
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveSection('reg')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-mono border-b-2 transition ${
              activeSection === 'reg'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Registration</span>
          </button>
          <button
            onClick={() => setActiveSection('overlay')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-mono border-b-2 transition ${
              activeSection === 'overlay'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overlays</span>
          </button>
          <button
            onClick={() => setActiveSection('camera')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-mono border-b-2 transition ${
              activeSection === 'camera'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera RTSP</span>
          </button>
          <button
            onClick={() => setActiveSection('limitations')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-mono border-b-2 transition ${
              activeSection === 'limitations'
                ? 'border-amber-500 text-amber-400 bg-slate-900/80 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
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
                    ORB + BFMatcher + RANSAC Homography reprojection
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

              <div className="space-y-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">FAST Corner Sensitivity</span>
                    <span className="text-sky-400 font-bold">{regSettings.fastThreshold ?? 16}</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    step="2"
                    value={regSettings.fastThreshold ?? 16}
                    onChange={(e) => onUpdateRegSettings({
                      ...regSettings,
                      fastThreshold: parseInt(e.target.value),
                    })}
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Lower values find more corners in low-contrast terrain; RANSAC rejects false matches.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
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
                    Controls the maximum number of FAST/BRIEF keypoints sampled across spatial bins.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
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
                    Ratio test distance(best) &lt; ratio × distance(second best). Higher values retain more candidates; RANSAC checks geometry.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">RANSAC Reprojection Distance Threshold</span>
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
                  <div className="flex justify-between text-[11px] font-mono mb-1">
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
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">RANSAC Iteration Trials</span>
                    <span className="text-emerald-400 font-bold">{regSettings.ransacIterations ?? 300} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="320"
                    step="20"
                    value={regSettings.ransacIterations ?? 300}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        ransacIterations: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    More iterations increase probability of discovering maximal inlier consensus under rapid motion or occlusion.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Weak-Frame Recovery Grace</span>
                    <span className="text-emerald-400 font-bold">
                      {regSettings.lostFrameToleranceFrames ?? 12} frames
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="2"
                    value={regSettings.lostFrameToleranceFrames ?? 12}
                    onChange={(e) => onUpdateRegSettings({
                      ...regSettings,
                      lostFrameToleranceFrames: parseInt(e.target.value),
                    })}
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Holds the last trusted pose through brief dropouts (12 frames is about 0.4 s at 30 FPS).
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Temporal Smoothing Responsiveness (α)</span>
                    <span className="text-emerald-400 font-bold">{((regSettings.smoothingFactor ?? 0.5) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.95"
                    step="0.05"
                    value={regSettings.smoothingFactor ?? 0.5}
                    onChange={(e) =>
                      onUpdateRegSettings({
                        ...regSettings,
                        smoothingFactor: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Lower values (30–50%) filter jitter and micro-shakes; higher values (70–90%) give ultra-fast camera reaction.
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <label className="flex items-center justify-between text-[11px] cursor-pointer">
                    <div>
                      <span className="text-slate-300 font-medium block">All-Inlier Least Squares Matrix Refinement</span>
                      <span className="text-[10px] text-slate-500 block">
                        Solves an overdetermined 8x8 normal system over all consensus inliers to eliminate single-quadrilateral warp jitter.
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
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">Re-Reference Engine</div>
                  <div className="text-[10px] text-slate-400">
                    Capture current camera view as the new reference frame (PRD Sec 17)
                  </div>
                </div>
                <button
                  onClick={() => {
                    onSetCurrentAsReference();
                    onClose();
                  }}
                  className="bg-sky-700 hover:bg-sky-600 text-white font-medium px-3 py-1.5 rounded transition"
                >
                  Set Now
                </button>
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
