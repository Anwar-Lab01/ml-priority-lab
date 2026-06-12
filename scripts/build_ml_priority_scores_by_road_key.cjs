const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const rootDir = path.resolve(__dirname, '..');
const source = 'outputs/thesis_appendix/appendix_ANY_Top105_RF_medium_full.csv';
const sourcePath = path.join(rootDir, source);
const outputPath = path.join(rootDir, 'public/data/ml_priority_scores_by_road_key.json');
const dd2Path = path.join(rootDir, 'public/data/dd2_road_features.json');

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (value === true || value === false) return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return undefined;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`ML priority source not found: ${source}`);
}

const workbook = XLSX.readFile(sourcePath, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
const dd2Data = fs.existsSync(dd2Path) ? JSON.parse(fs.readFileSync(dd2Path, 'utf8')) : null;
const dd2RoadKeys = new Set((dd2Data?.roads ?? []).map((road) => road.road_key).filter(Boolean));

const scores = {};

for (const row of rows) {
  const roadKey = typeof row.road_key === 'string' ? row.road_key.trim() : '';
  if (!roadKey) continue;

  const top35 = parseBoolean(row.is_top35);
  const top70 = parseBoolean(row.is_top70);
  const top105 = parseBoolean(row.is_top105);
  const hit2026 = parseBoolean(row.planned_any_2026);

  scores[roadKey] = {
    road_key: roadKey,
    rank: parseNumber(row.rank ?? row.rank_position ?? row.export_rank),
    score: parseNumber(row.score ?? row.score_final ?? row.final_score),
    model: row.model ? String(row.model) : null,
    top35,
    top70,
    top105,
    hit_2026: hit2026 === undefined ? null : hit2026,
  };
}

const scoreKeys = Object.keys(scores);
const dd2RoadKeyMatches = scoreKeys.filter((roadKey) => dd2RoadKeys.has(roadKey)).length;

const payload = {
  metadata: {
    source,
    source_scenario_id: 'refined_recall_max_any2026',
    scenario: 'planned_any_2026',
    target: 'planned_any_2026',
    model: 'RandomForest',
    score_type: 'rerank_medium',
    model_family: 'RandomForest rerank_medium',
    generated_at: new Date().toISOString(),
    identity: 'road_key',
    total_ml_records: scoreKeys.length,
    dd2_road_key_matches: dd2RoadKeyMatches,
    treatment_engine_total_roads: dd2RoadKeys.size,
  },
  scores,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${scoreKeys.length} ML priority scores to ${path.relative(rootDir, outputPath)}`);
console.log(`DD2 road_key matches: ${dd2RoadKeyMatches}/${dd2RoadKeys.size}`);
