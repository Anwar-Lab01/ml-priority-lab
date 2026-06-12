import type { CandidateBasketItem, CandidateStatus, DD2RoadFeature } from './treatmentTypes';

export type OptimizationWeights = {
  conditionUrgency: number;
  historicalGap: number;
  costEfficiency: number;
};

export type HistoricalTreatmentYearFlags = {
  any?: number | null;
  pl?: number | null;
  tender?: number | null;
};

export type HistoricalTreatmentContext = {
  road_key?: string | null;
  handled?: Record<string, HistoricalTreatmentYearFlags | undefined> | null;
  prior_history_pre2026?: {
    any?: number | null;
    count?: number | null;
    last_year?: number | null;
    years_since_last?: number | null;
  } | null;
  prior_handled_count_pre2026?: number | null;
  prior_handled_last_year_pre2026?: number | null;
  years_since_last_handled_pre2026?: number | null;
  handled_any_2021?: number | null;
  handled_any_2022?: number | null;
  handled_any_2023?: number | null;
  handled_any_2024?: number | null;
  handled_any_2025?: number | null;
};

export type OptimizationRoadInput = Pick<
  DD2RoadFeature,
  'road_key' | 'canonical_road_name' | 'non_mantap_pct' | 'kondisi_rusak_berat_pct' | 'kecamatan_dilalui'
> & {
  unpaved_pct?: number | null;
  rusak_berat_pct?: number | null;
};

export type TreatmentOptimizationInput = {
  road: OptimizationRoadInput | null | undefined;
  history?: HistoricalTreatmentContext | null;
  pagu_indikatif_rp?: number | null;
  status?: CandidateStatus | null;
  weights?: Partial<OptimizationWeights> | null;
};

export type TreatmentOptimizationScore = {
  road_key: string | null;
  condition_urgency_score: number;
  historical_gap_score: number;
  cost_efficiency_score: number;
  weighted_score: number;
  weights: OptimizationWeights;
  manual_status: CandidateStatus | null;
  manual_status_effect: 'normal' | 'force_include' | 'force_exclude' | 'deferred';
  kecamatan_balance_hint: string | null;
};

export type TreatmentOptimizationExplanation = {
  summary: string;
  factors: string[];
  guardrails: string[];
};

export type ScenarioOptimizationCandidate = {
  item: CandidateBasketItem;
  road: OptimizationRoadInput | null;
  history: HistoricalTreatmentContext | null;
  score: TreatmentOptimizationScore;
  explanation: TreatmentOptimizationExplanation;
};

export type ScenarioOptimizationPreviewInput = {
  candidates: CandidateBasketItem[] | Record<string, CandidateBasketItem>;
  roadsByKey: Map<string, OptimizationRoadInput> | Record<string, OptimizationRoadInput | undefined>;
  historyByKey?:
    | Map<string, HistoricalTreatmentContext>
    | Record<string, HistoricalTreatmentContext | undefined>
    | null;
  budgetCapRp?: number | null;
  weights?: Partial<OptimizationWeights> | null;
};

export type ScenarioOptimizationPreviewResult = {
  optimizedSelected: ScenarioOptimizationCandidate[];
  optimizedDeferred: ScenarioOptimizationCandidate[];
  forceIncluded: ScenarioOptimizationCandidate[];
  forceExcluded: ScenarioOptimizationCandidate[];
  totalOptimizedBudget: number;
  budgetCap: number | null;
  warnings: string[];
  explanation: Record<string, TreatmentOptimizationExplanation>;
};

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  conditionUrgency: 0.6,
  historicalGap: 0.25,
  costEfficiency: 0.15,
};

const HISTORICAL_YEARS = ['2021', '2022', '2023', '2024', '2025'] as const;
const COST_EFFICIENCY_REFERENCE_RP = 10_000_000_000;
const MIN_URGENCY_FOR_COST_RATIO = 0.1;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizePct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return clamp01(value / 100);
}

function normalizeWeights(weights?: Partial<OptimizationWeights> | null): OptimizationWeights {
  const merged = {
    ...DEFAULT_OPTIMIZATION_WEIGHTS,
    ...(weights ?? {}),
  };
  const total = merged.conditionUrgency + merged.historicalGap + merged.costEfficiency;

  if (!Number.isFinite(total) || total <= 0) return DEFAULT_OPTIMIZATION_WEIGHTS;

  return {
    conditionUrgency: merged.conditionUrgency / total,
    historicalGap: merged.historicalGap / total,
    costEfficiency: merged.costEfficiency / total,
  };
}

