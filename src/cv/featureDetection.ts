// Fast Corner & Binary Feature (FAST + BRIEF-inspired) Engine in Pure TypeScript
// High performance, 60 FPS capable, zero external dependencies

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  descriptor: Uint32Array; // 4 x 32-bit = 128-bit binary descriptor
}

// 16-pixel Bresenham circle offsets around center (x, y)
const CIRCLE_OFFSETS: [number, number][] = [
  [0, -3],  [1, -3],  [2, -2],  [3, -1],
  [3, 0],   [3, 1],   [2, 2],   [1, 3],
  [0, 3],   [-1, 3],  [-2, 2],  [-3, 1],
  [-3, 0],  [-1, -3], [-2, -2], [-1, -3]
];

// Fixed pseudo-random Gaussian-distributed sampling pattern for 128-bit BRIEF-style descriptor
// 128 pairs of (dx1, dy1) and (dx2, dy2) within a 31x31 patch
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
    return Math.max(-14, Math.min(14, Math.round(z * sd)));
  }

  for (let i = 0; i < 128; i++) {
    const x1 = gaussian(6.5);
    const y1 = gaussian(6.5);
    const x2 = gaussian(6.5);
    const y2 = gaussian(6.5);
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
 * Detect feature keypoints using FAST-9 corner detector and compute 128-bit BRIEF descriptors
 */
export function detectFeatures(
  gray: Uint8Array,
  width: number,
  height: number,
  maxFeatures = 200,
  fastThreshold = 22
): Keypoint[] {
  const keypoints: Keypoint[] = [];
  const border = 16;
  const gridW = 16;
  const gridH = 12;
  const cellW = Math.floor((width - 2 * border) / gridW);
  const cellH = Math.floor((height - 2 * border) / gridH);

  // We enforce spatial binning so keypoints are uniformly spread across the scene,
  // preventing all features from crowding in a single high-contrast corner.
  const bins: Keypoint[][] = Array.from({ length: gridW * gridH }, () => []);

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
      const t = fastThreshold;

      if (p0 > p + t) brighterCount++; else if (p0 < p - t) darkerCount++;
      if (p4 > p + t) brighterCount++; else if (p4 < p - t) darkerCount++;
      if (p8 > p + t) brighterCount++; else if (p8 < p - t) darkerCount++;
      if (p12 > p + t) brighterCount++; else if (p12 < p - t) darkerCount++;

      if (brighterCount < 3 && darkerCount < 3) continue;

      // Full 16-point circle test
      let isCorner = false;
      let score = 0;

      // Check contiguous arc of 9 pixels
      const ringVals: number[] = new Array(16);
      for (let k = 0; k < 16; k++) {
        const ox = CIRCLE_OFFSETS[k][0];
        const oy = CIRCLE_OFFSETS[k][1];
        ringVals[k] = gray[(y + oy) * width + (x + ox)];
      }

      // Check for 9 contiguous brighter or darker
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
        // Compute 128-bit BRIEF descriptor (4 uint32 integers)
        const descriptor = new Uint32Array(4);
        for (let b = 0; b < 128; b++) {
          const [dx1, dy1, dx2, dy2] = BRIEF_PAIRS[b];
          const v1 = gray[(y + dy1) * width + (x + dx1)];
          const v2 = gray[(y + dy2) * width + (x + dx2)];
          if (v1 < v2) {
            const wordIdx = b >> 5; // b / 32
            const bitIdx = b & 31;  // b % 32
            descriptor[wordIdx] |= (1 << bitIdx);
          }
        }

        const binX = Math.min(gridW - 1, Math.max(0, Math.floor((x - border) / cellW)));
        const binY = Math.min(gridH - 1, Math.max(0, Math.floor((y - border) / cellH)));
        const binIdx = binY * gridW + binX;

        bins[binIdx].push({ x, y, score, descriptor });
      }
    }
  }

  // Pick top keypoints per bin to guarantee spatial coverage
  const maxPerBin = Math.max(1, Math.ceil(maxFeatures / (gridW * gridH)));
  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];
    if (bin.length > 0) {
      bin.sort((a, b) => b.score - a.score);
      const take = Math.min(bin.length, maxPerBin);
      for (let j = 0; j < take; j++) {
        keypoints.push(bin[j]);
      }
    }
  }

  // If still room, backfill by global score
  if (keypoints.length > maxFeatures) {
    keypoints.sort((a, b) => b.score - a.score);
    return keypoints.slice(0, maxFeatures);
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
