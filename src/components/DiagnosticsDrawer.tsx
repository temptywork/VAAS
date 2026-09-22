import React from 'react';
import { RegistrationMetrics, RegistrationSettings } from '../types';
import { VisualRegistrationEngine } from '../cv/registrationEngine';
import { Activity, CheckCircle2, AlertTriangle, AlertCircle, Eye, Cpu } from 'lucide-react';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: RegistrationMetrics;
  settings: RegistrationSettings;
  engine: VisualRegistrationEngine;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  metrics,
  settings,
  engine,
}) => {
  if (!isOpen) return null;

  const H = metrics.homography || [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const inlierRatio =
    metrics.totalMatches > 0
      ? Math.round((metrics.inliers / metrics.totalMatches) * 100)
      : 0;

  return (
    <div
      id="diagnostics-inspector-drawer"
      className="absolute top-12 left-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md w-80 text-xs text-slate-200 select-none font-mono max-h-[80vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-1.5 font-bold text-sky-400 text-xs uppercase tracking-wider">
          <Activity className="w-4 h-4" />
          <span>CV Registration Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-1 text-sm font-sans"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3.5">
        {/* Registration Quality Status Card */}
        <div
          className={`p-2.5 rounded-lg border ${
            metrics.quality === 'GOOD'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : metrics.quality === 'DEGRADED'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center justify-between font-bold text-xs">
            <span>STATE: {metrics.quality}</span>
            <span>{metrics.fps} FPS</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {metrics.quality === 'GOOD'
              ? 'Visual correspondences stable. Overlays dynamically reprojected.'
              : metrics.quality === 'DEGRADED'
              ? 'Matches declining. Confidence marginal.'
              : 'Insufficient inliers (<4). Overlays frozen at last position.'}
          </div>
        </div>

        {/* Feature & Inlier Pipeline Breakdown (PRD Sec 12 & 45) */}
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
            <span>Feature Pipeline</span>
            <span className="text-slate-300">
              Proc: {metrics.processingTimeMs.toFixed(1)}ms
            </span>
          </div>

          <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Ref Keypoints:</span>
              <span className="text-slate-200">{metrics.candidateKeypointsRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Keypoints:</span>
              <span className="text-slate-200">{metrics.candidateKeypointsCur}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lowe's Ratio Matches:</span>
              <span className="text-amber-400">{metrics.totalMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">RANSAC Inliers:</span>
              <span className="text-emerald-400 font-bold">
                {metrics.inliers} (Req: ≥ {settings.minInliers})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inlier Ratio:</span>
              <span className="text-sky-400">{inlierRatio}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reprojection Error:</span>
              <span className="text-slate-300">
                {metrics.reprojectionError.toFixed(2)} px
              </span>
            </div>
          </div>
        </div>

        {/* 3x3 Homography Matrix (PRD Sec 13 & 25) */}
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
            Homography Matrix H (3×3)
          </div>
          <div className="bg-slate-950/80 rounded-lg border border-slate-800 p-2 text-[10px] font-mono grid grid-cols-3 gap-1 text-center">
            <span className="text-sky-300 bg-slate-900 py-1 rounded">
              {H[0].toFixed(3)}
            </span>
            <span className="text-slate-300 bg-slate-900 py-1 rounded">
              {H[1].toFixed(3)}
            </span>
            <span className="text-amber-300 bg-slate-900 py-1 rounded">
              {H[2].toFixed(1)}
            </span>

            <span className="text-slate-300 bg-slate-900 py-1 rounded">
              {H[3].toFixed(3)}
            </span>
            <span className="text-sky-300 bg-slate-900 py-1 rounded">
              {H[4].toFixed(3)}
            </span>
            <span className="text-amber-300 bg-slate-900 py-1 rounded">
              {H[5].toFixed(1)}
            </span>

            <span className="text-slate-400 bg-slate-900 py-1 rounded">
              {H[6].toFixed(4)}
            </span>
            <span className="text-slate-400 bg-slate-900 py-1 rounded">
              {H[7].toFixed(4)}
            </span>
            <span className="text-slate-200 bg-slate-900 py-1 rounded font-bold">
              {H[8].toFixed(2)}
            </span>
          </div>
        </div>

        {/* Camera Movement Inferred Estimation */}
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
            Estimated Camera Movement
          </div>
          <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Translation ΔX, ΔY:</span>
              <span className="text-sky-300">
                {metrics.translationEstimate[0].toFixed(1)}px,{' '}
                {metrics.translationEstimate[1].toFixed(1)}px
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estimated Scale / Zoom:</span>
              <span className="text-emerald-300">
                {metrics.scaleEstimate.toFixed(3)}x
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estimated Roll / Tilt:</span>
              <span className="text-amber-300">
                {metrics.rotationEstimateDeg.toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
