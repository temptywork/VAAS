// Fast Corner & Binary Feature (FAST + BRIEF-inspired) Engine in Pure TypeScript
// High performance, 60 FPS capable, zero external dependencies

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  angle: number; // Dominant patch orientation in radians [-pi, pi]
  descriptor: Uint32Array; // 4 x 32-bit = 128-bit steered ORB binary descriptor
}

// 16-pixel Bresenham circle offsets around center (x, y)
const CIRCLE_OFFSETS: [number, number][] = [
  [0, -3],  [1, -3],  [2, -2],  [3, -1],
  [3, 0],   [3, 1],   [2, 2],   [1, 3],
  [0, 3],   [-1, 3],  [-2, 2],  [-3, 1],
  [-3, 0],  [-1, -3], [-2, -2], [-1, -3]
];

// Circular patch offsets for fast Intensity Centroid orientation (ORB)
const ORIENTATION_OFFSETS: [number, number][] = [];
(function initOrientationOffsets() {
  const radius = 11;
  const rSq = radius * radius;
  for (let dy = -radius; dy <= radius; dy += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      if (dx === 0 && dy === 0) continue;
      if (dx * dx + dy * dy <= rSq) {
        ORIENTATION_OFFSETS.push([dx, dy]);
      }
    }
  }
})();

// Fixed pseudo-random Gaussian-distributed sampling pattern for 128-bit BRIEF-style descriptor
// 128 pairs of (dx1, dy1) and (dx2, dy2) within a circular patch so rotation stays in-bounds
const BRIEF_PAIRS: [number, number, number, number][] = [];
(function initBriefPairs() {
  // Deterministic PRNG for reproducible test vectors
  let seed = 42;
  function rnd(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  function gaussian(sd: number): number {
    const u1 = Math.max(1e-7, rnd());
    const u2 = rnd();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(-11, Math.min(11, Math.round(z * sd)));
  }

  for (let i = 0; i < 128; i++) {
    const x1 = gaussian(5.5);
    const y1 = gaussian(5.5);
    const x2 = gaussian(5.5);
    const y2 = gaussian(5.5);
    BRIEF_PAIRS.push([x1, y1, x2, y2]);
  }
})();

/**
 * Convert RGBA pixel buffer to 8-bit Grayscale
 */
export function rgbaToGrayscale(rgba: Uint8ClampedArray, width: number, height: number, outGray: Uint8Array): void {
  const len = width * height;
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    // Standard luminosity weights: 0.299 R + 0.587 G + 0.114 B
    outGray[i] = (rgba[idx] * 77 + rgba[idx + 1] * 150 + rgba[idx + 2] * 29) >> 8;
  }
}

/**
 * 5-pixel cross filter to suppress high-frequency CMOS sensor noise in webcam video
 */
function getSmoothedIntensity(gray: Uint8Array, width: number, x: number, y: number): number {
  const idx = y * width + x;
  return (gray[idx] * 4 + gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width]) >> 3;
}

/**
 * Compute dominant orientation angle in radians using circular intensity centroid (ORB)
 */
function computeKeypointOrientation(gray: Uint8Array, width: number, x: number, y: number): number {
  let m10 = 0;
  let m01 = 0;
  for (let i = 0; i < ORIENTATION_OFFSETS.length; i++) {
    const [dx, dy] = ORIENTATION_OFFSETS[i];
    const intensity = gray[(y + dy) * width + (x + dx)];
    m10 += dx * intensity;
    m01 += dy * intensity;
  }
  return Math.atan2(m01, m10);
}

/**
 * Detect feature keypoints using FAST-9 corner detector and compute 128-bit Oriented ORB descriptors
 */
export function detectFeatures(
  gray: Uint8Array,
  width: number,
  height: number,
  maxFeatures = 240,
  fastThreshold = 20,
  oriented = true
): Keypoint[] {
  // First attempt with requested threshold
  let keypoints = runFastDetection(gray, width, height, maxFeatures, fastThreshold, oriented);

  // Adaptive fallback: if room or lighting is soft/low-contrast and produced too few points, run with lower threshold
  if (keypoints.length < 35 && fastThreshold > 11) {
    keypoints = runFastDetection(gray, width, height, maxFeatures, 11, oriented);
  }

  return keypoints;
}

