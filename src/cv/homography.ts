import { HomographyMotionModel } from '../types';
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
  activeMotionModel: HomographyMotionModel;
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
 * Multiply two 3x3 Homography matrices: C = A * B, normalized so C[8] = 1
 */
export function multiplyHomography(A: Homography, B: Homography): Homography {
  const C = [
    A[0] * B[0] + A[1] * B[3] + A[2] * B[6],
    A[0] * B[1] + A[1] * B[4] + A[2] * B[7],
    A[0] * B[2] + A[1] * B[5] + A[2] * B[8],

    A[3] * B[0] + A[4] * B[3] + A[5] * B[6],
    A[3] * B[1] + A[4] * B[4] + A[5] * B[7],
    A[3] * B[2] + A[4] * B[5] + A[5] * B[8],

    A[6] * B[0] + A[7] * B[3] + A[8] * B[6],
    A[6] * B[1] + A[7] * B[4] + A[8] * B[7],
    A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
  ];

  const norm = Math.abs(C[8]) > 1e-8 ? C[8] : 1.0;
  for (let i = 0; i < 9; i++) {
    C[i] /= norm;
  }
  return C;
}

/**
 * Hartley Isotropic Coordinate Normalization:
 * Shifts point cloud centroid to (0, 0) and scales mean radial distance to sqrt(2).
 * Returns { normPts, T, invT }.
 */
function computeHartleyNormalization(pts: [number, number][]): {
  normPts: [number, number][];
  T: Homography;
  invT: Homography;
} {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += pts[i][0];
    cy += pts[i][1];
  }
  cx /= n;
  cy /= n;

  let meanDist = 0;
  for (let i = 0; i < n; i++) {
    meanDist += Math.hypot(pts[i][0] - cx, pts[i][1] - cy);
  }
  meanDist /= n;

  const scale = meanDist > 1e-6 ? Math.SQRT2 / meanDist : 1.0;
  const invScale = 1.0 / scale;

  const normPts: [number, number][] = new Array(n);
  for (let i = 0; i < n; i++) {
    normPts[i] = [(pts[i][0] - cx) * scale, (pts[i][1] - cy) * scale];
  }

  const T: Homography = [
    scale, 0, -scale * cx,
    0, scale, -scale * cy,
    0, 0, 1.0,
  ];
  const invT: Homography = [
    invScale, 0, cx,
    0, invScale, cy,
    0, 0, 1.0,
  ];

  return { normPts, T, invT };
}

/**
 * Check if 3 points are approximately collinear
 */
function areCollinear(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  threshold = 12
): boolean {
  const area = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  return area < threshold;
}

/**
 * Verify that a projective homography preserves convex orientation and reasonable perspective
 * across the canonical 640x360 viewport corners.
 */
function isProjectiveHomographyValid(H: Homography, width = 640, height = 360): boolean {
  if (!H || H.length < 9) return false;
  for (let i = 0; i < 9; i++) {
    if (!isFinite(H[i])) return false;
  }

  // Check determinant of upper-left 2x2 Jacobian
  const det = H[0] * H[4] - H[1] * H[3];
  if (det <= 0.08 || det > 9.0) return false;

  // Reject excessive perspective warp (horizon passing near frame)
  if (Math.abs(H[6]) > 0.0022 || Math.abs(H[7]) > 0.0022) return false;

  // Check positive w > 0.25 at all 4 canonical corners
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const projected: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    const w = H[6] * cx + H[7] * cy + H[8];
    if (w < 0.25 || w > 4.0) return false;
    projected.push([(H[0] * cx + H[1] * cy + H[2]) / w, (H[3] * cx + H[4] * cy + H[5]) / w]);
  }

  // Ensure projected quad is strictly convex with consistent clockwise orientation
  for (let i = 0; i < 4; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % 4];
    const c = projected[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross <= 1000) return false; // Quad inverted or collapsed
  }

  return true;
}

