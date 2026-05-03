import fs from 'fs';
import path from 'path';

const ROOT = 'F:/WebApps/1.ml_apps';
const DATA_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_DIR = path.join(ROOT, 'outputs', 'thesis_overlap_audit');

const rankings = readJson(path.join(DATA_DIR, 'rankings.json'));
const aliasConfig = readJson(path.join(DATA_DIR, 'road_alias_map.json'));
const aliases = new Map(Object.entries(aliasConfig.aliases || {}));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeRoadIdentity(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bjl\.?\s*/g, '')
    .replace(/\bds\.?(?=\s|$)/g, 'desa')
    .replace(/\bsp\.?\s*/g, 'sp ')
    .replace(/\bsei\.?\s*/g, 'sei ')
    .replace(/\//g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyAlias(normalizedKey) {
  let current = normalizedKey;
  const visited = new Set();
  while (aliases.has(current) && !visited.has(current)) {
    visited.add(current);
    current = aliases.get(current);
  }
  return current;
}

function getRoadKey(row) {
  return applyAlias(normalizeRoadIdentity(row.nama_ruas_norm || row.road_name || 'unknown'));
}

function toCsvValue(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filePath, headers, rows) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function makeRefLabel(ref) {
  const scoreType = ref.score_type || '(default)';
  return `${ref.scenario_id} / ${ref.model} / ${scoreType}`;
}

function listAvailableScenarioIds() {
  return [...new Set(rankings.map((row) => row.scenario_id))].sort();
}

function listAvailableModels() {
  return [...new Set(rankings.map((row) => row.model))].sort();
}

function listAvailableScoreTypes() {
  return [...new Set(rankings.map((row) => String(row.score_type ?? '')))].sort();
}

function listAlternatives(scenarioId, model) {
  const scoped = rankings.filter((row) => row.scenario_id === scenarioId);
  const models = [...new Set(scoped.map((row) => row.model))].sort();
  const scoreTypes = model
    ? [...new Set(scoped.filter((row) => row.model === model).map((row) => String(row.score_type ?? '')))].sort()
    : [];
  return { models, scoreTypes };
}

function resolveReference(ref) {
  const scoped = rankings.filter((row) => row.scenario_id === ref.scenario_id && row.model === ref.model);
  if (scoped.length === 0) {
    const alternatives = listAlternatives(ref.scenario_id, ref.model);
    console.warn(`[WARN] Missing ranking rows for ${ref.scenario_id} / ${ref.model}. Available models in scenario: ${alternatives.models.join(', ') || '(none)'}`);
    return null;
  }

  const availableScoreTypes = [...new Set(scoped.map((row) => String(row.score_type ?? '')))].sort();
  const preferredScoreType = ref.score_type ?? null;

  if (preferredScoreType !== null) {
    if (!availableScoreTypes.includes(preferredScoreType)) {
      console.warn(`[WARN] Missing score_type "${preferredScoreType}" for ${ref.scenario_id} / ${ref.model}. Available score_type values: ${availableScoreTypes.map(formatScoreType).join(', ')}`);
      return null;
    }
    return { ...ref, score_type: preferredScoreType };
  }

  console.log(`[INFO] Available score_type values for ${ref.scenario_id} / ${ref.model}: ${availableScoreTypes.map(formatScoreType).join(', ')}`);

  if (availableScoreTypes.includes('pred_prob')) {
    console.log(`[INFO] Using pred_prob as default for ${ref.scenario_id} / ${ref.model}.`);
    return { ...ref, score_type: 'pred_prob' };
  }

  if (availableScoreTypes.length === 1) {
    console.log(`[INFO] Using only available score_type ${formatScoreType(availableScoreTypes[0])} for ${ref.scenario_id} / ${ref.model}.`);
    return { ...ref, score_type: availableScoreTypes[0] };
  }

  console.warn(`[WARN] Multiple score_type values found for ${ref.scenario_id} / ${ref.model}, but no default rule resolved. Available: ${availableScoreTypes.map(formatScoreType).join(', ')}`);
  return null;
}

function formatScoreType(scoreType) {
  return scoreType === '' ? '(default/blank)' : scoreType;
}

