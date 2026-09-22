import { FeatureMatch } from './matcher';

/**
 * 3x3 Homography Matrix represented as a 9-element array in row-major order:
 * [H00, H01, H02,
 *  H10, H11, H12,
 *  H20, H21, H22]
 */
export type Homography = number[];

export interface RansacResult {
  homography: Homography | null;
  inliers: FeatureMatch[];
  inlierCount: number;
  avgReprojectionError: number;
  scale: number;
  rotationDeg: number;
  translation: [number, number];
}

/**
 * Transform a 2D point (x, y) by 3x3 Homography matrix H
 */
export function projectPoint(H: Homography, x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-7) {
    return [x, y];
  }
  const px = (H[0] * x + H[1] * y + H[2]) / w;
  const py = (H[3] * x + H[4] * y + H[5]) / w;
  return [px, py];
}

/**
 * Check if 3 points are approximately collinear
 */
function areCollinear(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  threshold = 10
): boolean {
  // Area of triangle = 0.5 * |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)|
  const area = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  return area < threshold;
}

/**
 * Direct Linear Transformation (DLT) solver for 4 point correspondences
 * Solves: A * h = b using Gaussian elimination with partial pivoting
 */
export function solveHomography4Points(
  src: [number, number][],
  dst: [number, number][]
): Homography | null {
  if (src.length < 4 || dst.length < 4) return null;

  // Verify that no 3 points are collinear in src or dst
  if (
    areCollinear(src[0][0], src[0][1], src[1][0], src[1][1], src[2][0], src[2][1]) ||
    areCollinear(src[0][0], src[0][1], src[1][0], src[1][1], src[3][0], src[3][1]) ||
    areCollinear(src[0][0], src[0][1], src[2][0], src[2][1], src[3][0], src[3][1]) ||
    areCollinear(src[1][0], src[1][1], src[2][0], src[2][1], src[3][0], src[3][1])
  ) {
    return null;
  }

  // Build 8x8 matrix A and 8x1 vector b for:
  // [x, y, 1, 0, 0, 0, -u*x, -u*y] [h0..h7]^T = u
  // [0, 0, 0, x, y, 1, -v*x, -v*y]            = v
  const A: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const B: number[] = new Array(8).fill(0);

  for (let i = 0; i < 4; i++) {
    const x = src[i][0];
    const y = src[i][1];
    const u = dst[i][0];
    const v = dst[i][1];

    const r1 = i * 2;
    const r2 = i * 2 + 1;

    A[r1][0] = x;
    A[r1][1] = y;
    A[r1][2] = 1;
    A[r1][6] = -u * x;
    A[r1][7] = -u * y;
    B[r1] = u;

    A[r2][3] = x;
    A[r2][4] = y;
    A[r2][5] = 1;
    A[r2][6] = -v * x;
    A[r2][7] = -v * y;
    B[r2] = v;
  }

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-9) {
      return null; // Singular matrix
    }

    // Swap rows
    if (maxRow !== col) {
      const tempA = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tempA;

      const tempB = B[col];
      B[col] = B[maxRow];
      B[maxRow] = tempB;
    }

    // Eliminate below
    for (let row = col + 1; row < 8; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < 8; k++) {
        A[row][k] -= factor * A[col][k];
      }
      B[row] -= factor * B[col];
    }
  }

  // Back-substitution
  const h: number[] = new Array(8).fill(0);
  for (let row = 7; row >= 0; row--) {
    let sum = B[row];
    for (let col = row + 1; col < 8; col++) {
      sum -= A[row][col] * h[col];
    }
    h[row] = sum / A[row][row];
  }

  // Resulting 3x3 Homography matrix [h0, h1, h2, h3, h4, h5, h6, h7, 1]
  const H = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];

  // Sanity check determinant / Jacobian condition
  const det = H[0] * H[4] - H[1] * H[3];
  if (det <= 0 || !isFinite(det)) {
    return null; // Orientation inversion or degenerate
  }

  return H;
}

/**
 * Estimate Homography using RANSAC (Random Sample Consensus)
 */