function getHandledAny(history: HistoricalTreatmentContext | null | undefined, year: string): number {
  const nestedValue = history?.handled?.[year]?.any;
  const flatValue = (history as Record<string, number | null | undefined> | null | undefined)?.[
    `handled_any_${year}`
  ];
  const value = nestedValue ?? flatValue ?? 0;
  return value === 1 ? 1 : 0;
}

function getYearsSinceLastHandled(history: HistoricalTreatmentContext | null | undefined): number | null {
  const explicitYears = history?.prior_history_pre2026?.years_since_last
    ?? history?.years_since_last_handled_pre2026
    ?? null;

  if (explicitYears != null && Number.isFinite(explicitYears)) return Math.max(0, explicitYears);

  const lastYear = history?.prior_history_pre2026?.last_year
    ?? history?.prior_handled_last_year_pre2026
    ?? null;

  if (lastYear != null && Number.isFinite(lastYear)) return Math.max(0, 2026 - lastYear);

  return null;
}

export function computeConditionUrgencyScore(road: OptimizationRoadInput | null | undefined): number {
  if (!road) return 0;

  const nonMantap = normalizePct(road.non_mantap_pct);
  const rusakBerat = normalizePct(road.rusak_berat_pct ?? road.kondisi_rusak_berat_pct);
  const unpaved = normalizePct(road.unpaved_pct);

  return clamp01((nonMantap * 0.45) + (rusakBerat * 0.35) + (unpaved * 0.2));
}

export function computeHistoricalGapScore(
  history: HistoricalTreatmentContext | null | undefined,
): number {
  if (!history) return 0.5;

  const handledAnyCount = HISTORICAL_YEARS.reduce(
    (sum, year) => sum + getHandledAny(history, year),
    0,
  );

  if (handledAnyCount === 0) return 1;

  const yearsSinceLast = getYearsSinceLastHandled(history);
  if (yearsSinceLast == null) return clamp01(1 - (handledAnyCount / HISTORICAL_YEARS.length));

  return clamp01(yearsSinceLast / HISTORICAL_YEARS.length);
}

export function computeCostEfficiencyScore(
  pagu_indikatif_rp: number | null | undefined,
  conditionUrgency: number,
): number {
  if (pagu_indikatif_rp == null || !Number.isFinite(pagu_indikatif_rp) || pagu_indikatif_rp <= 0) {
    return 0;
  }

  const effectiveUrgency = Math.max(MIN_URGENCY_FOR_COST_RATIO, clamp01(conditionUrgency));
  const costPerUrgency = pagu_indikatif_rp / effectiveUrgency;

  return clamp01(1 / (1 + (costPerUrgency / COST_EFFICIENCY_REFERENCE_RP)));
}

export function computeOptimizationScore(
  input: TreatmentOptimizationInput,
): TreatmentOptimizationScore {
  const weights = normalizeWeights(input.weights);
  const conditionUrgency = computeConditionUrgencyScore(input.road);
  const historicalGap = computeHistoricalGapScore(input.history);
  const costEfficiency = computeCostEfficiencyScore(input.pagu_indikatif_rp, conditionUrgency);

  const weightedScore = clamp01(
    (conditionUrgency * weights.conditionUrgency)
      + (historicalGap * weights.historicalGap)
      + (costEfficiency * weights.costEfficiency),
  );
  const manualStatusEffect = input.status === 'force_include'
    ? 'force_include'
    : input.status === 'force_exclude'
      ? 'force_exclude'
      : input.status === 'deferred'
        ? 'deferred'
        : 'normal';

  return {
    road_key: input.road?.road_key ?? input.history?.road_key ?? null,
    condition_urgency_score: conditionUrgency,
    historical_gap_score: historicalGap,
    cost_efficiency_score: costEfficiency,
    weighted_score: weightedScore,
    weights,
    manual_status: input.status ?? null,
    manual_status_effect: manualStatusEffect,
    kecamatan_balance_hint: input.road?.kecamatan_dilalui ?? null,
  };
}

