import { RegistrationMetrics, RegistrationQuality, RegistrationSettings } from '../types';
import {
  Keypoint,
  detectFeatures,
  rgbaToGrayscale,
} from './featureDetection';
import { FeatureMatch, matchFeatures } from './matcher';
import { Homography, estimateHomographyRANSAC, invertHomography, projectPoint } from './homography';

interface RegistrationKeyframe {
  id: string;
  independent: boolean;
  keypoints: Keypoint[];
  width: number;
  height: number;
  /** Maps the original overlay reference coordinates into this keyframe. */
  anchorToKeyframe: Homography | null;
}

const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function multiplyHomographies(a: Homography, b: Homography): Homography {
  const out = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      for (let k = 0; k < 3; k++) out[row * 3 + col] += a[row * 3 + k] * b[k * 3 + col];
    }
  }
  return out;
}

export class VisualRegistrationEngine {
  private refGray: Uint8Array | null = null;
  private refKeypoints: Keypoint[] = [];
  private refWidth = 0;
  private refHeight = 0;
  private refImageDataUrl: string | null = null;
  private keyframes: RegistrationKeyframe[] = [];
  private lastKeyframeSearchAt = 0;
  private keyframeSearchCursor = 1;
  private activeReferenceId = 'anchor-view-1';
  private currentMatchedViewId: string | null = null;
  private currentMatchedViewHomography: Homography | null = null;
  private currentMatchedViewIndependent = false;

  private curGrayBuffer: Uint8Array | null = null;
  private currentMatches: FeatureMatch[] = [];
  private currentInliers: FeatureMatch[] = [];
  private currentKeypoints: Keypoint[] = [];

  private lastValidHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private smoothedHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private externalHomography: Homography | null = null;
  private lastQuality: RegistrationQuality = 'UNINITIALIZED';
  private consecutiveWeakFrames = 0;

  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 0;

  public settings: RegistrationSettings = {
    enabled: true,
    maxFeatures: 360,
    fastThreshold: 16,
    matchRatioThreshold: 0.78,
    ransacThresholdPx: 4.5,
    minInliers: 8,
    ransacIterations: 300,
    lostFrameToleranceFrames: 12,
    smoothingFactor: 0.5,
    leastSquaresRefine: true,
    adaptiveReference: false,
    updateIntervalMs: 33, // ~30 FPS
  };

  /**
   * Set reference frame from ImageData
   */
  public setReferenceFrame(
    imageData: ImageData,
    dataUrl?: string,
    viewId = 'anchor-view-1'
  ): { keypointCount: number } {
    const { width, height, data } = imageData;
    this.refWidth = width;
    this.refHeight = height;

    this.refGray = new Uint8Array(width * height);
    rgbaToGrayscale(data, width, height, this.refGray);

    this.refKeypoints = detectFeatures(
      this.refGray,
      width,
      height,
      this.settings.maxFeatures,
      this.settings.fastThreshold ?? 16
    );
    this.keyframes = [{
      id: viewId,
      independent: false,
      keypoints: this.refKeypoints,
      width,
      height,
      anchorToKeyframe: [...IDENTITY],
    }];
    this.lastKeyframeSearchAt = 0;
    this.keyframeSearchCursor = 1;
    this.activeReferenceId = viewId;
    this.currentMatchedViewId = viewId;
    this.currentMatchedViewHomography = [...IDENTITY];

    if (dataUrl) {
      this.refImageDataUrl = dataUrl;
    }

    // Reset homography to identity
    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.externalHomography = null;
    this.consecutiveWeakFrames = 0;
    this.lastQuality = this.refKeypoints.length >= 4 ? 'GOOD' : 'DEGRADED';
    this.currentMatches = [];
    this.currentInliers = [];

    return { keypointCount: this.refKeypoints.length };
  }

  /** Add a manually captured setup view. It has its own local coordinate frame. */
  public addSetupKeyframe(imageData: ImageData, viewId: string, dataUrl?: string): number {
    if (!this.refGray) {
      const result = this.setReferenceFrame(imageData, dataUrl, viewId);
      return result.keypointCount;
    }
    const { width, height, data } = imageData;
    const gray = new Uint8Array(width * height);
    rgbaToGrayscale(data, width, height, gray);
    const keypoints = detectFeatures(gray, width, height, this.settings.maxFeatures, this.settings.fastThreshold ?? 16);
    this.keyframes = this.keyframes.filter((frame) => frame.id !== viewId);
    this.keyframes.push({ id: viewId, independent: true, keypoints, width, height, anchorToKeyframe: null });
    if (this.keyframes.length > 24) this.evictOldestNonAnchorView();
    return keypoints.length;
  }

