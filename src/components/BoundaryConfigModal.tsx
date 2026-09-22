import React from 'react';
import { BoundaryConfig } from '../types';
import { ShieldAlert, Check, Palette, Maximize2, Type, RefreshCw, Trash2 } from 'lucide-react';

interface BoundaryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BoundaryConfig;
  onChangeConfig: (updater: (prev: BoundaryConfig) => BoundaryConfig) => void;
  pointCount: number;
  isDrawing: boolean;
  onStartDrawing: () => void;
  onClearBoundary: () => void;
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
  config,
  onChangeConfig,
  pointCount,
  isDrawing,
  onStartDrawing,
  onClearBoundary,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="boundary-config-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div
        id="boundary-config-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Configure Exercise Boundary
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Status summary */}
          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-mono">Current Status:</span>
            <span className="font-mono font-bold text-sky-400">
              {pointCount > 0
                ? `${pointCount} points anchored`
                : isDrawing
                ? 'Actively drawing...'
                : 'No points defined'}
            </span>
          </div>

          {/* Boundary Name Input */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>Boundary Label / Tactical Name</span>
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="SIMULATED / EXERCISE BOUNDARY"
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-slate-100 text-xs focus:outline-none focus:border-sky-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Displays as a military badge along the boundary line.
            </p>
          </div>

          {/* Boundary Colour Selection */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Palette className="w-3.5 h-3.5 text-rose-400" />
              <span>Boundary Line Colour</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_COLORS.map((item) => {
                const isSelected = config.color.toLowerCase() === item.color.toLowerCase();
                return (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({ ...prev, color: item.color }))
                    }
                    className={`flex items-center gap-2 p-1.5 rounded border text-left font-mono text-[11px] transition ${
                      isSelected
                        ? 'border-white bg-slate-800 text-white font-bold ring-1 ring-white/40'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow"
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
                value={config.color}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, color: e.target.value }))
                }
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-[11px] text-slate-300 uppercase">
                {config.color}
              </span>
            </div>
          </div>

          {/* Line Size / Thickness Slider */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                Line Thickness / Size
              </span>
              <span className="text-sky-300 font-bold">{config.thickness} px</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={config.thickness}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  thickness: parseInt(e.target.value) || 3,
                }))
              }
              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
            />
            {/* Live visual line thickness preview */}
            <div className="mt-2 h-7 bg-slate-950 rounded flex items-center justify-center px-4 border border-slate-800">
              <div
                className="w-full rounded transition-all"
                style={{
                  height: `${config.thickness}px`,
                  backgroundColor: config.color,
                }}
              />
            </div>
          </div>

          {/* Closed Loop & Fill Opacity */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.closed ?? true}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({ ...prev, closed: e.target.checked }))
                  }
                  className="rounded border-slate-700 text-sky-500 focus:ring-0"
                />
                <span className="font-mono text-[11px] text-slate-300">
                  Close Perimeter
                </span>
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Connects final point to first point
              </p>
            </div>

            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Area Tint</span>
                <span className="text-sky-300 font-bold">
                  {Math.round((config.fillOpacity || 0.08) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.35"
                step="0.05"
                value={config.fillOpacity || 0.08}
                onChange={(e) =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    fillOpacity: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClearBoundary();
              }}
              disabled={pointCount === 0}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded hover:bg-slate-800 transition font-mono"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Boundary</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartDrawing();
              }}
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 px-2 py-1 rounded hover:bg-slate-800 transition font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{pointCount > 0 ? 'Redraw Points' : 'Draw Boundary'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
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
