const xlsx = require('xlsx');

const file = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\historis_rank_alignment_report.xlsx";

const workbook = xlsx.readFile(file);
console.log("------- plan_flags first row -------");
const planFlags = xlsx.utils.sheet_to_json(workbook.Sheets['plan_flags'], { defval: null });
console.log(planFlags[0]);
console.log("Total unique roads in plan_flags:", new Set(planFlags.map(r => r.road_name || r.road_id)).size);

console.log("\n------- target_rows_ranked first row -------");
const targetRows = xlsx.utils.sheet_to_json(workbook.Sheets['target_rows_ranked'], { defval: null });
console.log(targetRows[0]);
console.log("Total unique roads in target_rows_ranked:", new Set(targetRows.map(r => r.road_name || r.road_id)).size);

console.log("\n------- data first row -------");
if (workbook.Sheets['data']) {
    const dataRows = xlsx.utils.sheet_to_json(workbook.Sheets['data'], { defval: null });
    console.log(dataRows[0]);
}