/**
 * Solve linear system A * x = b of size N x N via Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A: number[][], B: number[], n: number): number[] | null {
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-10) {
      return null;
    }

    if (maxRow !== col) {
      const tempA = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tempA;

      const tempB = B[col];
      B[col] = B[maxRow];
      B[maxRow] = tempB;
    }

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      B[row] -= factor * B[col];
    }
  }

  const x: number[] = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = B[row];
    for (let col = row + 1; col < n; col++) {
      sum -= A[row][col] * x[col];
    }
    x[row] = sum / A[row][row];
  }
  return x;
}

/**
 * Hartley-Normalized Direct Linear Transformation (DLT) solver for 4 point correspondences
 */
export function solveHomography4Points(
  src: [number, number][],
  dst: [number, number][]
): Homography | null {
  if (src.length < 4 || dst.length < 4) return null;

  if (
    areCollinear(src[0][0], src[0][1], src[1][0], src[1][1], src[2][0], src[2][1]) ||
    areCollinear(src[0][0], src[0][1], src[1][0], src[1][1], src[3][0], src[3][1]) ||
    areCollinear(src[0][0], src[0][1], src[2][0], src[2][1], src[3][0], src[3][1]) ||
    areCollinear(src[1][0], src[1][1], src[2][0], src[2][1], src[3][0], src[3][1]) ||
    areCollinear(dst[0][0], dst[0][1], dst[1][0], dst[1][1], dst[2][0], dst[2][1])
  ) {
    return null;
  }

  const normSrc = computeHartleyNormalization(src);
  const normDst = computeHartleyNormalization(dst);

  const A: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const B: number[] = new Array(8).fill(0);

  for (let i = 0; i < 4; i++) {
    const [x, y] = normSrc.normPts[i];
    const [u, v] = normDst.normPts[i];

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

  const h = solveLinearSystem(A, B, 8);
  if (!h) return null;

  const Hnorm: Homography = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
  const H = multiplyHomography(normDst.invT, multiplyHomography(Hnorm, normSrc.T));

  if (!isProjectiveHomographyValid(H)) {
    return null;
  }

  return H;
}

/**
 * Exact 4-corner Homography solver used for 4-corner screen-space stabilization
 */
export function solveHomographyFrom4Corners(
  srcCorners: [number, number][],
  dstCorners: [number, number][]
): Homography | null {
  return solveHomography4Points(srcCorners, dstCorners);
}

/**
 * Closed-form 6-DOF Affine Transform solver from 3 non-collinear point correspondences
 */
export function solveAffine3Points(
  src: [number, number][],
  dst: [number, number][]
): Homography | null {
  if (src.length < 3 || dst.length < 3) return null;
  const [x1, y1] = src[0];
  const [x2, y2] = src[1];
  const [x3, y3] = src[2];

  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
  if (Math.abs(det) < 25) return null; // Nearly collinear

  const invDet = 1.0 / det;
  const i00 = (y2 - y3) * invDet;
  const i01 = (y3 - y1) * invDet;
  const i02 = (y1 - y2) * invDet;
  const i10 = (x3 - x2) * invDet;
  const i11 = (x1 - x3) * invDet;
  const i12 = (x2 - x1) * invDet;
  const i20 = (x2 * y3 - x3 * y2) * invDet;
  const i21 = (x3 * y1 - x1 * y3) * invDet;
  const i22 = (x1 * y2 - x2 * y1) * invDet;

  const [u1, v1] = dst[0];
  const [u2, v2] = dst[1];
  const [u3, v3] = dst[2];

  const h00 = i00 * u1 + i01 * u2 + i02 * u3;
  const h01 = i10 * u1 + i11 * u2 + i12 * u3;
  const h02 = i20 * u1 + i21 * u2 + i22 * u3;

  const h10 = i00 * v1 + i01 * v2 + i02 * v3;
  const h11 = i10 * v1 + i11 * v2 + i12 * v3;
  const h12 = i20 * v1 + i21 * v2 + i22 * v3;

  const jac = h00 * h11 - h01 * h10;
  if (jac <= 0.12 || jac > 7.5) return null;

  // Guard against excessive shear/anisotropy
  const sx = Math.hypot(h00, h10);
  const sy = Math.hypot(h01, h11);
  if (sx < 0.35 || sx > 2.8 || sy < 0.35 || sy > 2.8) return null;
  if (sx / sy > 1.65 || sy / sx > 1.65) return null;

  return [h00, h01, h02, h10, h11, h12, 0, 0, 1.0];
}

/**
 * 6-DOF Affine Iterative Reweighted Least Squares (IRLS) with Huber loss over all inliers
 */
export function refineAffineIRLS(
  inliers: FeatureMatch[],
  initialH: Homography,
  huberDelta = 2.5
): Homography | null {
  const n = inliers.length;
  if (n < 3) return initialH;

  let currentH = [...initialH];
  const weights = new Float64Array(n).fill(1.0);

  for (let iter = 0; iter < 3; iter++) {
    if (iter > 0) {
      for (let i = 0; i < n; i++) {
        const m = inliers[i];
        const [px, py] = projectPoint(currentH, m.refX, m.refY);
        const err = Math.hypot(px - m.curX, py - m.curY);
        weights[i] = err <= huberDelta ? 1.0 : huberDelta / Math.max(err, 1e-5);
      }
    }

    // 3x3 normal matrix for [x, y, 1] -> u and v simultaneously
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const Bu = [0, 0, 0];
    const Bv = [0, 0, 0];

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      const { refX: x, refY: y, curX: u, curY: v } = inliers[i];
      const row = [x, y, 1];
      for (let r = 0; r < 3; r++) {
        Bu[r] += w * row[r] * u;
        Bv[r] += w * row[r] * v;
        for (let c = 0; c < 3; c++) {
          M[r][c] += w * row[r] * row[c];
        }
      }
    }

    const M2 = M.map((r) => [...r]);
    const rowU = solveLinearSystem(M, Bu, 3);
    const rowV = solveLinearSystem(M2, Bv, 3);
    if (!rowU || !rowV) break;

    const candidate: Homography = [
      rowU[0], rowU[1], rowU[2],
      rowV[0], rowV[1], rowV[2],
      0, 0, 1.0,
    ];
    const jac = candidate[0] * candidate[4] - candidate[1] * candidate[3];
    if (jac <= 0.1 || jac > 8.0) break;
    currentH = candidate;
  }

  return currentH;
}

