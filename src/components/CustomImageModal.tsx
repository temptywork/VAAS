import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Check,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CustomPlacementOptions } from './AddFeatureModal';

interface CustomImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImageForPlacement: (
    label: string,
    rotation: number,
    options: CustomPlacementOptions & {
      flipH?: boolean;
      flipV?: boolean;
      opacity?: number;
      layer?: 'symbols' | 'labels' | 'boundary' | 'base';
    }
  ) => void;
}

// Built-in tactical high-res exercise photo assets
const SAMPLE_IMAGE_PRESETS = [
  {
    name: 'Armored Target Silhouette',
    category: 'Target Mark',
    label: 'SIM TANK TARGET',
    svgFallback: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="%230f172a" rx="8"/><rect x="25" y="35" width="70" height="25" fill="%23ef4444" rx="4"/><rect x="40" y="22" width="35" height="15" fill="%23b91c1c" rx="3"/><line x1="75" y1="28" x2="110" y2="28" stroke="%23fca5a5" stroke-width="4"/><circle cx="35" cy="62" r="6" fill="%231e293b"/><circle cx="50" cy="62" r="6" fill="%231e293b"/><circle cx="65" cy="62" r="6" fill="%231e293b"/><circle cx="80" cy="62" r="6" fill="%231e293b"/><text x="60" y="74" fill="%23f8fafc" font-size="8" font-family="monospace" text-anchor="middle">SIMULATED PHOTO</text></svg>`,
  },
  {
    name: 'Bunker Hardpoint Photo',
    category: 'Fortification',
    label: 'SIM HARDPOINT PHOTO',
    svgFallback: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="%230f172a" rx="8"/><polygon points="20,60 35,25 85,25 100,60" fill="%23f59e0b"/><rect x="45" y="35" width="30" height="10" fill="%23020617" rx="2"/><text x="60" y="72" fill="%23f8fafc" font-size="8" font-family="monospace" text-anchor="middle">HARDENED BUNKER</text></svg>`,
  },
  {
    name: 'Recon Waypoint Marker',
    category: 'Navigation',
    label: 'RECON WAYPOINT',
    svgFallback: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="%230f172a" rx="8"/><circle cx="60" cy="40" r="22" fill="%230284c7" stroke="%2338bdf8" stroke-width="2"/><circle cx="60" cy="40" r="8" fill="%23f8fafc"/><text x="60" y="72" fill="%2338bdf8" font-size="8" font-family="monospace" text-anchor="middle">WAYPOINT PIN</text></svg>`,
  },
];

export const CustomImageModal: React.FC<CustomImageModalProps> = ({
  isOpen,
  onClose,
  onSelectImageForPlacement,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(SAMPLE_IMAGE_PRESETS[0].svgFallback);
  const [imageType, setImageType] = useState<'jpg' | 'png' | 'other'>('png');
  const [fileName, setFileName] = useState<string>('armored_target_silhouette.png');
  const [label, setLabel] = useState<string>(SAMPLE_IMAGE_PRESETS[0].label);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(0.95);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [layer, setLayer] = useState<'symbols' | 'labels' | 'boundary'>('symbols');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessFile = (file: File) => {
    const isJpg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    setImageType(isJpg ? 'jpg' : isPng ? 'png' : 'other');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageDataUrl(result);
      if (!label) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        setLabel(`SIM ${cleanName}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmPlacement = () => {
    if (!imageDataUrl) return;
    onSelectImageForPlacement(label.trim() || 'SIM CUSTOM IMAGE', rotation, {
      customImage: imageDataUrl,
      customImageType: imageType,
      scale,
      opacity,
      flipH,
      flipV,
      layer,
      color: '#38bdf8',
    });
    onClose();
  };

  return (
    <div
      id="custom-image-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-slate-200"
    >
      <div
        id="custom-image-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Custom JPG / PNG Image Overlay
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
            <span className="text-emerald-400 font-bold">PRD Section 18:</span> Import JPG/PNG image, resize, rotate, adjust opacity, flip horizontally or vertically, assign layer, and click to anchor on live camera feed.
          </div>

          {/* Drag & Drop Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? 'border-emerald-400 bg-emerald-950/40 text-emerald-200'
                : 'border-slate-700 hover:border-emerald-500/70 bg-slate-950/40 text-slate-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
            {imageDataUrl ? (
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 bg-slate-950 border border-emerald-500/50 rounded-lg p-1 flex items-center justify-center overflow-hidden shrink-0 shadow transition"
                  style={{
                    transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                    opacity: opacity,
                  }}
                >
                  <img
                    src={imageDataUrl}
                    alt="Custom preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <div className="font-mono text-xs font-bold text-emerald-300 truncate max-w-[240px]">
                    {fileName}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                    Format: {imageType.toUpperCase()} • Click to upload new file
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    Flip: {flipH ? 'H ' : ''}{flipV ? 'V ' : ''}{!flipH && !flipV ? 'Normal' : ''} • Opacity: {(opacity * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-emerald-400" />
                <div>
                  <span className="font-semibold text-xs text-emerald-400">
                    Click to select JPG or PNG photo
                  </span>{' '}
                  <span className="text-xs text-slate-400">or drag and drop</span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Supports high-res JPG, PNG, WEBP simulated targets and markers
                </p>
              </>
            )}
          </div>

          {/* Quick Preset Imagery */}
          <div>
            <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Exercise Imagery Presets</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_IMAGE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setImageDataUrl(p.svgFallback);
                    setImageType('png');
                    setFileName(`${p.name.toLowerCase().replace(/\s+/g, '_')}.png`);
                    setLabel(p.label);
                  }}
                  className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-emerald-500/60 text-left transition group"
                >
                  <div className="w-full h-12 bg-slate-900 rounded border border-slate-800 p-1 flex items-center justify-center overflow-hidden mb-1.5">
                    <img src={p.svgFallback} alt={p.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="font-semibold text-[11px] text-slate-200 truncate group-hover:text-emerald-300">
                    {p.name}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono truncate">{p.category}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Controls: Label, Scale, Rotation, Opacity, Flips, Layer */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Exercise Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. SIM TANK PHOTO 01"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Rotation */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Rotation</span>
                  <span className="text-emerald-400 font-bold">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="15"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              {/* Scale */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Scale</span>
                  <span className="text-emerald-400 font-bold">{scale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              {/* Opacity */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Opacity</span>
                  <span className="text-emerald-400 font-bold">{(opacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                />
              </div>

              {/* Layer Assignment (PRD Section 18 & 21) */}
              <div>
                <div className="text-[11px] font-mono text-slate-400 mb-1">
                  <span>Target Layer</span>
                </div>
                <select
                  value={layer}
                  onChange={(e) => setLayer(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="symbols">Symbols Layer</option>
                  <option value="labels">Labels Layer</option>
                  <option value="boundary">Boundary Layer</option>
                </select>
              </div>
            </div>

            {/* Optional Flip (PRD Section 18) */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Orientation Flip:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition ${
                    flipH
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Flip Image Horizontally"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Flip H</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV(!flipV)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition ${
                    flipV
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Flip Image Vertically"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                  <span>Flip V</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Click on camera feed after confirming to place
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
              id="btn-confirm-custom-image"
              type="button"
              onClick={handleConfirmPlacement}
              disabled={!imageDataUrl}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
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
