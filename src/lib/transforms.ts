/**
 * Helper utilities for data transformations, filtering and statistical computations.
 */

/**
 * Normalizes scenario IDs (e.g. trimming or consistent casing if needed)
 */
export function normalizeScenarioId(id: string): string {
  return id.toLowerCase().trim();
}

/**
 * Normalizes model names to a consistent set
 */
export function normalizeModelName(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes('xgboost')) return 'XGBoost';
  if (n.includes('randomforest') || n.includes('rf')) return 'RandomForest';
  if (n.includes('decisiontree') || n.includes('dt')) return 'DecisionTree';
  return name;
}

/**
 * Filters a sorted list of items by rank up to K
 */
export function filterTopK<T extends { rank: number }>(items: T[], k: number): T[] {
  return items.filter(item => item.rank <= k);
}

/**
 * Computes the intersection of two sets of road IDs
 */
export function computeOverlapSet(setA: Set<any>, setB: Set<any>): Set<any> {
  const intersection = new Set<any>();
  for (const id of setA) {
    if (setB.has(id)) {
      intersection.add(id);
    }
  }
  return intersection;
}

/**
 * Computes Jaccard Similarity between two sets
 */
export function computeJaccardSimilarity(setA: Set<any>, setB: Set<any>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  const overlap = computeOverlapSet(setA, setB);
  const unionSize = setA.size + setB.size - overlap.size;
  return overlap.size / unionSize;
}

/**
 * Computes rank delta between two scenarios for the same roads
 */
export function computeRankDeltas(
  ranksA: Map<any, number>,
  ranksB: Map<any, number>
): Map<any, number> {
  const deltas = new Map<any, number>();
  for (const [id, rankA] of ranksA.entries()) {
    const rankB = ranksB.get(id);
    if (rankB !== undefined) {
      deltas.set(id, rankB - rankA);
    }
  }
  return deltas;
}

/**
 * Computes Spearman Rank Correlation Coefficient
 * 1 - (6 * sum(d^2)) / (n * (n^2 - 1))
 */
export function computeSpearmanCorrelation(
  ranksA: Map<any, number>,
  ranksB: Map<any, number>
): number {
  const commonIds = Array.from(ranksA.keys()).filter(id => ranksB.has(id));
  const n = commonIds.length;
  if (n < 2) return 0;

  let sumD2 = 0;
  for (const id of commonIds) {
    const d = (ranksA.get(id) ?? 0) - (ranksB.get(id) ?? 0);
    sumD2 += d * d;
  }

  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return rho;
}