/**
 * Closed-form 2D Similarity Transform solver for 2 point correspondences:
 * Finds uniform scale s, rotation theta, translation (tx, ty)
 */
export function solveSimilarity2Points(
  src1: [number, number],
  src2: [number, number],
  dst1: [number, number],
  dst2: [number, number]
): Homography | null {
  const dx = src2[0] - src1[0];
  const dy = src2[1] - src1[1];
  const srcDistSq = dx * dx + dy * dy;
  if (srcDistSq < 100) return null; // Points too close (<10px)

  const du = dst2[0] - dst1[0];
  const dv = dst2[1] - dst1[1];
  const dstDistSq = du * du + dv * dv;
  if (dstDistSq < 100) return null;

  const scale = Math.sqrt(dstDistSq / srcDistSq);
  if (scale < 0.35 || scale > 2.8) return null;

  const angleSrc = Math.atan2(dy, dx);
  const angleDst = Math.atan2(dv, du);
  const theta = angleDst - angleSrc;

  const a = scale * Math.cos(theta);
  const b = scale * Math.sin(theta);

  const tx = dst1[0] - (a * src1[0] - b * src1[1]);
  const ty = dst1[1] - (b * src1[0] + a * src1[1]);

  return [a, -b, tx, b, a, ty, 0, 0, 1.0];
}

/**
 * Closed-form Umeyama/Procrustes least-squares similarity refinement with 2-iteration Huber IRLS
 * across all inliers. Zero risk of determinant collapse or projective explosion.
 */
