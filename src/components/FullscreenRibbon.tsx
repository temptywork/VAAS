import React, { useState } from 'react';
import {
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  Crosshair,
  ShieldAlert,
  Camera,
  Layers,
  Settings,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Compass,
  Activity,
  Trash2,
} from 'lucide-react';
import { RegistrationMetrics, VideoSourceType } from '../types';

interface FullscreenRibbonProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  allLayersVisible: boolean;
  onToggleAllLayers: () => void;
  sourceType: VideoSourceType;
  onChangeSourceType: (type: VideoSourceType) => void;
  onSetCurrentAsReference: () => void;
  onOpenAddFeature: () => void;
  onOpenBoundaryConfig: () => void;
  onOpenSettings: () => void;
  registrationMetrics: RegistrationMetrics;
  featureCount: number;
  boundariesCount: number;
  showSimControls?: boolean;
  onToggleSimControls?: () => void;
}

export const FullscreenRibbon: React.FC<FullscreenRibbonProps> = ({
  isFullscreen,
  onToggleFullscreen,
  allLayersVisible,
  onToggleAllLayers,
  sourceType,
  onChangeSourceType,
  onSetCurrentAsReference,
  onOpenAddFeature,
  onOpenBoundaryConfig,
  onOpenSettings,
  registrationMetrics,
  featureCount,
  boundariesCount,
  showSimControls,
  onToggleSimControls,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getQualityDot = () => {
    switch (registrationMetrics.quality) {
      case 'GOOD':
        return 'bg-emerald-400 ring-emerald-500/50';
      case 'DEGRADED':
        return 'bg-amber-400 ring-amber-500/50';
      case 'LOST':
        return 'bg-rose-500 ring-rose-500/50 animate-pulse';
      case 'UNINITIALIZED':
      default:
        return 'bg-slate-500 ring-slate-600/50';
    }
  };

  return (
    <div
      id="fullscreen-bottom-ribbon"
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 transition-all duration-200 select-none max-w-[95vw]"
    >
      {/* Expanded Quick Options Strip (optional drawer above ribbon) */}
      {isExpanded && (
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-2 text-xs">
          {/* Video Source Switcher */}
          <div className="flex items-center bg-slate-950/80 rounded-full p-0.5 border border-slate-800">
            <button
              onClick={() => onChangeSourceType('simulator')}
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] transition ${
                sourceType === 'simulator'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sim
            </button>
            <button
              onClick={() => onChangeSourceType('webcam')}
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] transition ${
                sourceType === 'webcam'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cam
            </button>
            <button
              onClick={() => onChangeSourceType('rear_camera')}
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] transition ${
                sourceType === 'rear_camera'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rear
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-700/60" />

          {/* Simulator PTZ quick toggle if in sim mode */}
          {sourceType === 'simulator' && onToggleSimControls && (
            <button
              onClick={onToggleSimControls}
              className={`flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] border transition ${
                showSimControls
                  ? 'bg-sky-950 border-sky-500 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle Pan / Tilt / Zoom Controls"
            >
              <Sliders className="w-3 h-3 text-sky-400" />
              <span>PTZ</span>
            </button>
          )}

          {/* Set Reference Frame */}
          <button
            onClick={onSetCurrentAsReference}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-full font-mono text-[10px] transition"
            title="Set current camera frame as optical reference"
          >
            <RotateCw className="w-3 h-3 text-sky-400" />
            <span>Set Ref</span>
          </button>

          {/* Add Symbol */}
          <button
            onClick={onOpenAddFeature}
            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded-full font-mono text-[10px] font-bold transition shadow-sm"
            title="Add tactical symbol"
          >
            <Crosshair className="w-3 h-3" />
            <span>+ Symbol ({featureCount})</span>
          </button>

          {/* Boundaries */}
          <button
            onClick={onOpenBoundaryConfig}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-full font-mono text-[10px] transition"
            title="Manage exercise boundaries"
          >
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>Boundaries ({boundariesCount})</span>
          </button>
        </div>
      )}

      {/* Main Streamlined Floating Glass Ribbon */}
      <div className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full shadow-2xl transition">
        {/* Fullscreen indicator badge / mode */}
        <div className="flex items-center gap-1.5 pr-1 border-r border-slate-700/60 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ring-2 ${getQualityDot()}`}
            title={`Registration: ${registrationMetrics.quality} (${registrationMetrics.inliers} inliers)`}
          />
          <span className="text-slate-300 font-bold text-[10px] hidden sm:inline">
            {registrationMetrics.fps} FPS
          </span>
        </div>

        {/* Master Layers Toggle Button */}
        <button
          id="ribbon-btn-toggle-all-layers"
          onClick={onToggleAllLayers}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border transition ${
            allLayersVisible
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600/80'
              : 'bg-amber-950/90 hover:bg-amber-900 text-amber-300 border-amber-500/60 shadow-sm animate-pulse'
          }`}
          title={allLayersVisible ? 'Hide all tactical overlay layers' : 'Unhide all tactical layers'}
        >
          {allLayersVisible ? (
            <>
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>LAYERS: ON</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              <span>LAYERS: HIDDEN</span>
            </>
          )}
        </button>

        {/* Quick Add Symbol */}
        <button
          id="ribbon-btn-add-feature"
          onClick={onOpenAddFeature}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-full font-mono text-[11px] transition"
          title="Place new military tactical feature"
        >
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Symbol</span>
          <span className="text-[10px] text-sky-300 font-bold font-mono">({featureCount})</span>
        </button>

        {/* Quick Boundaries Config */}
        <button
          id="ribbon-btn-boundaries"
          onClick={onOpenBoundaryConfig}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-full font-mono text-[11px] transition"
          title="Configure and draw boundary phases"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Boundaries</span>
          <span className="text-[10px] text-amber-300 font-bold font-mono">({boundariesCount})</span>
        </button>

        {/* Quick Reference Capture */}
        <button
          id="ribbon-btn-set-ref"
          onClick={onSetCurrentAsReference}
          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-full transition"
          title="Update Reference Frame Now"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* More Tools Toggle */}
        <button
          id="ribbon-btn-expand"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1.5 rounded-full transition ${
            isExpanded
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={isExpanded ? 'Collapse extra options' : 'More options (Source, PTZ, Settings)'}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Settings button */}
        <button
          id="ribbon-btn-settings"
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition"
          title="Open Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Exit Fullscreen or Toggle Fullscreen Button */}
        <button
          id="ribbon-btn-toggle-fullscreen"
          onClick={onToggleFullscreen}
          className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white font-mono text-[11px] font-bold px-2.5 py-1 rounded-full transition shadow-md ml-1"
          title={isFullscreen ? 'Exit full screen preview (Esc)' : 'Maximize full screen preview'}
        >
          {isFullscreen ? (
            <>
              <Minimize className="w-3.5 h-3.5" />
              <span>Exit Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