export function buildOptimizationExplanation(
  input: TreatmentOptimizationInput,
): TreatmentOptimizationExplanation {
  const score = computeOptimizationScore(input);

  return {
    summary: `Transparent score ${score.weighted_score.toFixed(3)} using condition urgency, historical gap, and ASB cost efficiency.`,
    factors: [
      `condition_urgency_score=${score.condition_urgency_score.toFixed(3)}`,
      `historical_gap_score=${score.historical_gap_score.toFixed(3)}`,
      `cost_efficiency_score=${score.cost_efficiency_score.toFixed(3)}`,
      `weights=${score.weights.conditionUrgency.toFixed(2)}/${score.weights.historicalGap.toFixed(2)}/${score.weights.costEfficiency.toFixed(2)}`,
      `manual_status=${score.manual_status ?? 'none'}`,
      `kecamatan_balance_hint=${score.kecamatan_balance_hint ?? 'not_available'}`,
    ],
    guardrails: [
      'ASB pagu_indikatif_rp is the budget input.',
      'HPS/AHSP is not used in the score.',
      'ML Priority Score is not used in the score.',
      'Kecamatan is returned as read-only metadata only.',
    ],
  };
}

function getLookupValue<T>(
  lookup: Map<string, T> | Record<string, T | undefined> | null | undefined,
  key: string,
): T | null {
  if (!lookup) return null;
  if (lookup instanceof Map) return lookup.get(key) ?? null;
  return lookup[key] ?? null;
}

function normalizeCandidateList(
  candidates: CandidateBasketItem[] | Record<string, CandidateBasketItem>,
): CandidateBasketItem[] {
  return Array.isArray(candidates) ? [...candidates] : Object.values(candidates);
}

function getCandidateBudget(item: CandidateBasketItem): number {
  const value = item.pagu_indikatif_rp ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildScenarioOptimizationCandidate(
  item: CandidateBasketItem,
  road: OptimizationRoadInput | null,
  history: HistoricalTreatmentContext | null,
  weights?: Partial<OptimizationWeights> | null,
): ScenarioOptimizationCandidate {
  const input: TreatmentOptimizationInput = {
    road,
    history,
    pagu_indikatif_rp: item.pagu_indikatif_rp,
    status: item.status,
    weights,
  };

  return {
    item,
    road,
    history,
    score: computeOptimizationScore(input),
    explanation: buildOptimizationExplanation(input),
  };
}

export function runScenarioOptimizationPreview(
  input: ScenarioOptimizationPreviewInput,
): ScenarioOptimizationPreviewResult {
  const candidates = normalizeCandidateList(input.candidates);
  const budgetCap = input.budgetCapRp != null && Number.isFinite(input.budgetCapRp) && input.budgetCapRp > 0
    ? input.budgetCapRp
    : null;
  const scored = candidates.map((item) => buildScenarioOptimizationCandidate(
    item,
    getLookupValue(input.roadsByKey, item.road_key),
    getLookupValue(input.historyByKey, item.road_key),
    input.weights,
  ));

  const forceExcluded = scored.filter((candidate) => candidate.item.status === 'force_exclude');
  const forceIncluded = scored.filter((candidate) => candidate.item.status === 'force_include');
  const deferredManual = scored.filter((candidate) => candidate.item.status === 'deferred');
  const includedSorted = scored
    .filter((candidate) => candidate.item.status === 'included')
    .sort((a, b) => {
      if (b.score.weighted_score !== a.score.weighted_score) {
        return b.score.weighted_score - a.score.weighted_score;
      }
      return getCandidateBudget(a.item) - getCandidateBudget(b.item);
    });

  const warnings: string[] = [];
  const optimizedSelected = [...forceIncluded];
  const optimizedDeferred: ScenarioOptimizationCandidate[] = [...deferredManual];
  let totalOptimizedBudget = forceIncluded.reduce(
    (sum, candidate) => sum + getCandidateBudget(candidate.item),
    0,
  );

  if (budgetCap != null && totalOptimizedBudget > budgetCap) {
    warnings.push('Force-included roads exceed the budget cap. They remain selected for preview.');
  }

  includedSorted.forEach((candidate) => {
    const cost = getCandidateBudget(candidate.item);
    const fitsBudget = budgetCap == null || totalOptimizedBudget + cost <= budgetCap;

    if (fitsBudget) {
      optimizedSelected.push(candidate);
      totalOptimizedBudget += cost;
    } else {
      optimizedDeferred.push(candidate);
    }
  });

  const explanation = Object.fromEntries(
    scored.map((candidate) => [candidate.item.road_key, candidate.explanation]),
  );

  return {
    optimizedSelected,
    optimizedDeferred,
    forceIncluded,
    forceExcluded,
    totalOptimizedBudget,
    budgetCap,
    warnings,
    explanation,
  };
}
