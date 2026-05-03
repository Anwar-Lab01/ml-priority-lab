const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SRC_DIR = 'F:\\WebApps\\1.ml_apps\\staging-source';
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const wb = xlsx.readFile(filePath);
    console.log(`\n=== FILE: ${file} ===`);
    console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
    
    // Check key sheets to see their columns/row counts
    ['raking_main', 'ranking_main', 'eval_summary', 'topn_summary', 'model_metrics', 'target_capture', 'Target_Hit_Rate', 'reranked_predictions'].forEach(sheetName => {
        if (wb.Sheets[sheetName]) {
            const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
            console.log(`  Sheet: ${sheetName} | Rows: ${rows.length}`);
            if (rows.length > 0) {
                console.log(`         Columns: ${Object.keys(rows[0]).join(', ')}`);
                // Sample row for scenario/model naming
                const r = rows[0];
                if (r.scenario || r.scenario_id) {
                    const uniqueScenarios = [...new Set(rows.map(x => x.scenario || x.scenario_id))].filter(Boolean);
                    console.log(`         Found Scenario IDs: ${uniqueScenarios.join(', ')}`);
                }
                if (r.model || r.best_temporal_model) {
                    const uniqueModels = [...new Set(rows.map(x => x.model || x.best_temporal_model))].filter(Boolean);
                    console.log(`         Found Models: ${uniqueModels.join(', ')}`);
                }
                 if (r.score_type) {
                     const uniqueScoreTypes = [...new Set(rows.map(x => x.score_type))].filter(Boolean);
                     console.log(`         Found Score Types: ${uniqueScoreTypes.join(', ')}`);
                 }
            }
        }
    });

    // Check for shap sheets
    const shapSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('shap') || s.toLowerCase().includes('fi_'));
    if (shapSheets.length > 0) {
        console.log(`  SHAP / Feature Importance Sheets: ${shapSheets.join(', ')}`);
    }
}