function getSortedRows(ref) {
  return rankings
    .filter((row) =>
      row.scenario_id === ref.scenario_id &&
      row.model === ref.model &&
      String(row.score_type ?? '') === String(ref.score_type ?? '')
    )
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

function buildTopKEntries(ref, k) {
  const rows = getSortedRows(ref);
  if (rows.length === 0) {
    return { ok: false, reason: `No rows available for ${makeRefLabel(ref)}` };
  }
  if (rows.length < k) {
    return { ok: false, reason: `Only ${rows.length} rows available for ${makeRefLabel(ref)} at Top-${k}` };
  }

  const slice = rows.slice(0, k);
  const entries = slice.map((row) => ({
    road_key: getRoadKey(row),
    road_name: row.nama_ruas_norm || row.road_name,
    rank: row.rank,
  }));

  return { ok: true, entries };
}

function computeOverlapRecord(comparisonName, refA, refB, k) {
  const resultA = buildTopKEntries(refA, k);
  const resultB = buildTopKEntries(refB, k);

  if (!resultA.ok) {
    console.warn(`[WARN] Skipping ${comparisonName} Top-${k}: ${resultA.reason}`);
    return null;
  }
  if (!resultB.ok) {
    console.warn(`[WARN] Skipping ${comparisonName} Top-${k}: ${resultB.reason}`);
    return null;
  }

  const entriesA = resultA.entries;
  const entriesB = resultB.entries;

  const mapA = new Map(entriesA.map((entry) => [entry.road_key, entry]));
  const mapB = new Map(entriesB.map((entry) => [entry.road_key, entry]));

  const overlap = entriesA.filter((entry) => mapB.has(entry.road_key));
  const aOnly = entriesA.filter((entry) => !mapB.has(entry.road_key));
  const bOnly = entriesB.filter((entry) => !mapA.has(entry.road_key));

  const overlapLong = overlap.map((entry) => ({
    comparison_name: comparisonName,
    K: k,
    category: 'overlap',
    road_key: entry.road_key,
    road_name: entry.road_name,
    rank_A: entry.rank,
    rank_B: mapB.get(entry.road_key)?.rank ?? '',
    A_scenario_id: refA.scenario_id,
    A_model: refA.model,
    A_score_type: refA.score_type,
    B_scenario_id: refB.scenario_id,
    B_model: refB.model,
    B_score_type: refB.score_type,
  }));

  const aOnlyLong = aOnly.map((entry) => ({
    comparison_name: comparisonName,
    K: k,
    category: 'A_only',
    road_key: entry.road_key,
    road_name: entry.road_name,
    rank_A: entry.rank,
    rank_B: '',
    A_scenario_id: refA.scenario_id,
    A_model: refA.model,
    A_score_type: refA.score_type,
    B_scenario_id: refB.scenario_id,
    B_model: refB.model,
    B_score_type: refB.score_type,
  }));

  const bOnlyLong = bOnly.map((entry) => ({
    comparison_name: comparisonName,
    K: k,
    category: 'B_only',
    road_key: entry.road_key,
    road_name: entry.road_name,
    rank_A: '',
    rank_B: entry.rank,
    A_scenario_id: refA.scenario_id,
    A_model: refA.model,
    A_score_type: refA.score_type,
    B_scenario_id: refB.scenario_id,
    B_model: refB.model,
    B_score_type: refB.score_type,
  }));

  return {
    summary: {
      comparison_name: comparisonName,
      K: k,
      reference_A: makeRefLabel(refA),
      comparison_B: makeRefLabel(refB),
      A_scenario_id: refA.scenario_id,
      A_model: refA.model,
      A_score_type: refA.score_type,
      B_scenario_id: refB.scenario_id,
      B_model: refB.model,
      B_score_type: refB.score_type,
      overlap_count: overlap.length,
      overlap_percent: Number(((overlap.length / k) * 100).toFixed(2)),
      A_only_count: k - overlap.length,
      B_only_count: k - overlap.length,
      overlap_road_names: overlap.map((entry) => entry.road_name).join(' | '),
      A_only_road_names: aOnly.map((entry) => entry.road_name).join(' | '),
      B_only_road_names: bOnly.map((entry) => entry.road_name).join(' | '),
      A_ranked_road_names: entriesA.map((entry) => entry.road_name).join(' | '),
      B_ranked_road_names: entriesB.map((entry) => entry.road_name).join(' | '),
    },
    longRows: [...overlapLong, ...aOnlyLong, ...bOnlyLong],
  };
}

const COMPARISON_GROUPS = [
  {
    comparison_name: 'AHP_WSM_17_vs_Historis_Any2026_Final',
    reference_A: { scenario_id: 'normatif_17', model: 'AHP_WSM', score_type: null },
    per_k: {
      35: { scenario_id: 'refined_recall_max_any2026', model: 'DecisionTree', score_type: 'rerank_population_focus' },
      70: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'grid_0005' },
      105: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'rerank_medium' },
    },
  },
  {
    comparison_name: 'AHP_WSM_17_vs_Historis_Teknokratis2026_Final',
    reference_A: { scenario_id: 'normatif_17', model: 'AHP_WSM', score_type: null },
    per_k: {
      35: { scenario_id: 'refined_rerank_teknokratis2026', model: 'XGBoost', score_type: 'rerank' },
      70: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
      105: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
    },
  },
  {
    comparison_name: 'AHP_WSM_20_vs_Historis_Any2026_Final',
    reference_A: { scenario_id: 'normatif_20', model: 'AHP_WSM', score_type: null },
    per_k: {
      35: { scenario_id: 'refined_recall_max_any2026', model: 'DecisionTree', score_type: 'rerank_population_focus' },
      70: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'grid_0005' },
      105: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'rerank_medium' },
    },
  },
  {
    comparison_name: 'AHP_WSM_20_vs_Historis_Teknokratis2026_Final',
    reference_A: { scenario_id: 'normatif_20', model: 'AHP_WSM', score_type: null },
    per_k: {
      35: { scenario_id: 'refined_rerank_teknokratis2026', model: 'XGBoost', score_type: 'rerank' },
      70: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
      105: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
    },
  },
];