  public getCurrentMatchedView(): { id: string | null; homography: Homography | null; independent: boolean } {
    return { id: this.currentMatchedViewId, homography: this.currentMatchedViewHomography, independent: this.currentMatchedViewIndependent };
  }

  public getAnchorViewId(): string {
    return this.activeReferenceId;
  }

  public isIndependentView(viewId: string): boolean {
    return this.keyframes.some((frame) => frame.id === viewId && frame.independent);
  }

  private evictOldestNonAnchorView(): void {
    const autoViewIndex = this.keyframes.findIndex((frame, index) => index > 0 && !frame.independent);
    this.keyframes.splice(autoViewIndex > 0 ? autoViewIndex : 1, 1);
  }

  public getReferenceKeypoints(): Keypoint[] {
    return this.refKeypoints;
  }

  public getCurrentKeypoints(): Keypoint[] {
    return this.currentKeypoints;
  }

  public getInliers(): FeatureMatch[] {
    return this.currentInliers;
  }

  public getMatches(): FeatureMatch[] {
    return this.currentMatches;
  }

  public getReferenceImage(): string | null {
    return this.refImageDataUrl;
  }

  public getHomography(): Homography | null {
    if (!this.settings.enabled) {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }
    if (this.externalHomography) {
      return this.externalHomography;
    }
    return this.smoothedHomography || this.lastValidHomography;
  }

  public setExternalHomography(homography: Homography | null): void {
    this.externalHomography = homography;
  }

  /**
   * Process incoming live frame and compute visual registration
   */
  public processFrame(imageData: ImageData): RegistrationMetrics {
    const startTime = performance.now();
    const { width, height, data } = imageData;

    // Calculate FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!this.refGray) {
      return {
        quality: 'UNINITIALIZED',
        inliers: 0,
        totalMatches: 0,
        candidateKeypointsRef: this.refKeypoints.length,
        candidateKeypointsCur: 0,
        reprojectionError: 0,
        homography: this.lastValidHomography,
        fps: this.currentFps,
        processingTimeMs: performance.now() - startTime,
        scaleEstimate: 1,
        rotationEstimateDeg: 0,
        translationEstimate: [0, 0],
      };
    }

    if (!this.settings.enabled) {
      return {
        quality: 'GOOD',
        inliers: this.refKeypoints.length,
        totalMatches: this.refKeypoints.length,
        candidateKeypointsRef: this.refKeypoints.length,
        candidateKeypointsCur: this.refKeypoints.length,
        reprojectionError: 0,
        homography: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        fps: this.currentFps,
        processingTimeMs: performance.now() - startTime,
        scaleEstimate: 1,
        rotationEstimateDeg: 0,
        translationEstimate: [0, 0],
      };
    }

    // Allocate current frame grayscale buffer
    if (!this.curGrayBuffer || this.curGrayBuffer.length !== width * height) {
      this.curGrayBuffer = new Uint8Array(width * height);
    }
    rgbaToGrayscale(data, width, height, this.curGrayBuffer);

    // Feature Detection on Current Frame
    this.currentKeypoints = detectFeatures(
      this.curGrayBuffer,
      width,
      height,
      this.settings.maxFeatures,
      this.settings.fastThreshold ?? 16
    );

    // Feature Matching with Lowe's ratio test
    this.currentMatches = matchFeatures(
      this.refKeypoints,
      this.currentKeypoints,
      this.settings.matchRatioThreshold,
      60
    );

    // RANSAC Homography Estimation with configurable iteration trials
    const iterations = this.settings.ransacIterations || 300;
    const ransac = estimateHomographyRANSAC(
      this.currentMatches,
      iterations,
      this.settings.ransacThresholdPx,
      this.settings.minInliers,
      this.settings.leastSquaresRefine !== false
    );

    const hasReliableSupport = this.isReliable(ransac, width, height);

