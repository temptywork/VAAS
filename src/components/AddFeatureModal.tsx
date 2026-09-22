import React, { useState, useRef, useEffect } from 'react';
import { FeatureType, ExerciseFeature } from '../types';
import { FEATURE_LIBRARY } from '../data/featureDefinitions';
import {
  Crosshair,
  Check,
  Upload,
  FileImage,
  Sparkles,
  RotateCw,
  Layers,
  Image as ImageIcon,
  Trash2,
  Search,
  Eye,
  EyeOff,
  ListFilter,
  AlertCircle,
} from 'lucide-react';

export interface CustomPlacementOptions {
  customImage?: string;
  customImageType?: 'svg' | 'jpg' | 'png' | 'other';
  scale?: number;
  color?: string;
}

interface AddFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFeatureForPlacement: (
    type: FeatureType,
    label: string,
    rotation: number,
    options?: CustomPlacementOptions
  ) => void;
  existingCountByType: Record<string, number>;
  plottedFeatures?: ExerciseFeature[];
  onToggleFeatureVisibility?: (id: string) => void;
  onToggleAllFeatures?: (visible: boolean) => void;
  onDeleteFeature?: (id: string) => void;
  onDeleteAllFeatures?: () => void;
}

const PRESET_SAMPLE_SVGS = [
  {
    name: 'Tactical UAV / Drone',
    label: 'SIM UAV 01',
    color: '#38bdf8',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"><path d="M50 15 L50 85 M15 50 L85 50 M25 25 L75 75 M25 75 L75 25"/><circle cx="50" cy="50" r="14" fill="#0f172a" stroke="#38bdf8" stroke-width="5"/><circle cx="20" cy="20" r="10" stroke="#38bdf8"/><circle cx="80" cy="20" r="10" stroke="#38bdf8"/><circle cx="20" cy="80" r="10" stroke="#38bdf8"/><circle cx="80" cy="80" r="10" stroke="#38bdf8"/></svg>`
      ),
  },
  {
    name: 'Radar Emplacement',
    label: 'RADAR SITE 01',
    color: '#f59e0b',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"><path d="M20 70 A45 45 0 0 1 80 70 M32 60 A30 30 0 0 1 68 60 M44 50 A15 15 0 0 1 56 50"/><circle cx="50" cy="50" r="5" fill="#f59e0b"/><line x1="50" y1="50" x2="70" y2="30"/><line x1="50" y1="70" x2="50" y2="90"/><line x1="35" y1="90" x2="65" y2="90"/></svg>`
      ),
  },
  {
    name: 'Air Defense Battery',
    label: 'AIR DEF 01',
    color: '#ef4444',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"><line x1="20" y1="85" x2="80" y2="85"/><rect x="30" y="65" width="40" height="20" fill="#0f172a"/><line x1="50" y1="65" x2="50" y2="20"/><polygon points="50,10 40,28 60,28" fill="#ef4444"/><line x1="35" y1="65" x2="25" y2="30"/><polygon points="25,20 18,36 32,36" fill="#ef4444"/><line x1="65" y1="65" x2="75" y2="30"/><polygon points="75,20 68,36 82,36" fill="#ef4444"/></svg>`
      ),
  },
  {
    name: 'Medical Aid Station',
    label: 'MEDEVAC OP',
    color: '#22c55e',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#22c55e" stroke-width="5"><rect x="15" y="15" width="70" height="70" rx="12" fill="#0f172a"/><path d="M50 28 L50 72 M28 50 L72 50" stroke="#22c55e" stroke-width="12" stroke-linecap="square"/></svg>`
      ),
  },
];

