const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SRC_DIR = 'F:\\WebApps\\1.ml_apps\\staging-source';
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const wb = xlsx.readFile(filePath);
    console.log(`\n=== ${file} ===`);
    
    // Find ranking sheets
    const rankingSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('ranking'));
    // Find metric sheets
    const metricSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('eval'));
    // Find capture sheets
    const captureSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('gap') || s.toLowerCase().includes('topk') || s.toLowerCase().includes('target'));

    const checkSheet = (sheetName) => {
        if (!sheetName) return;
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
        if (rows.length > 0) {
            console.log(`  [${sheetName}] Cols: ${Object.keys(rows[0]).join(', ')}`);
            const models = [...new Set(rows.map(x => x.model || x.best_temporal_model))].filter(Boolean);
            if(models.length) console.log(`  [${sheetName}] Models: ${models.join(', ')}`);
        } else {
             console.log(`  [${sheetName}] Empty`);
        }
    };
    
    console.log(`Rankings: ${rankingSheets.join(', ')}`);
    if(rankingSheets.length > 0) checkSheet(rankingSheets.find(s => s.includes('rerank') || s.includes('horizon_2026') || s.includes('ranking_main')) || rankingSheets[0]);
    
    console.log(`Metrics: ${metricSheets.join(', ')}`);
    if(metricSheets.length > 0) checkSheet(metricSheets.find(s => s.includes('horizon') || s.includes('summary')) || metricSheets[0]);

    console.log(`Capture: ${captureSheets.join(', ')}`);
    if(captureSheets.length > 0) checkSheet(captureSheets.find(s => s.includes('topk') || s.includes('policy')) || captureSheets[0]);
}
