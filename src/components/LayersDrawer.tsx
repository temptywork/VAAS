import React from 'react';
import {
  Layers,
  Video,
  ShieldAlert,
  Crosshair,
  Type,
  Activity,
  Eye,
  EyeOff,
  Sliders,
  RotateCcw,
  Check,
} from 'lucide-react';
import { SystemLayers, OverlaySettings } from '../types';

interface LayersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  systemLayers: SystemLayers;
  onUpdateSystemLayers: (layers: SystemLayers) => void;
  overlaySettings: OverlaySettings;
  onUpdateOverlaySettings: (settings: OverlaySettings) => void;
  featureCount: number;
  boundaryCount: number;
}

export const LayersDrawer: React.FC<LayersDrawerProps> = ({
  isOpen,
  onClose,
  systemLayers,
  onUpdateSystemLayers,
  overlaySettings,
  onUpdateOverlaySettings,
  featureCount,
  boundaryCount,
}) => {
  if (!isOpen) return null;

  const handleToggleLayer = (layerKey: keyof SystemLayers) => {
    onUpdateSystemLayers({
      ...systemLayers,
      [layerKey]: {
        ...systemLayers[layerKey],
        visible: !systemLayers[layerKey].visible,
      },
    });
  };

  const handleLayerOpacity = (layerKey: keyof SystemLayers, opacity: number) => {
    onUpdateSystemLayers({
      ...systemLayers,
      [layerKey]: {
        ...systemLayers[layerKey],
        opacity,
      },
    });
  };

  const handleResetLayers = () => {
    onUpdateSystemLayers({
      baseVideo: { visible: true, opacity: 1.0, contrast: 100, brightness: 100 },
      boundary: { visible: true, opacity: 0.9 },
      symbols: { visible: true, opacity: 0.95 },
      labels: { visible: true, opacity: 1.0 },
      status: { visible: true, opacity: 0.9 },
    });
    onUpdateOverlaySettings({
      ...overlaySettings,
      showAllLayers: true,
      showBoundary: true,
      showSymbols: true,
      showLabels: true,
      showHUD: true,
    });
  };

  return (
    <div
      id="layers-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end p-0 text-slate-200"
    >
      <div
        id="layers-drawer-panel"
        className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Exercise Layers &amp; Overlay Engine
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs font-mono">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 font-mono">
            <span className="text-sky-400 font-bold">PRD Section 21:</span> Manage and isolate video canvas layers (Base Video, Boundary, Symbols, Labels, Status diagnostics) with independent visibility and opacity.
          </div>

          {/* Master Layer Control */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Master Overlays Switch</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {overlaySettings.showAllLayers !== false ? 'All tactical layers rendered' : 'All overlays suppressed'}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateOverlaySettings({
                  ...overlaySettings,
                  showAllLayers: !(overlaySettings.showAllLayers !== false),
                })
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition border ${
                overlaySettings.showAllLayers !== false
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                  : 'bg-amber-950 text-amber-300 border-amber-500/60'
              }`}
            >
              {overlaySettings.showAllLayers !== false ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>ENABLED</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>SUPPRESSED</span>
                </>
              )}
            </button>
          </div>

          {/* Layer 1: Base Video */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="font-bold text-slate-200">1. Base Video Layer</span>
                  <span className="text-[10px] text-slate-500 block">RTSP / ONVIF Camera Stream</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleLayer('baseVideo')}
                className={`p-1.5 rounded border transition ${
                  systemLayers.baseVideo.visible
                    ? 'text-sky-400 border-sky-500/40 bg-sky-950/30'
                    : 'text-slate-500 border-slate-800 bg-slate-900'
                }`}
                title="Toggle Base Video visibility"
              >
                {systemLayers.baseVideo.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            {systemLayers.baseVideo.visible && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Stream Opacity</span>
                  <span className="text-sky-300 font-bold">
                    {(systemLayers.baseVideo.opacity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={systemLayers.baseVideo.opacity}
                  onChange={(e) => handleLayerOpacity('baseVideo', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
            )}
          </div>

          {/* Layer 2: Exercise Boundary */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="font-bold text-slate-200">2. Boundary Layer</span>
                  <span className="text-[10px] text-slate-500 block">
                    {boundaryCount} Exercise Polygon{boundaryCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleToggleLayer('boundary');
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    showBoundary: !systemLayers.boundary.visible,
                  });
                }}
                className={`p-1.5 rounded border transition ${
                  systemLayers.boundary.visible
                    ? 'text-amber-400 border-amber-500/40 bg-amber-950/30'
                    : 'text-slate-500 border-slate-800 bg-slate-900'
                }`}
              >
                {systemLayers.boundary.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            {systemLayers.boundary.visible && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Boundary Opacity</span>
                  <span className="text-amber-300 font-bold">
                    {(systemLayers.boundary.opacity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={systemLayers.boundary.opacity}
                  onChange={(e) => handleLayerOpacity('boundary', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded"
                />
              </div>
            )}
          </div>

          {/* Layer 3: Symbols Layer */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="font-bold text-slate-200">3. Symbols Layer</span>
                  <span className="text-[10px] text-slate-500 block">
                    {featureCount} Military &amp; Custom Symbols
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleToggleLayer('symbols');
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    showSymbols: !systemLayers.symbols.visible,
                  });
                }}
                className={`p-1.5 rounded border transition ${
                  systemLayers.symbols.visible
                    ? 'text-sky-400 border-sky-500/40 bg-sky-950/30'
                    : 'text-slate-500 border-slate-800 bg-slate-900'
                }`}
              >
                {systemLayers.symbols.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            {systemLayers.symbols.visible && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Symbols Opacity</span>
                  <span className="text-sky-300 font-bold">
                    {(systemLayers.symbols.opacity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={systemLayers.symbols.opacity}
                  onChange={(e) => handleLayerOpacity('symbols', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
            )}
          </div>

          {/* Layer 4: Labels Layer */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-bold text-slate-200">4. Labels Layer</span>
                  <span className="text-[10px] text-slate-500 block">Tactical Text Badges</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleToggleLayer('labels');
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    showLabels: !systemLayers.labels.visible,
                  });
                }}
                className={`p-1.5 rounded border transition ${
                  systemLayers.labels.visible
                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30'
                    : 'text-slate-500 border-slate-800 bg-slate-900'
                }`}
              >
                {systemLayers.labels.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            {systemLayers.labels.visible && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Font Size</span>
                  <span className="text-emerald-300 font-bold">{overlaySettings.textSize}px</span>
                </div>
                <input
                  type="range"
                  min="9"
                  max="20"
                  step="1"
                  value={overlaySettings.textSize}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      textSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-400 h-1 bg-slate-800 rounded"
                />
              </div>
            )}
          </div>

          {/* Layer 5: Status & HUD Layer */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="font-bold text-slate-200">5. Status &amp; HUD Layer</span>
                  <span className="text-[10px] text-slate-500 block">Azimuth Compass &amp; PTZ Ribbon</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleToggleLayer('status');
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    showHUD: !systemLayers.status.visible,
                  });
                }}
                className={`p-1.5 rounded border transition ${
                  systemLayers.status.visible
                    ? 'text-purple-400 border-purple-500/40 bg-purple-950/30'
                    : 'text-slate-500 border-slate-800 bg-slate-900'
                }`}
              >
                {systemLayers.status.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
              <span>Offscreen Target Indicators:</span>
              <input
                type="checkbox"
                checked={overlaySettings.showOffscreenPtzIndicators !== false}
                onChange={(e) =>
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    showOffscreenPtzIndicators: e.target.checked,
                  })
                }
                className="accent-purple-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetLayers}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1.5 rounded hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Layers</span>
          </button>
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
