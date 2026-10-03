/**
 * ONVIF Profile S/T PTZ Camera Service & Protocol Client
 * Provides complete PTZ command execution (ContinuousMove, AbsoluteMove, RelativeMove,
 * Stop, Presets, Home, Status polling) and connects to both network ONVIF cameras
 * and the integrated Virtual ONVIF device.
 */

import { OnvifConfig, OnvifPreset, OnvifStatus } from '../types';

export class OnvifService {
  private config: OnvifConfig;
  private status: OnvifStatus;
  private presets: OnvifPreset[] = [];
  private pollInterval: number | null = null;
  private listeners: Array<(status: OnvifStatus) => void> = [];

  // Virtual motor state for realistic camera physics
  private motorTarget = { pan: 0, tilt: 0, zoom: 1.0 };
  private motorVelocity = { pan: 0, tilt: 0, zoom: 0 };
  private isSlewing = false;

  constructor(initialConfig?: Partial<OnvifConfig>) {
    this.config = {
      enabled: false,
      host: '192.168.1.108',
      port: 80,
      rtspPort: 554,
      username: 'admin',
      password: '',
      profileToken: 'Profile_1',
      useTls: false,
      authMode: 'digest',
      cameraName: 'TACTICAL-PTZ-01',
      ...initialConfig,
    };

    this.status = {
      connected: true, // Defaults connected to virtual ONVIF camera
      isVirtual: true,
      deviceInfo: {
        manufacturer: 'MIL-SPEC SENSORS',
        model: 'PTZ-OPTIX-4K-IR',
        firmwareVersion: 'v4.18.2-ONVIF-S/T',
        serialNumber: 'TAC-8829-9941',
        hardwareId: 'HW-ARM64-ONVIF',
      },
      ptzStatus: {
        pan: 0,
        tilt: 0,
        zoom: 1.0,
        moveStatus: 'IDLE',
        utcTime: new Date().toISOString(),
      },
      lastSoapCommand: 'GetStatus',
      lastSoapResponse: 'HTTP/1.1 200 OK (Virtual PTZ Ready)',
    };

    // Pre-populate standard tactical presets
    this.presets = [
      { token: 'preset_1', name: 'NORTH OBSERVATION (0°)', pan: 0, tilt: -12, zoom: 1.4, createdAt: Date.now() - 60000 },
      { token: 'preset_2', name: 'EAST ROAD CHECKPOINT (75°)', pan: 75, tilt: -8, zoom: 2.2, createdAt: Date.now() - 40000 },
      { token: 'preset_3', name: 'WEST HILL REDOUBT (-65°)', pan: -65, tilt: 5, zoom: 1.8, createdAt: Date.now() - 20000 },
      { token: 'preset_4', name: 'BASE DEFENSE / HOME', pan: 0, tilt: 0, zoom: 1.0, createdAt: Date.now() },
    ];

    this.startVirtualPhysicsLoop();
  }

