/**
 * FFmpeg Ingestion & Transcoder Gateway Service
 * Manages server-side FFmpeg pipelines for RTSP ingestion, transcoding,
 * MJPEG streaming, tactical synthetic stream generation, and frame snapshots.
 */

import { FfmpegStatus, FfmpegStreamConfig } from '../types';

export class FfmpegService {
  private config: FfmpegStreamConfig;
  private status: FfmpegStatus;
  private pollTimer: number | null = null;
  private listeners: Array<(status: FfmpegStatus) => void> = [];

  constructor() {
    this.config = {
      enabled: false,
      sourceType: 'synthetic_tactical',
      rtspUrl: 'rtsp://exercise-control:sec88@192.168.1.100:554/live',
      resolution: '1280x720',
      fps: 30,
      videoCodec: 'mjpeg',
      transport: 'tcp',
      preset: 'ultrafast',
      bitrate: '2500k',
    };

    this.status = {
      available: true,
      active: false,
      uptimeSec: 0,
      fps: 30,
      bitrate: '2.5 Mbps',
      framesProcessed: 0,
      droppedFrames: 0,
      logs: ['FFmpeg service initialized. Ready for ingestion.'],
      streamUrl: '/api/ffmpeg/stream',
    };

    this.checkStatus();
  }

  public getConfig(): FfmpegStreamConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<FfmpegStreamConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getStatus(): FfmpegStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: FfmpegStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.status));
  }

  public async checkStatus(): Promise<FfmpegStatus> {
    try {
      const res = await fetch('/api/ffmpeg/status');
      if (res.ok) {
        const data = await res.json();
        this.status = {
          ...this.status,
          ...data,
          available: true,
        };
      }
    } catch {
      this.status.available = true;
    }
    this.notify();
    return this.status;
  }

  public async startStream(customConfig?: Partial<FfmpegStreamConfig>): Promise<boolean> {
    if (customConfig) {
      this.updateConfig(customConfig);
    }

    try {
      const res = await fetch('/api/ffmpeg/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config),
      });

      if (res.ok) {
        const data = await res.json();
        this.status = {
          ...this.status,
          active: true,
          pid: data.pid,
          streamUrl: '/api/ffmpeg/stream',
          error: null,
          logs: [
            ...this.status.logs.slice(-20),
            `[FFmpeg] Pipeline spawned (PID ${data.pid || 'PROC'}). Ingesting ${this.config.sourceType}...`,
          ],
        };
        this.startPolling();
        this.notify();
        return true;
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to start FFmpeg pipeline' }));
        this.status.error = err.error || 'FFmpeg launch error';
        this.notify();
        return false;
      }
    } catch (err: any) {
      this.status.error = err.message || 'Network error connecting to FFmpeg gateway';
      this.notify();
      return false;
    }
  }

  public async stopStream(): Promise<void> {
    try {
      await fetch('/api/ffmpeg/stop', { method: 'POST' });
    } catch (e) {
      console.warn('Error stopping FFmpeg pipeline:', e);
    }
    this.status.active = false;
    this.status.pid = undefined;
    this.status.logs.push('[FFmpeg] Pipeline stopped by operator.');
    this.stopPolling();
    this.notify();
  }

  public getSnapshotUrl(): string {
    return `/api/ffmpeg/snapshot?t=${Date.now()}`;
  }

  public getStreamUrl(): string {
    return `/api/ffmpeg/stream?t=${Date.now()}`;
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = window.setInterval(() => {
      this.checkStatus();
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const ffmpegService = new FfmpegService();
