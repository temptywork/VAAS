import React from 'react';
import { SimulatorCameraState } from './ExerciseTerrainRenderer';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Eye,
  Activity,
  Sliders,
  Flame,
} from 'lucide-react';

interface ExerciseSimulatorControlsProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulatorCameraState;
  onChangeState: (updater: (prev: SimulatorCameraState) => SimulatorCameraState) => void;
}

export const ExerciseSimulatorControls: React.FC<ExerciseSimulatorControlsProps> = ({
  isOpen,
  onClose,
  state,
  onChangeState,
}) => {
  if (!isOpen) return null;

  const handlePan = (dx: number, dy: number) => {
    onChangeState((prev) => ({
      ...prev,
      panX: Math.max(-350, Math.min(350, prev.panX + dx)),
      tiltY: Math.max(-180, Math.min(180, prev.tiltY + dy)),
    }));
  };

  const handleReset = () => {
    onChangeState((prev) => ({
      ...prev,
      panX: 0,
      tiltY: 0,
      zoom: 1.0,
      jitter: 0,
      autoPatrol: false,
    }));
  };

  return (
    <div
      id="simulator-ptz-controls-floating"
      className="absolute bottom-10 left-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md w-72 text-xs text-slate-200 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
        <div className="flex items-center gap-1.5 font-mono font-bold text-sky-400">
          <Sliders className="w-3.5 h-3.5" />
          <span>Camera PTZ Simulator</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-1 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {/* Virtual Pan/Tilt Directional Pad */}
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5 flex justify-between">
            <span>Pan / Tilt Control</span>
            <span className="text-sky-300">
              X:{Math.round(state.panX)} Y:{Math.round(state.tiltY)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto">
            <div />
            <button
              onClick={() => handlePan(0, -25)}
              className="p-2 bg-slate-800 hover:bg-sky-700 rounded text-slate-200 hover:text-white flex items-center justify-center transition"
              title="Tilt Up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <div />

            <button
              onClick={() => handlePan(-35, 0)}
              className="p-2 bg-slate-800 hover:bg-sky-700 rounded text-slate-200 hover:text-white flex items-center justify-center transition"
              title="Pan Left"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white flex items-center justify-center transition text-[10px] font-mono"
              title="Recenter Camera"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              onClick={() => handlePan(35, 0)}
              className="p-2 bg-slate-800 hover:bg-sky-700 rounded text-slate-200 hover:text-white flex items-center justify-center transition"
              title="Pan Right"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div />
            <button
              onClick={() => handlePan(0, 25)}
              className="p-2 bg-slate-800 hover:bg-sky-700 rounded text-slate-200 hover:text-white flex items-center justify-center transition"
              title="Tilt Down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <div />
          </div>
        </div>

        {/* Zoom Slider */}
        <div>
          <div className="flex justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-400">Optical Zoom</span>
            <span className="text-sky-400 font-bold">{state.zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.05"
            value={state.zoom}
            onChange={(e) =>
              onChangeState((prev) => ({ ...prev, zoom: parseFloat(e.target.value) }))
            }
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Camera Jitter (Shake) */}
        <div>
          <div className="flex justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-400">Vibration / Shake</span>
            <span className="text-amber-400 font-bold">{Math.round(state.jitter * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={state.jitter}
            onChange={(e) =>
              onChangeState((prev) => ({ ...prev, jitter: parseFloat(e.target.value) }))
            }
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Quick Toggles */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {/* Auto Patrol Mode */}
          <button
            onClick={() =>
              onChangeState((prev) => ({ ...prev, autoPatrol: !prev.autoPatrol }))
            }
            className={`flex-1 py-1 px-2 rounded font-mono text-[11px] transition border flex items-center justify-center gap-1 ${
              state.autoPatrol
                ? 'bg-sky-950 border-sky-500 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Patrol: {state.autoPatrol ? 'ON' : 'OFF'}</span>
          </button>

          {/* Thermal FLIR mode */}
          <button
            onClick={() =>
              onChangeState((prev) => ({ ...prev, flirThermal: !prev.flirThermal }))
            }
            className={`flex-1 py-1 px-2 rounded font-mono text-[11px] transition border flex items-center justify-center gap-1 ${
              state.flirThermal
                ? 'bg-amber-950 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>FLIR: {state.flirThermal ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
