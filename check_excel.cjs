const xlsx = require('xlsx');

const file = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\historis_rank_alignment_report.xlsx";
console.log(`Loading ${file}`);
const workbook = xlsx.readFile(file);
console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);

for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: null });
    if (json.length === 0) continue;
    const cols = Object.keys(json[0]);
    console.log(`\nSheet: ${sheetName}`);
    console.log(`Total Rows: ${json.length}`);
    console.log(`Columns: ${cols.join(', ')}`);
    console.log(`Sample Row: ${JSON.stringify(json[0])}`);
}
