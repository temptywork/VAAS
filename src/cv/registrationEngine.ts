import { RegistrationMetrics, RegistrationQuality, RegistrationSettings } from '../types';
import {
  Keypoint,
  detectFeatures,
  rgbaToGrayscale,
} from './featureDetection';
import { FeatureMatch, matchFeatures } from './matcher';
import { Homography, estimateHomographyRANSAC } from './homography';

export class VisualRegistrationEngine {
  private refGray: Uint8Array | null = null;
  private refKeypoints: Keypoint[] = [];
  private refWidth = 0;
  private refHeight = 0;
  private refImageDataUrl: string | null = null;

  private curGrayBuffer: Uint8Array | null = null;
  private currentMatches: FeatureMatch[] = [];
  private currentInliers: FeatureMatch[] = [];
  private currentKeypoints: Keypoint[] = [];

  private lastValidHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private smoothedHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private lastQuality: RegistrationQuality = 'UNINITIALIZED';

  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 0;

  public settings: RegistrationSettings = {
    enabled: true,
    maxFeatures: 260,
    matchRatioThreshold: 0.74,
    ransacThresholdPx: 4.5,
    minInliers: 8,
    ransacIterations: 160,
    smoothingFactor: 0.65,
    leastSquaresRefine: true,
    adaptiveReference: false,
    updateIntervalMs: 33, // ~30 FPS
  };

  /**
   * Set reference frame from ImageData
   */
  public setReferenceFrame(
    imageData: ImageData,
    dataUrl?: string
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
      20
    );

    if (dataUrl) {
      this.refImageDataUrl = dataUrl;
    }

    // Reset homography to identity
    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.lastQuality = this.refKeypoints.length >= 4 ? 'GOOD' : 'DEGRADED';
    this.currentMatches = [];
    this.currentInliers = [];

    return { keypointCount: this.refKeypoints.length };
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
    return this.smoothedHomography || this.lastValidHomography;
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

    if (!this.refGray || this.refKeypoints.length < 4) {
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
      20
    );

    // Feature Matching with Lowe's ratio test
    this.currentMatches = matchFeatures(
      this.refKeypoints,
      this.currentKeypoints,
      this.settings.matchRatioThreshold,
      60
    );

    // RANSAC Homography Estimation with configurable iteration trials
    const iterations = this.settings.ransacIterations || 160;
    const ransac = estimateHomographyRANSAC(
      this.currentMatches,
      iterations,
      this.settings.ransacThresholdPx,
      this.settings.minInliers
    );

    let quality: RegistrationQuality = 'LOST';
    if (ransac.homography && ransac.inlierCount >= this.settings.minInliers) {
      quality = 'GOOD';
    } else if (ransac.homography && ransac.inlierCount >= 4) {
      quality = 'DEGRADED';
    } else {
      quality = 'LOST';
    }

    this.currentInliers = ransac.inliers;
    this.lastQuality = quality;

    if (quality === 'GOOD' || quality === 'DEGRADED') {
      if (ransac.homography) {
        this.lastValidHomography = ransac.homography;

        // Smooth homography with configurable alpha to eliminate high-frequency jitter
        const baseAlpha = this.settings.smoothingFactor ?? 0.65;
        const alpha = quality === 'GOOD' ? baseAlpha : Math.min(baseAlpha, 0.4);
        if (!this.smoothedHomography) {
          this.smoothedHomography = [...ransac.homography];
        } else {
          for (let i = 0; i < 9; i++) {
            this.smoothedHomography[i] =
              alpha * ransac.homography[i] + (1 - alpha) * this.smoothedHomography[i];
          }
        }
      }
    } else {
      // Registration is LOST: Overlays are FROZEN at last valid position per Section 16 & Section 29
      // We do not change smoothedHomography
    }

    const procTime = performance.now() - startTime;

    return {
      quality,
      inliers: ransac.inlierCount,
      totalMatches: this.currentMatches.length,
      candidateKeypointsRef: this.refKeypoints.length,
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
    this.refImageDataUrl = null;
    this.currentMatches = [];
    this.currentInliers = [];
    this.currentKeypoints = [];
    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.lastQuality = 'UNINITIALIZED';
  }
}
