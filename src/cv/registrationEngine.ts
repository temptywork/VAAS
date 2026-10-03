import {
  HomographyMotionModel,
  RegistrationMetrics,
  RegistrationQuality,
  RegistrationSettings,
} from '../types';
import {
  Keypoint,
  detectFeatures,
  rgbaToGrayscale,
} from './featureDetection';
import { FeatureMatch, matchFeatures } from './matcher';
import {
  Homography,
  RansacResult,
  estimateHomographyRANSAC,
  multiplyHomography,
  projectPoint,
  solveHomographyFrom4Corners,
} from './homography';

export class VisualRegistrationEngine {
  private refGray: Uint8Array | null = null;
  private refKeypoints: Keypoint[] = [];
  private refWidth = 640;
  private refHeight = 360;
  private refImageDataUrl: string | null = null;

  // Active chained keyframe state for wide camera panning
  private activeKeyframeKeypoints: Keypoint[] = [];
  private activeKeyframeToRootH: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private keyframeChainDepth = 0;

  private curGrayBuffer: Uint8Array | null = null;
  private currentMatches: FeatureMatch[] = [];
  private currentInliers: FeatureMatch[] = [];
  private currentKeypoints: Keypoint[] = [];

  private lastValidHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private smoothedHomography: Homography | null = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private filteredCorners: [number, number][] | null = null;
  private lastCornerVelocityPx = 0;
  private lastActiveMotionModel: HomographyMotionModel = 'SIMILARITY_4DOF';