export const AddFeatureModal: React.FC<AddFeatureModalProps> = ({
  isOpen,
  onClose,
  onSelectFeatureForPlacement,
  existingCountByType,
  plottedFeatures = [],
  onToggleFeatureVisibility,
  onToggleAllFeatures,
  onDeleteFeature,
  onDeleteAllFeatures,
}) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'custom' | 'plotted'>('standard');
  const [selectedType, setSelectedType] = useState<FeatureType>('tank');
  const [label, setLabel] = useState<string>('');
  const [rotation, setRotation] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [customColor, setCustomColor] = useState<string>('#38bdf8');
  const [plottedSearch, setPlottedSearch] = useState<string>('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);

  useEffect(() => {
    if (confirmDeleteAll) {
      const timer = setTimeout(() => setConfirmDeleteAll(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteAll]);

  // Custom Image State (SVG or JPG/PNG)
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(null);
  const [customImageType, setCustomImageType] = useState<'svg' | 'jpg' | 'png' | 'other'>('svg');
  const [customImageFileName, setCustomImageFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentDef = FEATURE_LIBRARY[selectedType];
  const allFeaturesVisible = plottedFeatures.length > 0 && plottedFeatures.every((f) => f.visible !== false);

  const filteredPlotted = plottedFeatures.filter((f) => {
    if (!plottedSearch.trim()) return true;
    const term = plottedSearch.toLowerCase();
    return (
      f.label.toLowerCase().includes(term) ||
      f.type.toLowerCase().includes(term)
    );
  });

  const handleSelectType = (type: FeatureType) => {
    setSelectedType(type);
    const def = FEATURE_LIBRARY[type];
    const count = (existingCountByType[type] || 0) + 1;
    const prefix = def.defaultLabel.replace(/\s\d+$/, '');
    const numStr = count < 10 ? `0${count}` : `${count}`;
    setLabel(`${prefix} ${numStr}`);
  };

  const handleProcessFile = (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    const isJpg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    setCustomImageType(isSvg ? 'svg' : isJpg ? 'jpg' : isPng ? 'png' : 'other');
    setCustomImageFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCustomImageDataUrl(result);
      if (!label) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        setLabel(cleanName);
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

  const handleSelectPresetSvg = (preset: typeof PRESET_SAMPLE_SVGS[0]) => {
    setCustomImageDataUrl(preset.dataUrl);
    setCustomImageType('svg');
    setCustomImageFileName(preset.name + '.svg');
    setCustomColor(preset.color);
    setLabel(preset.label);
  };

  const handleConfirmPlacement = () => {
    if (activeTab === 'custom') {
      const finalLabel = label.trim() || 'CUSTOM MARK';
      onSelectFeatureForPlacement('custom', finalLabel, rotation, {
        customImage: customImageDataUrl || PRESET_SAMPLE_SVGS[0].dataUrl,
        customImageType: customImageType,
        scale,
        color: customColor,
      });
    } else {
      const finalLabel = label.trim() || currentDef.defaultLabel;
      onSelectFeatureForPlacement(selectedType, finalLabel, rotation, {
        scale,
      });
    }
    onClose();
  };

  return (
    <div
      id="add-feature-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        id="add-feature-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-400" />
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              Select or Upload Exercise Feature
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Standard vs Custom vs Plotted Features */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            className={`flex-1 py-2.5 px-3 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'standard'
                ? 'border-sky-500 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Standard (8)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('custom');
              if (!customImageDataUrl) {
                handleSelectPresetSvg(PRESET_SAMPLE_SVGS[0]);
              }
            }}
            className={`flex-1 py-2.5 px-3 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'custom'
                ? 'border-sky-500 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Custom Symbol</span>
          </button>
          <button
            type="button"
            id="tab-plotted-features"
            onClick={() => setActiveTab('plotted')}
            className={`flex-1 py-2.5 px-3 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'plotted'
                ? 'border-emerald-500 text-emerald-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Plotted ({plottedFeatures.length})</span>
            {plottedFeatures.length > 0 && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-1.5 rounded-full font-bold">
                {plottedFeatures.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'standard' ? (
            <>
              <p className="text-xs text-slate-400">
                Select a tactical simulated feature from the standard military library, adjust orientation or label, then click on the video feed to anchor it.
              </p>

              {/* Standard Feature Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {(Object.keys(FEATURE_LIBRARY) as FeatureType[])
                  .filter((t) => t !== 'custom')
                  .map((type) => {
                    const item = FEATURE_LIBRARY[type];
                    const isSelected = selectedType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSelectType(type)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition ${
                          isSelected
                            ? 'bg-sky-950/70 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                            : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded flex items-center justify-center font-bold text-base shadow-sm shrink-0"
                          style={{
                            backgroundColor: `${item.color}22`,
                            color: item.color,
                            border: `1px solid ${item.color}66`,
                          }}
                        >
                          {item.symbol}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </>
          ) : activeTab === 'custom' ? (
            <>
              {/* Custom SVG / JPG Upload Section */}
              <div className="space-y-3">
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
                      ? 'border-sky-400 bg-sky-950/40 text-sky-200'
                      : 'border-slate-700 hover:border-sky-500/70 bg-slate-950/40 text-slate-300'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  {customImageDataUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-900 border border-sky-500/50 rounded-lg p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow">
                        <img
                          src={customImageDataUrl}
                          alt="Custom Symbol"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-left">
                        <div className="font-mono text-xs font-bold text-sky-300 truncate max-w-xs">
                          {customImageFileName || 'Uploaded Symbol'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          Format: {customImageType} • Click to replace file
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-sky-400" />
                      <div>
                        <span className="font-semibold text-xs text-sky-400">
                          Click to upload SVG or JPG
                        </span>{' '}
                        <span className="text-xs text-slate-400">or drag and drop</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Supports vector SVG, JPG, PNG, WEBP tactical graphics
                      </p>
                    </>
                  )}
                </div>

                {/* Quick Preset SVG Samples */}
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Quick Tactical Presets (SVG)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_SAMPLE_SVGS.map((preset) => {
                      const isSelected =
                        customImageDataUrl === preset.dataUrl ||
                        customImageFileName === preset.name + '.svg';
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectPresetSvg(preset)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                            isSelected
                              ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                              : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="w-7 h-7 bg-slate-950 border border-slate-700 rounded p-0.5 shrink-0 flex items-center justify-center">
                            <img
                              src={preset.dataUrl}
                              alt={preset.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-xs font-medium truncate">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Theme for Custom Symbol */}
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Highlight / Badge Color
                  </label>
                  <div className="flex items-center gap-2">
                    {['#38bdf8', '#ef4444', '#f59e0b', '#22c55e', '#a855f7', '#f43f5e'].map(
                      (c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCustomColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            customColor === c ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      )
                    )}
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer ml-2"
                      title="Custom Hex Color"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Plotted Features on Canvas Tab */
            <div className="space-y-3">
              {/* Search & Bulk Actions Bar */}
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={plottedSearch}
                    onChange={(e) => setPlottedSearch(e.target.value)}
                    placeholder="Search plotted symbols by label or type..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {plottedFeatures.length > 0 && onToggleAllFeatures && (
                    <button
                      type="button"
                      id="btn-plotted-toggle-all-visibility"
                      onClick={() => onToggleAllFeatures(!allFeaturesVisible)}
                      className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition shrink-0"
                      title={allFeaturesVisible ? 'Hide all plotted features' : 'Unhide all plotted features'}
                    >
                      {allFeaturesVisible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Hide All</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Unhide All</span>
                        </>
                      )}
                    </button>
                  )}

                  {plottedFeatures.length > 0 && onDeleteAllFeatures && (
                    !confirmDeleteAll ? (
                      <button
                        type="button"
                        id="btn-plotted-clear-all"
                        onClick={() => setConfirmDeleteAll(true)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 px-2.5 py-1.5 rounded-lg transition shrink-0"
                        title="Delete all features plotted on canvas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All ({plottedFeatures.length})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        id="btn-plotted-confirm-clear-all"
                        onClick={() => {
                          onDeleteAllFeatures();
                          setConfirmDeleteAll(false);
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-white bg-rose-600 hover:bg-rose-500 font-bold px-2.5 py-1.5 rounded-lg transition shrink-0 animate-pulse shadow-md"
                        title="Click again to confirm clearing all features"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm Clear All ({plottedFeatures.length})?</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Plotted Features List */}
              {plottedFeatures.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500 border border-slate-700/60">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-mono font-bold text-slate-300 text-xs uppercase tracking-wide">
                      No Features Plotted on Canvas
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Switch to the "Standard" or "Custom Symbol" tabs to select a military symbol and anchor it onto the live camera stream.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('standard')}
                    className="inline-flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white font-medium px-3 py-1.5 rounded transition shadow"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Select Symbol to Plot</span>
                  </button>
                </div>
              ) : filteredPlotted.length === 0 ? (
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-6 text-center text-slate-400 font-mono text-xs">
                  No plotted features matching "{plottedSearch}"
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredPlotted.map((feat) => {
                    const def = FEATURE_LIBRARY[feat.type] || FEATURE_LIBRARY.tank;
                    return (
                      <div
                        key={feat.id}
                        className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-lg p-2.5 flex items-center justify-between gap-3 transition"
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 p-1 overflow-hidden"
                            style={{ borderColor: feat.color || def.color }}
                          >
                            {feat.customImage ? (
                              <img
                                src={feat.customImage}
                                alt={feat.label}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="font-mono text-xs font-bold" style={{ color: feat.color || def.color }}>
                                {def.symbol}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-100 truncate">
                                {feat.label}
                              </span>
                              <span
                                className="text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase"
                                style={{
                                  borderColor: feat.color || def.color,
                                  color: feat.color || def.color,
                                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                }}
                              >
                                {def.name}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Pos: ({Math.round(feat.x)}, {Math.round(feat.y)})</span>
                              <span>•</span>
                              <span>Rot: {feat.rotation || 0}°</span>
                              <span>•</span>
                              <span>Scale: {(feat.scale || 1).toFixed(1)}x</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick Visibility Toggle & Delete Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onToggleFeatureVisibility && (
                            <button
                              type="button"
                              onClick={() => onToggleFeatureVisibility(feat.id)}
                              className={`p-1.5 rounded transition border ${
                                feat.visible !== false
                                  ? 'text-sky-400 hover:text-sky-300 hover:bg-slate-800 border-slate-700'
                                  : 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/40'
                              }`}
                              title={feat.visible !== false ? 'Hide feature' : 'Unhide feature'}
                            >
                              {feat.visible !== false ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteFeature && onDeleteFeature(feat.id)}
                            className="flex items-center gap-1 text-xs text-rose-400 hover:text-white hover:bg-rose-900/60 border border-rose-900/30 hover:border-rose-700 px-2.5 py-1.5 rounded transition font-mono shrink-0"
                            title="Delete this feature from canvas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Common Parameters: Tactical Label, Orientation, Scale (shown for standard/custom placement) */}
          {activeTab !== 'plotted' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Tactical Label (e.g. SIM TANK 01, RECON 02)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={activeTab === 'standard' ? currentDef.defaultLabel : 'CUSTOM MARK'}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Orientation</span>
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
                    <span>Symbol Scale</span>
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
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            {activeTab === 'plotted'
              ? `${plottedFeatures.length} total symbol${plottedFeatures.length === 1 ? '' : 's'} plotted`
              : activeTab === 'custom'
              ? 'Anchors custom SVG/JPG symbol on live video'
              : 'Select position on camera feed after confirming'}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'plotted' ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-feature-placement"
                  type="button"
                  onClick={handleConfirmPlacement}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Place on Canvas</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
