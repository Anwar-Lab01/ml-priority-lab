const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const EXCEL_DIR = "F:\\WebApps\\1.ml_apps\\staging-source";
const STAGING_DIR = "F:\\WebApps\\1.ml_apps\\staging-data";
const ACTIVE_DIR = "F:\\WebApps\\1.ml_apps\\public\\data";

if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
}

// Scenarios Mapping
const MAPPINGS = [
    {
        scenario_id: "refined_base_any2026",
        file: "ml_murni_refined_comprehensive_20260417_201703.xlsx",
        rankingSheet: "ranking_horizon_2026",
        captureSheet: "topk_horizon_2026",
        metricsSheet: "eval_horizon_2026"
    },
    {
        scenario_id: "refined_recall_max_any2026",
        file: "recall_maximizer_any2026_policyboost.xlsx",
        rankingSheet: "all_rankings_top160",
        captureSheet: "best_by_cutoff",
        metricsSheet: "summary_pivot"
    },
    {
        scenario_id: "refined_rerank_any2026",
        file: "report_rerank_refined_planned_any_2026_20260417_211301.xlsx",
        rankingSheet: "ranking_horizon_rerank",
        captureSheet: "topk_horizon_only",
        metricsSheet: "eval_horizon_only"
    },
    {
        scenario_id: "refined_base_teknokratis2026",
        file: "report_planned_teknokratis_2026.xlsx",
        rankingSheet: "ranking_horizon_2026",
        captureSheet: "topk_horizon_2026",
        metricsSheet: "eval_horizon_2026"
    },
    {
        scenario_id: "refined_rerank_teknokratis2026",
        file: "report_rerank_refined_planned_teknokratis_2026_20260422_215256.xlsx",
        rankingSheet: "ranking_horizon_rerank",
        captureSheet: "topk_horizon_only",
        metricsSheet: "eval_horizon_only"
    },
    {
        scenario_id: "refined_rerank_tender2026",
        file: "report_rerank_refined_planned_tender_2026_20260417_212741.xlsx",
        rankingSheet: "ranking_horizon_rerank",
        captureSheet: "topk_horizon_only",
        metricsSheet: "eval_horizon_only"
    }
];

// Helper: Active data exclusion
function isLegacyHistoris(scenario_id) {
    return scenario_id && scenario_id.startsWith('historis_');
}
function isNewRefined(scenario_id) {
    return scenario_id && scenario_id.startsWith('refined_');
}

// 1. Load active data
const activeRankings = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'rankings.json'), 'utf8'));
const activeMetrics = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'model_metrics.json'), 'utf8'));
const activeCapture = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'target_capture.json'), 'utf8'));
const activeScenarios = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'scenarios.json'), 'utf8'));

// Filter out old historis AND existing refined_ (if any) to preserve only normatif
const preservedRankings = activeRankings.filter(r => !isLegacyHistoris(r.scenario_id) && !isNewRefined(r.scenario_id));
const preservedMetrics = activeMetrics.filter(m => !isLegacyHistoris(m.scenario_id) && !isNewRefined(m.scenario_id));
const preservedCapture = activeCapture.filter(c => !isLegacyHistoris(c.scenario_id) && !isNewRefined(c.scenario_id));
const preservedScenarios = activeScenarios.filter(s => !isLegacyHistoris(s.scenario_id) && !isNewRefined(s.scenario_id));


// 2. Data Containers
const newRankings = [];
const newMetrics = [];
const newCapture = [];
const newScenarios = [];

const duplicateCheck = new Set();
let missingRoadNames = 0;