function runFastDetection(
  gray: Uint8Array,
  width: number,
  height: number,
  maxFeatures: number,
  threshold: number,
  oriented: boolean
): Keypoint[] {
  const border = 16;
  const gridW = 16;
  const gridH = 12;
  const cellW = Math.floor((width - 2 * border) / gridW);
  const cellH = Math.floor((height - 2 * border) / gridH);

  // Spatial bins hold candidate corner coordinates and scores before descriptor extraction
  const bins: { x: number; y: number; score: number }[][] = Array.from(
    { length: gridW * gridH },
    () => []
  );

  // FAST-9 Corner Detection
  for (let y = border; y < height - border; y += 2) {
    const rowOffset = y * width;
    for (let x = border; x < width - border; x += 2) {
      const p = gray[rowOffset + x];

      // Quick rejection test: check pixels 0, 4, 8, 12 (top, right, bottom, left)
      const p0 = gray[(y - 3) * width + x];
      const p4 = gray[y * width + (x + 3)];
      const p8 = gray[(y + 3) * width + x];
      const p12 = gray[y * width + (x - 3)];

      let brighterCount = 0;
      let darkerCount = 0;
      const t = threshold;

      if (p0 > p + t) brighterCount++; else if (p0 < p - t) darkerCount++;
      if (p4 > p + t) brighterCount++; else if (p4 < p - t) darkerCount++;
      if (p8 > p + t) brighterCount++; else if (p8 < p - t) darkerCount++;
      if (p12 > p + t) brighterCount++; else if (p12 < p - t) darkerCount++;

      if (brighterCount < 3 && darkerCount < 3) continue;

      // Full 16-point circle test
      let isCorner = false;
      let score = 0;

      const ringVals: number[] = new Array(16);
      for (let k = 0; k < 16; k++) {
        const ox = CIRCLE_OFFSETS[k][0];
        const oy = CIRCLE_OFFSETS[k][1];
        ringVals[k] = gray[(y + oy) * width + (x + ox)];
      }

      for (let start = 0; start < 16; start++) {
        let allB = true;
        let allD = true;
        let diffSum = 0;
        for (let k = 0; k < 9; k++) {
          const val = ringVals[(start + k) % 16];
          if (val <= p + t) allB = false;
          if (val >= p - t) allD = false;
          diffSum += Math.abs(val - p);
        }
        if (allB || allD) {
          isCorner = true;
          score = Math.max(score, diffSum);
          break;
        }
      }

      if (isCorner) {
        const binX = Math.min(gridW - 1, Math.max(0, Math.floor((x - border) / cellW)));
        const binY = Math.min(gridH - 1, Math.max(0, Math.floor((y - border) / cellH)));
        const binIdx = binY * gridW + binX;
        bins[binIdx].push({ x, y, score });
      }
    }
  }

  // Pick top candidates per bin to guarantee uniform spatial coverage across the frame
  const selectedCandidates: { x: number; y: number; score: number }[] = [];
  const maxPerBin = Math.max(1, Math.ceil(maxFeatures / (gridW * gridH)));
  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];
    if (bin.length > 0) {
      bin.sort((a, b) => b.score - a.score);
      const take = Math.min(bin.length, maxPerBin);
      for (let j = 0; j < take; j++) {
        selectedCandidates.push(bin[j]);
      }
    }
  }

  if (selectedCandidates.length > maxFeatures) {
    selectedCandidates.sort((a, b) => b.score - a.score);
    selectedCandidates.length = maxFeatures;
  }

  // Compute Oriented ORB angle and steered 128-bit BRIEF descriptors on selected keypoints
  const keypoints: Keypoint[] = new Array(selectedCandidates.length);
  for (let i = 0; i < selectedCandidates.length; i++) {
    const { x, y, score } = selectedCandidates[i];
    const angle = oriented ? computeKeypointOrientation(gray, width, x, y) : 0;
    const cosA = oriented ? Math.cos(angle) : 1;
    const sinA = oriented ? Math.sin(angle) : 0;

    const descriptor = new Uint32Array(4);
    for (let b = 0; b < 128; b++) {
      const [dx1, dy1, dx2, dy2] = BRIEF_PAIRS[b];
      const rx1 = oriented
        ? Math.max(-14, Math.min(14, Math.round(dx1 * cosA - dy1 * sinA)))
        : dx1;
      const ry1 = oriented
        ? Math.max(-14, Math.min(14, Math.round(dx1 * sinA + dy1 * cosA)))
        : dy1;
      const rx2 = oriented
        ? Math.max(-14, Math.min(14, Math.round(dx2 * cosA - dy2 * sinA)))
        : dx2;
      const ry2 = oriented
        ? Math.max(-14, Math.min(14, Math.round(dx2 * sinA + dy2 * cosA)))
        : dy2;

      const v1 = getSmoothedIntensity(gray, width, x + rx1, y + ry1);
      const v2 = getSmoothedIntensity(gray, width, x + rx2, y + ry2);
      if (v1 < v2) {
        const wordIdx = b >> 5;
        const bitIdx = b & 31;
        descriptor[wordIdx] |= (1 << bitIdx);
      }
    }

    keypoints[i] = { x, y, score, angle, descriptor };
  }

  return keypoints;
}

/**
 * Fast popcount for 32-bit unsigned integer
 */
function popcnt32(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

/**
 * Calculate Hamming distance between two 128-bit descriptors (0-128)
 */
export function hammingDistance(descA: Uint32Array, descB: Uint32Array): number {
  return (
    popcnt32(descA[0] ^ descB[0]) +
    popcnt32(descA[1] ^ descB[1]) +
    popcnt32(descA[2] ^ descB[2]) +
    popcnt32(descA[3] ^ descB[3])
  );
}
