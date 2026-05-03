const fs = require('fs');
const xlsx = require('xlsx');

const SOURCE = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\historis_rank_alignment_report.xlsx";
const OUT_RANKINGS = "F:\\WebApps\\1.ml_apps\\scratch_rankings.json";
const OUT_METRICS = "F:\\WebApps\\1.ml_apps\\scratch_model_metrics.json";
const OUT_CAPTURE = "F:\\WebApps\\1.ml_apps\\scratch_target_capture.json";

function formatScenarioId(s) {
    if (!s) return s;
    const str = String(s).toLowerCase();
    
    // mapping logic from export_targets.cjs
    if (str.includes('original')) return 'historis_original';
    if (str.includes('tender_only') || str === 'tender only') return 'historis_tender_only';
    if (str.includes('2:1') || str.includes('2_1')) return 'historis_weighted_2_1';
    if (str.includes('3:1') || str.includes('3_1')) return 'historis_weighted_3_1';
    if (str.includes('5:1') || str.includes('5_1')) return 'historis_weighted_5_1';
    
    if (!str.startsWith('historis_')) return 'historis_' + str;
    return str;
}

function run() {
    const wb = xlsx.readFile(SOURCE);
    
    // 1. Parse rankings
    const rankingsSheet = wb.Sheets['rankings_report'];
    let rankingsData = [];
    if (rankingsSheet) {
        const raw = xlsx.utils.sheet_to_json(rankingsSheet, { defval: null });
        rankingsData = raw.map(r => ({
            scenario_id: formatScenarioId(r.scenario),
            model: r.model || r.best_temporal_model,
            score_type: r.score_type,
            road_id: r.nomor_ruas,
            road_name: r.nama_ruas,
            score: r.score,
            rank: r.rank,
            source_file: "historis_rank_alignment_report.xlsx",
            source_sheet: "rankings_report"
        }));
    }

    // 2. Parse metrics
    const metricsSheet = wb.Sheets['model_metrics_report'];
    let metricsData = [];
    if (metricsSheet) {
        const raw = xlsx.utils.sheet_to_json(metricsSheet, { defval: null });
        metricsData = raw.map(r => ({
            scenario_id: formatScenarioId(r.scenario),
            model: r.model || r.best_temporal_model,
            mcc: r.mcc,
            mean_rank_any: r.mean_rank_any,
            median_rank_any: r.median_rank_any,
            overlap_any_k19: r.overlap_any_k19,
            recall_any_k19: r.recall_any_k19,
            precision_any_k19: r.precision_any_k19,
            overlap_any_k28: r.overlap_any_k28,
            recall_any_k28: r.recall_any_k28,
            precision_any_k28: r.precision_any_k28,
            overlap_any_k35: r.overlap_any_k35,
            recall_any_k35: r.recall_any_k35,
            precision_any_k35: r.precision_any_k35,
            overlap_any_k70: r.overlap_any_k70,
            recall_any_k70: r.recall_any_k70,
            precision_any_k70: r.precision_any_k70,
            overlap_any_k105: r.overlap_any_k105,
            recall_any_k105: r.recall_any_k105,
            precision_any_k105: r.precision_any_k105,
            source_file: "historis_rank_alignment_report.xlsx",
            source_sheet: "model_metrics_report"
        }));
    }

    // 3. Parse target capture
    const captureSheet = wb.Sheets['target_capture_report'];
    let captureData = [];
    if (captureSheet) {
        const raw = xlsx.utils.sheet_to_json(captureSheet, { defval: null });
        captureData = raw.map(r => ({
            scenario_id: formatScenarioId(r.scenario),
            best_temporal_model: r.model || r.best_temporal_model,
            plan_target: "planned_any_2026",
            K: r.K || 0,
            total_target_rows: r.total_target_rows,
            overlap_top_k: r.overlap_top_k,
            recall_at_k: r.recall_at_k,
            precision_at_k: r.precision_at_k,
            mean_rank_of_all_target_rows: r.mean_rank_of_all_target_rows,
            median_rank_of_all_target_rows: r.median_rank_of_all_target_rows,
            source_file: "historis_rank_alignment_report.xlsx",
            source_sheet: "target_capture_report"
        }));
    }

    // Write to scratch
    fs.writeFileSync(OUT_RANKINGS, JSON.stringify(rankingsData, null, 2));
    fs.writeFileSync(OUT_METRICS, JSON.stringify(metricsData, null, 2));
    fs.writeFileSync(OUT_CAPTURE, JSON.stringify(captureData, null, 2));

    // Validations
    console.log("=== VALIDATION REPORT ===");
    console.log(`Total rows exported:`);
    console.log(`- rankings.json: ${rankingsData.length}`);
    console.log(`- model_metrics.json: ${metricsData.length}`);
    console.log(`- target_capture.json: ${captureData.length}`);
    
    // Unique roads in rankings
    const uniqueRoads = new Set(rankingsData.map(r => r.road_name?.trim()?.toLowerCase()));
    console.log(`Unique roads in rankings: ${uniqueRoads.size}`);
    
    // Missing road names
    const missingRoadNames = rankingsData.filter(r => !r.road_name).length;
    console.log(`Missing road_name count: ${missingRoadNames}`);

    // Scenario lists
    const scenarios = [...new Set(rankingsData.map(r => r.scenario_id))];
    console.log(`Scenario list: ${scenarios.join(', ')}`);

    // Model list
    const models = [...new Set(rankingsData.map(r => r.model))];
    console.log(`Model list: ${models.join(', ')}`);
    
    // Score Types
    const scoreTypes = [...new Set(rankingsData.map(r => r.score_type))];
    console.log(`Score Type list: ${scoreTypes.join(', ')}`);

    // Duplicate Key checks in rankings
    const counts = {};
    let duplicates = 0;
    rankingsData.forEach(r => {
        const key = `${r.scenario_id}|${r.model}|${r.score_type}|${r.road_name}`;
        if (counts[key]) {
            duplicates++;
        } else {
            counts[key] = 1;
        }
    });
    console.log(`Duplicate key check (scenario+model+score_type+road_name): ${duplicates} duplicates found`);
    
    // Target Counts (we load the public/data/target_rows.json to verify)
    const targetRows = JSON.parse(fs.readFileSync('F:\\WebApps\\1.ml_apps\\public\\data\\target_rows.json', 'utf8'));
    let tAny = 0, tTender = 0, tPl = 0, tTek26 = 0, tTek27 = 0;
    const roadTruth = new Map();
    targetRows.forEach(r => {
        const nm = r.road_name.trim().toLowerCase();
        if (!roadTruth.has(nm)) {
            roadTruth.set(nm, true);
            tAny += r.planned_any_2026 ? 1 : 0;
            tTender += r.planned_tender_2026 ? 1 : 0;
            tPl += r.planned_pl_2026 ? 1 : 0;
            tTek26 += r.planned_teknokratis_2026 ? 1 : 0;
            tTek27 += r.planned_teknokratis_2027 ? 1 : 0;
        }
    });
    console.log(`Current Target Counts (unique roads):`);
    console.log(`- planned_any_2026: ${tAny}`);
    console.log(`- planned_tender_2026: ${tTender}`);
    console.log(`- planned_pl_2026: ${tPl}`);
    console.log(`- planned_teknokratis_2026: ${tTek26}`);
    console.log(`- planned_teknokratis_2027: ${tTek27}`);

    console.log("\nScratch files generated successfully.");
}

run();
