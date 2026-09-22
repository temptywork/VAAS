import { Keypoint, hammingDistance } from './featureDetection';

export interface FeatureMatch {
  refIdx: number;
  curIdx: number;
  distance: number;
  refX: number;
  refY: number;
  curX: number;
  curY: number;
}

/**
 * Brute-force matcher with Lowe's ratio test (Lowe 2004)
 * For each feature in curKeypoints, find closest and 2nd closest in refKeypoints.
 * Accept if dist(1st) < ratioThreshold * dist(2nd).
 */
export function matchFeatures(
  refKeypoints: Keypoint[],
  curKeypoints: Keypoint[],
  ratioThreshold = 0.75,
  maxHammingDist = 64
): FeatureMatch[] {
  const matches: FeatureMatch[] = [];
  if (refKeypoints.length < 4 || curKeypoints.length < 4) {
    return matches;
  }

  // Cross-checking array to ensure one-to-one best match
  const refBestMatch: { curIdx: number; dist: number }[] = Array.from(
    { length: refKeypoints.length },
    () => ({ curIdx: -1, dist: Infinity })
  );

  const candidateMatches: {
    refIdx: number;
    curIdx: number;
    bestDist: number;
  }[] = [];

  for (let c = 0; c < curKeypoints.length; c++) {
    const curDesc = curKeypoints[c].descriptor;
    let bestDist = Infinity;
    let secondBestDist = Infinity;
    let bestRefIdx = -1;

    for (let r = 0; r < refKeypoints.length; r++) {
      const d = hammingDistance(curDesc, refKeypoints[r].descriptor);
      if (d < bestDist) {
        secondBestDist = bestDist;
        bestDist = d;
        bestRefIdx = r;
      } else if (d < secondBestDist) {
        secondBestDist = d;
      }
    }

    // Ratio test check
    if (
      bestRefIdx !== -1 &&
      bestDist <= maxHammingDist &&
      bestDist < secondBestDist * ratioThreshold
    ) {
      candidateMatches.push({
        refIdx: bestRefIdx,
        curIdx: c,
        bestDist,
      });

      if (bestDist < refBestMatch[bestRefIdx].dist) {
        refBestMatch[bestRefIdx] = { curIdx: c, dist: bestDist };
      }
    }
  }

  // Enforce mutual exclusivity (cross-check consistency)
  for (let i = 0; i < candidateMatches.length; i++) {
    const m = candidateMatches[i];
    if (refBestMatch[m.refIdx].curIdx === m.curIdx) {
      matches.push({
        refIdx: m.refIdx,
        curIdx: m.curIdx,
        distance: m.bestDist,
        refX: refKeypoints[m.refIdx].x,
        refY: refKeypoints[m.refIdx].y,
        curX: curKeypoints[m.curIdx].x,
        curY: curKeypoints[m.curIdx].y,
      });
    }
  }

  return matches;
}
