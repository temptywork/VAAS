import React from 'react';
import { RegistrationMetrics, RegistrationQuality } from '../types';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MapPin,
  Cpu,
  Info,
} from 'lucide-react';

interface StatusBarProps {
  isConnected: boolean;
  registrationMetrics: RegistrationMetrics;
  featureCount: number;
  boundariesCount?: number;
  boundaryPointCount: number;
  isDrawingBoundary: boolean;
  minInliersThreshold: number;
  onOpenSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isConnected,
  registrationMetrics,
  featureCount,
  boundariesCount,
  boundaryPointCount,
  isDrawingBoundary,
  minInliersThreshold,
  onOpenSettings,
}) => {
  const { quality, inliers, totalMatches, fps, processingTimeMs } = registrationMetrics;

  const getQualityBadge = () => {
    switch (quality) {
      case 'GOOD':
        return (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>REGISTRATION: GOOD</span>
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
            <span>REGISTRATION: LOST (OVERLAYS FROZEN)</span>
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

  return (
    <div
      id="tactical-status-bar"
      className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 select-none z-30"
    >
      {/* Left items: Camera & Registration Quality */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Camera Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-slate-400 text-[11px]">Camera:</span>
          <span
            className={`font-semibold ${
              isConnected ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

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
      </div>
    </div>
  );
};