  private smoothedTx = 0;
  private smoothedTy = 0;
  private smoothedScale = 1;
  private smoothedRotRad = 0;
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
    motionModel: 'HYBRID',
    enableKeyframeChaining: true,
    adaptiveCornerFiltering: true,
    orientedOrbDescriptors: true,
  };

  /**
   * Set root reference frame from ImageData
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

    const useOriented = this.settings.orientedOrbDescriptors !== false;
    this.refKeypoints = detectFeatures(
      this.refGray,
      width,
      height,
      this.settings.maxFeatures,
      20,
      useOriented
    );

    if (dataUrl) {
      this.refImageDataUrl = dataUrl;
    }

    // Reset keyframe chain and homography to identity
    this.activeKeyframeKeypoints = [];
    this.activeKeyframeToRootH = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.keyframeChainDepth = 0;

    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.filteredCorners = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
    this.lastCornerVelocityPx = 0;
    this.smoothedTx = 0;
    this.smoothedTy = 0;
    this.smoothedScale = 1;
    this.smoothedRotRad = 0;
    this.lastQuality = this.refKeypoints.length >= 4 ? 'GOOD' : 'DEGRADED';
    this.currentMatches = [];
    this.currentInliers = [];

    return { keypointCount: this.refKeypoints.length };
  }

  /**
   * Clear intermediate chained keyframes and relock to root reference frame
   */
  public clearKeyframeChain(): void {
    this.activeKeyframeKeypoints = [];
    this.activeKeyframeToRootH = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.keyframeChainDepth = 0;
  }

  public getKeyframeCount(): number {
    return this.keyframeChainDepth;
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
        activeMotionModel: this.settings.motionModel || 'HYBRID',
        keyframeCount: 0,
        cornerVelocityPx: 0,
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
        activeMotionModel: this.settings.motionModel || 'HYBRID',
        keyframeCount: this.keyframeChainDepth,
        cornerVelocityPx: 0,
      };
    }

    // Allocate current frame grayscale buffer
    if (!this.curGrayBuffer || this.curGrayBuffer.length !== width * height) {
      this.curGrayBuffer = new Uint8Array(width * height);
    }
    rgbaToGrayscale(data, width, height, this.curGrayBuffer);

    const useOriented = this.settings.orientedOrbDescriptors !== false;
    this.currentKeypoints = detectFeatures(
      this.curGrayBuffer,
      width,
      height,
      this.settings.maxFeatures,
      20,
      useOriented
    );

    const iterations = this.settings.ransacIterations || 160;
    const motionModel: HomographyMotionModel = this.settings.motionModel || 'HYBRID';
    const refineLS = this.settings.leastSquaresRefine !== false;

    // 1. Primary Match against Root Reference Frame (F0) for zero-drift loop closure
    const rootMatches = matchFeatures(
      this.refKeypoints,
      this.currentKeypoints,
      this.settings.matchRatioThreshold,
      62
    );

    const rootRansac = estimateHomographyRANSAC(
      rootMatches,
      iterations,
      this.settings.ransacThresholdPx,
      this.settings.minInliers,
      motionModel,
      refineLS
    );

    let activeRansac: RansacResult = rootRansac;
    let compositeH: Homography | null = rootRansac.homography;
    let usedChainedKeyframe = false;
    this.currentMatches = rootMatches;

    const chainingEnabled =
      this.settings.enableKeyframeChaining !== false || this.settings.adaptiveReference;

    // If root match is strong, lock directly to root F0 and close any open keyframe loop
    if (
      rootRansac.homography &&
      rootRansac.inlierCount >= Math.max(8, this.settings.minInliers)
    ) {
      if (
        this.keyframeChainDepth > 0 &&
        rootRansac.inlierCount >= Math.max(12, this.settings.minInliers + 2)
      ) {
        // Direct loop closure back to root reference frame
        this.activeKeyframeKeypoints = [];
        this.activeKeyframeToRootH = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        this.keyframeChainDepth = 0;
      }
    } else if (
      chainingEnabled &&
      this.activeKeyframeKeypoints.length >= 8
    ) {
      // 2. Fallback to Active Chained Keyframe (Fk) for wide camera panning
      const kfMatches = matchFeatures(
        this.activeKeyframeKeypoints,
        this.currentKeypoints,
        this.settings.matchRatioThreshold,
        62
      );
      const kfRansac = estimateHomographyRANSAC(
        kfMatches,
        iterations,
        this.settings.ransacThresholdPx,
        this.settings.minInliers,
        motionModel,
        refineLS
      );

      if (
        kfRansac.homography &&
        kfRansac.inlierCount > rootRansac.inlierCount &&
        kfRansac.inlierCount >= 4
      ) {
        activeRansac = kfRansac;
        this.currentMatches = kfMatches;
        usedChainedKeyframe = true;
        // Compose H_{0 -> cur} = H_{k -> cur} * H_{0 -> k}
        compositeH = multiplyHomography(kfRansac.homography, this.activeKeyframeToRootH);
      }
    }

    // 3. Automatic Keyframe Handoff: spawn intermediate keyframe when camera pans significantly
    if (
      chainingEnabled &&
      compositeH &&
      activeRansac.homography &&
      activeRansac.inlierCount >= Math.max(12, this.settings.minInliers + 3) &&
      activeRansac.avgReprojectionError <= 2.6 &&
      this.keyframeChainDepth < 12
    ) {
      const relTrans = Math.hypot(
        activeRansac.translation[0],
        activeRansac.translation[1]
      );
      const relRot = Math.abs(activeRansac.rotationDeg);
      const relScaleDiff = Math.abs(activeRansac.scale - 1.0);

      if (relTrans > 75 || relRot > 14 || relScaleDiff > 0.18) {
        this.activeKeyframeKeypoints = this.currentKeypoints.map((kp) => ({
          ...kp,
          descriptor: new Uint32Array(kp.descriptor),
        }));
        this.activeKeyframeToRootH = [...compositeH];
        if (!usedChainedKeyframe) {
          this.keyframeChainDepth = 1;
        } else {
          this.keyframeChainDepth++;
        }
      }
    }

    let quality: RegistrationQuality = 'LOST';
    if (compositeH && activeRansac.inlierCount >= this.settings.minInliers) {
      quality = 'GOOD';
    } else if (compositeH && activeRansac.inlierCount >= 4) {
      quality = 'DEGRADED';
    } else {
      quality = 'LOST';
    }

    const wasTrackingLost =
      this.lastQuality === 'LOST' || this.lastQuality === 'UNINITIALIZED';
    this.currentInliers = activeRansac.inliers;
    this.lastQuality = quality;
    this.lastActiveMotionModel = activeRansac.activeMotionModel;

    // Extract global composite motion metrics
    let globalScale = activeRansac.scale;
    let globalRotDeg = activeRansac.rotationDeg;
    let globalTrans: [number, number] = activeRansac.translation;

    if (compositeH) {
      globalRotDeg = (Math.atan2(compositeH[3], compositeH[0]) * 180) / Math.PI;
      globalScale = Math.sqrt(
        compositeH[0] * compositeH[0] + compositeH[3] * compositeH[3]
      );
      globalTrans = [compositeH[2], compositeH[5]];
    }

    if ((quality === 'GOOD' || quality === 'DEGRADED') && compositeH) {
      this.lastValidHomography = compositeH;

      const canonicalCorners: [number, number][] = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ];
      const rawProjectedCorners: [number, number][] = canonicalCorners.map(
        ([cx, cy]) => projectPoint(compositeH!, cx, cy)
      );

      // Compute instantaneous screen-space corner velocity (px/frame)
      let meanCornerStep = 0;
      if (this.filteredCorners && this.filteredCorners.length === 4) {
        for (let i = 0; i < 4; i++) {
          meanCornerStep += Math.hypot(
            rawProjectedCorners[i][0] - this.filteredCorners[i][0],
            rawProjectedCorners[i][1] - this.filteredCorners[i][1]
          );
        }
        meanCornerStep /= 4;
      }
      this.lastCornerVelocityPx = meanCornerStep;

      const baseAlpha = this.settings.smoothingFactor ?? 0.65;
      const useAdaptiveCorners = this.settings.adaptiveCornerFiltering !== false;

      if (!this.smoothedHomography || !this.filteredCorners || wasTrackingLost) {
        this.smoothedHomography = [...compositeH];
        this.filteredCorners = rawProjectedCorners.map(([x, y]) => [x, y]);
        this.smoothedTx = globalTrans[0];
        this.smoothedTy = globalTrans[1];
        this.smoothedScale = globalScale;
        this.smoothedRotRad = (globalRotDeg * Math.PI) / 180;
      } else if (useAdaptiveCorners) {
        // Adaptive 4-Corner Velocity Filter:
        // Heavy deadband damping when camera is stationary (<1.0 px/frame) to eliminate pixel crawl;
        // Fast responsiveness when camera is actively panning (>5.5 px/frame).
        let effectiveAlpha = baseAlpha;
        if (meanCornerStep < 0.9) {
          effectiveAlpha = Math.min(baseAlpha * 0.22, 0.14);
        } else if (meanCornerStep < 5.5) {
          const t = (meanCornerStep - 0.9) / (5.5 - 0.9);
          const minA = Math.min(baseAlpha * 0.35, 0.22);
          effectiveAlpha = minA + t * (baseAlpha - minA);
        } else {
          effectiveAlpha = Math.max(baseAlpha, 0.84);
        }

        if (quality === 'DEGRADED') {
          effectiveAlpha = Math.min(effectiveAlpha, 0.38);
        }

        for (let i = 0; i < 4; i++) {
          this.filteredCorners[i][0] =
            effectiveAlpha * rawProjectedCorners[i][0] +
            (1 - effectiveAlpha) * this.filteredCorners[i][0];
          this.filteredCorners[i][1] =
            effectiveAlpha * rawProjectedCorners[i][1] +
            (1 - effectiveAlpha) * this.filteredCorners[i][1];
        }

        const cornerH = solveHomographyFrom4Corners(
          canonicalCorners,
          this.filteredCorners
        );
        if (cornerH) {
          this.smoothedHomography = cornerH;
        } else {
          // Fallback to rigid similarity parameter smoothing
          this.smoothedTx =
            effectiveAlpha * globalTrans[0] + (1 - effectiveAlpha) * this.smoothedTx;
          this.smoothedTy =
            effectiveAlpha * globalTrans[1] + (1 - effectiveAlpha) * this.smoothedTy;
          this.smoothedScale =
            effectiveAlpha * globalScale + (1 - effectiveAlpha) * this.smoothedScale;

          const targetRad = (globalRotDeg * Math.PI) / 180;
          let diffRad = targetRad - this.smoothedRotRad;
          while (diffRad > Math.PI) diffRad -= 2 * Math.PI;
          while (diffRad < -Math.PI) diffRad += 2 * Math.PI;
          this.smoothedRotRad += effectiveAlpha * diffRad;

          const a = this.smoothedScale * Math.cos(this.smoothedRotRad);
          const b = this.smoothedScale * Math.sin(this.smoothedRotRad);
          this.smoothedHomography = [
            a, -b, this.smoothedTx,
            b,  a, this.smoothedTy,
            0,  0, 1.0,
          ];
        }
      } else {
        // Standard parameter-space EMA smoothing
        const alpha = quality === 'GOOD' ? baseAlpha : Math.min(baseAlpha, 0.4);
        this.smoothedTx = alpha * globalTrans[0] + (1 - alpha) * this.smoothedTx;
        this.smoothedTy = alpha * globalTrans[1] + (1 - alpha) * this.smoothedTy;
        this.smoothedScale = alpha * globalScale + (1 - alpha) * this.smoothedScale;

        const targetRad = (globalRotDeg * Math.PI) / 180;
        let diffRad = targetRad - this.smoothedRotRad;
        while (diffRad > Math.PI) diffRad -= 2 * Math.PI;
        while (diffRad < -Math.PI) diffRad += 2 * Math.PI;
        this.smoothedRotRad += alpha * diffRad;

        const a = this.smoothedScale * Math.cos(this.smoothedRotRad);
        const b = this.smoothedScale * Math.sin(this.smoothedRotRad);
        this.smoothedHomography = [
          a, -b, this.smoothedTx,
          b,  a, this.smoothedTy,
          0,  0, 1.0,
        ];
      }
    } else {
      this.lastCornerVelocityPx = 0;
    }

    const procTime = performance.now() - startTime;

    return {
      quality,
      inliers: activeRansac.inlierCount,
      totalMatches: this.currentMatches.length,
      candidateKeypointsRef: usedChainedKeyframe
        ? this.activeKeyframeKeypoints.length
        : this.refKeypoints.length,
      candidateKeypointsCur: this.currentKeypoints.length,
      reprojectionError: activeRansac.avgReprojectionError,
      homography: this.smoothedHomography || this.lastValidHomography,
      fps: this.currentFps,
      processingTimeMs: procTime,
      scaleEstimate: globalScale,
      rotationEstimateDeg: globalRotDeg,
      translationEstimate: globalTrans,
      activeMotionModel: this.lastActiveMotionModel,
      keyframeCount: this.keyframeChainDepth,
      cornerVelocityPx: this.lastCornerVelocityPx,
    };
  }

  public reset(): void {
    this.refGray = null;
    this.refKeypoints = [];
    this.refImageDataUrl = null;
    this.activeKeyframeKeypoints = [];
    this.activeKeyframeToRootH = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.keyframeChainDepth = 0;
    this.currentMatches = [];
    this.currentInliers = [];
    this.currentKeypoints = [];
    this.lastValidHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.smoothedHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.filteredCorners = null;
    this.lastCornerVelocityPx = 0;
    this.smoothedTx = 0;
    this.smoothedTy = 0;
    this.smoothedScale = 1;
    this.smoothedRotRad = 0;
    this.lastQuality = 'UNINITIALIZED';
  }
}
