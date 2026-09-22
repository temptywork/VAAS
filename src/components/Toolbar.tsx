import React from 'react';
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
  Settings,
  Tv,
  Palette,
  ShieldAlert,
} from 'lucide-react';
import { RegistrationQuality, BoundaryConfig } from '../types';

interface ToolbarProps {
  sourceType: 'simulator' | 'webcam' | 'rtsp';
  onChangeSourceType: (type: 'simulator' | 'webcam' | 'rtsp') => void;
  rtspUrl: string;
  onChangeRtspUrl: (url: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isDrawingBoundary: boolean;
  onStartBoundary: () => void;
  onFinishBoundary: () => void;
  onClearLastBoundaryPoint: () => void;
  onClearAll: () => void;
  boundaryConfig: BoundaryConfig;
  onOpenBoundaryConfig: () => void;
  onOpenAddFeature: () => void;
  onOpenSaveScenario: () => void;
  onOpenLoadScenario: () => void;
  onSetCurrentAsReference: () => void;
  visualRegEnabled: boolean;
  onToggleVisualReg: () => void;
  showDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  showSimControls: boolean;
  onToggleSimControls: () => void;
  onOpenSettings: () => void;
  registrationQuality: RegistrationQuality;
  hasReference: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  sourceType,
  onChangeSourceType,
  rtspUrl,
  onChangeRtspUrl,
  isConnected,
  onConnect,
  onDisconnect,
  isDrawingBoundary,
  onStartBoundary,
  onFinishBoundary,
  onClearLastBoundaryPoint,
  onClearAll,
  boundaryConfig,
  onOpenBoundaryConfig,
  onOpenAddFeature,
  onOpenSaveScenario,
  onOpenLoadScenario,
  onSetCurrentAsReference,
  visualRegEnabled,
  onToggleVisualReg,
  showDiagnostics,
  onToggleDiagnostics,
  showSimControls,
  onToggleSimControls,
  onOpenSettings,
  registrationQuality,
  hasReference,
}) => {
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
        <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded px-1.5 py-0.5">
          <Camera className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
          <select
            id="camera-source-select"
            value={sourceType}
            onChange={(e) =>
              onChangeSourceType(e.target.value as 'simulator' | 'webcam' | 'rtsp')
            }
            className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer py-1"
          >
            <option value="simulator" className="bg-slate-900 text-slate-200">
              Exercise Feed Simulator (Tactical Range)
            </option>
            <option value="webcam" className="bg-slate-900 text-slate-200">
              Live Webcam / Video Capture
            </option>
            <option value="rtsp" className="bg-slate-900 text-slate-200">
              RTSP IP Camera Stream
            </option>
          </select>
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

      {/* Exercise Overlay Action Tools */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Add Feature Button */}
        <button
          id="btn-add-feature"
          onClick={onOpenAddFeature}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
          title="Place simulated military symbol onto live video"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Feature</span>
        </button>

        {/* Boundary Tools */}
        <div className="flex items-center gap-1">
          {!isDrawingBoundary ? (
            <button
              id="btn-draw-boundary"
              onClick={onStartBoundary}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1.5 rounded font-medium transition"
              title="Draw simulated exercise boundary line"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw Boundary</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-amber-950/60 border border-amber-500/50 rounded px-1 py-0.5">
              <button
                id="btn-finish-boundary"
                onClick={onFinishBoundary}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-2 py-1 rounded transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Finish Boundary</span>
              </button>
              <button
                id="btn-clear-last-point"
                onClick={onClearLastBoundaryPoint}
                className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
                title="Remove most recent boundary point"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo Pt</span>
              </button>
            </div>
          )}

          {/* Boundary Customization Button (Color, Name, Thickness) */}
          <button
            id="btn-boundary-config"
            onClick={onOpenBoundaryConfig}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1.5 rounded font-medium transition"
            title="Customize boundary colour, name label, and line thickness"
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shadow-sm ring-1 ring-white/20"
              style={{ backgroundColor: boundaryConfig.color }}
            />
            <span className="font-mono text-[11px]">Boundary Style</span>
          </button>
        </div>

        {/* Clear All */}
        <button
          id="btn-clear-all"
          onClick={onClearAll}
          className="flex items-center gap-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 px-2 py-1.5 rounded transition"
          title="Clear all placed features and boundaries"
        >
          <Trash className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        {/* Re-Reference (Section 17) */}
        <button
          id="btn-re-reference"
          onClick={onSetCurrentAsReference}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-sky-950 text-slate-200 hover:text-sky-300 border border-slate-700 hover:border-sky-600 px-2.5 py-1.5 rounded transition"
          title="Set Current Camera View as Reference Frame"
        >
          <Anchor className="w-3.5 h-3.5 text-sky-400" />
          <span>Re-Reference</span>
        </button>

        {/* Visual Registration Toggle */}
        <button
          id="btn-toggle-visual-reg"
          onClick={onToggleVisualReg}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono font-medium transition border ${
            visualRegEnabled
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle CV Homography Tracking Engine"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Visual Reg: {visualRegEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        {/* Scenario Save & Load (PRD Section 23 & 26) */}
        <button
          id="btn-save-scenario"
          onClick={onOpenSaveScenario}
          className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded transition"
          title="Save scenario JSON and reference frame"
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
            <span>Camera PTZ</span>
          </button>
        )}

        {/* Diagnostics Toggle */}
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
          <Eye className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>

        {/* Settings Button */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          title="Settings (Camera, Registration, Overlay, Parallax notice)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
