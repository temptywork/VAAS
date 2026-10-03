import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Video,
  Play,
  Square,
  Bookmark,
  Plus,
  Trash2,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
  Shield,
  Radio,
} from 'lucide-react';
import { OnvifConfig, OnvifPreset, OnvifStatus } from '../types';
import { onvifService } from '../services/onvifService';

interface OnvifPtzControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFfmpegModal: () => void;
  onOpenPtzMemoryDrawer: () => void;
  currentCamPan: number;
  currentCamTilt: number;
  currentCamZoom: number;
  onSyncCameraPtz?: (pan: number, tilt: number, zoom: number) => void;
}

export const OnvifPtzControlPanel: React.FC<OnvifPtzControlPanelProps> = ({
  isOpen,
  onClose,
  onOpenFfmpegModal,
  onOpenPtzMemoryDrawer,
  currentCamPan,
  currentCamTilt,
  currentCamZoom,
  onSyncCameraPtz,
}) => {
  const [status, setStatus] = useState<OnvifStatus>(onvifService.getStatus());
  const [config, setConfig] = useState<OnvifConfig>(onvifService.getConfig());
  const [presets, setPresets] = useState<OnvifPreset[]>(onvifService.getPresets());
  const [speed, setSpeed] = useState<number>(0.5); // 0.1 to 1.0
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [isAddingPreset, setIsAddingPreset] = useState<boolean>(false);
  const [showSoapInspector, setShowSoapInspector] = useState<boolean>(false);
  const [manualCoords, setManualCoords] = useState<{ pan: number; tilt: number; zoom: number }>({
    pan: 0,
    tilt: 0,
    zoom: 1.0,
  });

  // Subscribe to ONVIF service updates
  useEffect(() => {
    const unsub = onvifService.subscribe((s) => {
      setStatus(s);
      setPresets(onvifService.getPresets());
    });
    return unsub;
  }, []);

  // Sync manual coordinate inputs when not typing
  useEffect(() => {
    setManualCoords({
      pan: Math.round(status.ptzStatus.pan * 10) / 10,
      tilt: Math.round(status.ptzStatus.tilt * 10) / 10,
      zoom: Math.round(status.ptzStatus.zoom * 100) / 100,
    });
  }, [status.ptzStatus.pan, status.ptzStatus.tilt, status.ptzStatus.zoom]);

  if (!isOpen) return null;

  // Continuous move press-and-hold handlers
  const handleContinuousMoveStart = (panFactor: number, tiltFactor: number) => {
    onvifService.continuousMove(panFactor * speed, tiltFactor * speed, 0);
  };

  const handleContinuousMoveEnd = () => {
    onvifService.stop(true, true);
  };

  const handleZoomContinuous = (zoomFactor: number) => {
    onvifService.continuousMove(0, 0, zoomFactor * speed);
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onvifService.setPreset(newPresetName.trim());
    setNewPresetName('');
    setIsAddingPreset(false);
    setPresets(onvifService.getPresets());
  };

  const handleApplyManualMove = (e: React.FormEvent) => {
    e.preventDefault();
    onvifService.absoluteMove(manualCoords.pan, manualCoords.tilt, manualCoords.zoom);
  };

  return (
    <div
      id="onvif-ptz-control-panel"
      className="absolute top-16 right-4 z-30 w-84 bg-slate-900/95 border border-sky-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs text-slate-200 select-none flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="font-mono font-bold text-sky-300 flex items-center gap-1.5">
              <span>ONVIF PTZ CONTROLLER</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 border border-emerald-500/60 text-emerald-300 rounded font-semibold">
                PROFILE S/T
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
              <span>{config.cameraName || 'PTZ-OPTIX-4K'}</span>
              <span>•</span>
              <span className="text-sky-400">{status.isVirtual ? 'VIRTUAL MOTOR' : config.host}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          title="Close Panel"
        >
          ✕
        </button>
      </div>

      {/* Main Controls Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Live Telemetry Pill Banner */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 font-mono text-[11px] grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">PAN (AZIMUTH)</span>
            <span className="text-sky-300 font-bold">{status.ptzStatus.pan.toFixed(1)}°</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">TILT (ELEVATION)</span>
            <span className="text-amber-300 font-bold">{status.ptzStatus.tilt.toFixed(1)}°</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">OPTICAL ZOOM</span>
            <span className="text-emerald-300 font-bold">{status.ptzStatus.zoom.toFixed(2)}x</span>
          </div>
        </div>

        {/* 8-Directional Virtual PTZ Joystick / D-Pad */}
        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-2">
            <span className="uppercase tracking-wider">Continuous PTZ D-Pad</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${status.ptzStatus.moveStatus === 'MOVING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              {status.ptzStatus.moveStatus}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 w-36">
            {/* Top-Left */}
            <button
              onMouseDown={() => handleContinuousMoveStart(-0.7, 0.7)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(-0.7, 0.7)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Left & Tilt Up"
            >
              <div className="rotate-[-45deg]"><ArrowUp className="w-3.5 h-3.5" /></div>
            </button>
            {/* Tilt Up */}
            <button
              onMouseDown={() => handleContinuousMoveStart(0, 1.0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(0, 1.0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Tilt Up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            {/* Top-Right */}
            <button
              onMouseDown={() => handleContinuousMoveStart(0.7, 0.7)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(0.7, 0.7)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Right & Tilt Up"
            >
              <div className="rotate-[45deg]"><ArrowUp className="w-3.5 h-3.5" /></div>
            </button>

            {/* Pan Left */}
            <button
              onMouseDown={() => handleContinuousMoveStart(-1.0, 0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(-1.0, 0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Left"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {/* Center Home Position */}
            <button
              onClick={() => onvifService.gotoHome()}
              className="h-10 bg-sky-950/80 hover:bg-sky-700 border border-sky-500/40 rounded text-sky-300 hover:text-white flex flex-col items-center justify-center transition"
              title="Goto Home Position (0°, 0°, 1x)"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="text-[8px] font-mono mt-0.5">HOME</span>
            </button>
            {/* Pan Right */}
            <button
              onMouseDown={() => handleContinuousMoveStart(1.0, 0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(1.0, 0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Right"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Bottom-Left */}
            <button
              onMouseDown={() => handleContinuousMoveStart(-0.7, -0.7)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(-0.7, -0.7)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Left & Tilt Down"
            >
              <div className="rotate-[45deg]"><ArrowDown className="w-3.5 h-3.5" /></div>
            </button>
            {/* Tilt Down */}
            <button
              onMouseDown={() => handleContinuousMoveStart(0, -1.0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(0, -1.0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Tilt Down"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            {/* Bottom-Right */}
            <button
              onMouseDown={() => handleContinuousMoveStart(0.7, -0.7)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleContinuousMoveStart(0.7, -0.7)}
              onTouchEnd={handleContinuousMoveEnd}
              className="h-10 bg-slate-800/80 hover:bg-sky-600 rounded text-slate-300 hover:text-white flex items-center justify-center transition active:bg-sky-500"
              title="Pan Right & Tilt Down"
            >
              <div className="rotate-[-45deg]"><ArrowDown className="w-3.5 h-3.5" /></div>
            </button>
          </div>

          {/* Motor Speed Slider */}
          <div className="w-full mt-3 pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>Slew Velocity / Speed</span>
              <span className="text-sky-300">{Math.round(speed * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Optical Zoom Controls */}
        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-2">
            <span className="uppercase tracking-wider">Continuous Zoom Control</span>
            <span className="text-emerald-400 font-bold">{status.ptzStatus.zoom.toFixed(2)}x</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => handleZoomContinuous(-1.0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleZoomContinuous(-1.0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded text-slate-200 flex items-center justify-center gap-1.5 font-mono text-[11px]"
              title="Press and hold to Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>WIDE (-)</span>
            </button>

            <button
              onMouseDown={() => handleZoomContinuous(1.0)}
              onMouseUp={handleContinuousMoveEnd}
              onTouchStart={() => handleZoomContinuous(1.0)}
              onTouchEnd={handleContinuousMoveEnd}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded text-slate-200 flex items-center justify-center gap-1.5 font-mono text-[11px]"
              title="Press and hold to Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>TELE (+)</span>
            </button>
          </div>

          <div className="mt-2.5">
            <input
              type="range"
              min="0.6"
              max="10.0"
              step="0.1"
              value={status.ptzStatus.zoom}
              onChange={(e) => onvifService.absoluteMove(status.ptzStatus.pan, status.ptzStatus.tilt, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Absolute Coordinate Movement */}
        <form onSubmit={handleApplyManualMove} className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
            Absolute Move Command (Degrees)
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2 font-mono">
            <div>
              <label className="text-[9px] text-slate-500 block mb-0.5">PAN (°)</label>
              <input
                type="number"
                step="0.5"
                min="-180"
                max="180"
                value={manualCoords.pan}
                onChange={(e) => setManualCoords({ ...manualCoords, pan: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-sky-300 text-[11px]"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 block mb-0.5">TILT (°)</label>
              <input
                type="number"
                step="0.5"
                min="-90"
                max="90"
                value={manualCoords.tilt}
                onChange={(e) => setManualCoords({ ...manualCoords, tilt: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-amber-300 text-[11px]"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 block mb-0.5">ZOOM (x)</label>
              <input
                type="number"
                step="0.1"
                min="0.6"
                max="30"
                value={manualCoords.zoom}
                onChange={(e) => setManualCoords({ ...manualCoords, zoom: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-emerald-300 text-[11px]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-sky-700 hover:bg-sky-600 rounded text-white font-mono text-[11px] font-semibold transition"
          >
            SLEW TO COORDS
          </button>
        </form>

        {/* Preset Positions List & Quick Recall */}
        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              ONVIF Presets ({presets.length})
            </span>
            <button
              onClick={() => setIsAddingPreset(!isAddingPreset)}
              className="text-[10px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Store Current</span>
            </button>
          </div>

          {isAddingPreset && (
            <form onSubmit={handleSavePreset} className="mb-2 flex gap-1.5">
              <input
                type="text"
                placeholder="Preset Name (e.g. TACTICAL OVERWATCH)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                className="flex-1 bg-slate-900 border border-sky-500/50 rounded px-2 py-1 text-[11px] font-mono text-slate-200"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-mono font-bold"
              >
                SAVE
              </button>
            </form>
          )}

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {presets.map((preset) => (
              <div
                key={preset.token}
                className="flex items-center justify-between p-1.5 bg-slate-900/80 hover:bg-slate-800/90 rounded border border-slate-800/80 text-[11px] font-mono"
              >
                <div
                  onClick={() => onvifService.gotoPreset(preset.token)}
                  className="flex-1 cursor-pointer hover:text-sky-300"
                >
                  <div className="font-semibold truncate text-slate-200">{preset.name}</div>
                  <div className="text-[9px] text-slate-400">
                    P:{preset.pan}° T:{preset.tilt}° Z:{preset.zoom}x
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onvifService.gotoPreset(preset.token)}
                    className="p-1 text-sky-400 hover:text-white hover:bg-sky-950 rounded"
                    title="Goto Preset"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onvifService.removePreset(preset.token)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded"
                    title="Remove Preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Nav to PTZ Object Memory & FFmpeg Hub */}
        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
          <button
            onClick={onOpenPtzMemoryDrawer}
            className="p-2 bg-slate-800 hover:bg-sky-800/60 border border-sky-500/30 rounded-lg text-sky-300 flex items-center justify-center gap-1.5 transition"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>OBJECT MEMORY</span>
          </button>

          <button
            onClick={onOpenFfmpegModal}
            className="p-2 bg-slate-800 hover:bg-amber-800/60 border border-amber-500/30 rounded-lg text-amber-300 flex items-center justify-center gap-1.5 transition"
          >
            <Video className="w-3.5 h-3.5" />
            <span>FFMPEG HUB</span>
          </button>
        </div>

        {/* Collapsible ONVIF SOAP / Protocol Inspector */}
        <div className="border-t border-slate-800 pt-2 font-mono">
          <button
            onClick={() => setShowSoapInspector(!showSoapInspector)}
            className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200"
          >
            <span className="flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              <span>SOAP Protocol Inspector</span>
            </span>
            <span>{showSoapInspector ? '▲ Hide' : '▼ View'}</span>
          </button>

          {showSoapInspector && (
            <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-800 text-[10px] text-slate-300 space-y-1">
              <div>
                <span className="text-slate-500">Last Command:</span>
                <pre className="text-sky-300 truncate">{status.lastSoapCommand || 'None'}</pre>
              </div>
              <div>
                <span className="text-slate-500">Response:</span>
                <pre className="text-emerald-400 truncate">{status.lastSoapResponse || '200 OK'}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