function logAvailability() {
  console.log('[INFO] Available scenario_id values:');
  console.log(listAvailableScenarioIds().join(', '));
  console.log('[INFO] Available model values:');
  console.log(listAvailableModels().join(', '));
  console.log('[INFO] Available score_type values:');
  console.log(listAvailableScoreTypes().map(formatScoreType).join(', '));

  for (const [scenarioId, model] of [
    ['normatif_17', 'AHP_WSM'],
    ['normatif_20', 'AHP_WSM'],
    ['refined_recall_max_any2026', 'DecisionTree'],
    ['refined_recall_max_any2026', 'RandomForest'],
    ['refined_rerank_teknokratis2026', 'XGBoost'],
    ['refined_rerank_teknokratis2026', 'DecisionTree'],
  ]) {
    const alternatives = listAlternatives(scenarioId, model);
    console.log(`[INFO] ${scenarioId} / ${model} score_type values: ${alternatives.scoreTypes.map(formatScoreType).join(', ') || '(none)'}`);
  }
}

function main() {
  logAvailability();
  ensureDir(OUTPUT_DIR);

  const summaryRows = [];
  const longRows = [];

  for (const group of COMPARISON_GROUPS) {
    const resolvedA = resolveReference(group.reference_A);
    if (!resolvedA) {
      if (group.reference_A.scenario_id === 'normatif_20') {
        console.log('[INFO] Skipping optional normatif_20 sensitivity group because the reference ranking is unavailable.');
      }
      continue;
    }

    for (const k of [35, 70, 105]) {
      const resolvedB = resolveReference(group.per_k[k]);
      if (!resolvedB) {
        continue;
      }

      const record = computeOverlapRecord(group.comparison_name, resolvedA, resolvedB, k);
      if (!record) continue;

      summaryRows.push(record.summary);
      longRows.push(...record.longRows);
    }
  }

  const summaryPath = path.join(OUTPUT_DIR, 'thesis_overlap_summary.csv');
  const longPath = path.join(OUTPUT_DIR, 'thesis_overlap_long_roads.csv');

  writeCsv(summaryPath, [
    'comparison_name',
    'K',
    'reference_A',
    'comparison_B',
    'A_scenario_id',
    'A_model',
    'A_score_type',
    'B_scenario_id',
    'B_model',
    'B_score_type',
    'overlap_count',
    'overlap_percent',
    'A_only_count',
    'B_only_count',
    'overlap_road_names',
    'A_only_road_names',
    'B_only_road_names',
    'A_ranked_road_names',
    'B_ranked_road_names',
  ], summaryRows);

  writeCsv(longPath, [
    'comparison_name',
    'K',
    'category',
    'road_key',
    'road_name',
    'rank_A',
    'rank_B',
    'A_scenario_id',
    'A_model',
    'A_score_type',
    'B_scenario_id',
    'B_model',
    'B_score_type',
  ], longRows);

  console.table(summaryRows.map((row) => ({
    comparison_name: row.comparison_name,
    K: row.K,
    reference_A: row.reference_A,
    comparison_B: row.comparison_B,
    overlap_count: row.overlap_count,
    overlap_percent: row.overlap_percent,
  })));

  console.log(`[INFO] Wrote ${summaryRows.length} summary rows to ${summaryPath}`);
  console.log(`[INFO] Wrote ${longRows.length} long-format rows to ${longPath}`);
}

main();
