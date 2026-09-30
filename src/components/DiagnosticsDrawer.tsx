import React from 'react';
import { RegistrationMetrics, RegistrationSettings } from '../types';
import { VisualRegistrationEngine } from '../cv/registrationEngine';
import { Activity } from 'lucide-react';

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
}) => {
  if (!isOpen) return null;

  const H = metrics.homography;
  const number = (value: number | undefined, digits=3) => value!==undefined&&Number.isFinite(value)?value.toFixed(digits):'—';
  const pose = metrics.reportedPose || metrics.cameraPose;
  const correction = metrics.visualCorrection;

  const inlierRatio =
    metrics.totalMatches > 0
      ? Math.round((metrics.inliers / metrics.totalMatches) * 100)
      : 0;

  return (
    <div
      id="diagnostics-inspector-drawer"
      className="absolute top-12 right-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md w-80 text-xs text-slate-200 select-none font-mono max-h-[80vh] overflow-y-auto"
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
            {metrics.mode === 'ptz' || metrics.mode === 'ptz+visual'
              ? `Camera pose drives projection${metrics.mode === 'ptz+visual' ? ' with a bounded visual correction' : ''}. ${metrics.ptzModel === 'estimated' ? 'Camera geometry is estimated.' : ''}`
              : metrics.quality === 'UNINITIALIZED'
              ? 'Capture views and finish setup to start visual registration.'
              : metrics.quality === 'GOOD'
              ? 'Visual correspondences stable. Overlays dynamically reprojected.'
              : metrics.quality === 'DEGRADED'
              ? 'Matches declining. Confidence marginal.'
              : 'No fresh usable projection. Return to a saved view to recover anchors.'}
          </div>
          {metrics.trackingHint&&<div className="text-[10px] text-amber-300 mt-1">{metrics.trackingHint}</div>}
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
            Active view transform H (3×3)
          </div>
          <div className="text-[10px] text-slate-400 mb-1 break-all">View: {metrics.activeViewId || 'No saved view'}</div>
          <div className="bg-slate-950/80 rounded-lg border border-slate-800 p-2 text-[10px] font-mono grid grid-cols-3 gap-1 text-center">
            <span className="text-sky-300 bg-slate-900 py-1 rounded">
              {number(H?.[0])}
            </span>
            <span className="text-slate-300 bg-slate-900 py-1 rounded">
              {number(H?.[1])}
            </span>
            <span className="text-amber-300 bg-slate-900 py-1 rounded">
              {number(H?.[2],1)}
            </span>

            <span className="text-slate-300 bg-slate-900 py-1 rounded">
              {number(H?.[3])}
            </span>
            <span className="text-sky-300 bg-slate-900 py-1 rounded">
              {number(H?.[4])}
            </span>
            <span className="text-amber-300 bg-slate-900 py-1 rounded">
              {number(H?.[5],1)}
            </span>

            <span className="text-slate-400 bg-slate-900 py-1 rounded">
              {number(H?.[6],4)}
            </span>
            <span className="text-slate-400 bg-slate-900 py-1 rounded">
              {number(H?.[7],4)}
            </span>
            <span className="text-slate-200 bg-slate-900 py-1 rounded font-bold">
              {number(H?.[8],2)}
            </span>
          </div>
        </div>

        {pose&&<div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Camera PTZ telemetry</div>
          <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2 space-y-1 text-[10px]">
            <div className="flex justify-between"><span>Reported pan / tilt:</span><span className="text-sky-300">{number(pose.pan,5)} / {number(pose.tilt,5)}</span></div>
            <div className="flex justify-between"><span>Reported zoom:</span><span className="text-emerald-300">{number(pose.zoom,5)}</span></div>
            <div className="flex justify-between"><span>Video-aligned pan / tilt:</span><span>{number(metrics.cameraPose?.pan,5)} / {number(metrics.cameraPose?.tilt,5)}</span></div>
            <div className="flex justify-between"><span>Video-aligned zoom:</span><span>{number(metrics.cameraPose?.zoom,5)}</span></div>
            <div className="flex justify-between"><span>Reference pan / tilt:</span><span>{number(metrics.referencePose?.pan,5)} / {number(metrics.referencePose?.tilt,5)}</span></div>
            <div className="flex justify-between"><span>Reference zoom:</span><span>{number(metrics.referencePose?.zoom,5)}</span></div>
            <div className="flex justify-between"><span>Pose age / configured delay:</span><span>{number(metrics.poseAgeMs,0)} / {number(metrics.videoDelayMs,0)} ms</span></div>
            <div className="flex justify-between"><span>Δ pan / tilt (device units):</span><span>{number(metrics.poseDelta?.pan,5)} / {number(metrics.poseDelta?.tilt,5)}</span></div>
            <div className="flex justify-between"><span>Δ zoom (device units):</span><span>{number(metrics.poseDelta?.zoom,5)}</span></div>
            <div className="flex justify-between"><span>Model Δ pan / tilt:</span><span>{number(metrics.angularDeltaDeg?.pan,1)}° / {number(metrics.angularDeltaDeg?.tilt,1)}°</span></div>
            <div className="text-slate-500 pt-1">Deltas are relative to the active saved view. ONVIF device units are not pixels or optical magnification.</div>
          </div>
        </div>}

        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
            {metrics.movementSource==='ptz'?'PTZ model projection':'Visual image movement'}
          </div>
          <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Reference center ΔX, ΔY:</span>
              <span className="text-sky-300">
                {metrics.movementAvailable?`${number(metrics.translationEstimate[0],1)}px, ${number(metrics.translationEstimate[1],1)}px`:'—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{metrics.movementSource==='ptz'?'Model focal ratio:':'Local image scale:'}</span>
              <span className="text-emerald-300">
                {number(metrics.scaleEstimate)}x
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{metrics.movementSource==='ptz'?'Image roll / flip Δ:':'Local image rotation:'}</span>
              <span className="text-amber-300">
                {number(metrics.rotationEstimateDeg,1)}°
              </span>
            </div>
            <div className="text-slate-500 pt-1">Pixels use the {metrics.frameWidth}×{metrics.frameHeight} processing image. The reference center is unavailable when behind the camera.</div>
          </div>
        </div>
        {correction&&<div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Visual correction on top of PTZ</div>
          <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2 space-y-1 text-[10px]">
            <div className="flex justify-between"><span>Center ΔX / ΔY:</span><span>{number(correction.translation[0],1)} / {number(correction.translation[1],1)} px</span></div>
            <div className="flex justify-between"><span>Scale / rotation:</span><span>{number(correction.scale)}x / {number(correction.rotationDeg,1)}°</span></div>
            <div className="flex justify-between"><span>Last visual observation:</span><span>{number(correction.ageMs,0)} ms ago</span></div>
          </div>
        </div>}
      </div>
    </div>
  );
};
