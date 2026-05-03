const fs = require('fs');
const xlsx = require('xlsx');

const MASTER_DIR = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario";
const FILES = {
    "historis_original": "master_report_originall.xlsx",
    "historis_tender_only": "master_report_Tender_only.xlsx",
    "historis_weighted_2_1": "master_report_weighted_tender_tw2_pl1_neg1.xlsx",
    "historis_weighted_3_1": "master_report_weighted_tender_tw3_pl1_neg1.xlsx",
    "historis_weighted_5_1": "master_report_weighted_tender_tw5_pl1_neg1.xlsx"
};

let totalRankings = 0;
let totalMetrics = 0;
let totalCapture = 0;
let duplicates = 0;
let missingNames = 0;
const uniqueRoads = new Set();
const scenariosFound = new Set();
const modelsFound = new Set();
const scoreTypesFound = new Set();
const countDict = {};

for (const [scenario_id, filename] of Object.entries(FILES)) {
    console.log(`Processing ${filename}...`);
    const path = `${MASTER_DIR}\\${filename}`;
    if(!fs.existsSync(path)) {
        console.log(`  File missing: ${path}`);
        continue;
    }
    const wb = xlsx.readFile(path);
    scenariosFound.add(scenario_id);

    // rankings
    const rSheet = wb.Sheets['ranking_main'];
    if (rSheet) {
        const rows = xlsx.utils.sheet_to_json(rSheet, {defval: null});
        for (const row of rows) {
            totalRankings++;
            const model = row.model || "Unknown";
            const scoreType = "pred_prob"; // Adjust if explicit in sheet
            const rn = row.nama_ruas_cleaned || row.nama_ruas;
            
            modelsFound.add(model);
            scoreTypesFound.add(scoreType);
            
            if (!rn) missingNames++;
            else uniqueRoads.add(rn.trim().toLowerCase());

            const key = `${scenario_id}|${model}|${scoreType}|${rn}`;
            if (countDict[key]) duplicates++;
            else countDict[key] = 1;
        }
    }

    // metrics
    const mSheet = wb.Sheets['eval_summary'];
    if (mSheet) {
        const rows = xlsx.utils.sheet_to_json(mSheet, {defval: null});
        totalMetrics += rows.length;
    }

    // capture (topn_summary is likely what we need)
    const cSheet = wb.Sheets['topn_summary'] || wb.Sheets['policy_gap_analysis'];
    if (cSheet) {
        const rows = xlsx.utils.sheet_to_json(cSheet, {defval: null});
        totalCapture += rows.length;
    }
}

console.log("\n=== VALIDATION REPORT ===");
console.log(`- total rows (rankings generated internally): ~${totalRankings}`);
console.log(`- total rows (metrics): ~${totalMetrics}`);
console.log(`- total rows (capture): ~${totalCapture}`);
console.log(`- unique roads: ${uniqueRoads.size}`);
console.log(`- scenario_id list: ${Array.from(scenariosFound).join(', ')}`);
console.log(`- model list: ${Array.from(modelsFound).join(', ')}`);
console.log(`- score_type list: ${Array.from(scoreTypesFound).join(', ')}`);
console.log(`- duplicate key check (scenario+model+score_type+road_name): ${duplicates}`);
console.log(`- missing road_name count: ${missingNames}`);

// Targets
const targetRows = JSON.parse(fs.readFileSync('F:\\WebApps\\1.ml_apps\\public\\data\\target_rows.json', 'utf8'));
let tAny=0, tTender=0, tPl=0, tTek26=0, tTek27=0;
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
console.log(`\n- target counts after loader reconciliation:`);
console.log(`  planned_any_2026: ${tAny}`);
console.log(`  planned_tender_2026: ${tTender}`);
console.log(`  planned_pl_2026: ${tPl}`);
console.log(`  planned_teknokratis_2026: ${tTek26}`);
console.log(`  planned_teknokratis_2027: ${tTek27}`);