    // If the active view no longer overlaps the current scene, search a small
    // bounded bank of earlier views. This runs only on weak frames and is
    // throttled so normal frame processing stays on the fast single-view path.
    let selectedHomography = ransac.homography;
    let selectedInliers = ransac.inliers;
    let selectedMatches = this.currentMatches;
    let selectedMatchCount = this.currentMatches.length;
    let selectedReferenceCount = this.refKeypoints.length;
    let selectedViewId = this.activeReferenceId;
    let selectedViewIndependent = false;
    let selectedLocalHomography = ransac.homography;
    let recoveredFromKeyframe = false;
    if (!hasReliableSupport && this.keyframes.length > 1 && performance.now() - this.lastKeyframeSearchAt >= 250) {
      this.lastKeyframeSearchAt = performance.now();
      const searchCount = Math.min(3, this.keyframes.length - 1);
      for (let offset = 0; offset < searchCount; offset++) {
        const index = 1 + ((this.keyframeSearchCursor - 1 + offset) % (this.keyframes.length - 1));
        const keyframe = this.keyframes[index];
        if (keyframe.keypoints === this.refKeypoints) continue;
        const keyframeMatches = matchFeatures(
          keyframe.keypoints,
          this.currentKeypoints,
          this.settings.matchRatioThreshold,
          60
        );
        if (keyframeMatches.length < Math.max(8, this.settings.minInliers)) continue;
        const candidate = estimateHomographyRANSAC(
          keyframeMatches,
          Math.min(iterations, 120),
          this.settings.ransacThresholdPx,
          this.settings.minInliers,
          this.settings.leastSquaresRefine !== false
        );
        if (!this.isReliable(candidate, keyframe.width, keyframe.height)) continue;
        const anchorToCurrent = multiplyHomographies(
          candidate.homography!,
          keyframe.anchorToKeyframe || IDENTITY
        );
        selectedHomography = keyframe.anchorToKeyframe ? anchorToCurrent : null;
        selectedLocalHomography = candidate.homography;
        selectedViewId = keyframe.id;
        selectedViewIndependent = keyframe.independent;
        selectedInliers = candidate.inliers;
        selectedMatches = keyframeMatches;
        selectedMatchCount = keyframeMatches.length;
        selectedReferenceCount = keyframe.keypoints.length;
        recoveredFromKeyframe = true;
        break;
      }
      this.keyframeSearchCursor = 1 + ((this.keyframeSearchCursor - 1 + searchCount) % (this.keyframes.length - 1));
    }

    const finalReliable = hasReliableSupport || recoveredFromKeyframe;

    if (recoveredFromKeyframe && selectedHomography) {
      // A keyframe switch can be a large pose jump; do not interpolate matrix
      // coefficients across unrelated views.
      this.lastValidHomography = selectedHomography;
      this.smoothedHomography = [...selectedHomography];
      this.consecutiveWeakFrames = 0;
    }

    if (finalReliable) {
      this.currentMatchedViewId = selectedViewId;
      this.currentMatchedViewHomography = selectedLocalHomography;
      this.currentMatchedViewIndependent = selectedViewIndependent;
    }

    let quality: RegistrationQuality;
    if (finalReliable) {
      quality = 'GOOD';
      this.consecutiveWeakFrames = 0;
    } else {
      this.consecutiveWeakFrames++;
      const hasSomeSupport = ransac.homography !== null && ransac.inlierCount >= 4;
      const graceFrames = this.settings.lostFrameToleranceFrames ?? 12;
      quality = hasSomeSupport || this.consecutiveWeakFrames <= graceFrames
        ? 'DEGRADED'
        : 'LOST';
    }

    this.currentInliers = recoveredFromKeyframe ? selectedInliers : ransac.inliers;
    if (recoveredFromKeyframe) this.currentMatches = selectedMatches;
    this.lastQuality = quality;

