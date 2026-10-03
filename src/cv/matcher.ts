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
 * Brute-force matcher with Lowe's ratio test, mutual cross-check consistency,
 * and ORB circular orientation histogram filtering.
 * Returns matches sorted by descriptor distance ascending for PROSAC/MSAC sampling.
 */
export function matchFeatures(
  refKeypoints: Keypoint[],
  curKeypoints: Keypoint[],
  ratioThreshold = 0.75,
  maxHammingDist = 64
): FeatureMatch[] {
  const rawMatches: FeatureMatch[] = [];
  if (refKeypoints.length < 4 || curKeypoints.length < 4) {
    return rawMatches;
  }

  // Cross-checking array to ensure one-to-one mutual best match
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
      rawMatches.push({
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

  if (rawMatches.length < 6) {
    rawMatches.sort((a, b) => a.distance - b.distance);
    return rawMatches;
  }

  // ORB Orientation Consistency Filter:
  // Build a 12-bin circular histogram (30 deg per bin) of (curAngle - refAngle)
  const numBins = 12;
  const histBins: FeatureMatch[][] = Array.from({ length: numBins }, () => []);
  const twoPi = 2 * Math.PI;

  for (let i = 0; i < rawMatches.length; i++) {
    const m = rawMatches[i];
    const dAngle =
      (((curKeypoints[m.curIdx].angle - refKeypoints[m.refIdx].angle) % twoPi) + twoPi) % twoPi;
    const binIdx = Math.min(numBins - 1, Math.floor((dAngle / twoPi) * numBins));
    histBins[binIdx].push(m);
  }

  // Find dominant orientation bin (including circular neighbors bin-1, bin, bin+1)
  let bestBin = 0;
  let bestNeighborCount = -1;
  for (let b = 0; b < numBins; b++) {
    const prev = (b + numBins - 1) % numBins;
    const next = (b + 1) % numBins;
    const count = histBins[prev].length + histBins[b].length + histBins[next].length;
    if (count > bestNeighborCount) {
      bestNeighborCount = count;
      bestBin = b;
    }
  }

  const prevBin = (bestBin + numBins - 1) % numBins;
  const nextBin = (bestBin + 1) % numBins;
  const filteredMatches = [
    ...histBins[prevBin],
    ...histBins[bestBin],
    ...histBins[nextBin],
  ];

  const finalMatches = filteredMatches.length >= 4 ? filteredMatches : rawMatches;
  finalMatches.sort((a, b) => a.distance - b.distance);
  return finalMatches;
}

