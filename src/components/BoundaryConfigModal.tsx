import React from 'react';
import { ExerciseBoundary } from '../types';
import {
  ShieldAlert,
  Check,
  Palette,
  Maximize2,
  Type,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  PenTool,
  RotateCcw,
} from 'lucide-react';

interface BoundaryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  boundaries: ExerciseBoundary[];
  selectedBoundaryId: string | null;
  onSelectBoundary: (id: string) => void;
  onAddBoundary: () => void;
  onUpdateBoundary: (boundary: ExerciseBoundary) => void;
  onDeleteBoundary: (id: string) => void;
  onToggleBoundaryVisibility: (id: string) => void;
  onStartDrawingBoundary: (id: string) => void;
  onClearBoundaryPoints: (id: string) => void;
  isDrawing: boolean;
}

const PRESET_COLORS = [
  { name: 'Tactical Red', color: '#ef4444' },
  { name: 'Warning Amber', color: '#f59e0b' },
  { name: 'Target Yellow', color: '#eab308' },
  { name: 'Sky Cyan', color: '#06b6d4' },
  { name: 'Friendly Blue', color: '#3b82f6' },
  { name: 'Clear Green', color: '#22c55e' },
  { name: 'High-Vis Magenta', color: '#ec4899' },
  { name: 'Command Purple', color: '#a855f7' },
  { name: 'Tactical White', color: '#f8fafc' },
];

