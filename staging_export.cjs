const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const EXCEL_DIR = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario";
const STAGING_DIR = "F:\\WebApps\\1.ml_apps\\staging-data";
const ACTIVE_DIR = "F:\\WebApps\\1.ml_apps\\public\\data";

// Mapping definition
const SCENARIO_FILES = {
    "historis_original": "master_report_originall.xlsx",
    "historis_tender_only": "master_report_Tender_only.xlsx",
    "historis_weighted_2_1": "master_report_weighted_tender_tw2_pl1_neg1.xlsx",
    "historis_weighted_3_1": "master_report_weighted_tender_tw3_pl1_neg1.xlsx",
    "historis_weighted_5_1": "master_report_weighted_tender_tw5_pl1_neg1.xlsx"
};

// Ensure STAGING_DIR exists
if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
}

// Data structures
const stagingRankings = [];
const stagingMetrics = [];
const stagingCapture = [];

const stagingValidation = {
    uniqueRoads: new Set(),
    scenarios: new Set(),
    models: new Set(),
    scoreTypes: new Set(),
    duplicates: 0,
    missingRoadNames: 0,
    targetCounts: {
        planned_any_2026: 0,
        planned_tender_2026: 0,
        planned_pl_2026: 0,
        planned_teknokratis_2026: 0,
        planned_teknokratis_2027: 0
    }
};

const duplicateCheck = new Set();

console.log("=== 1. EXTRACTING EXTERNAL EXCEL FILES ===");
for (const [scenario_id, filename] of Object.entries(SCENARIO_FILES)) {
    const p = path.join(EXCEL_DIR, filename);
    if (!fs.existsSync(p)) {
        console.error(`Missing file: ${p}`);
        continue;
    }
    
    console.log(`Processing ${scenario_id} from ${filename}`);
    const wb = xlsx.readFile(p);
    
    // Rankings
    const rSheet = wb.Sheets['ranking_main'];
    if (rSheet) {
        const rows = xlsx.utils.sheet_to_json(rSheet, { defval: null });
        for (const row of rows) {
            const model = row.model || "Unknown";
            const scoreType = row.score_type || "pred_prob";
            const rn = row.nama_ruas_cleaned || row.nama_ruas;
            
            if (!rn) stagingValidation.missingRoadNames++;
            else stagingValidation.uniqueRoads.add(rn.trim().toLowerCase());
            
            stagingValidation.scenarios.add(scenario_id);
            stagingValidation.models.add(model);
            stagingValidation.scoreTypes.add(scoreType);
            
            const key = `${scenario_id}|${model}|${scoreType}|${rn}`;
            if (duplicateCheck.has(key)) stagingValidation.duplicates++;
            else duplicateCheck.add(key);
            
            stagingRankings.push({
                road_id: row.nomor_ruas,
                road_name: rn,
                scenario_id: scenario_id,
                model: model,
                score: row.score || row.pred_prob || 0,
                rank: row.rank || row.rank_prioritas || 0,
                wsm_score: null,
                y_true: null,
                pred_top_pct: null,
                planned_any_2026: null,
                planned_tender_2026: null,
                planned_pl_2026: null,
                planned_teknokratis_2026: null,
                planned_teknokratis_2027: null,
                captured_any: null,
                source_file: filename,
                source_sheet: "ranking_main",
                score_type: scoreType
            });
        }
    }
    
    // Metrics
    const mSheet = wb.Sheets['eval_summary'];
    if (mSheet) {
        const rows = xlsx.utils.sheet_to_json(mSheet, { defval: null });
        for (const row of rows) {
            const model = row.model || "Unknown";
            stagingMetrics.push({
                scenario_id,
                model,
                source_file: filename,
                source_sheet: "eval_summary",
                mcc: row.mcc,
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
    const cSheet = wb.Sheets['topn_summary'] || wb.Sheets['policy_gap_analysis'];
    if (cSheet) {
        const rows = xlsx.utils.sheet_to_json(cSheet, { defval: null });
        for (const row of rows) {
            stagingCapture.push({
                scenario_id,
                best_temporal_model: row.model || "Unknown",
                plan_target: "planned_any_2026",
                K: row.K || row.top_n || row.k || 0,
                total_target_rows: row.total_target_rows || row.target_count || 0,
                overlap_top_k: row.overlap_top_k || row.hits || 0,
                recall_at_k: row.recall_at_k || row.recall || 0,
                precision_at_k: row.precision_at_k || row.precision || 0,
                mean_rank_of_all_target_rows: row.mean_rank_of_all_target_rows || 0,
                median_rank_of_all_target_rows: row.median_rank_of_all_target_rows || 0,
                source_file: filename,
                source_sheet: wb.Sheets['topn_summary'] ? 'topn_summary' : 'policy_gap_analysis',
            });
        }
    }
}

// Update Scenarios
const activeScenarios = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'scenarios.json')));
const stagingScenarios = activeScenarios.map(sc => {
    if (SCENARIO_FILES[sc.scenario_id]) {
        return { ...sc, source: SCENARIO_FILES[sc.scenario_id] };
    }
    return sc;
});

// Write to staging 
fs.writeFileSync(path.join(STAGING_DIR, 'rankings.json'), JSON.stringify(stagingRankings, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'model_metrics.json'), JSON.stringify(stagingMetrics, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'target_capture.json'), JSON.stringify(stagingCapture, null, 2));
fs.writeFileSync(path.join(STAGING_DIR, 'scenarios.json'), JSON.stringify(stagingScenarios, null, 2));

// Active Load
const activeRankings = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'rankings.json'), 'utf8'));
const activeMetrics = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'model_metrics.json'), 'utf8'));
const activeCapture = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'target_capture.json'), 'utf8'));

