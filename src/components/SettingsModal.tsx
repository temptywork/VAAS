import React, { useState } from 'react';
import { CameraConfig, OverlaySettings, RegistrationSettings } from '../types';
import {
  Settings,
  ShieldAlert,
  Camera,
  Activity,
  Layers,
  Info,
  Check,
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
                    Controls number of FAST/ORB keypoints extracted across spatial bins.
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
                    Ratio test distance(best) &lt; ratio × distance(second_best). Initial 0.70–0.75.
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
                    max="20"
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
                    Threshold for GOOD registration state (PRD recommends ≥ 8).
                  </span>
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
            <div className="space-y-3.5">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Reconnect Interval (seconds)
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
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded p-3 text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-200 font-semibold mb-1">Camera Stream Integration Note:</div>
                <p>
                  For desktop deployment (PyInstaller/Windows), OpenCV natively captures RTSP via ffmpeg. In this web-based operator console, the simulator and local camera test feeds provide instantaneous testing, and RTSP feeds stream via WebRTC/HLS proxy.
                </p>
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
