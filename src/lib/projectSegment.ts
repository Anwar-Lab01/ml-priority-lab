// ── Segment Projection Math ──────────────────────────────────────────────────
//
// Extracted from TreatmentEnginePage.tsx (Phase 1 refactor).
// Pure geometry function — no React dependencies.
//
// SAFETY: No behavioral changes. Function is byte-identical to original.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract exact partial subset of original polyline between specific STA meter range 
 */
export function projectSegment(coords: [number, number][], startM: number, endM: number, totalLengthM: number): [number, number][] {
  if (!coords || coords.length < 2 || totalLengthM <= 0) return [];
  const startFraction = Math.max(0, Math.min(1, startM / totalLengthM));
  const endFraction = Math.max(startFraction, Math.min(1, endM / totalLengthM));
  if (startFraction === endFraction) return [];

  const cumulative: number[] = [0];
  let runningDist = 0;
  for (let i = 1; i < coords.length; i++) {
    runningDist += Math.sqrt(Math.pow(coords[i][0] - coords[i-1][0], 2) + Math.pow(coords[i][1] - coords[i-1][1], 2));
    cumulative.push(runningDist);
  }
  
  const totalMapDist = runningDist;
  if (totalMapDist === 0) return coords;

  const targetStart = startFraction * totalMapDist;
  const targetEnd = endFraction * totalMapDist;
  const result: [number, number][] = [];

  // 1. Interpolate dynamic head point
  for (let i = 0; i < coords.length - 1; i++) {
    if (targetStart >= cumulative[i] && targetStart <= cumulative[i+1]) {
       const distInSeg = targetStart - cumulative[i];
       const segLen = cumulative[i+1] - cumulative[i];
       const f = segLen === 0 ? 0 : distInSeg / segLen;
       result.push([
         coords[i][0] + f * (coords[i+1][0] - coords[i][0]),
         coords[i][1] + f * (coords[i+1][1] - coords[i][1])
       ]);
       break;
    }
  }

  // 2. Attach rigid central nodes
  for (let i = 0; i < coords.length; i++) {
    if (cumulative[i] > targetStart && cumulative[i] < targetEnd) {
      result.push(coords[i]);
    }
  }

  // 3. Interpolate dynamic tail point
  for (let i = 0; i < coords.length - 1; i++) {
    if (targetEnd >= cumulative[i] && targetEnd <= cumulative[i+1]) {
       const distInSeg = targetEnd - cumulative[i];
       const segLen = cumulative[i+1] - cumulative[i];
       const f = segLen === 0 ? 0 : distInSeg / segLen;
       result.push([
         coords[i][0] + f * (coords[i+1][0] - coords[i][0]),
         coords[i][1] + f * (coords[i+1][1] - coords[i][1])
       ]);
       break;
    }
  }
  
  return result;
}
