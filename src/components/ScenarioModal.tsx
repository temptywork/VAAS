import React, { useState } from 'react';
import { ScenarioData } from '../types';
import { DEFAULT_SCENARIOS } from '../data/defaultScenarios';
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  Calendar,
  Layers,
  MapPin,
  Check,
} from 'lucide-react';

interface ScenarioModalProps {
  isOpen: boolean;
  mode: 'save' | 'load';
  onClose: () => void;
  currentScenarioName: string;
  onSaveScenario: (name: string, description: string) => void;
  onLoadScenario: (scenario: ScenarioData) => void;
  savedScenarios: ScenarioData[];
  onDeleteSavedScenario: (index: number) => void;
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  mode,
  onClose,
  currentScenarioName,
  onSaveScenario,
  onLoadScenario,
  savedScenarios,
  onDeleteSavedScenario,
}) => {
  const [nameInput, setNameInput] = useState(currentScenarioName || 'Exercise Iron Spear - OP 2');
  const [descInput, setDescInput] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'saved'>('presets');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!nameInput.trim()) return;
    onSaveScenario(nameInput.trim(), descInput.trim());
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as ScenarioData;
        if (parsed && parsed.features) {
          onLoadScenario(parsed);
          onClose();
        } else {
          alert('Invalid scenario file format.');
        }
      } catch (err) {
        alert('Failed to parse scenario JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="scenario-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-slate-200"
    >
      <div
        id="scenario-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'save' ? (
              <Save className="w-4 h-4 text-sky-400" />
            ) : (
              <FolderOpen className="w-4 h-4 text-amber-400" />
            )}
            <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide uppercase">
              {mode === 'save' ? 'Save Exercise Scenario' : 'Load Exercise Scenario'}
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
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {mode === 'save' ? (
            <div className="space-y-3.5">
              <p className="text-slate-400">
                Per Section 23 of PRD, saving preserves the scenario name, reference frame, all placed features, text labels, boundary coordinates, RTSP stream URL, and registration settings.
              </p>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Scenario Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Exercise Crimson Shield - Fort Stewart"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Description / Operational Notes
                </label>
                <textarea
                  rows={3}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Training exercise objectives, sector coordinates, unit callsigns..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded p-3 text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="text-sky-400 font-semibold mb-1">Scenario File Bundle:</div>
                <div>• Format: JSON + Embedded Reference Frame</div>
                <div>• Compatibility: Single-Screen Visual Registration v1.0</div>
                <div>• Persistent in browser storage + instant JSON file download</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Tabs for Presets vs User Saved */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveTab('presets')}
                  className={`px-3 py-1 rounded font-mono font-medium transition ${
                    activeTab === 'presets'
                      ? 'bg-sky-950 text-sky-400 border border-sky-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Standard Presets ({DEFAULT_SCENARIOS.length})
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-3 py-1 rounded font-mono font-medium transition ${
                    activeTab === 'saved'
                      ? 'bg-sky-950 text-sky-400 border border-sky-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  My Saved Scenarios ({savedScenarios.length})
                </button>

                <div className="ml-auto">
                  <label
                    htmlFor="scenario-file-input"
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded cursor-pointer border border-slate-700 transition"
                  >
                    <Upload className="w-3 h-3 text-sky-400" />
                    <span>Upload JSON</span>
                  </label>
                  <input
                    id="scenario-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* List */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(activeTab === 'presets' ? DEFAULT_SCENARIOS : savedScenarios).map(
                  (scen, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-lg p-3 flex items-start justify-between gap-3 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-200 text-xs truncate">
                          {scen.scenario_name}
                        </div>
                        {scen.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                            {scen.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1 text-sky-400">
                            <Layers className="w-3 h-3" />
                            {scen.features.length} Features
                          </span>
                          <span className="flex items-center gap-1 text-red-400">
                            <MapPin className="w-3 h-3" />
                            {scen.boundaries && scen.boundaries.length > 0
                              ? `${scen.boundaries.length} Boundaries`
                              : `${scen.boundary?.length || 0} Boundary Pts`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            onLoadScenario(scen);
                            onClose();
                          }}
                          className="flex items-center gap-1 bg-sky-700 hover:bg-sky-600 text-white font-medium px-2.5 py-1.5 rounded transition"
                        >
                          <Check className="w-3 h-3" />
                          <span>Load</span>
                        </button>
                        {activeTab === 'saved' && (
                          <button
                            onClick={() => onDeleteSavedScenario(idx)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                            title="Delete scenario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}

                {activeTab === 'saved' && savedScenarios.length === 0 && (
                  <div className="text-center py-6 text-slate-500 font-mono text-xs">
                    No custom scenarios saved yet. Use the Save button to persist your scenario.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            Close
          </button>
          {mode === 'save' && (
            <button
              id="btn-confirm-save-scenario"
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-1.5 rounded transition shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
