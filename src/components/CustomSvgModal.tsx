import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Check,
  RotateCw,
  Palette,
  AlertTriangle,
  Layers,
  FileCode,
} from 'lucide-react';
import { DEFAULT_TACTICAL_SVGS, TacticalSvgPreset, colorizeTacticalSvg } from '../data/tacticalSvgPresets';
import { CustomPlacementOptions } from './AddFeatureModal';

interface CustomSvgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSvgForPlacement: (
    label: string,
    rotation: number,
    options: CustomPlacementOptions & {
      opacity?: number;
      layer?: 'symbols' | 'labels' | 'boundary' | 'base';
    }
  ) => void;
}

const COLOR_PALETTE = [
  { label: 'Red (Hostile/OPFOR)', color: '#ef4444' },
  { label: 'Amber (Caution/Warning)', color: '#f59e0b' },
  { label: 'Yellow (Logistics/Armor)', color: '#eab308' },
  { label: 'Green (Friendly/Infantry)', color: '#10b981' },
  { label: 'Cyan (Recon/OP)', color: '#06b6d4' },
  { label: 'Sky (Tactical AR)', color: '#38bdf8' },
  { label: 'Blue (Command/Comm)', color: '#3b82f6' },
  { label: 'Purple (HQ/Command)', color: '#a855f7' },
  { label: 'White (Neutral/Mark)', color: '#f8fafc' },
];

export const CustomSvgModal: React.FC<CustomSvgModalProps> = ({
  isOpen,
  onClose,
  onSelectSvgForPlacement,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_TACTICAL_SVGS[0].id);
  const [svgDataUrl, setSvgDataUrl] = useState<string>(DEFAULT_TACTICAL_SVGS[0].dataUrl);
  const [svgRaw, setSvgRaw] = useState<string>(DEFAULT_TACTICAL_SVGS[0].svgRaw);
  const [svgFileName, setSvgFileName] = useState<string>(`${DEFAULT_TACTICAL_SVGS[0].name}.svg`);
  const [label, setLabel] = useState<string>(DEFAULT_TACTICAL_SVGS[0].label);
  const [color, setColor] = useState<string>(DEFAULT_TACTICAL_SVGS[0].defaultColor);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(0.95);
  const [layer, setLayer] = useState<'symbols' | 'labels' | 'boundary'>('symbols');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const validateAndLoadSvgString = (rawContent: string, name: string) => {
    try {
      // Validate XML & SVG structure per PRD Section 19
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawContent, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        setValidationError('Invalid SVG structure. Malformed XML elements detected.');
        return false;
      }
      const svgEl = doc.querySelector('svg');
      if (!svgEl) {
        setValidationError('Invalid file: Missing root <svg> element.');
        return false;
      }

      setValidationError(null);
      setSvgRaw(rawContent);
      setSvgFileName(name);
      setSelectedPresetId('custom_uploaded');

      // Create data URL
      const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(rawContent)}`;
      setSvgDataUrl(encoded);

      if (!label) {
        const cleanName = name.replace(/\.svg$/i, '').toUpperCase();
        setLabel(`SIM ${cleanName}`);
      }
      return true;
    } catch (err: any) {
      setValidationError(`Failed to parse SVG: ${err?.message || 'unknown error'}`);
      return false;
    }
  };

  const handleProcessFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      setValidationError('Please select a valid .svg vector file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      validateAndLoadSvgString(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleSelectPreset = (preset: TacticalSvgPreset) => {
    setSelectedPresetId(preset.id);
    setSvgRaw(preset.svgRaw);
    setSvgFileName(`${preset.name}.svg`);
    setColor(preset.defaultColor);
    setLabel(preset.label);
    setValidationError(null);
    setSvgDataUrl(colorizeTacticalSvg(preset.svgRaw, preset.defaultColor));
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    const updatedUrl = colorizeTacticalSvg(svgRaw, newColor);
    setSvgDataUrl(updatedUrl);
  };

  const handleConfirmPlacement = () => {
    if (validationError || !svgDataUrl) return;
    const finalDataUrl = colorizeTacticalSvg(svgRaw, color);

    onSelectSvgForPlacement(label.trim() || 'SIM SVG SYMBOL', rotation, {
      customImage: finalDataUrl,
      customImageType: 'svg',
      scale,
      opacity,
      color,
      layer,
    });
    onClose();
  };

  return (
    <div
      id="custom-svg-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-slate-200"
    >
      <div
        id="custom-svg-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Custom SVG Vector Symbol
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
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 font-mono">
            <span className="text-sky-400 font-bold">PRD Section 19:</span> Render scalable resolution vector symbols, customize military colors, adjust scale and orientation, and anchor onto live video feed.
          </div>

          {/* Upload SVG Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleProcessFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? 'border-sky-400 bg-sky-950/40 text-sky-200'
                : 'border-slate-700 hover:border-sky-500/70 bg-slate-950/40 text-slate-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 bg-slate-950 border border-sky-500/50 rounded-lg p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  opacity: opacity,
                }}
              >
                <img
                  src={svgDataUrl}
                  alt="SVG Preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left">
                <div className="font-mono text-xs font-bold text-sky-300 truncate max-w-[240px]">
                  {svgFileName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Vector Scalable • Click or drop to upload custom .svg
                </div>
              </div>
            </div>
          </div>

          {validationError && (
            <div className="bg-rose-950/70 border border-rose-600/50 rounded-lg p-2.5 flex items-center gap-2 text-rose-300 font-mono text-[11px]">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Tactical SVG Presets Grid */}
          <div>
            <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Standard Military Presets</span>
              <span className="text-[10px] text-sky-400">Click to preview</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_TACTICAL_SVGS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                      isSelected
                        ? 'bg-sky-950/80 border-sky-400 text-sky-200 ring-1 ring-sky-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded p-1 shrink-0 flex items-center justify-center border"
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderColor: preset.defaultColor,
                      }}
                    >
                      <img src={preset.dataUrl} alt={preset.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{preset.name}</div>
                      <div className="text-[9px] font-mono text-slate-500 truncate">{preset.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls: Label, Color, Scale, Rotation, Opacity, Layer */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Exercise Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. SIM TANK 01"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Vector Color Palette */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3 text-sky-400" />
                  Symbol Vector Color
                </span>
                <span className="text-slate-300 font-bold">{color}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLOR_PALETTE.map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => handleColorChange(item.color)}
                    title={item.label}
                    className={`w-6 h-6 rounded-full border-2 transition transform ${
                      color.toLowerCase() === item.color.toLowerCase()
                        ? 'border-white scale-125 shadow-md shadow-sky-500/30'
                        : 'border-slate-800 hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: item.color }}
                  />
                ))}
                <div className="relative flex items-center ml-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-6 h-6 rounded-full border border-slate-700 bg-transparent cursor-pointer p-0"
                    title="Custom Hex Color"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Rotation</span>
                  <span className="text-sky-300 font-bold">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="15"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Scale</span>
                  <span className="text-sky-300 font-bold">{scale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Opacity</span>
                  <span className="text-sky-300 font-bold">{(opacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="text-[11px] font-mono text-slate-400 mb-1">
                  <span>Target Layer</span>
                </div>
                <select
                  value={layer}
                  onChange={(e) => setLayer(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                >
                  <option value="symbols">Symbols Layer</option>
                  <option value="labels">Labels Layer</option>
                  <option value="boundary">Boundary Layer</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Click on live video feed to place symbol
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-custom-svg"
              type="button"
              onClick={handleConfirmPlacement}
              disabled={Boolean(validationError)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Place on Live Video</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
