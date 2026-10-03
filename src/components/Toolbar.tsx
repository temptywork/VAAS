import React, { useState, useEffect } from 'react';
import {
  Camera,
  Play,
  Square,
  PlusCircle,
  PenTool,
  Check,
  RotateCcw,
  Trash,
  Save,
  FolderOpen,
  Anchor,
  Activity,
  Sliders,
  Eye,
  EyeOff,
  Layers,
  Settings,
  Tv,
  Palette,
  ShieldAlert,
  AlertTriangle,
  X,
  RotateCw,
  Zap,
  Smartphone,
  Maximize,
  Radio,
  Target,
  Video,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { RegistrationQuality, BoundaryConfig, VideoSourceType } from '../types';

interface ToolbarProps {
  sourceType: VideoSourceType;
  onChangeSourceType: (type: VideoSourceType) => void;
  cameraFacingMode?: 'environment' | 'user';
  onToggleCameraFacing?: () => void;
  availableCameras?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string | null;
  onSelectCameraDevice?: (id: string) => void;
  isTorchOn?: boolean;
  hasTorchSupport?: boolean;
  onToggleTorch?: () => void;
  rtspUrl: string;
  onChangeRtspUrl: (url: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isDrawingBoundary: boolean;
  activeBoundaryPointsCount?: number;
  onStartBoundary?: () => void;
  onFinishBoundary: () => void;
  onClearLastBoundaryPoint: () => void;
  onCancelBoundary?: () => void;
  onClearAll: () => void;
  boundaryConfig?: BoundaryConfig;
  boundariesCount?: number;
  allLayersVisible?: boolean;
  onToggleAllLayers?: () => void;
  onOpenBoundaryConfig: () => void;
  onOpenAddFeature: () => void;
  onOpenCustomImage?: () => void;
  onOpenCustomSvg?: () => void;
  onOpenLayersDrawer?: () => void;
  onOpenSaveScenario: () => void;
  onOpenLoadScenario: () => void;
  onSetCurrentAsReference: () => void;
  visualRegEnabled: boolean;
  onToggleVisualReg: () => void;
  showDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  showSimControls: boolean;
  onToggleSimControls: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenSettings: () => void;
  registrationQuality: RegistrationQuality;
  hasReference: boolean;
  onOpenOnvifPtz?: () => void;
  onOpenPtzMemory?: () => void;
  onOpenFfmpegHub?: () => void;
  isOnvifOpen?: boolean;
  isPtzMemoryOpen?: boolean;
  ptzPan?: number;
  ptzTilt?: number;
  ptzZoom?: number;
  onvifConnected?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  sourceType,
  onChangeSourceType,
  cameraFacingMode = 'environment',
  onToggleCameraFacing,
  availableCameras = [],
  selectedCameraDeviceId,
  onSelectCameraDevice,
  isTorchOn = false,
  hasTorchSupport = false,
  onToggleTorch,
  rtspUrl,
  onChangeRtspUrl,
  isConnected,
  onConnect,
  onDisconnect,
  isDrawingBoundary,
  activeBoundaryPointsCount = 0,
  onStartBoundary,
  onFinishBoundary,
  onClearLastBoundaryPoint,
  onCancelBoundary,
  onClearAll,
  boundaryConfig,
  boundariesCount,
  allLayersVisible = true,
  onToggleAllLayers,
  onOpenBoundaryConfig,
  onOpenAddFeature,
  onOpenCustomImage,
  onOpenCustomSvg,
  onOpenLayersDrawer,
  onOpenSaveScenario,
  onOpenLoadScenario,
  onSetCurrentAsReference,
  visualRegEnabled,
  onToggleVisualReg,
  showDiagnostics,
  onToggleDiagnostics,
  showSimControls,
  onToggleSimControls,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenSettings,
  registrationQuality,
  hasReference,
  onOpenOnvifPtz,
  onOpenPtzMemory,
  onOpenFfmpegHub,
  isOnvifOpen = false,
  isPtzMemoryOpen = false,
  ptzPan,
  ptzTilt,
  ptzZoom,
  onvifConnected = false,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (confirmClear) {
      const timer = setTimeout(() => setConfirmClear(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmClear]);
  return (
    <div
      id="tactical-system-toolbar"
      className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs select-none shadow-md z-30"
    >
      {/* Brand & Camera Stream Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* VAAS System Branding */}
        <div id="vaas-brand-indicator" className="flex items-center gap-2 pr-2 border-r border-slate-800">
          <div className="w-6 h-6 rounded bg-sky-950 border border-sky-500/70 flex items-center justify-center text-sky-400 font-mono font-bold text-xs shadow-inner">
            V
          </div>
          <div>
            <div className="font-mono font-bold text-[11px] text-slate-100 tracking-wider flex items-center gap-1.5 leading-none">
              <span>VAAS</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                AUGMENTATION
              </span>
            </div>
            <div className="text-[8.5px] text-slate-400 font-mono tracking-tight hidden sm:block mt-0.5">
              Vijay Ashish Augmentation System
            </div>
          </div>
        </div>

        {/* Source Mode Selector */}
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded px-1.5 py-0.5">
            {sourceType === 'rear_camera' ? (
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 mr-1.5 shrink-0" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            )}
            <select
              id="camera-source-select"
              value={sourceType}
              onChange={(e) =>
                onChangeSourceType(e.target.value as VideoSourceType)
              }
              className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer py-1"
            >
              <option value="simulator" className="bg-slate-900 text-slate-200">
                Exercise Feed Simulator (Tactical Range)
              </option>
              <option value="rear_camera" className="bg-slate-900 text-emerald-400 font-bold">
                Mobile Rear Camera (Back / Environment)
              </option>
              <option value="webcam" className="bg-slate-900 text-slate-200">
                Live Webcam / Front Camera (User)
              </option>
              <option value="rtsp" className="bg-slate-900 text-slate-200">
                RTSP IP Camera Stream
              </option>
              <option value="onvif_ffmpeg" className="bg-slate-900 text-sky-400 font-bold">
                ONVIF / FFmpeg Stream Pipeline
              </option>
            </select>
          </div>

          {/* Quick Flip Camera (Rear <-> Front) */}
          {(sourceType === 'rear_camera' || sourceType === 'webcam') && onToggleCameraFacing && (
            <button
              id="btn-toggle-camera-facing"
              type="button"
              onClick={onToggleCameraFacing}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2 py-1.5 rounded text-xs font-mono transition"
              title={
                sourceType === 'rear_camera'
                  ? 'Switch to Front / User Camera'
                  : 'Switch to Mobile Rear Camera (Environment)'
              }
            >
              <RotateCw className="w-3 h-3 text-sky-400" />
              <span>{sourceType === 'rear_camera' ? 'Flip to Front' : 'Flip to Rear'}</span>
            </button>
          )}

          {/* Sensor / Lens Device Picker (if multiple cameras detected, e.g. Wide, Ultrawide, Tele) */}
          {(sourceType === 'rear_camera' || sourceType === 'webcam') &&
            availableCameras.length > 1 &&
            onSelectCameraDevice && (
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5">
                <select
                  id="camera-device-select"
                  value={selectedCameraDeviceId || ''}
                  onChange={(e) => onSelectCameraDevice(e.target.value)}
                  className="bg-transparent text-slate-300 text-[11px] font-mono focus:outline-none cursor-pointer py-0.5 max-w-[130px] truncate"
                  title="Select specific hardware lens / camera sensor"
                >
                  <option value="" className="bg-slate-900 text-slate-300">
                    Auto Camera Lens
                  </option>
                  {availableCameras.map((cam, idx) => (
                    <option
                      key={cam.deviceId || idx}
                      value={cam.deviceId}
                      className="bg-slate-900 text-slate-200"
                    >
                      {cam.label || `Camera Sensor ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Mobile Rear Camera Torch / Flashlight Toggle (if supported) */}
          {hasTorchSupport && onToggleTorch && (
            <button
              id="btn-toggle-torch"
              type="button"
              onClick={onToggleTorch}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-mono border transition ${
                isTorchOn
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={isTorchOn ? 'Turn mobile torch / flashlight off' : 'Turn mobile torch / flashlight on'}
            >
              <Zap className={`w-3 h-3 ${isTorchOn ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>{isTorchOn ? 'Torch On' : 'Torch'}</span>
            </button>
          )}
        </div>

        {/* RTSP URL Input Field (PRD Section 7.2) */}
        {sourceType === 'rtsp' && (
          <div className="flex items-center">
            <span className="text-slate-400 font-mono text-[11px] mr-1.5">RTSP:</span>
            <input
              id="rtsp-url-input"
              type="text"
              value={rtspUrl}
              onChange={(e) => onChangeRtspUrl(e.target.value)}
              placeholder="rtsp://username:password@192.168.1.100:554/stream"
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs w-64 focus:outline-none focus:border-sky-500"
            />
          </div>
        )}

        {/* Connect / Disconnect */}
        {!isConnected ? (
          <button
            id="btn-connect-camera"
            onClick={onConnect}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium px-3 py-1.5 rounded transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Connect</span>
          </button>
        ) : (
          <button
            id="btn-disconnect-camera"
            onClick={onDisconnect}
            className="flex items-center gap-1.5 bg-red-800 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded transition shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Disconnect</span>
          </button>
        )}
      </div>

      {/* Exercise Overlay Action Tools matching PRD Section 6 Main UI */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* PTZ Status Quick Button (PRD Section 6 & 9) */}
        {onOpenOnvifPtz && (
          <button
            id="btn-toolbar-ptz-status"
            onClick={onOpenOnvifPtz}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition border font-mono text-[11px] ${
              onvifConnected
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 font-bold shadow-sm'
                : isOnvifOpen
                ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="PTZ Status & Telemetry Panel (Pan, Tilt, Zoom, Speed Dome)"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>PTZ Status</span>
            {ptzPan !== undefined && (
              <span className="text-[10px] text-sky-300 font-semibold hidden md:inline">
                {ptzPan >= 0 ? `+${ptzPan.toFixed(1)}°` : `${ptzPan.toFixed(1)}°`}
              </span>
            )}
          </button>
        )}

        {/* [Add Feature] Button (PRD Section 6 & 17) */}
        <button
          id="btn-add-feature"
          onClick={onOpenAddFeature}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
          title="Place simulated military symbol onto live video"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Feature</span>
        </button>

        {/* [Custom Image] Button (PRD Section 6 & 18) */}
        {onOpenCustomImage && (
          <button
            id="btn-toolbar-custom-image"
            onClick={onOpenCustomImage}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
            title="Import and place custom JPG / PNG exercise image"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Custom Image</span>
          </button>
        )}

        {/* [SVG Symbol] Button (PRD Section 6 & 19) */}
        {onOpenCustomSvg && (
          <button
            id="btn-toolbar-custom-svg"
            onClick={onOpenCustomSvg}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
            title="Import and place scalable vector SVG exercise symbol"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SVG Symbol</span>
          </button>
        )}

        {/* [Boundary] Button & In-Progress Drawing Controller (PRD Section 6 & 16) */}
        <div className="flex items-center gap-1">
          {isDrawingBoundary ? (
            <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/60 rounded px-1.5 py-0.5 shadow-sm">
              <span className="font-mono text-[10px] text-amber-300 font-bold px-1 flex items-center gap-1">
                <PenTool className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>DRAWING</span>
                {activeBoundaryPointsCount > 0 && (
                  <span className="text-amber-200">({activeBoundaryPointsCount} pts)</span>
                )}
              </span>
              <button
                id="btn-finish-boundary"
                onClick={onFinishBoundary}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[11px] transition shadow"
                title="Finish and anchor boundary"
              >
                <Check className="w-3 h-3" />
                <span>Finish</span>
              </button>
              <button
                id="btn-clear-last-point"
                onClick={onClearLastBoundaryPoint}
                className="flex items-center gap-1 text-slate-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 text-[11px]"
                title="Remove most recent boundary point"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
              {onCancelBoundary && (
                <button
                  id="btn-cancel-boundary"
                  onClick={onCancelBoundary}
                  className="flex items-center gap-0.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 px-1 py-0.5 rounded text-[11px]"
                  title="Cancel drawing boundary"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          ) : null}

          <button
            id="btn-boundary-config"
            onClick={onOpenBoundaryConfig}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
            title="Manage and draw exercise boundaries"
          >
            {boundaryConfig?.color ? (
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-sm ring-1 ring-white/20"
                style={{ backgroundColor: boundaryConfig.color }}
              />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-mono text-[11px]">Boundary</span>
            {boundariesCount !== undefined && boundariesCount > 0 && (
              <span className="bg-slate-700 text-sky-300 font-mono text-[10px] px-1.5 py-0.2 rounded font-bold">
                {boundariesCount}
              </span>
            )}
          </button>
        </div>

        {/* [Re-Reference] Button (PRD Section 6 & 14) */}
        <button
          id="btn-re-reference"
          onClick={onSetCurrentAsReference}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-sky-950 text-slate-200 hover:text-sky-300 border border-slate-700 hover:border-sky-600 px-2.5 py-1.5 rounded transition"
          title="Set Current Camera View as Reference Frame"
        >
          <Anchor className="w-3.5 h-3.5 text-sky-400" />
          <span>Re-reference</span>
        </button>

        {/* [Layers] Button (PRD Section 6 & 21) */}
        {onOpenLayersDrawer ? (
          <button
            id="btn-toolbar-layers-drawer"
            onClick={onOpenLayersDrawer}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
            title="Manage Exercise Layers (Base Video, Boundary, Symbols, Labels, Status)"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Layers</span>
          </button>
        ) : (
          onToggleAllLayers && (
            <button
              id="btn-toggle-all-layers"
              onClick={onToggleAllLayers}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition border font-mono text-[11px] ${
                allLayersVisible
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 border-amber-500/50 shadow-sm'
              }`}
              title="Toggle all tactical overlay layers at once"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Layers</span>
            </button>
          )
        )}

        {/* [Save] & [Load] Buttons (PRD Section 6, 22, 23) */}
        <button
          id="btn-save-scenario"
          onClick={onOpenSaveScenario}
          className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded transition"
          title="Save complete scenario with packaged assets"
        >
          <Save className="w-3.5 h-3.5 text-sky-400" />
          <span>Save</span>
        </button>

        <button
          id="btn-load-scenario"
          onClick={onOpenLoadScenario}
          className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded transition"
          title="Load scenario JSON"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Load</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        {/* Clear All - Safe two-step confirmation */}
        {!confirmClear ? (
          <button
            id="btn-clear-all"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 px-2 py-1.5 rounded transition"
            title="Clear all placed features and boundaries"
          >
            <Trash className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        ) : (
          <button
            id="btn-clear-all-confirm"
            onClick={() => {
              onClearAll();
              setConfirmClear(false);
            }}
            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold px-2 py-1.5 rounded transition shadow text-[11px] animate-pulse"
            title="Confirm clearing all features and boundaries"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>Confirm?</span>
          </button>
        )}

        {/* PTZ Spatial Memory Registry */}
        {onOpenPtzMemory && (
          <button
            id="btn-toolbar-ptz-memory"
            onClick={onOpenPtzMemory}
            className={`flex items-center gap-1 px-2 py-1.5 rounded transition border font-mono text-[11px] ${
              isPtzMemoryOpen
                ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="PTZ Spatial Memory Radar Registry"
          >
            <Target className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Memory</span>
          </button>
        )}

        {/* Simulator Pan/Tilt Controls Toggle */}
        {sourceType === 'simulator' && (
          <button
            id="btn-toggle-sim-controls"
            onClick={onToggleSimControls}
            className={`flex items-center gap-1 px-2 py-1.5 rounded transition border ${
              showSimControls
                ? 'bg-sky-950 border-sky-500 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Simulator Camera Pan / Tilt / Zoom Controls"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sim PTZ</span>
          </button>
        )}

        {/* Diagnostics Inspector */}
        <button
          id="btn-toggle-diagnostics"
          onClick={onToggleDiagnostics}
          className={`flex items-center gap-1 px-2 py-1.5 rounded transition border ${
            showDiagnostics
              ? 'bg-sky-950 border-sky-500 text-sky-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Visual Registration Diagnostics Inspector"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inspector</span>
        </button>

        {/* [Settings] Button (PRD Section 6) */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition border border-transparent hover:border-slate-700"
          title="Settings (Camera, Calibration, Registration, Overlays)"
        >
          <Settings className="w-4 h-4 text-slate-300" />
        </button>

        {/* [Maximize] Button (PRD Section 6 & 7) */}
        {onToggleFullscreen && (
          <button
            id="btn-toolbar-toggle-fullscreen"
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition border font-mono text-[11px] font-semibold ${
              isFullscreen
                ? 'bg-sky-950 border-sky-500 text-sky-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white shadow-sm'
            }`}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Maximize screen / Fullscreen preview'}
          >
            <Maximize className="w-3.5 h-3.5 text-sky-400" />
            <span>{isFullscreen ? 'Exit' : 'Maximize'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