  public getConfig(): OnvifConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<OnvifConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.notify();
  }

  public getStatus(): OnvifStatus {
    return { ...this.status };
  }

  public getPresets(): OnvifPreset[] {
    return [...this.presets];
  }

  public subscribe(listener: (status: OnvifStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private isNotifying = false;

  private notify(): void {
    if (this.isNotifying) return;
    this.isNotifying = true;
    try {
      // Use slice to protect against mutation during iteration
      const listenersCopy = this.listeners.slice();
      listenersCopy.forEach((l) => {
        try {
          l(this.status);
        } catch (err) {
          console.error('Error in onvifService listener:', err);
        }
      });
    } finally {
      this.isNotifying = false;
    }
  }

  /**
   * Connect to Physical or Virtual ONVIF Camera
   */
  public async connect(): Promise<boolean> {
    try {
      const res = await fetch('/api/onvif/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        this.status = {
          ...this.status,
          connected: true,
          isVirtual: data.isVirtual ?? false,
          deviceInfo: data.deviceInfo || this.status.deviceInfo,
          lastSoapCommand: 'GetCapabilities / GetDeviceInformation',
          lastSoapResponse: '200 OK - ONVIF Profile S/T Verified',
          error: null,
        };
      } else {
        this.status = {
          ...this.status,
          connected: true,
          isVirtual: true,
          lastSoapCommand: 'VirtualConnect',
          lastSoapResponse: '200 OK - Virtual ONVIF PTZ Active',
          error: null,
        };
      }
      this.notify();
      return true;
    } catch (err: any) {
      this.status.error = err.message || 'Connection failed';
      this.notify();
      return false;
    }
  }

  public disconnect(): void {
    this.status.connected = false;
    this.status.ptzStatus.moveStatus = 'IDLE';
    this.motorVelocity = { pan: 0, tilt: 0, zoom: 0 };
    this.notify();
  }

  /**
   * ONVIF ContinuousMove: sends velocity vector [-1.0, 1.0] for pan, tilt, zoom
   */
  public continuousMove(panVel: number, tiltVel: number, zoomVel: number = 0): void {
    this.status.lastSoapCommand = `<ContinuousMove><Velocity><PanTilt x="${panVel.toFixed(2)}" y="${tiltVel.toFixed(2)}"/><Zoom x="${zoomVel.toFixed(2)}"/></Velocity></ContinuousMove>`;
    this.status.lastSoapResponse = 'HTTP/1.1 200 OK';

    const maxPanSpeed = 45;
    const maxTiltSpeed = 30;
    const maxZoomSpeed = 0.8;

    this.motorVelocity = {
      pan: panVel * maxPanSpeed,
      tilt: tiltVel * maxTiltSpeed,
      zoom: zoomVel * maxZoomSpeed,
    };
    this.isSlewing = false;

    if (Math.abs(panVel) > 0.01 || Math.abs(tiltVel) > 0.01 || Math.abs(zoomVel) > 0.01) {
      this.status.ptzStatus.moveStatus = 'MOVING';
    } else {
      this.status.ptzStatus.moveStatus = 'IDLE';
    }

    if (!this.status.isVirtual) {
      fetch('/api/onvif/ptz/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.config, panVel, tiltVel, zoomVel }),
      }).catch(console.warn);
    }

    this.notify();
  }

  /**
   * ONVIF Stop: Halts continuous or absolute PTZ motion
   */
  public stop(panTilt: boolean = true, zoom: boolean = true): void {
    this.status.lastSoapCommand = `<Stop><PanTilt>${panTilt}</PanTilt><Zoom>${zoom}</Zoom></Stop>`;
    this.status.lastSoapResponse = 'HTTP/1.1 200 OK';

    if (panTilt) {
      this.motorVelocity.pan = 0;
      this.motorVelocity.tilt = 0;
    }
    if (zoom) {
      this.motorVelocity.zoom = 0;
    }
    this.isSlewing = false;
    this.status.ptzStatus.moveStatus = 'IDLE';

    if (!this.status.isVirtual) {
      fetch('/api/onvif/ptz/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.config, panTilt, zoom }),
      }).catch(console.warn);
    }

    this.notify();
  }

  /**
   * ONVIF AbsoluteMove: Slew camera to target pan (deg), tilt (deg), zoom factor
   */
  public absoluteMove(pan: number, tilt: number, zoom?: number): void {
    const targetPan = Math.max(-180, Math.min(180, pan));
    const targetTilt = Math.max(-90, Math.min(90, tilt));
    const targetZoom = zoom !== undefined ? Math.max(0.6, Math.min(30.0, zoom)) : this.status.ptzStatus.zoom;

    this.status.lastSoapCommand = `<AbsoluteMove><Position><PanTilt x="${(targetPan / 180).toFixed(4)}" y="${(targetTilt / 90).toFixed(4)}"/><Zoom x="${targetZoom.toFixed(2)}"/></Position></AbsoluteMove>`;
    this.status.lastSoapResponse = 'HTTP/1.1 200 OK';

    this.motorTarget = { pan: targetPan, tilt: targetTilt, zoom: targetZoom };
    this.isSlewing = true;
    this.status.ptzStatus.moveStatus = 'MOVING';

    if (!this.status.isVirtual) {
      fetch('/api/onvif/ptz/absolute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.config, pan: targetPan, tilt: targetTilt, zoom: targetZoom }),
      }).catch(console.warn);
    }

    this.notify();
  }

  /**
   * ONVIF RelativeMove: Step delta pan, tilt, zoom
   */
  public relativeMove(deltaPan: number, deltaTilt: number, deltaZoom: number = 0): void {
    const newPan = Math.max(-180, Math.min(180, this.status.ptzStatus.pan + deltaPan));
    const newTilt = Math.max(-90, Math.min(90, this.status.ptzStatus.tilt + deltaTilt));
    const newZoom = Math.max(0.6, Math.min(30.0, this.status.ptzStatus.zoom + deltaZoom));
    this.absoluteMove(newPan, newTilt, newZoom);
  }

  /**
   * ONVIF GotoHome: Moves to home position (0, 0, 1x)
   */
  public gotoHome(): void {
    this.status.lastSoapCommand = '<GotoHome/>';
    this.status.ptzStatus.moveStatus = 'HOMING';
    this.absoluteMove(0, 0, 1.0);
  }

  /**
   * ONVIF SetPreset: Store current PTZ position
   */
  public setPreset(name: string, thumbnail?: string): OnvifPreset {
    const token = `preset_${Date.now()}`;
    const newPreset: OnvifPreset = {
      token,
      name: name || `PRESET-${this.presets.length + 1}`,
      pan: Math.round(this.status.ptzStatus.pan * 10) / 10,
      tilt: Math.round(this.status.ptzStatus.tilt * 10) / 10,
      zoom: Math.round(this.status.ptzStatus.zoom * 100) / 100,
      thumbnail,
      createdAt: Date.now(),
    };

    this.presets = [newPreset, ...this.presets];
    this.status.lastSoapCommand = `<SetPreset><PresetName>${newPreset.name}</PresetName></SetPreset>`;
    this.status.lastSoapResponse = `<SetPresetResponse><PresetToken>${token}</PresetToken></SetPresetResponse>`;
    this.notify();
    return newPreset;
  }

  /**
   * ONVIF GotoPreset: Slew to saved preset coordinates
   */
  public gotoPreset(token: string): boolean {
    const preset = this.presets.find((p) => p.token === token);
    if (!preset) return false;

    this.status.lastSoapCommand = `<GotoPreset><PresetToken>${token}</PresetToken></GotoPreset>`;
    this.status.ptzStatus.moveStatus = 'PRESET_SLEW';
    this.absoluteMove(preset.pan, preset.tilt, preset.zoom);
    return true;
  }

  /**
   * ONVIF RemovePreset
   */
  public removePreset(token: string): void {
    this.presets = this.presets.filter((p) => p.token !== token);
    this.status.lastSoapCommand = `<RemovePreset><PresetToken>${token}</PresetToken></RemovePreset>`;
    this.notify();
  }

  /**
   * Virtual PTZ Camera Physics Loop
   */
  private startVirtualPhysicsLoop(): void {
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (this.status.connected) {
        if (this.isSlewing) {
          const panDiff = this.motorTarget.pan - this.status.ptzStatus.pan;
          const tiltDiff = this.motorTarget.tilt - this.status.ptzStatus.tilt;
          const zoomDiff = this.motorTarget.zoom - this.status.ptzStatus.zoom;

          const panStep = panDiff * Math.min(1.0, dt * 6);
          const tiltStep = tiltDiff * Math.min(1.0, dt * 6);
          const zoomStep = zoomDiff * Math.min(1.0, dt * 5);

          this.status.ptzStatus.pan += panStep;
          this.status.ptzStatus.tilt += tiltStep;
          this.status.ptzStatus.zoom += zoomStep;

          if (Math.abs(panDiff) < 0.1 && Math.abs(tiltDiff) < 0.1 && Math.abs(zoomDiff) < 0.01) {
            this.status.ptzStatus.pan = this.motorTarget.pan;
            this.status.ptzStatus.tilt = this.motorTarget.tilt;
            this.status.ptzStatus.zoom = this.motorTarget.zoom;
            this.isSlewing = false;
            this.status.ptzStatus.moveStatus = 'IDLE';
            this.notify();
          }
        } else if (
          Math.abs(this.motorVelocity.pan) > 0.01 ||
          Math.abs(this.motorVelocity.tilt) > 0.01 ||
          Math.abs(this.motorVelocity.zoom) > 0.001
        ) {
          this.status.ptzStatus.pan = Math.max(
            -180,
            Math.min(180, this.status.ptzStatus.pan + this.motorVelocity.pan * dt)
          );
          this.status.ptzStatus.tilt = Math.max(
            -90,
            Math.min(90, this.status.ptzStatus.tilt + this.motorVelocity.tilt * dt)
          );
          this.status.ptzStatus.zoom = Math.max(
            0.6,
            Math.min(30.0, this.status.ptzStatus.zoom + this.motorVelocity.zoom * dt)
          );
          this.status.ptzStatus.moveStatus = 'MOVING';
        }

        this.status.ptzStatus.utcTime = new Date().toISOString();
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

export const onvifService = new OnvifService();
