import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const ROOT = 'F:/WebApps/1.ml_apps';
const DATA_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_DIR = path.join(ROOT, 'outputs', 'thesis_appendix');

const RANKINGS_PATH = path.join(DATA_DIR, 'rankings.json');
const TARGET_ROWS_PATH = path.join(DATA_DIR, 'target_rows.json');
const ALIAS_MAP_PATH = path.join(DATA_DIR, 'road_alias_map.json');

const rankings = readJson(RANKINGS_PATH);
const targetRows = readJson(TARGET_ROWS_PATH);
const aliasConfig = readJson(ALIAS_MAP_PATH);
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

function formatScoreType(scoreType) {
  return scoreType === '' ? '(default/blank)' : scoreType;
}

function formatLabel(ref) {
  return `${ref.scenario_id} / ${ref.model} / ${formatScoreType(String(ref.score_type ?? ''))}`;
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

function availableScenarioIds() {
  return [...new Set(rankings.map((row) => row.scenario_id))].sort();
}

function availableModels() {
  return [...new Set(rankings.map((row) => row.model))].sort();
}

function availableScoreTypes() {
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
    console.warn(`[WARN] Missing ranking rows for ${ref.scenario_id} / ${ref.model}. Available models: ${alternatives.models.join(', ') || '(none)'}`);
    return null;
  }

  const scoreTypes = [...new Set(scoped.map((row) => String(row.score_type ?? '')))].sort();
  console.log(`[INFO] ${ref.scenario_id} / ${ref.model} score_type values: ${scoreTypes.map(formatScoreType).join(', ')}`);

  if (ref.score_type == null) {
    if (scoreTypes.includes('pred_prob')) {
      console.log(`[INFO] Using pred_prob as default for ${ref.scenario_id} / ${ref.model}.`);
      return { ...ref, score_type: 'pred_prob' };
    }
    if (scoreTypes.length === 1) {
      console.log(`[INFO] Using only available score_type ${formatScoreType(scoreTypes[0])} for ${ref.scenario_id} / ${ref.model}.`);
      return { ...ref, score_type: scoreTypes[0] };
    }
    console.warn(`[WARN] Multiple score_type values found for ${ref.scenario_id} / ${ref.model} with no default rule resolved.`);
    return null;
  }

  if (!scoreTypes.includes(ref.score_type)) {
    console.warn(`[WARN] Missing score_type "${ref.score_type}" for ${ref.scenario_id} / ${ref.model}. Available: ${scoreTypes.map(formatScoreType).join(', ')}`);
    return null;
  }

  return { ...ref, score_type: ref.score_type };
}

function buildTargetMetaMap() {
  const map = new Map();
  for (const row of targetRows) {
    const key = getRoadKey(row);
    const existing = map.get(key);
    const merged = {
      road_key: key,
      nama_ruas: row.road_name || existing?.nama_ruas || '',
      nomor_ruas: row.nomor_ruas ?? existing?.nomor_ruas ?? '',
      desa_yang_dilalui: row.desa_yang_dilalui ?? existing?.desa_yang_dilalui ?? '',
      kecamatan_yang_dilalui: row.kecamatan_yang_dilalui ?? existing?.kecamatan_yang_dilalui ?? '',
      planned_any_2026: Number(row.planned_any_2026) === 1 ? 1 : existing?.planned_any_2026 ?? 0,
      planned_teknokratis_2026: Number(row.planned_teknokratis_2026) === 1 ? 1 : existing?.planned_teknokratis_2026 ?? 0,
      planned_tender_2026: Number(row.planned_tender_2026) === 1 ? 1 : existing?.planned_tender_2026 ?? 0,
      planned_pl_2026: Number(row.planned_pl_2026) === 1 ? 1 : existing?.planned_pl_2026 ?? 0,
    };
    map.set(key, merged);
  }
  return map;
}

const targetMetaMap = buildTargetMetaMap();

function sortRankingRows(rows, label) {
  const allHaveRank = rows.every((row) => typeof row.rank === 'number');
  if (allHaveRank) {
    return rows.slice().sort((a, b) => a.rank - b.rank);
  }

  const allHaveScore = rows.every((row) => typeof row.score === 'number');
  if (allHaveScore) {
    console.warn(`[WARN] ${label} has no complete rank column. Falling back to score DESC for export order.`);
    return rows.slice().sort((a, b) => b.score - a.score);
  }

  console.warn(`[WARN] ${label} has neither a complete rank column nor a complete score column. Falling back to existing row order.`);
  return rows.slice();
}

