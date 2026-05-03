const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const file = 'F:\\WebApps\\1.ml_apps\\staging-source\\recall_maximizer_any2026_policyboost.xlsx';
const wb = xlsx.readFile(file);
console.log(`\n=== FILE: recall_maximizer_any2026_policyboost.xlsx ===`);
console.log(`Sheets: ${wb.SheetNames.join(', ')}`);

const targetSheets = ["all_rankings_top160", "summary_pivot", "best_by_cutoff", "missed_main_targets", "weight_formulas", "ranking_horizon_2026", "eval_horizon_2026", "topk_horizon_2026"];

for (const sheetName of targetSheets) {
    if (wb.Sheets[sheetName]) {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
         console.log(`\n  Sheet: ${sheetName} | Rows: ${rows.length}`);
         if (rows.length > 0) {
             console.log(`         Columns: ${Object.keys(rows[0]).join(', ')}`);
             const r = rows[0];
             const modelField = Object.keys(r).find(k => k.toLowerCase().includes('model'));
             if (modelField) {
                  const uniqueModels = [...new Set(rows.map(x => x[modelField]))].filter(Boolean);
                  console.log(`         Found Models (in ${modelField}): ${uniqueModels.join(', ')}`);
             }
         }
    }
}
