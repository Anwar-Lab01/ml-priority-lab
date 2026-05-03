const xlsx = require('xlsx');

const file = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\master_report_originall.xlsx";
const wb = xlsx.readFile(file);
console.log(`Sheets in master_report_originall.xlsx: ${wb.SheetNames.join(', ')}`);