for (const mapping of MAPPINGS) {
    const filePath = path.join(EXCEL_DIR, mapping.file);
    if (!fs.existsSync(filePath)) {
        console.error(`Missing file: ${filePath}`);
        continue;
    }
    
    console.log(`Processing ${mapping.scenario_id} from ${mapping.file}`);
    const wb = xlsx.readFile(filePath);
    
    // Scenarios list
    newScenarios.push({
        scenario_id: mapping.scenario_id,
        scenario_label: mapping.scenario_id.replace(/_/g, ' ').toUpperCase(),
        family: "historis",
        source: mapping.file,
        completeness: mapping.scenario_id.includes('recall_max') ? 'top160 only' : 'full'
    });

    // Rankings
    const rSheet = wb.Sheets[mapping.rankingSheet];
    if (rSheet) {
        let rows = xlsx.utils.sheet_to_json(rSheet, { defval: null });
        for (const row of rows) {
            const model = row.model || row.best_temporal_model || "Unknown";
            const scoreType = row.score_type || "pred_prob";
            const rn = row.nama_ruas_cleaned || row.nama_ruas_norm || row.nama_ruas;
            
            if (!rn) missingRoadNames++;
            
            const key = `${mapping.scenario_id}|${model}|${scoreType}|${rn}`;
            if (!duplicateCheck.has(key)) {
                duplicateCheck.add(key);
                
                newRankings.push({
                    road_id: row.nomor_ruas,
                    road_name: rn,
                    scenario_id: mapping.scenario_id,
                    model: model,
                    score: row.score || row.pred_prob || row.base_prob || 0,
                    rank: row.rank || row.rank_prioritas || 0,
                    wsm_score: null,
                    y_true: row.actual !== undefined ? row.actual : null,
                    pred_top_pct: null,
                    planned_any_2026: row.planned_any_2026 || null,
                    planned_tender_2026: row.planned_tender_2026 || null,
                    planned_pl_2026: row.planned_pl_2026 || null,
                    planned_teknokratis_2026: row.planned_teknokratis_2026 || null,
                    planned_teknokratis_2027: row.planned_teknokratis_2027 || null,
                    captured_any: null,
                    source_file: mapping.file,
                    source_sheet: mapping.rankingSheet,
                    score_type: scoreType
                });
            }
        }
    } else {
        console.warn(`Warning: Missing sheet ${mapping.rankingSheet} in ${mapping.file}`);
    }
    
    // Metrics
    const mSheet = wb.Sheets[mapping.metricsSheet];
    if (mSheet) {
        const rows = xlsx.utils.sheet_to_json(mSheet, { defval: null });
        for (const row of rows) {
            const model = row.model || "Unknown";
            newMetrics.push({
                scenario_id: mapping.scenario_id,
                model: model,
                source_file: mapping.file,
                source_sheet: mapping.metricsSheet,
                mcc: row.mcc || row.best_mcc,
                mean_rank_any: row.mean_rank_any,
                median_rank_any: row.median_rank_any,
                overlap_any_k19: row.overlap_any_k19,
                recall_any_k19: row.recall_any_k19,
                precision_any_k19: row.precision_any_k19,
                overlap_any_k28: row.overlap_any_k28,
                recall_any_k28: row.recall_any_k28,
                precision_any_k28: row.precision_any_k28,
                overlap_any_k35: row.overlap_any_k35,
                recall_any_k35: row.recall_any_k35,
                precision_any_k35: row.precision_any_k35,
                overlap_any_k70: row.overlap_any_k70,
                recall_any_k70: row.recall_any_k70,
                precision_any_k70: row.precision_any_k70,
                overlap_any_k105: row.overlap_any_k105,
                recall_any_k105: row.recall_any_k105,
                precision_any_k105: row.precision_any_k105,
            });
        }
    }
    
    // Capture
    const cSheet = wb.Sheets[mapping.captureSheet];
    if (cSheet) {
        const rows = xlsx.utils.sheet_to_json(cSheet, { defval: null });
        for (const row of rows) {
            newCapture.push({
                scenario_id: mapping.scenario_id,
                best_temporal_model: row.model || "Unknown",
                plan_target: "planned_any_2026",
                K: row.K || row.top_k || row.top_n || 0,
                total_target_rows: row.total_target_rows || row.total_positive || 0,
                overlap_top_k: row.overlap_top_k || row.captured_positive || row.hits || 0,
                recall_at_k: row.recall_at_k || row.recall || 0,
                precision_at_k: row.precision_at_k || row.precision || 0,
                mean_rank_of_all_target_rows: row.mean_rank_of_all_target_rows || 0,
                median_rank_of_all_target_rows: row.median_rank_of_all_target_rows || 0,
                source_file: mapping.file,
                source_sheet: mapping.captureSheet,
            });
        }
    }
}

// 3. Merging logic
const mergedRankings = [...preservedRankings, ...newRankings];
const mergedMetrics = [...preservedMetrics, ...newMetrics];
const mergedCapture = [...preservedCapture, ...newCapture];
const mergedScenarios = [...preservedScenarios, ...newScenarios];

// 4. Write to staging
fs.writeFileSync(path.join(STAGING_DIR, 'merged_rankings.json'), JSON.stringify(mergedRankings, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'merged_model_metrics.json'), JSON.stringify(mergedMetrics, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'merged_target_capture.json'), JSON.stringify(mergedCapture, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'merged_scenarios.json'), JSON.stringify(mergedScenarios, null, 2));


// 5. Validation
console.log("\n=== VALIDATION REPORT (MERGED STAGING) ===");

console.log(`Row Counts:`);
console.log(`- Total merged rows: ${mergedRankings.length}`);
console.log(`- Preserved Normatif rows: ${preservedRankings.length}`);
console.log(`- New Refined rows: ${newRankings.length}`);

const uniqueScenarios = [...new Set(mergedRankings.map(r => r.scenario_id))];
console.log(`\n- Scenario_id list: ${uniqueScenarios.join(', ')}`);

const uniqueModels = [...new Set(mergedRankings.map(r => r.model))];
console.log(`- Model list: ${uniqueModels.join(', ')}`);

const uniqueScoreTypes = [...new Set(mergedRankings.map(r => r.score_type))];
console.log(`- Score_type list: ${uniqueScoreTypes.filter(Boolean).join(', ')}`);

console.log(`- Missing road_name count in newly extracted rows: ${missingRoadNames}`);

// Targets
const targetRows = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'target_rows.json'), 'utf8'));
const truthCounts = {
    planned_any_2026: 0,
    planned_tender_2026: 0,
    planned_pl_2026: 0,
    planned_teknokratis_2026: 0,
    planned_teknokratis_2027: 0
};
const roadTruth = new Map();
for (const r of targetRows) {
    const nm = r.road_name.trim().toLowerCase();
    if (!roadTruth.has(nm)) {
        roadTruth.set(nm, true);
        truthCounts.planned_any_2026 += r.planned_any_2026 ? 1 : 0;
        truthCounts.planned_tender_2026 += r.planned_tender_2026 ? 1 : 0;
        truthCounts.planned_pl_2026 += r.planned_pl_2026 ? 1 : 0;
        truthCounts.planned_teknokratis_2026 += r.planned_teknokratis_2026 ? 1 : 0;
        truthCounts.planned_teknokratis_2027 += r.planned_teknokratis_2027 ? 1 : 0;
    }
}
console.log(`\n- Target truth counts (unchanged):`);
console.log(`  planned_any_2026: ${truthCounts.planned_any_2026}`);
console.log(`  planned_tender_2026: ${truthCounts.planned_tender_2026}`);
console.log(`  planned_pl_2026: ${truthCounts.planned_pl_2026}`);
console.log(`  planned_teknokratis_2026: ${truthCounts.planned_teknokratis_2026}`);
console.log(`  planned_teknokratis_2027: ${truthCounts.planned_teknokratis_2027}`);
