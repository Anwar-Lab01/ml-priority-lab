import * as xlsx from 'xlsx';

const files = [
    "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\historis_rank_alignment_report.xlsx",
    "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Arsip\\Pendukung\\historis_rank_alignment_report.xlsx"
];

for (const file of files) {
    console.log(`\n--- Checking ${file} ---`);
    try {
        const workbook = xlsx.readFile(file);
        console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);
        
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const json = xlsx.utils.sheet_to_json(worksheet, { defval: null });
            
            if (json.length === 0) continue;
            
            const cols = Object.keys(json[0]).filter(c => 
                c.toLowerCase().includes('planned') || 
                c.toLowerCase().includes('2026') || 
                c.toLowerCase().includes('target')
            );
            console.log(`  Sheet '${sheetName}' relevant columns: ${cols.join(', ')}`);
            console.log(`  Sheet '${sheetName}' - Total Rows: ${json.length}`);
            
            let planned_any = 0;
            let planned_tender = 0;
            let planned_pl = 0;
            
            for (const row of json) {
                if (row['planned_any_2026'] === 1 || row['planned_any_2026'] === '1' || row['planned_any_2026'] === true || String(row['planned_any_2026']).toLowerCase() === 'true') {
                    planned_any++;
                }
                if (row['planned_tender_2026'] === 1 || row['planned_tender_2026'] === '1' || row['planned_tender_2026'] === true || String(row['planned_tender_2026']).toLowerCase() === 'true') {
                    planned_tender++;
                }
                if (row['planned_pl_2026'] === 1 || row['planned_pl_2026'] === '1' || row['planned_pl_2026'] === true || String(row['planned_pl_2026']).toLowerCase() === 'true') {
                    planned_pl++;
                }
            }
            
            if (cols.includes('planned_any_2026')) console.log(`    planned_any_2026 positives: ${planned_any}`);
            if (cols.includes('planned_tender_2026')) console.log(`    planned_tender_2026 positives: ${planned_tender}`);
            if (cols.includes('planned_pl_2026')) console.log(`    planned_pl_2026 positives: ${planned_pl}`);
        }
    } catch (e) {
        console.error(`Error reading file:`, e.message);
    }
}
