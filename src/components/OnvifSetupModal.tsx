import React from 'react';
import { Camera, CheckCircle2, Loader2, Network, ShieldCheck, X } from 'lucide-react';
import type { OnvifCameraConfig, OnvifMediaProfile } from '../types';

interface OnvifSetupModalProps {
  isOpen: boolean;
  config: OnvifCameraConfig;
  profiles: OnvifMediaProfile[];
  deviceName?: string;
  isBusy: boolean;
  error: string | null;
  onChange: (config: OnvifCameraConfig) => void;
  onDiscover: () => void;
  onSaveAndConnect: () => void;
  onClose: () => void;
  onForget: () => void;
}

export const OnvifSetupModal: React.FC<OnvifSetupModalProps> = ({
  isOpen,
  config,
  profiles,
  deviceName,
  isBusy,
  error,
  onChange,
  onDiscover,
  onSaveAndConnect,
  onClose,
  onForget,
}) => {
  if (!isOpen) return null;

  const update = (patch: Partial<OnvifCameraConfig>) => onChange({ ...config, ...patch });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl overflow-hidden rounded-xl border border-sky-500/40 bg-slate-900 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-sky-400" />
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">ONVIF Camera Setup</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">Connect a network PTZ camera and save its settings in this browser.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close ONVIF setup">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3">
            <label className="text-xs text-slate-300">
              Camera address
              <input
                autoFocus
                value={config.host}
                onChange={(event) => update({ host: event.target.value })}
                placeholder="192.168.1.120"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
            <label className="text-xs text-slate-300">
              ONVIF port
              <input
                type="number"
                min="1"
                max="65535"
                value={config.port}
                onChange={(event) => update({ port: Number(event.target.value) })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
            <label className="text-xs text-slate-300">
              RTSP port
              <input
                type="number"
                min="1"
                max="65535"
                value={config.rtspPort}
                onChange={(event) => update({ rtspPort: Number(event.target.value) })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-300">
            ONVIF device service path
            <input
              value={config.endpointPath}
              onChange={(event) => update({ endpointPath: event.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-sky-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-300">
              ONVIF username
              <input
                autoComplete="username"
                value={config.username}
                onChange={(event) => update({ username: event.target.value })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
            <label className="text-xs text-slate-300">
              ONVIF password
              <input
                type="password"
                autoComplete="current-password"
                value={config.password}
                onChange={(event) => update({ password: event.target.value })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              {profiles.length ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Network className="h-4 w-4 text-sky-400" />}
              <span>{deviceName || (profiles.length ? 'PTZ and media profiles found' : 'Discover the camera profiles before connecting')}</span>
            </div>
            <button
              type="button"
              onClick={onDiscover}
              disabled={isBusy || !config.host.trim()}
              className="shrink-0 rounded border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-40"
            >
              {isBusy ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span> : 'Discover Camera'}
            </button>
          </div>

          <label className="block text-xs text-slate-300">
            Video stream profile
            <select
              value={config.profileToken || ''}
              onChange={(event) => update({ profileToken: event.target.value || undefined })}
              disabled={!profiles.length}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 disabled:text-slate-500"
            >
              {profiles.length ? profiles.map((profile) => (
                <option key={profile.token} value={profile.token}>
                  {profile.name} · {profile.width || '?'}×{profile.height || '?'} · {profile.encoding} {profile.frameRate ? `· ${profile.frameRate} fps` : ''}
                </option>
              )) : <option value="">Discover camera profiles first</option>}
            </select>
          </label>

          {error && <div className="rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">{error}</div>}

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Credentials are saved in this browser’s local storage. The local development server uses them to request the ONVIF stream and PTZ commands.</span>
          </p>

          <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-[10px] leading-relaxed text-slate-400">
            Attached CP-UNP-E2521L15-DAP product sheet: 25× optical zoom, 360° pan, ONVIF Profile S/G, RTSP/RTP, and H.264/H.265 streams. The discovered device profile is used for the active feed.
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 px-4 py-3">
          <button type="button" onClick={onForget} className="text-xs text-slate-500 hover:text-red-300">Forget saved camera</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white">Cancel</button>
            <button
              type="button"
              onClick={onSaveAndConnect}
              disabled={isBusy || profiles.length === 0 || !config.host.trim()}
              className="rounded border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save &amp; Connect
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