export function refineSimilarityLeastSquares(
  inliers: FeatureMatch[],
  huberDelta = 2.5
): Homography | null {
  const n = inliers.length;
  if (n < 2) return null;

  const weights = new Float64Array(n).fill(1.0);
  let bestH: Homography | null = null;

  for (let iter = 0; iter < 3; iter++) {
    if (iter > 0 && bestH) {
      for (let i = 0; i < n; i++) {
        const m = inliers[i];
        const [px, py] = projectPoint(bestH, m.refX, m.refY);
        const err = Math.hypot(px - m.curX, py - m.curY);
        weights[i] = err <= huberDelta ? 1.0 : huberDelta / Math.max(err, 1e-5);
      }
    }

    let wSum = 0;
    let meanSrcX = 0;
    let meanSrcY = 0;
    let meanDstX = 0;
    let meanDstY = 0;

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      wSum += w;
      meanSrcX += w * inliers[i].refX;
      meanSrcY += w * inliers[i].refY;
      meanDstX += w * inliers[i].curX;
      meanDstY += w * inliers[i].curY;
    }
    if (wSum < 1e-5) break;
    meanSrcX /= wSum;
    meanSrcY /= wSum;
    meanDstX /= wSum;
    meanDstY /= wSum;

    let denom = 0;
    let numA = 0;
    let numB = 0;

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      const x = inliers[i].refX - meanSrcX;
      const y = inliers[i].refY - meanSrcY;
      const u = inliers[i].curX - meanDstX;
      const v = inliers[i].curY - meanDstY;

      denom += w * (x * x + y * y);
      numA += w * (x * u + y * v);
      numB += w * (x * v - y * u);
    }

    if (denom < 1e-4) break;

    const a = numA / denom;
    const b = numB / denom;
    const scale = Math.sqrt(a * a + b * b);
    if (scale < 0.25 || scale > 4.0) break;

    const tx = meanDstX - (a * meanSrcX - b * meanSrcY);
    const ty = meanDstY - (b * meanSrcX + a * meanSrcY);

    bestH = [a, -b, tx, b, a, ty, 0, 0, 1.0];
  }

  return bestH;
}

/**
 * Hartley-Normalized 8-DOF Homography Iterative Reweighted Least Squares (IRLS)
 * with Huber weights and Tikhonov perspective regularization on (h6, h7).
 */
export function refineHomographyHartleyIRLS(
  inliers: FeatureMatch[],
  initialH: Homography,
  huberDelta = 2.5
): Homography | null {
  const n = inliers.length;
  if (n < 4) return initialH;

  const srcPts: [number, number][] = inliers.map((m) => [m.refX, m.refY]);
  const dstPts: [number, number][] = inliers.map((m) => [m.curX, m.curY]);

  const normSrc = computeHartleyNormalization(srcPts);
  const normDst = computeHartleyNormalization(dstPts);

  let currentH = [...initialH];
  const weights = new Float64Array(n).fill(1.0);

  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < n; i++) {
      const m = inliers[i];
      const [px, py] = projectPoint(currentH, m.refX, m.refY);
      const err = Math.hypot(px - m.curX, py - m.curY);
      weights[i] = err <= huberDelta ? 1.0 : huberDelta / Math.max(err, 1e-5);
    }

    const AtA: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const AtB: number[] = new Array(8).fill(0);

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      const [x, y] = normSrc.normPts[i];
      const [u, v] = normDst.normPts[i];

      const row1 = [x, y, 1, 0, 0, 0, -u * x, -u * y];
      const b1 = u;
      const row2 = [0, 0, 0, x, y, 1, -v * x, -v * y];
      const b2 = v;

      for (let r = 0; r < 8; r++) {
        AtB[r] += w * (row1[r] * b1 + row2[r] * b2);
        for (let c = 0; c < 8; c++) {
          AtA[r][c] += w * (row1[r] * row1[c] + row2[r] * row2[c]);
        }
      }
    }

    // Tikhonov regularization on normalized perspective terms h6, h7 to prevent horizon blowup
    const perspectiveLambda = 0.35;
    AtA[6][6] += perspectiveLambda;
    AtA[7][7] += perspectiveLambda;

    const h = solveLinearSystem(AtA, AtB, 8);
    if (!h) break;

    const Hnorm: Homography = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
    const candidateH = multiplyHomography(
      normDst.invT,
      multiplyHomography(Hnorm, normSrc.T)
    );

    if (!isProjectiveHomographyValid(candidateH)) {
      break;
    }
    currentH = candidateH;
  }

  return currentH;
}

