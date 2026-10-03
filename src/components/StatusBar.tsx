import React from 'react';
import { RegistrationMetrics, RegistrationQuality, VideoSourceType } from '../types';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MapPin,
  Cpu,
  Info,
  Camera,
  Smartphone,
  EyeOff,
  Maximize,
} from 'lucide-react';

interface StatusBarProps {
  sourceType?: VideoSourceType;
  isConnected: boolean;
  onvifConnected?: boolean;
  registrationMetrics: RegistrationMetrics;
  featureCount: number;
  boundariesCount?: number;
  boundaryPointCount: number;
  isDrawingBoundary: boolean;
  minInliersThreshold: number;
  allLayersVisible?: boolean;
  onToggleAllLayers?: () => void;
  onToggleFullscreen?: () => void;
  onOpenSettings: () => void;
  ptzCoordinates?: { pan: number; tilt: number; zoom: number; moveStatus?: string };
  scenarioName?: string;
  isScenarioModified?: boolean;
  registrationMode?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  sourceType = 'simulator',
  isConnected,
  onvifConnected = false,
  registrationMetrics,
  featureCount,
  boundariesCount,
  boundaryPointCount,
  isDrawingBoundary,
  minInliersThreshold,
  allLayersVisible = true,
  onToggleAllLayers,
  onToggleFullscreen,
  onOpenSettings,
  ptzCoordinates,
  scenarioName = 'Exercise-01',
  isScenarioModified = false,
  registrationMode = 'PTZ + VISUAL',
}) => {
  const { quality, inliers, totalMatches, fps, processingTimeMs } = registrationMetrics;

  const getQualityBadge = () => {
    switch (quality) {
      case 'GOOD':
        return (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>HYBRID: ACTIVE (GOOD)</span>
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="flex items-center gap-1 text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>REGISTRATION: DEGRADED</span>
          </span>
        );
      case 'LOST':
        return (
          <span className="flex items-center gap-1 text-red-400 bg-red-950/90 border border-red-500/50 px-2 py-0.5 rounded font-mono font-semibold animate-pulse">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span>REGISTRATION: LOST</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono">
            <span>REGISTRATION: INITIALIZING</span>
          </span>
        );
    }
  };

  // Formatted executive telemetry string per PRD Section 6
  const panStr = ptzCoordinates ? (ptzCoordinates.pan >= 0 ? `+${ptzCoordinates.pan.toFixed(1).padStart(5, '0')}°` : `${ptzCoordinates.pan.toFixed(1)}°`) : '000.0°';
  const tiltStr = ptzCoordinates ? (ptzCoordinates.tilt >= 0 ? `+${ptzCoordinates.tilt.toFixed(1)}°` : `${ptzCoordinates.tilt.toFixed(1)}°`) : '00.0°';
  const zoomStr = ptzCoordinates ? `${ptzCoordinates.zoom.toFixed(1)}×` : '1.0×';

  return (
    <div
      id="tactical-status-bar"
      className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex flex-col gap-1 text-xs font-mono text-slate-300 select-none z-30 shadow-inner"
    >
      {/* PRD Section 6 Executive Status Ribbon */}
      <div
        id="executive-status-ribbon"
        className="flex items-center justify-between gap-2 overflow-x-auto py-0.5 px-2 bg-slate-950/90 rounded border border-slate-800/80 text-[11px] tracking-wide"
      >
        <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
          <span className="text-slate-500 font-bold">Status:</span>
          <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {sourceType === 'rtsp' ? 'RTSP' : sourceType === 'onvif_ffmpeg' ? 'RTSP/ONVIF' : 'VIDEO'}{' '}
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          <span className="text-slate-600">|</span>
          <span className={onvifConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
            ONVIF {onvifConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-300 font-bold">PAN {panStr}</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-300 font-bold">TILT {tiltStr}</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-300 font-bold">ZOOM {zoomStr}</span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-400 font-bold">
            REGISTRATION {registrationMode}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-200 font-bold">
            SCENARIO {scenarioName}
          </span>
          {isScenarioModified ? (
            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
              MODIFIED
            </span>
          ) : (
            <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
              SAVED
            </span>
          )}
        </div>

        {/* Persistent Simulation Exercise Indicator per PRD Section 36 */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold animate-pulse">
            SIMULATION / EXERCISE USE ONLY
          </span>
        </div>
      </div>

      {/* Secondary Bar: Live Diagnostics & Tactical Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {/* Left: Quality Badge, Inliers, and Latency */}
        <div className="flex items-center gap-3 flex-wrap">
          {getQualityBadge()}
          <span className="text-slate-400">
            Inliers: <strong className="text-slate-200">{inliers}</strong> / {minInliersThreshold}
          </span>
          <span className="text-slate-500 hidden sm:inline">
            (Matches: {totalMatches})
          </span>
        </div>

        {/* Live PTZ Telemetry Badge */}
        {ptzCoordinates && (
          <div className="flex items-center gap-2 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
            <span className="text-slate-500">PTZ:</span>
            <span className="text-sky-300">P:{ptzCoordinates.pan.toFixed(1)}°</span>
            <span className="text-amber-300">T:{ptzCoordinates.tilt.toFixed(1)}°</span>
            <span className="text-emerald-300">Z:{ptzCoordinates.zoom.toFixed(2)}x</span>
            {ptzCoordinates.moveStatus && ptzCoordinates.moveStatus !== 'IDLE' && (
              <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 animate-pulse">
                {ptzCoordinates.moveStatus}
              </span>
            )}
          </div>
        )}

        <div className="h-3.5 w-[1px] bg-slate-800" />

        {/* Visual Registration State (PRD Section 16 & 29) */}
        <div className="flex items-center gap-2">
          {getQualityBadge()}
          <span className="text-[11px] text-slate-400">
            Inliers: <strong className="text-slate-200">{inliers}</strong> / {minInliersThreshold}
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            (Matches: {totalMatches})
          </span>
        </div>
      </div>

      {/* Center / Right: Features, Boundary, FPS, Parallax warning */}
      <div className="flex items-center gap-3 flex-wrap">
        {!allLayersVisible && (
          <button
            type="button"
            onClick={onToggleAllLayers}
            className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded animate-pulse hover:bg-amber-900 transition"
            title="All tactical layers are currently hidden. Click to unhide all layers."
          >
            <EyeOff className="w-3 h-3 text-amber-400" />
            <span>LAYERS HIDDEN</span>
          </button>
        )}

        {/* Features Count */}
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <Layers className="w-3 h-3 text-sky-400" />
          <span>Features:</span>
          <span className="font-semibold text-sky-300">{featureCount}</span>
        </div>

        {/* Boundary Status */}
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <MapPin className="w-3 h-3 text-rose-400" />
          <span>Boundaries:</span>
          {isDrawingBoundary ? (
            <span className="font-semibold text-amber-400 animate-pulse">
              DRAWING ({boundaryPointCount} pts)
            </span>
          ) : boundariesCount !== undefined && boundariesCount > 0 ? (
            <span className="font-semibold text-emerald-400">
              {boundariesCount} LAYER{boundariesCount === 1 ? '' : 'S'} ({boundaryPointCount} pts)
            </span>
          ) : boundaryPointCount > 0 ? (
            <span className="font-semibold text-emerald-400">
              ACTIVE ({boundaryPointCount} pts)
            </span>
          ) : (
            <span className="text-slate-500">NONE</span>
          )}
        </div>

        <div className="h-3.5 w-[1px] bg-slate-800" />

        {/* FPS & Latency */}
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <Cpu className="w-3 h-3 text-slate-400" />
          <span>FPS:</span>
          <span className="font-semibold text-slate-200">{fps || 30}</span>
          <span className="text-[10px] text-slate-500">
            ({processingTimeMs.toFixed(1)}ms)
          </span>
        </div>

        {/* Parallax Limitation Info Link (PRD Section 19 & 46) */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          title="Homography assumes moderate movement & limited parallax. Click for technical details."
        >
          <Info className="w-3 h-3 text-sky-400" />
          <span className="hidden md:inline">Parallax Limit: Moderate</span>
        </button>

        <div className="h-3.5 w-[1px] bg-slate-800 hidden lg:block" />

        {/* VAAS System Identifier */}
        <span
          id="vaas-status-system-id"
          className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 text-sky-400 text-[10px] font-mono"
        >
          VAAS v2.4
        </span>

        {/* Maximize Fullscreen Trigger */}
        {onToggleFullscreen && (
          <button
            id="status-bar-btn-maximize"
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300 hover:bg-slate-800 px-1.5 py-0.5 rounded transition"
            title="Maximize screen / Fullscreen preview (F)"
          >
            <Maximize className="w-3 h-3" />
            <span className="hidden sm:inline">Maximize</span>
          </button>
        )}
      </div>
    </div>
  );
};