function buildRankingExportRows(appendixName, ref) {
  const scoped = rankings.filter((row) =>
    row.scenario_id === ref.scenario_id &&
    row.model === ref.model &&
    String(row.score_type ?? '') === String(ref.score_type ?? '')
  );

  const sorted = sortRankingRows(scoped, appendixName);
  const duplicateCounts = new Map();
  const rows = sorted.map((row, index) => {
    const roadKey = getRoadKey(row);
    duplicateCounts.set(roadKey, (duplicateCounts.get(roadKey) || 0) + 1);
    const meta = targetMetaMap.get(roadKey) || {};

    return {
      appendix_name: appendixName,
      scenario_id: ref.scenario_id,
      model: ref.model,
      score_type: String(ref.score_type ?? ''),
      rank: row.rank ?? '',
      export_rank: index + 1,
      road_key: roadKey,
      nama_ruas: meta.nama_ruas || row.road_name || '',
      nomor_ruas: meta.nomor_ruas || '',
      desa_yang_dilalui: meta.desa_yang_dilalui || '',
      kecamatan_yang_dilalui: meta.kecamatan_yang_dilalui || '',
      score: row.score ?? '',
      pred_prob: row.pred_prob ?? '',
      final_score: row.final_score ?? '',
      base_prob: row.base_prob ?? '',
      rerank_score: row.rerank_score ?? '',
      planned_any_2026: meta.planned_any_2026 ?? row.planned_any_2026 ?? '',
      planned_teknokratis_2026: meta.planned_teknokratis_2026 ?? row.planned_teknokratis_2026 ?? '',
      planned_tender_2026: meta.planned_tender_2026 ?? row.planned_tender_2026 ?? '',
      planned_pl_2026: meta.planned_pl_2026 ?? row.planned_pl_2026 ?? '',
      is_top35: index + 1 <= 35 ? 1 : 0,
      is_top70: index + 1 <= 70 ? 1 : 0,
      is_top105: index + 1 <= 105 ? 1 : 0,
    };
  });

  const duplicates = [...duplicateCounts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.warn(`[WARN] ${appendixName} contains ${duplicates.length} duplicate road_key values. Sample: ${duplicates.slice(0, 5).map(([key, count]) => `${key} (${count})`).join(', ')}`);
  }

  return rows;
}

function buildTargetExportRows(targetName, field) {
  const deduped = new Map();
  for (const row of targetRows) {
    if (Number(row[field]) !== 1) continue;
    const roadKey = getRoadKey(row);
    if (!deduped.has(roadKey)) {
      deduped.set(roadKey, {
        target_name: targetName,
        road_key: roadKey,
        nama_ruas: row.road_name || '',
        nomor_ruas: row.nomor_ruas ?? '',
        desa_yang_dilalui: row.desa_yang_dilalui ?? '',
        kecamatan_yang_dilalui: row.kecamatan_yang_dilalui ?? '',
        planned_any_2026: row.planned_any_2026 ?? '',
        planned_teknokratis_2026: row.planned_teknokratis_2026 ?? '',
        planned_tender_2026: row.planned_tender_2026 ?? '',
        planned_pl_2026: row.planned_pl_2026 ?? '',
      });
    }
  }

  return [...deduped.values()].sort((a, b) =>
    String(a.nama_ruas).localeCompare(String(b.nama_ruas)) ||
    String(a.road_key).localeCompare(String(b.road_key))
  );
}

function addSheetFromRows(workbook, sheetName, rows, headers) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
}

function buildReadmeRows() {
  return [
    { note: 'These exports are appendix material for thesis auditability.' },
    { note: 'Rankings are exported from existing ranking data and are not recomputed.' },
    { note: 'planned_any_2026 final configurations: Top-35 = DecisionTree + rerank_population_focus; Top-70 = RandomForest + grid_0005; Top-105 = RandomForest + rerank_medium.' },
    { note: 'The exact planned_any_2026 final ranking configurations are stored in refined_recall_max_any2026 from recall_maximizer_any2026_policyboost.xlsx, sheet all_rankings_top160.' },
    { note: 'Because that source is truncated to Top-160 rows, the planned_any appendix ranking exports contain 160 rows each, not the full 350-road universe.' },
    { note: 'A separate 350-row refined_rerank_any2026 source exists, but it only provides score_type = rerank and is not the same as the requested planned_any final configurations, so it is not substituted here.' },
    { note: 'planned_teknokratis_2026 final configurations: Top-35 = XGBoost + rerank; Top-70 = DecisionTree + rerank; Top-105 = DecisionTree + rerank.' },
    { note: 'normatif_17 AHP_WSM is the main normative appendix ranking.' },
    { note: 'normatif_20 AHP_WSM is optional sensitivity if available.' },
    { note: 'Target lists are labels/annotations, not ranking overlap calculations.' },
  ];
}