/**
 * Legacy alias for compatibility
 */
export function refineHomographyLeastSquares(
  inliers: FeatureMatch[],
  initialH: Homography
): Homography | null {
  return refineHomographyHartleyIRLS(inliers, initialH);
}

/**
 * Evaluate MSAC (M-estimator SAmple Consensus) cost and collect inliers
 * MSAC scores inliers by e^2 and outliers by T^2 (lower cost = better fit)
 */
function evaluateMsacCandidate(
  candidateH: Homography,
  matches: FeatureMatch[],
  threshSq: number
): { cost: number; inliers: FeatureMatch[] } {
  let cost = 0;
  const inliers: FeatureMatch[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const [px, py] = projectPoint(candidateH, m.refX, m.refY);
    const dx = px - m.curX;
    const dy = py - m.curY;
    const distSq = dx * dx + dy * dy;
    if (distSq <= threshSq) {
      cost += distSq;
      inliers.push(m);
    } else {
      cost += threshSq;
    }
  }
  return { cost, inliers };
}

/**
 * Compute bounding box area coverage ratio (0..1) of inliers in 640x360 frame
 */
function computeSpatialSpread(inliers: FeatureMatch[], width = 640, height = 360): number {
  if (inliers.length < 4) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < inliers.length; i++) {
    const { refX, refY } = inliers[i];
    if (refX < minX) minX = refX;
    if (refX > maxX) maxX = refX;
    if (refY < minY) minY = refY;
    if (refY > maxY) maxY = refY;
  }
  return ((maxX - minX) * (maxY - minY)) / (width * height);
}

/**
 * Draw unique indices with PROSAC-style bias toward top-ranked matches
 */
function sampleIndices(n: number, k: number, preferTopPool: boolean): number[] {
  const poolSize = preferTopPool ? Math.max(k + 2, Math.min(n, Math.ceil(n * 0.65))) : n;
  const indices: number[] = [];
  let guard = 0;
  while (indices.length < k && guard < 30) {
    guard++;
    const idx = Math.floor(Math.random() * poolSize);
    if (!indices.includes(idx)) {
      indices.push(idx);
    }
  }
  return indices;
}

/**
 * Estimate Homography using Quality-Guided MSAC + Hartley-Normalized Huber IRLS
 * Supports user-selectable motion models: HYBRID, PROJECTIVE_8DOF, AFFINE_6DOF, SIMILARITY_4DOF
 */