// Target Checks
const targetRows = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, 'target_rows.json'), 'utf8'));
const roadTruth = new Map();
targetRows.forEach(r => {
    const nm = r.road_name.trim().toLowerCase();
    if (!roadTruth.has(nm)) {
        roadTruth.set(nm, true);
        stagingValidation.targetCounts.planned_any_2026 += r.planned_any_2026 ? 1 : 0;
        stagingValidation.targetCounts.planned_tender_2026 += r.planned_tender_2026 ? 1 : 0;
        stagingValidation.targetCounts.planned_pl_2026 += r.planned_pl_2026 ? 1 : 0;
        stagingValidation.targetCounts.planned_teknokratis_2026 += r.planned_teknokratis_2026 ? 1 : 0;
        stagingValidation.targetCounts.planned_teknokratis_2027 += r.planned_teknokratis_2027 ? 1 : 0;
    }
});


console.log("\n=== 2. STAGING VS ACTIVE COMPARISON ===");

// Helper to check distinct fields
const getDistinct = (arr, field) => [...new Set(arr.filter(a => a[field]).map(a => a[field]))];

const actScen = getDistinct(activeRankings, 'scenario_id');
const stgScen = getDistinct(stagingRankings, 'scenario_id');
const actModels = getDistinct(activeRankings, 'model');
const stgModels = getDistinct(stagingRankings, 'model');
const actScoreT = getDistinct(activeRankings, 'score_type');
const stgScoreT = getDistinct(stagingRankings, 'score_type');

console.log(`\nRow Counts:`);
console.log(`- Rankings: Active (${activeRankings.length}) -> Staging (${stagingRankings.length}) | Diff: ${stagingRankings.length - activeRankings.length}`);
console.log(`- Metrics: Active (${activeMetrics.length}) -> Staging (${stagingMetrics.length}) | Diff: ${stagingMetrics.length - activeMetrics.length}`);
console.log(`- Capture: Active (${activeCapture.length}) -> Staging (${stagingCapture.length}) | Diff: ${stagingCapture.length - activeCapture.length}`);

console.log(`\nScenario list elements:`);
console.log(`- Added: ${stgScen.filter(x => !actScen.includes(x)).join(', ') || 'none'}`);
console.log(`- Removed: ${actScen.filter(x => !stgScen.includes(x) && x.startsWith('historis')).join(', ') || 'none'}`);
// Note: We only check removed for historis_ because normatif wasn't touched in staging build. Wait, our staging ONLY builds historis. So staging is actually missing normatif_20 in rankings!

console.log(`\nModel list elements:`);
console.log(`- Active: ${actModels.join(', ')}`);
console.log(`- Staging: ${stgModels.join(', ')}`);
console.log(`- Added: ${stgModels.filter(x => !actModels.includes(x)).join(', ') || 'none'}`);
console.log(`- Removed: ${actModels.filter(x => !stgModels.includes(x)).join(', ') || 'none'}`);

console.log(`\nScore Types:`);
console.log(`- Active: ${actScoreT.join(', ')}`);
console.log(`- Staging: ${stgScoreT.join(', ')}`);
console.log(`- Added: ${stgScoreT.filter(x => !actScoreT.includes(x)).join(', ') || 'none'}`);
console.log(`- Removed: ${actScoreT.filter(x => !stgScoreT.includes(x)).join(', ') || 'none'}`);


console.log("\n=== 3. STAGING VALIDATION REPORT ===");
console.log(`- total rows (staging): ~${stagingRankings.length}`);
console.log(`- unique roads: ${stagingValidation.uniqueRoads.size}`);
console.log(`- scenario_id list: ${Array.from(stagingValidation.scenarios).join(', ')}`);
console.log(`- model list: ${Array.from(stagingValidation.models).join(', ')}`);
console.log(`- score_type list: ${Array.from(stagingValidation.scoreTypes).join(', ')}`);
console.log(`- duplicate key check (scenario+model+score_type+road_name): ${stagingValidation.duplicates}`);
console.log(`- missing road_name count: ${stagingValidation.missingRoadNames}`);

console.log(`\n- target counts after applying current target_rows truth:`);
console.log(`  planned_any_2026: ${stagingValidation.targetCounts.planned_any_2026}`);
console.log(`  planned_tender_2026: ${stagingValidation.targetCounts.planned_tender_2026}`);
console.log(`  planned_pl_2026: ${stagingValidation.targetCounts.planned_pl_2026}`);
console.log(`  planned_teknokratis_2026: ${stagingValidation.targetCounts.planned_teknokratis_2026}`);
console.log(`  planned_teknokratis_2027: ${stagingValidation.targetCounts.planned_teknokratis_2027}`);

console.log("\nAre Target Hit Compare and loaders expected to work?");
let willWork = stagingRankings.length > 0 && stagingValidation.missingRoadNames === 0 && stagingValidation.duplicates === 0;
// Note: Since we only built staging for 'historis', the final actual build needs to MERGE with the existing 'normatif' rows.
console.log(`Compatibility Note: The staging JSON only contains 'historis' scenarios. To maintain full compatibility (including 'normatif' scenarios), the final export must append these rows to the existing 'normatif' rows rather than overwriting completely.`);