function writeReadmeText(filePath) {
  const lines = buildReadmeRows().map((row) => row.note);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function logAvailability() {
  console.log('[INFO] Available scenario_id values:');
  console.log(availableScenarioIds().join(', '));
  console.log('[INFO] Available model values:');
  console.log(availableModels().join(', '));
  console.log('[INFO] Available score_type values:');
  console.log(availableScoreTypes().map(formatScoreType).join(', '));
}

function main() {
  logAvailability();
  ensureDir(OUTPUT_DIR);

  const rankingExports = [
    {
      appendixName: 'AHP_WSM_17_full',
      fileName: 'appendix_AHP_WSM_17_full.csv',
      sheetName: 'AHP_WSM_17_full',
      ref: { scenario_id: 'normatif_17', model: 'AHP_WSM', score_type: null },
      optional: false,
    },
    {
      appendixName: 'AHP_WSM_20_full',
      fileName: 'appendix_AHP_WSM_20_full.csv',
      sheetName: 'AHP_WSM_20_full',
      ref: { scenario_id: 'normatif_20', model: 'AHP_WSM', score_type: null },
      optional: true,
    },
    {
      appendixName: 'ANY_Top35_DT_population_full',
      fileName: 'appendix_ANY_Top35_DT_population_full.csv',
      sheetName: 'ANY_T35_DT_pop',
      ref: { scenario_id: 'refined_recall_max_any2026', model: 'DecisionTree', score_type: 'rerank_population_focus' },
      optional: false,
      expectedFullRows: 350,
    },
    {
      appendixName: 'ANY_Top70_RF_grid0005_full',
      fileName: 'appendix_ANY_Top70_RF_grid0005_full.csv',
      sheetName: 'ANY_T70_RF_grid5',
      ref: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'grid_0005' },
      optional: false,
      expectedFullRows: 350,
    },
    {
      appendixName: 'ANY_Top105_RF_medium_full',
      fileName: 'appendix_ANY_Top105_RF_medium_full.csv',
      sheetName: 'ANY_T105_RF_med',
      ref: { scenario_id: 'refined_recall_max_any2026', model: 'RandomForest', score_type: 'rerank_medium' },
      optional: false,
      expectedFullRows: 350,
    },
    {
      appendixName: 'TEK_Top35_XGB_rerank_full',
      fileName: 'appendix_TEK_Top35_XGB_rerank_full.csv',
      sheetName: 'TEK_T35_XGB_rr',
      ref: { scenario_id: 'refined_rerank_teknokratis2026', model: 'XGBoost', score_type: 'rerank' },
      optional: false,
    },
    {
      appendixName: 'TEK_Top70_DT_rerank_full',
      fileName: 'appendix_TEK_Top70_DT_rerank_full.csv',
      sheetName: 'TEK_T70_DT_rr',
      ref: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
      optional: false,
    },
    {
      appendixName: 'TEK_Top105_DT_rerank_full',
      fileName: 'appendix_TEK_Top105_DT_rerank_full.csv',
      sheetName: 'TEK_T105_DT_rr',
      ref: { scenario_id: 'refined_rerank_teknokratis2026', model: 'DecisionTree', score_type: 'rerank' },
      optional: false,
    },
  ];

  const rankingHeaders = [
    'appendix_name',
    'scenario_id',
    'model',
    'score_type',
    'rank',
    'export_rank',
    'road_key',
    'nama_ruas',
    'nomor_ruas',
    'desa_yang_dilalui',
    'kecamatan_yang_dilalui',
    'score',
    'pred_prob',
    'final_score',
    'base_prob',
    'rerank_score',
    'planned_any_2026',
    'planned_teknokratis_2026',
    'planned_tender_2026',
    'planned_pl_2026',
    'is_top35',
    'is_top70',
    'is_top105',
  ];

  const targetHeaders = [
    'target_name',
    'road_key',
    'nama_ruas',
    'nomor_ruas',
    'desa_yang_dilalui',
    'kecamatan_yang_dilalui',
    'planned_any_2026',
    'planned_teknokratis_2026',
    'planned_tender_2026',
    'planned_pl_2026',
  ];

  const workbook = XLSX.utils.book_new();
  addSheetFromRows(workbook, 'README', buildReadmeRows(), ['note']);

  const summaryRows = [];

  for (const exportDef of rankingExports) {
    const resolved = resolveReference(exportDef.ref);
    if (!resolved) {
      if (exportDef.optional) {
        console.log(`[INFO] Skipping optional export ${exportDef.appendixName} because the ranking is unavailable.`);
      }
      continue;
    }

    const rows = buildRankingExportRows(exportDef.appendixName, resolved);
    const filePath = path.join(OUTPUT_DIR, exportDef.fileName);
    writeCsv(filePath, rankingHeaders, rows);
    addSheetFromRows(workbook, exportDef.sheetName, rows, rankingHeaders);
    console.log(`[INFO] Exported ${exportDef.appendixName}: ${rows.length} rows -> ${filePath}`);

    if (exportDef.expectedFullRows && rows.length < exportDef.expectedFullRows) {
      const sourceRows = rankings.filter((row) =>
        row.scenario_id === resolved.scenario_id &&
        row.model === resolved.model &&
        String(row.score_type ?? '') === String(resolved.score_type ?? '')
      );
      const sourceFiles = [...new Set(sourceRows.map((row) => row.source_file).filter(Boolean))];
      const sourceSheets = [...new Set(sourceRows.map((row) => row.source_sheet).filter(Boolean))];
      console.warn(
        `[WARN] ${exportDef.appendixName} exported ${rows.length} rows, not ${exportDef.expectedFullRows}. ` +
        `Stored source is truncated: scenario ${resolved.scenario_id}, source file ${sourceFiles.join(', ') || '(unknown)'}, ` +
        `sheet ${sourceSheets.join(', ') || '(unknown)'}.`
      );
    }

    summaryRows.push({
      export_name: exportDef.appendixName,
      source: formatLabel(resolved),
      row_count: rows.length,
      output_file: exportDef.fileName,
    });
  }

  const targetAnyRows = buildTargetExportRows('TARGET_planned_any_2026', 'planned_any_2026');
  const targetTekRows = buildTargetExportRows('TARGET_planned_teknokratis_2026', 'planned_teknokratis_2026');

  const targetAnyPath = path.join(OUTPUT_DIR, 'appendix_TARGET_planned_any_2026.csv');
  const targetTekPath = path.join(OUTPUT_DIR, 'appendix_TARGET_planned_teknokratis_2026.csv');
  writeCsv(targetAnyPath, targetHeaders, targetAnyRows);
  writeCsv(targetTekPath, targetHeaders, targetTekRows);
  addSheetFromRows(workbook, 'TARGET_any_2026', targetAnyRows, targetHeaders);
  addSheetFromRows(workbook, 'TARGET_tek_2026', targetTekRows, targetHeaders);

  console.log(`[INFO] Exported TARGET_planned_any_2026 from target_rows.json: ${targetAnyRows.length} rows -> ${targetAnyPath}`);
  console.log(`[INFO] Exported TARGET_planned_teknokratis_2026 from target_rows.json: ${targetTekRows.length} rows -> ${targetTekPath}`);

  if (targetAnyRows.length !== 28) {
    console.warn(`[WARN] TARGET_planned_any_2026 expected 28 rows but exported ${targetAnyRows.length}.`);
  }
  if (targetTekRows.length !== 46) {
    console.warn(`[WARN] TARGET_planned_teknokratis_2026 expected 46 rows but exported ${targetTekRows.length}.`);
  }

  summaryRows.push({
    export_name: 'TARGET_planned_any_2026',
    source: 'target_rows.json',
    row_count: targetAnyRows.length,
    output_file: 'appendix_TARGET_planned_any_2026.csv',
  });
  summaryRows.push({
    export_name: 'TARGET_planned_teknokratis_2026',
    source: 'target_rows.json',
    row_count: targetTekRows.length,
    output_file: 'appendix_TARGET_planned_teknokratis_2026.csv',
  });

  const readmePath = path.join(OUTPUT_DIR, 'appendix_README.txt');
  writeReadmeText(readmePath);
  console.log(`[INFO] Wrote README -> ${readmePath}`);

  const workbookPath = path.join(OUTPUT_DIR, 'thesis_appendix_rankings.xlsx');
  XLSX.writeFile(workbook, workbookPath);
  console.log(`[INFO] Wrote Excel workbook -> ${workbookPath}`);

  console.table(summaryRows);
}

main();