export function estimateHomographyRANSAC(
  matches: FeatureMatch[],
  maxIterations = 120,
  ransacThresholdPx = 4.5,
  minInliers = 8
): RansacResult {
  const result: RansacResult = {
    homography: null,
    inliers: [],
    inlierCount: 0,
    avgReprojectionError: 0,
    scale: 1,
    rotationDeg: 0,
    translation: [0, 0],
  };

  const n = matches.length;
  if (n < 4) {
    return result;
  }

  let bestInliers: FeatureMatch[] = [];
  let bestH: Homography | null = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Pick 4 unique random indices
    const indices: number[] = [];
    while (indices.length < 4) {
      const randIdx = Math.floor(Math.random() * n);
      if (!indices.includes(randIdx)) {
        indices.push(randIdx);
      }
    }

    const srcPoints: [number, number][] = indices.map((i) => [
      matches[i].refX,
      matches[i].refY,
    ]);
    const dstPoints: [number, number][] = indices.map((i) => [
      matches[i].curX,
      matches[i].curY,
    ]);

    const candidateH = solveHomography4Points(srcPoints, dstPoints);
    if (!candidateH) continue;

    // Check candidate scale sanity
    const scaleX = Math.sqrt(candidateH[0] * candidateH[0] + candidateH[3] * candidateH[3]);
    const scaleY = Math.sqrt(candidateH[1] * candidateH[1] + candidateH[4] * candidateH[4]);
    if (scaleX < 0.25 || scaleX > 4.0 || scaleY < 0.25 || scaleY > 4.0) {
      continue;
    }

    // Count inliers
    const currentInliers: FeatureMatch[] = [];
    const threshSq = ransacThresholdPx * ransacThresholdPx;

    for (let i = 0; i < n; i++) {
      const m = matches[i];
      const [px, py] = projectPoint(candidateH, m.refX, m.refY);
      const dx = px - m.curX;
      const dy = py - m.curY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= threshSq) {
        currentInliers.push(m);
      }
    }

    if (currentInliers.length > bestInliers.length) {
      bestInliers = currentInliers;
      bestH = candidateH;

      // Early exit if vast majority matched
      if (bestInliers.length > n * 0.85 && bestInliers.length >= minInliers) {
        break;
      }
    }
  }

  if (bestH && bestInliers.length >= 4) {
    // Compute average reprojection error
    let totalError = 0;
    for (let i = 0; i < bestInliers.length; i++) {
      const m = bestInliers[i];
      const [px, py] = projectPoint(bestH, m.refX, m.refY);
      totalError += Math.hypot(px - m.curX, py - m.curY);
    }
    const avgErr = totalError / bestInliers.length;

    // Extract motion metrics
    const rotRad = Math.atan2(bestH[3], bestH[0]);
    const rotDeg = (rotRad * 180) / Math.PI;
    const scaleEst = Math.sqrt(bestH[0] * bestH[0] + bestH[3] * bestH[3]);
    const transEst: [number, number] = [bestH[2], bestH[5]];

    result.homography = bestH;
    result.inliers = bestInliers;
    result.inlierCount = bestInliers.length;
    result.avgReprojectionError = avgErr;
    result.scale = scaleEst;
    result.rotationDeg = rotDeg;
    result.translation = transEst;
  }

  return result;
}

/**
 * Invert 3x3 Homography Matrix
 */
export function invertHomography(H: Homography): Homography | null {
  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22,
  ] = H;

  const det =
    m00 * (m11 * m22 - m12 * m21) -
    m01 * (m10 * m22 - m12 * m20) +
    m02 * (m10 * m21 - m11 * m20);

  if (Math.abs(det) < 1e-9) {
    return null;
  }

  const invDet = 1.0 / det;

  return [
    (m11 * m22 - m12 * m21) * invDet,
    (m02 * m21 - m01 * m22) * invDet,
    (m01 * m12 - m02 * m11) * invDet,

    (m12 * m20 - m10 * m22) * invDet,
    (m00 * m22 - m02 * m20) * invDet,
    (m02 * m10 - m00 * m12) * invDet,

    (m10 * m21 - m11 * m20) * invDet,
    (m01 * m20 - m00 * m21) * invDet,
    (m00 * m11 - m01 * m10) * invDet,
  ];
}