export function estimateHomographyRANSAC(
  matches: FeatureMatch[],
  maxIterations = 160,
  ransacThresholdPx = 4.5,
  minInliers = 6,
  motionModel: HomographyMotionModel = 'HYBRID',
  leastSquaresRefine = true
): RansacResult {
  const result: RansacResult = {
    homography: null,
    inliers: [],
    inlierCount: 0,
    avgReprojectionError: 0,
    scale: 1,
    rotationDeg: 0,
    translation: [0, 0],
    activeMotionModel: motionModel === 'HYBRID' ? 'SIMILARITY_4DOF' : motionModel,
  };

  const n = matches.length;
  if (n < 4) {
    return result;
  }

  const threshSq = ransacThresholdPx * ransacThresholdPx;
  let bestCost = Infinity;
  let bestInliers: FeatureMatch[] = [];
  let bestH: Homography | null = null;
  let chosenModel: HomographyMotionModel = 'SIMILARITY_4DOF';

  // Stage 1: 2-Point Similarity MSAC (always run in SIMILARITY_4DOF and HYBRID, or as fast seed)
  if (motionModel === 'SIMILARITY_4DOF' || motionModel === 'HYBRID') {
    const simIters = motionModel === 'SIMILARITY_4DOF' ? maxIterations : Math.floor(maxIterations * 0.55);
    for (let iter = 0; iter < simIters; iter++) {
      const [i1, i2] = sampleIndices(n, 2, iter < simIters * 0.6);
      const candidateH = solveSimilarity2Points(
        [matches[i1].refX, matches[i1].refY],
        [matches[i2].refX, matches[i2].refY],
        [matches[i1].curX, matches[i1].curY],
        [matches[i2].curX, matches[i2].curY]
      );
      if (!candidateH) continue;

      const { cost, inliers } = evaluateMsacCandidate(candidateH, matches, threshSq);
      if (inliers.length >= 4 && cost < bestCost) {
        bestCost = cost;
        bestInliers = inliers;
        bestH = candidateH;
        chosenModel = 'SIMILARITY_4DOF';
      }
    }
  }

  // Stage 2: 3-Point Affine MSAC (run in AFFINE_6DOF or HYBRID)
  if (motionModel === 'AFFINE_6DOF' || (motionModel === 'HYBRID' && n >= 6)) {
    const affIters = motionModel === 'AFFINE_6DOF' ? maxIterations : Math.floor(maxIterations * 0.3);
    for (let iter = 0; iter < affIters; iter++) {
      const idx = sampleIndices(n, 3, iter < affIters * 0.6);
      if (idx.length < 3) continue;
      const candidateH = solveAffine3Points(
        idx.map((i) => [matches[i].refX, matches[i].refY]),
        idx.map((i) => [matches[i].curX, matches[i].curY])
      );
      if (!candidateH) continue;

      const { cost, inliers } = evaluateMsacCandidate(candidateH, matches, threshSq);
      // In HYBRID mode, require slight cost improvement to justify 6-DOF over 4-DOF
      const costThreshold = motionModel === 'HYBRID' ? bestCost * 0.93 : bestCost;
      if (inliers.length >= 4 && cost < costThreshold) {
        bestCost = cost;
        bestInliers = inliers;
        bestH = candidateH;
        chosenModel = 'AFFINE_6DOF';
      }
    }
  }

  // Stage 3: 4-Point Hartley-Normalized Projective MSAC (run in PROJECTIVE_8DOF or HYBRID when well-spread)
  if (motionModel === 'PROJECTIVE_8DOF' || (motionModel === 'HYBRID' && n >= 10)) {
    const projIters = motionModel === 'PROJECTIVE_8DOF' ? maxIterations : Math.floor(maxIterations * 0.25);
    for (let iter = 0; iter < projIters; iter++) {
      const idx = sampleIndices(n, 4, iter < projIters * 0.6);
      if (idx.length < 4) continue;
      const candidateH = solveHomography4Points(
        idx.map((i) => [matches[i].refX, matches[i].refY]),
        idx.map((i) => [matches[i].curX, matches[i].curY])
      );
      if (!candidateH) continue;

      const { cost, inliers } = evaluateMsacCandidate(candidateH, matches, threshSq);
      const spread = computeSpatialSpread(inliers);
      const costThreshold = motionModel === 'HYBRID' ? bestCost * 0.86 : bestCost;
      if (
        inliers.length >= Math.max(6, minInliers) &&
        (motionModel === 'PROJECTIVE_8DOF' || spread >= 0.14) &&
        cost < costThreshold
      ) {
        bestCost = cost;
        bestInliers = inliers;
        bestH = candidateH;
        chosenModel = 'PROJECTIVE_8DOF';
      }
    }

    // Graceful fallback if PROJECTIVE_8DOF had too few non-collinear points
    if (!bestH && motionModel === 'PROJECTIVE_8DOF') {
      for (let iter = 0; iter < 50; iter++) {
        const [i1, i2] = sampleIndices(n, 2, true);
        const candidateH = solveSimilarity2Points(
          [matches[i1].refX, matches[i1].refY],
          [matches[i2].refX, matches[i2].refY],
          [matches[i1].curX, matches[i1].curY],
          [matches[i2].curX, matches[i2].curY]
        );
        if (!candidateH) continue;
        const { cost, inliers } = evaluateMsacCandidate(candidateH, matches, threshSq);
        if (inliers.length >= 4 && cost < bestCost) {
          bestCost = cost;
          bestInliers = inliers;
          bestH = candidateH;
          chosenModel = 'SIMILARITY_4DOF';
        }
      }
    }
  }

  if (bestH && bestInliers.length >= 4) {
    let refinedH = bestH;

    if (leastSquaresRefine) {
      if (motionModel === 'SIMILARITY_4DOF') {
        refinedH = refineSimilarityLeastSquares(bestInliers) || bestH;
        chosenModel = 'SIMILARITY_4DOF';
      } else if (motionModel === 'AFFINE_6DOF') {
        const simH = refineSimilarityLeastSquares(bestInliers) || bestH;
        refinedH = bestInliers.length >= 5 ? refineAffineIRLS(bestInliers, simH) || simH : simH;
        chosenModel = 'AFFINE_6DOF';
      } else if (motionModel === 'PROJECTIVE_8DOF') {
        const simH = refineSimilarityLeastSquares(bestInliers) || bestH;
        const affH = bestInliers.length >= 6 ? refineAffineIRLS(bestInliers, simH) || simH : simH;
        if (bestInliers.length >= 8 && computeSpatialSpread(bestInliers) >= 0.1) {
          refinedH = refineHomographyHartleyIRLS(bestInliers, affH) || affH;
          chosenModel = 'PROJECTIVE_8DOF';
        } else {
          refinedH = affH;
          chosenModel = 'AFFINE_6DOF';
        }
      } else {
        // HYBRID adaptive model promotion:
        // Start with Huber-weighted Similarity, promote to Affine or Projective only if residual drops cleanly
        const simH = refineSimilarityLeastSquares(bestInliers) || bestH;
        refinedH = simH;
        chosenModel = 'SIMILARITY_4DOF';

        const spread = computeSpatialSpread(bestInliers);
        if (bestInliers.length >= 8 && spread >= 0.12) {
          const affH = refineAffineIRLS(bestInliers, simH);
          if (affH) {
            const simEval = evaluateMsacCandidate(simH, bestInliers, threshSq);
            const affEval = evaluateMsacCandidate(affH, bestInliers, threshSq);
            if (affEval.cost < simEval.cost * 0.88) {
              refinedH = affH;
              chosenModel = 'AFFINE_6DOF';
            }
          }
        }

        if (bestInliers.length >= 14 && spread >= 0.22) {
          const projH = refineHomographyHartleyIRLS(bestInliers, refinedH);
          if (projH) {
            const curEval = evaluateMsacCandidate(refinedH, bestInliers, threshSq);
            const projEval = evaluateMsacCandidate(projH, bestInliers, threshSq);
            if (projEval.cost < curEval.cost * 0.85) {
              refinedH = projH;
              chosenModel = 'PROJECTIVE_8DOF';
            }
          }
        }
      }
    }

    // Re-collect final consensus inliers under the refined homography
    const finalEval = evaluateMsacCandidate(refinedH, matches, threshSq);
    const finalInliers = finalEval.inliers.length >= 4 ? finalEval.inliers : bestInliers;

    let totalError = 0;
    for (let i = 0; i < finalInliers.length; i++) {
      const m = finalInliers[i];
      const [px, py] = projectPoint(refinedH, m.refX, m.refY);
      totalError += Math.hypot(px - m.curX, py - m.curY);
    }
    const avgErr = totalError / finalInliers.length;

    const rotRad = Math.atan2(refinedH[3], refinedH[0]);
    const rotDeg = (rotRad * 180) / Math.PI;
    const scaleEst = Math.sqrt(refinedH[0] * refinedH[0] + refinedH[3] * refinedH[3]);
    const transEst: [number, number] = [refinedH[2], refinedH[5]];

    result.homography = refinedH;
    result.inliers = finalInliers;
    result.inlierCount = finalInliers.length;
    result.avgReprojectionError = avgErr;
    result.scale = scaleEst;
    result.rotationDeg = rotDeg;
    result.translation = transEst;
    result.activeMotionModel = chosenModel;
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
