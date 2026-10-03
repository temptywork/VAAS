import React, { useRef, useEffect } from 'react';
import {
  Compass,
  Crosshair,
  MapPin,
  Eye,
  Navigation,
  RotateCw,
  Trash2,
  Layers,
  ArrowUpRight,
  Shield,
  Target,
  Download,
} from 'lucide-react';
import { ExerciseFeature, PtzAnchor } from '../types';
import { FEATURE_LIBRARY } from '../data/featureDefinitions';
import { normalizeAngleDeg, getCameraFov } from '../utils/ptzMath';

interface PtzSpatialMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  features: ExerciseFeature[];
  currentCamPan: number;
  currentCamTilt: number;
  currentCamZoom: number;
  onSlewToObject: (pan: number, tilt: number, zoom?: number) => void;
  onReanchorFeature: (id: string) => void;
  onDeleteFeature: (id: string) => void;
  onSelectFeature: (id: string) => void;
  selectedFeatureId: string | null;
}

export const PtzSpatialMemoryDrawer: React.FC<PtzSpatialMemoryDrawerProps> = ({
  isOpen,
  onClose,
  features,
  currentCamPan,
  currentCamTilt,
  currentCamZoom,
  onSlewToObject,
  onReanchorFeature,
  onDeleteFeature,
  onSelectFeature,
  selectedFeatureId,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { fovH, fovV } = getCameraFov(currentCamZoom);

  // Render 360° Radar Dome on Canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) / 2 - 16;

    ctx.clearRect(0, 0, W, H);

    // Dark Radar Background
    ctx.fillStyle = '#060c18';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Range Rings
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross Axis & Degree ticks
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Compass Cardinal Markings
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N (0°)', cx, cy - radius + 8);
    ctx.fillText('S (180°)', cx, cy + radius - 8);
    ctx.fillText('E (+90°)', cx + radius - 16, cy);
    ctx.fillText('W (-90°)', cx - radius + 16, cy);

    // Active Camera FOV Cone
    const camAngleRad = (currentCamPan * Math.PI) / 180 - Math.PI / 2;
    const halfFovRad = ((fovH / 2) * Math.PI) / 180;

    ctx.save();
    ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, camAngleRad - halfFovRad, camAngleRad + halfFovRad);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Camera Boresight Heading Needle
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(camAngleRad) * radius, cy + Math.sin(camAngleRad) * radius);
    ctx.stroke();
    ctx.restore();

    // Center camera base icon
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Plot remembered objects
    features.forEach((f) => {
      const anchor = f.ptzAnchor;
      // If no anchor yet, fallback to camera's placed azimuth
      const panDeg = anchor ? anchor.panDeg : currentCamPan;
      const tiltDeg = anchor ? anchor.tiltDeg : currentCamTilt;

      // Distance mapping on radar (default 0.7 * radius)
      const objDistRatio = 0.7;
      const angleRad = (panDeg * Math.PI) / 180 - Math.PI / 2;
      const ox = cx + Math.cos(angleRad) * (radius * objDistRatio);
      const oy = cy + Math.sin(angleRad) * (radius * objDistRatio);

      // Check if in camera FOV
      const deltaPan = normalizeAngleDeg(panDeg - currentCamPan);
      const deltaTilt = tiltDeg - currentCamTilt;
      const inView = Math.abs(deltaPan) <= fovH / 2 && Math.abs(deltaTilt) <= fovV / 2;

      const isSelected = f.id === selectedFeatureId;
      const def = FEATURE_LIBRARY[f.type] || FEATURE_LIBRARY.tank;

      // Draw Blip
      ctx.save();
      ctx.fillStyle = inView ? '#22c55e' : '#f59e0b';
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = isSelected ? 2 : 1;

      ctx.beginPath();
      ctx.arc(ox, oy, isSelected ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Short label
      ctx.font = '8px monospace';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(f.label.slice(0, 10), ox, oy + 10);
      ctx.restore();
    });
  }, [isOpen, features, currentCamPan, currentCamTilt, currentCamZoom, fovH, fovV, selectedFeatureId]);

  if (!isOpen) return null;

  return (
    <div
      id="ptz-spatial-memory-drawer"
      className="absolute top-16 right-92 z-30 w-96 bg-slate-900/95 border border-sky-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs text-slate-200 select-none flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          <div>
            <div className="font-mono font-bold text-sky-300">
              PTZ SPATIAL MEMORY REGISTRY
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Remembered Objects Locked to PTZ Coordinates ({features.length})
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* 360° Tactical Radar Dome */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
            <span className="uppercase tracking-wider">360° Azimuth Radar Dome</span>
            <span className="text-sky-300 font-bold">FOV: {fovH.toFixed(1)}°</span>
          </div>

          <canvas
            ref={radarCanvasRef}
            width={240}
            height={240}
            className="w-56 h-56 rounded-full cursor-crosshair border border-sky-500/20 shadow-inner"
          />

          <div className="w-full mt-2 flex justify-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-300">In View Frustum</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-300">Off-Screen / Stored</span>
            </div>
          </div>
        </div>

        {/* Remembered Objects List */}
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>Remembered Spatial Objects</span>
            <span className="text-sky-400">{features.length} Tracked</span>
          </div>

          {features.length === 0 ? (
            <div className="p-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 font-mono text-[11px]">
              No exercise features plotted yet. Click "Add Tactical Feature" on the toolbar to anchor objects.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {features.map((feat) => {
                const anchor = feat.ptzAnchor;
                const panDeg = anchor ? anchor.panDeg : currentCamPan;
                const tiltDeg = anchor ? anchor.tiltDeg : currentCamTilt;
                const zoomFactor = anchor ? anchor.placedAtZoom : 1.0;

                const deltaPan = normalizeAngleDeg(panDeg - currentCamPan);
                const deltaTilt = tiltDeg - currentCamTilt;
                const inView = Math.abs(deltaPan) <= fovH / 2 && Math.abs(deltaTilt) <= fovV / 2;
                const isSelected = feat.id === selectedFeatureId;
                const def = FEATURE_LIBRARY[feat.type] || FEATURE_LIBRARY.tank;

                return (
                  <div
                    key={feat.id}
                    onClick={() => onSelectFeature(feat.id)}
                    className={`p-2 rounded-lg border transition font-mono ${
                      isSelected
                        ? 'bg-sky-950/70 border-sky-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: feat.color || def.color }}
                        />
                        <span className="font-bold text-slate-200 text-[11px] truncate max-w-[140px]">
                          {feat.label}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          inView
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {inView ? 'IN SIGHT' : `BEARING ${deltaPan > 0 ? `+${deltaPan.toFixed(0)}°` : `${deltaPan.toFixed(0)}°`}`}
                      </span>
                    </div>

                    {/* Coordinates & Actions */}
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <div>
                        <span>Pan: <b className="text-sky-300">{panDeg.toFixed(1)}°</b></span>
                        <span className="mx-1.5">•</span>
                        <span>Tilt: <b className="text-amber-300">{tiltDeg.toFixed(1)}°</b></span>
                        <span className="mx-1.5">•</span>
                        <span>{zoomFactor.toFixed(1)}x</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Slew Camera to Object */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlewToObject(panDeg, tiltDeg, zoomFactor);
                          }}
                          className="px-2 py-0.8 bg-sky-700 hover:bg-sky-600 text-white rounded text-[9px] font-bold flex items-center gap-1 transition"
                          title="Slew PTZ Camera to this object"
                        >
                          <Navigation className="w-2.5 h-2.5" />
                          <span>SLEW</span>
                        </button>

                        {/* Re-anchor */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReanchorFeature(feat.id);
                          }}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                          title="Re-anchor to current camera PTZ"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFeature(feat.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded"
                          title="Delete Feature"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