    // Only promote a geometrically supported estimate. A four-to-seven point
    // fit can satisfy the minimum needed to solve a homography while still
    // being badly conditioned; applying it makes overlays jump dramatically.
    // Keep the last trusted transform during DEGRADED/LOST frames and recover
    // as soon as the scene provides enough well-distributed inliers again.
    if (quality === 'GOOD') {
      if (selectedHomography) {
        if (!recoveredFromKeyframe) this.lastValidHomography = selectedHomography;

        // Smooth homography with configurable alpha to eliminate high-frequency jitter
        const alpha = this.settings.smoothingFactor ?? 0.5;
        if (!this.smoothedHomography) {
          this.smoothedHomography = [...selectedHomography];
        } else {
          for (let i = 0; i < 9; i++) {
            this.smoothedHomography[i] =
              alpha * selectedHomography[i] + (1 - alpha) * this.smoothedHomography[i];
          }
        }
        this.maybeAddKeyframe(this.currentKeypoints, width, height, selectedHomography);
      }
      if (recoveredFromKeyframe && !selectedHomography && selectedLocalHomography) {
        // Independent setup views use their own pixel coordinates and do not
        // fabricate a transform into the first view's coordinate plane.
        this.smoothedHomography = this.lastValidHomography;
      }
    } else {
      // Registration is LOST: Overlays are FROZEN at last valid position per Section 16 & Section 29
      // We do not change smoothedHomography
    }

    const procTime = performance.now() - startTime;

    return {
      quality,
      inliers: recoveredFromKeyframe ? selectedInliers.length : ransac.inlierCount,
      totalMatches: selectedMatchCount,
      candidateKeypointsRef: selectedReferenceCount,
      candidateKeypointsCur: this.currentKeypoints.length,
      reprojectionError: ransac.avgReprojectionError,
      homography: this.smoothedHomography || this.lastValidHomography,
      fps: this.currentFps,
      processingTimeMs: procTime,
      scaleEstimate: ransac.scale,
      rotationEstimateDeg: ransac.rotationDeg,
      translationEstimate: ransac.translation,
    };
  }

  public reset(): void {
    this.refGray = null;
    this.refKeypoints = [];
    this.keyframes = [];
    this.refImageDataUrl = null;
    this.currentMatches = [];
    this.currentInliers = [];
    this.currentKeypoints = [];
    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.externalHomography = null;
    this.lastQuality = 'UNINITIALIZED';
    this.consecutiveWeakFrames = 0;
    this.currentMatchedViewId = null;
    this.currentMatchedViewHomography = null;
    this.currentMatchedViewIndependent = false;
  }

  private isReliable(
    result: ReturnType<typeof estimateHomographyRANSAC>,
    width: number,
    height: number
  ): boolean {
    const coverage = this.getInlierCoverage(result.inliers, width, height);
    return result.homography !== null &&
      result.inlierCount >= this.settings.minInliers &&
      coverage.x >= 0.15 && coverage.y >= 0.12 &&
      result.avgReprojectionError <= this.settings.ransacThresholdPx * 0.75;
  }

  private maybeAddKeyframe(
    keypoints: Keypoint[],
    width: number,
    height: number,
    anchorToCurrent: Homography
  ): void {
    const inverse = invertHomography(anchorToCurrent);
    if (!inverse) return;
    const latest = [...this.keyframes].reverse().find((frame) => frame.anchorToKeyframe !== null);
    if (latest?.anchorToKeyframe) {
      const corners: [number, number][] = [[0, 0], [width, 0], [0, height], [width, height]];
      let displacement = 0;
      for (const [x, y] of corners) {
        const [oldX, oldY] = projectPoint(latest.anchorToKeyframe, x, y);
        const [newX, newY] = projectPoint(inverse, x, y);
        displacement = Math.max(displacement, Math.hypot(oldX - newX, oldY - newY));
      }
      if (displacement < 80) return;
    }

    // Keep the original anchor plus at most 23 recent views. Only descriptors
    // are retained, keeping the map compact and the search workload bounded.
    this.keyframes.push({
      id: `auto-view-${Date.now()}-${this.keyframes.length}`,
      independent: false,
      keypoints,
      width,
      height,
      anchorToKeyframe: inverse,
    });
    if (this.keyframes.length > 24) this.evictOldestNonAnchorView();
  }

  private getInlierCoverage(
    inliers: FeatureMatch[],
    width: number,
    height: number
  ): { x: number; y: number } {
    if (inliers.length < 4 || width <= 0 || height <= 0) {
      return { x: 0, y: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const match of inliers) {
      minX = Math.min(minX, match.refX);
      maxX = Math.max(maxX, match.refX);
      minY = Math.min(minY, match.refY);
      maxY = Math.max(maxY, match.refY);
    }

    return {
      x: (maxX - minX) / width,
      y: (maxY - minY) / height,
    };
  }
}
