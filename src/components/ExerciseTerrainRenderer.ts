/**
 * Realistic Tactical Training Ground Synthetic Video Generator
 * Generates rich visual features (textured terrain, hills, roads, bunkers, foliage)
 * with dynamic Pan / Tilt / Zoom / Shake and thermal FLIR rendering.
 */

export interface SimulatorCameraState {
  panX: number; // pixels pan offset (-400 to +400)
  tiltY: number; // pixels tilt offset (-200 to +200)
  zoom: number; // 0.6x to 2.2x
  jitter: number; // vibration/shake magnitude (0 to 1)
  time: number;
  flirThermal: boolean;
  autoPatrol: boolean;
}

export class ExerciseTerrainRenderer {
  private noiseCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.createStaticNoiseTexture();
  }

  private createStaticNoiseTexture(): void {
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = 256;
    this.noiseCanvas.height = 256;
    const ctx = this.noiseCanvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(256, 256);
    for (let i = 0; i < 256 * 256 * 4; i += 4) {
      const v = (Math.random() * 50 + 100) | 0;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 40;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Render simulated tactical frame onto the target 2D canvas
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulatorCameraState
  ): void {
    ctx.save();

    // Clear
    ctx.fillStyle = state.flirThermal ? '#0f172a' : '#222';
    ctx.fillRect(0, 0, width, height);

    // Camera jitter (shake)
    const shakeX = (Math.random() - 0.5) * state.jitter * 12;
    const shakeY = (Math.random() - 0.5) * state.jitter * 12;

    // Apply Camera Transform: Zoom from center, Pan and Tilt
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(
      -width / 2 - state.panX + shakeX,
      -height / 2 - state.tiltY + shakeY
    );

    const W = width;
    const H = height;

    if (state.flirThermal) {
      // Thermal FLIR Mode (White-Hot / Cold Dark Green-Gray palette)
      this.drawThermalTerrain(ctx, W, H, state.time);
    } else {
      // Standard Daylight Optical Mode (Tactical Military Camo / Terrain)
      this.drawDaylightTerrain(ctx, W, H, state.time);
    }

    ctx.restore();
  }

  private drawDaylightTerrain(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    time: number
  ): void {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.45);
    skyGrad.addColorStop(0, '#5b7999');
    skyGrad.addColorStop(1, '#a6b8c7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-W, -H * 0.5, W * 3, H);

    // Distant Mountain Ridge (High visual feature contrast)
    ctx.fillStyle = '#4c5c56';
    ctx.beginPath();
    ctx.moveTo(-W, H * 0.42);
    const ridgePoints = [
      [-600, 0.38], [-400, 0.32], [-200, 0.36], [0, 0.28],
      [200, 0.34], [450, 0.26], [700, 0.35], [950, 0.30],
      [1200, 0.37], [1600, 0.33], [2000, 0.42]
    ];
    for (const [px, pyFactor] of ridgePoints) {
      ctx.lineTo(px, H * pyFactor);
    }
    ctx.lineTo(W * 2.5, H * 0.45);
    ctx.lineTo(W * 2.5, H);
    ctx.lineTo(-W, H);
    ctx.closePath();
    ctx.fill();

    // Midground Rolling Hills with Grass and Dirt Strata
    ctx.fillStyle = '#596d43';
    ctx.beginPath();
    ctx.moveTo(-W, H * 0.46);
    ctx.quadraticCurveTo(W * 0.15, H * 0.40, W * 0.5, H * 0.47);
    ctx.quadraticCurveTo(W * 0.85, H * 0.52, W * 2.0, H * 0.45);
    ctx.lineTo(W * 2.0, H);
    ctx.lineTo(-W, H);
    ctx.closePath();
    ctx.fill();

    // Foreground Plain (Olive/Earth tone)
    const groundGrad = ctx.createLinearGradient(0, H * 0.45, 0, H);
    groundGrad.addColorStop(0, '#5f7344');
    groundGrad.addColorStop(0.5, '#4f6037');
    groundGrad.addColorStop(1, '#3b4926');
    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.moveTo(-W, H * 0.5);
    ctx.quadraticCurveTo(W * 0.4, H * 0.48, W * 2.0, H * 0.51);
    ctx.lineTo(W * 2.0, H * 1.5);
    ctx.lineTo(-W, H * 1.5);
    ctx.closePath();
    ctx.fill();

    // Winding Dirt Road (Sharp high-contrast corners for FAST/ORB tracking)
    ctx.fillStyle = '#8f7b59';
    ctx.beginPath();
    ctx.moveTo(W * 0.15, H * 0.52);
    ctx.bezierCurveTo(W * 0.35, H * 0.55, W * 0.45, H * 0.65, W * 0.25, H * 0.85);
    ctx.lineTo(W * 0.45, H * 0.88);
    ctx.bezierCurveTo(W * 0.65, H * 0.68, W * 0.52, H * 0.56, W * 0.25, H * 0.52);
    ctx.closePath();
    ctx.fill();

    // Tactical River / Canal Barrier
    ctx.fillStyle = '#2d4546';
    ctx.beginPath();
    ctx.moveTo(W * 0.75, H * 0.51);
    ctx.quadraticCurveTo(W * 0.65, H * 0.62, W * 0.85, H * 0.82);
    ctx.lineTo(W * 0.92, H * 0.82);
    ctx.quadraticCurveTo(W * 0.72, H * 0.61, W * 0.82, H * 0.51);
    ctx.closePath();
    ctx.fill();

    // Tactical Concrete Bunker complex (Stationary training structure)
    this.drawConcreteBunker(ctx, W * 0.68, H * 0.42, 60, false);
    this.drawConcreteBunker(ctx, W * 0.22, H * 0.46, 45, false);

    // Communications Tower Antenna (Strong geometric lines)
    this.drawCommTower(ctx, W * 0.78, H * 0.38, 70, false);

    // Tree clusters & rock outcroppings (Distinct feature clusters)
    this.drawTreeCluster(ctx, W * 0.1, H * 0.54, 30);
    this.drawTreeCluster(ctx, W * 0.55, H * 0.56, 40);
    this.drawTreeCluster(ctx, W * 0.88, H * 0.62, 50);
    this.drawRockCluster(ctx, W * 0.38, H * 0.52);
    this.drawRockCluster(ctx, W * 0.62, H * 0.72);

    // Moving Exercise Target Vehicle along the dirt road
    const roadProg = (Math.sin(time * 0.0008) + 1) * 0.5; // 0 to 1 back and forth
    const vehX = W * 0.2 + roadProg * W * 0.2;
    const vehY = H * 0.58 + roadProg * H * 0.22;
    this.drawSimulatedVehicle(ctx, vehX, vehY, 32, roadProg > 0.5 ? 0.3 : -2.8, false);

    // Add subtle texture noise pattern for organic micro-features
    if (this.noiseCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      const ptrn = ctx.createPattern(this.noiseCanvas, 'repeat');
      if (ptrn) {
        ctx.fillStyle = ptrn;
        ctx.fillRect(-W, H * 0.45, W * 3, H);
      }
      ctx.restore();
    }
  }

  private drawThermalTerrain(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    time: number
  ): void {
    // Thermal sky (Cold dark)
    ctx.fillStyle = '#060d16';
    ctx.fillRect(-W, -H * 0.5, W * 3, H);

    // Thermal Ridge
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-W, H * 0.42);
    ctx.lineTo(0, H * 0.30);
    ctx.lineTo(W * 0.5, H * 0.28);
    ctx.lineTo(W, H * 0.35);
    ctx.lineTo(W * 2, H * 0.42);
    ctx.lineTo(W * 2, H);
    ctx.lineTo(-W, H);
    ctx.closePath();
    ctx.fill();

    // Thermal Ground (Cool gray-green)
    ctx.fillStyle = '#162322';
    ctx.beginPath();
    ctx.moveTo(-W, H * 0.47);
    ctx.quadraticCurveTo(W * 0.5, H * 0.44, W * 2.0, H * 0.48);
    ctx.lineTo(W * 2.0, H * 1.5);
    ctx.lineTo(-W, H * 1.5);
    ctx.closePath();
    ctx.fill();

    // Road (Retains heat, warmer/lighter)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(W * 0.15, H * 0.52);
    ctx.bezierCurveTo(W * 0.35, H * 0.55, W * 0.45, H * 0.65, W * 0.25, H * 0.85);
    ctx.lineTo(W * 0.45, H * 0.88);
    ctx.bezierCurveTo(W * 0.65, H * 0.68, W * 0.52, H * 0.56, W * 0.25, H * 0.52);
    ctx.closePath();
    ctx.fill();

    // Thermal Bunkers
    this.drawConcreteBunker(ctx, W * 0.68, H * 0.42, 60, true);
    this.drawConcreteBunker(ctx, W * 0.22, H * 0.46, 45, true);
    this.drawCommTower(ctx, W * 0.78, H * 0.38, 70, true);

    // Moving Vehicle (Engine & Exhaust white-hot heat signature!)
    const roadProg = (Math.sin(time * 0.0008) + 1) * 0.5;
    const vehX = W * 0.2 + roadProg * W * 0.2;
    const vehY = H * 0.58 + roadProg * H * 0.22;
    this.drawSimulatedVehicle(ctx, vehX, vehY, 32, roadProg > 0.5 ? 0.3 : -2.8, true);

    // White-hot heat bloom on engine
    const heatGlow = ctx.createRadialGradient(vehX, vehY, 2, vehX, vehY, 35);
    heatGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    heatGlow.addColorStop(0.4, 'rgba(250, 204, 21, 0.4)');
    heatGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = heatGlow;
    ctx.beginPath();
    ctx.arc(vehX, vehY, 35, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawConcreteBunker(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isThermal: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Bunker base
    ctx.fillStyle = isThermal ? '#475569' : '#52525b';
    ctx.fillRect(-size / 2, -size * 0.3, size, size * 0.5);

    // Pillbox gun slit
    ctx.fillStyle = isThermal ? '#0f172a' : '#18181b';
    ctx.fillRect(-size * 0.35, -size * 0.1, size * 0.7, size * 0.12);

    // Camo sandbags
    ctx.fillStyle = isThermal ? '#334155' : '#78716c';
    for (let i = -size * 0.45; i < size * 0.45; i += size * 0.2) {
      ctx.beginPath();
      ctx.ellipse(i, size * 0.18, size * 0.1, size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCommTower(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
    isThermal: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = isThermal ? '#64748b' : '#3f3f46';
    ctx.lineWidth = 2;

    // Lattice Tower Structure
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(0, -height);
    ctx.lineTo(10, 0);
    for (let h = 0; h < height; h += 15) {
      ctx.moveTo(-10 + (h / height) * 10, -h);
      ctx.lineTo(10 - (h / height) * 10, -h);
      ctx.moveTo(-10 + (h / height) * 10, -h);
      ctx.lineTo(10 - ((h + 15) / height) * 10, -(h + 15));
    }
    ctx.stroke();

    // Antenna Beacon light
    ctx.fillStyle = isThermal ? '#ffffff' : '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -height - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSimulatedVehicle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    length: number,
    angle: number,
    isThermal: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Hull
    ctx.fillStyle = isThermal ? '#e2e8f0' : '#27272a';
    ctx.fillRect(-length / 2, -length * 0.25, length, length * 0.5);

    // Turret / cabin
    ctx.fillStyle = isThermal ? '#f8fafc' : '#3f3f46';
    ctx.fillRect(-length * 0.2, -length * 0.18, length * 0.4, length * 0.36);

    // Barrel / antenna
    ctx.strokeStyle = isThermal ? '#cbd5e1' : '#71717a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(length * 0.2, 0);
    ctx.lineTo(length * 0.55, 0);
    ctx.stroke();

    ctx.restore();
  }

  private drawTreeCluster(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#283618';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.arc(radius * 0.4, -radius * 0.2, radius * 0.5, 0, Math.PI * 2);
    ctx.arc(-radius * 0.3, radius * 0.2, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRockCluster(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#52525b';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(-5, -12);
    ctx.lineTo(12, -8);
    ctx.lineTo(18, 2);
    ctx.lineTo(4, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