export const BoundaryConfigModal: React.FC<BoundaryConfigModalProps> = ({
  isOpen,
  onClose,
  boundaries,
  selectedBoundaryId,
  onSelectBoundary,
  onAddBoundary,
  onUpdateBoundary,
  onDeleteBoundary,
  onToggleBoundaryVisibility,
  onStartDrawingBoundary,
  onClearBoundaryPoints,
  isDrawing,
}) => {
  if (!isOpen) return null;

  const currentBoundary =
    boundaries.find((b) => b.id === selectedBoundaryId) || boundaries[0] || null;

  return (
    <div
      id="boundary-config-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div
        id="boundary-config-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Exercise Boundaries Manager
            </h3>
            <span className="bg-slate-800 text-sky-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-700 ml-1">
              {boundaries.length} {boundaries.length === 1 ? 'Boundary' : 'Boundaries'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onAddBoundary();
              }}
              className="flex items-center gap-1 text-xs font-mono bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Layer</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content: Two-column layout (List on left, Settings on right) */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 overflow-y-auto flex-1">
          {/* Left Column: Boundaries List (2 cols) */}
          <div className="md:col-span-2 space-y-2 border-r border-slate-800/80 pr-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Boundary Layers
              </span>
              <button
                type="button"
                id="btn-add-new-boundary"
                onClick={onAddBoundary}
                className="flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300"
                title="Create a new boundary layer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Layer</span>
              </button>
            </div>

            {/* List */}
            {boundaries.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-center space-y-2">
                <p className="text-xs text-slate-400 font-mono">No boundaries created yet.</p>
                <button
                  type="button"
                  onClick={onAddBoundary}
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-mono"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Boundary</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {boundaries.map((b, idx) => {
                  const isSelected = currentBoundary?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectBoundary(b.id)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-sky-500 bg-sky-950/30 ring-1 ring-sky-500/50'
                          : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: b.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold text-slate-200 truncate">
                            {b.name || `Boundary ${idx + 1}`}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                            <span className="text-sky-300 font-bold">{b.points.length} pts</span>
                            {b.isClosed && <span className="text-sky-400">• Closed</span>}
                            <span>• {b.thickness}px</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions: Draw on Canvas, Visibility & Delete */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartDrawingBoundary(b.id);
                          }}
                          className="flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded transition shadow-sm"
                          title="Draw or plot points for this boundary on canvas"
                        >
                          <PenTool className="w-3 h-3 text-amber-400" />
                          <span>Draw</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleBoundaryVisibility(b.id)}
                          className={`p-1 rounded transition ${
                            b.visible !== false
                              ? 'text-sky-400 hover:bg-slate-800'
                              : 'text-slate-600 hover:bg-slate-800'
                          }`}
                          title={b.visible !== false ? 'Hide Boundary' : 'Show Boundary'}
                        >
                          {b.visible !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBoundary(b.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete Boundary"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Boundary Style & Geometry Editor (3 cols) */}
          <div className="md:col-span-3 space-y-3.5">
            {currentBoundary ? (
              <>
                {/* Boundary Name Input */}
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Type className="w-3.5 h-3.5 text-sky-400" />
                    <span>Tactical Name / Designation</span>
                  </label>
                  <input
                    type="text"
                    value={currentBoundary.name}
                    onChange={(e) =>
                      onUpdateBoundary({ ...currentBoundary, name: e.target.value })
                    }
                    placeholder="e.g. SIMULATED BOUNDARY, PHASE LINE ALPHA"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Displays as a tactical badge along the reprojected boundary line.
                  </p>
                </div>

                {/* Boundary Color Palette */}
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Palette className="w-3.5 h-3.5 text-rose-400" />
                    <span>Boundary Line Colour</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESET_COLORS.map((item) => {
                      const isSelected =
                        currentBoundary.color.toLowerCase() === item.color.toLowerCase();
                      return (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() =>
                            onUpdateBoundary({ ...currentBoundary, color: item.color })
                          }
                          className={`flex items-center gap-1.5 p-1 rounded border text-left font-mono text-[10px] transition ${
                            isSelected
                              ? 'border-white bg-slate-800 text-white font-bold ring-1 ring-white/40'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Input */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 font-mono">Custom Color:</span>
                    <input
                      type="color"
                      value={currentBoundary.color}
                      onChange={(e) =>
                        onUpdateBoundary({ ...currentBoundary, color: e.target.value })
                      }
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-slate-300 uppercase">
                      {currentBoundary.color}
                    </span>
                  </div>
                </div>

                {/* Line Size / Thickness Slider */}
                <div>
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider">
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      Line Thickness / Size
                    </span>
                    <span className="text-sky-300 font-bold">{currentBoundary.thickness} px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={currentBoundary.thickness}
                    onChange={(e) =>
                      onUpdateBoundary({
                        ...currentBoundary,
                        thickness: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                  />
                  {/* Live Stroke Preview */}
                  <div className="mt-1.5 h-6 bg-slate-950 rounded flex items-center justify-center px-4 border border-slate-800">
                    <div
                      className="w-full rounded transition-all"
                      style={{
                        height: `${currentBoundary.thickness}px`,
                        backgroundColor: currentBoundary.color,
                      }}
                    />
                  </div>
                </div>

                {/* Closed Perimeter & Fill Opacity */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentBoundary.isClosed ?? false}
                        onChange={(e) =>
                          onUpdateBoundary({ ...currentBoundary, isClosed: e.target.checked })
                        }
                        className="rounded border-slate-700 text-sky-500 focus:ring-0"
                      />
                      <span className="font-mono text-[11px] text-slate-300 font-bold">
                        Close Perimeter
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Connects last point back to first
                    </p>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>Area Tint</span>
                      <span className="text-sky-300 font-bold">
                        {Math.round((currentBoundary.fillOpacity || 0.08) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.35"
                      step="0.05"
                      value={currentBoundary.fillOpacity ?? 0.08}
                      onChange={(e) =>
                        onUpdateBoundary({
                          ...currentBoundary,
                          fillOpacity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                </div>

                {/* Prominent Canvas Drawing & Point Plotting Section */}
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-950/70 to-slate-950/70 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                        <PenTool className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-amber-200 uppercase tracking-wide">
                          Plot / Draw on Canvas
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {currentBoundary.points.length > 0
                            ? `${currentBoundary.points.length} perimeter points anchored`
                            : 'No points plotted yet'}
                        </div>
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        borderColor: currentBoundary.color,
                        color: currentBoundary.color,
                        backgroundColor: `${currentBoundary.color}15`,
                      }}
                    >
                      {currentBoundary.name}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Click <strong>Draw Boundary</strong> to close this manager and anchor boundary points directly on the camera viewport with live homography reprojection.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      id="btn-modal-start-drawing"
                      onClick={() => {
                        onClose();
                        onStartDrawingBoundary(currentBoundary.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs py-2 px-3 rounded-lg shadow-md transition"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>
                        {currentBoundary.points.length > 0 ? 'Redraw / Extend Points' : 'Start Drawing Points'}
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-modal-clear-boundary-points"
                      onClick={() => onClearBoundaryPoints(currentBoundary.id)}
                      disabled={currentBoundary.points.length === 0}
                      className="flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 disabled:opacity-30 disabled:pointer-events-none py-2 px-3 rounded-lg transition"
                      title="Clear all points for this boundary"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Points</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 font-mono text-xs">
                Select a boundary layer from the left list or create a new one.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {currentBoundary && (
              <button
                type="button"
                id="btn-footer-draw-boundary"
                onClick={() => {
                  onClose();
                  onStartDrawingBoundary(currentBoundary.id);
                }}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs px-3.5 py-1.5 rounded transition shadow-md"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Draw on Canvas</span>
              </button>
            )}
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              Each boundary layer reprojects accurately across camera motion.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
