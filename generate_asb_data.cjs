const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const RAW_FILE = 'staging-source/asb/raw/ASB BM 2027.xlsx';
const SHEET_NAME = 'ASB (Fisik) BM';
const OUT_CSV = 'staging-source/asb/processed/asb_unit_prices_2027.csv';
const OUT_JSON = 'public/data/asb_unit_prices.json';

// Ensure directories exist
fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

console.log(`Reading ${RAW_FILE}...`);
const workbook = xlsx.readFile(RAW_FILE);
const sheet = workbook.Sheets[SHEET_NAME];

if (!sheet) {
  console.error(`Sheet "${SHEET_NAME}" not found! Available sheets: ${workbook.SheetNames.join(', ')}`);
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

if (rows.length < 4) {
  console.error('Not enough rows in the sheet.');
  process.exit(1);
}

// Map the items
const items = [];
let asbCounter = 1;

for (let i = 3; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const kelompokBarang = row[1]?.toString().trim() || '';
  const kodeBarang = row[2]?.toString().trim() || '';
  const uraian = row[3]?.toString().trim() || '';
  const spesifikasi = row[4]?.toString().trim() || '';
  const satuan = row[5]?.toString().trim() || '';
  let hargaRp = row[6];
  const kelompokBelanja = row[7]?.toString().trim() || '';

  // Clean and parse Harga
  if (typeof hargaRp === 'string') {
     hargaRp = parseFloat(hargaRp.replace(/[^\d.-]/g, ''));
  } else if (typeof hargaRp === 'number') {
     // good
  } else {
     hargaRp = null;
  }

  // Skip rows that don't have enough data (e.g. empty rows or section headers without codes/prices)
  if (!kodeBarang && !uraian && !hargaRp) continue;
  if (!hargaRp && !kodeBarang) continue; // Must have some identifying info

  // Derive fields cautiously
  let treatmentFamily = null;
  let surfaceType = null;
  let widthM = null;
  let layerThicknessCm = null;

  const uraianLower = uraian.toLowerCase();
  
  if (uraianLower.includes('peningkatan') && uraianLower.includes('jalan')) {
      treatmentFamily = 'peningkatan_permukaan';
  } else if (uraianLower.includes('rehabilitasi') || uraianLower.includes('rekon')) {
      treatmentFamily = 'rehabilitasi_rekonstruksi';
  } else if (uraianLower.includes('berkala')) {
      treatmentFamily = 'pemeliharaan_berkala';
  } else if (uraianLower.includes('rutin')) {
      treatmentFamily = 'pemeliharaan_rutin';
  }

  if (spesifikasi) {
      if (spesifikasi.includes('HRS-Base') || spesifikasi.includes('HRS Base')) surfaceType = 'HRS-Base';
      else if (spesifikasi.includes('HRS-WC') || spesifikasi.includes('HRS WC')) surfaceType = 'HRS-WC';
      else if (spesifikasi.includes('AC-WC') || spesifikasi.includes('AC WC')) surfaceType = 'AC-WC';
      else if (spesifikasi.includes('AC-BC') || spesifikasi.includes('AC BC')) surfaceType = 'AC-BC';
      else if (spesifikasi.toLowerCase().includes('rigid') || spesifikasi.toLowerCase().includes('beton')) surfaceType = 'Rigid';
      else if (spesifikasi.toLowerCase().includes('lapen')) surfaceType = 'Lapen';
      else if (spesifikasi.toLowerCase().includes('latasir')) surfaceType = 'Latasir';
      
      const widthMatch = spesifikasi.match(/Lebar\s*=\s*([\d,.]+)\s*m/i);
      if (widthMatch) {
          widthM = parseFloat(widthMatch[1].replace(',', '.'));
      }
      
      const thicknessMatch = spesifikasi.match(/(?:(?:HRS(?:-Base|-WC)?|AC(?:-BC|-WC)?|Tebal|t)\s*=\s*|\s)([\d,.]+)\s*cm/i);
      if (thicknessMatch) {
          layerThicknessCm = parseFloat(thicknessMatch[1].replace(',', '.'));
      }
  }

  items.push({
    asb_id: `asb_${asbCounter.toString().padStart(4, '0')}`,
    no: row[0] || asbCounter,
    kelompok_barang: kelompokBarang,
    kode_barang: kodeBarang,
    uraian: uraian,
    spesifikasi: spesifikasi,
    satuan: satuan,
    harga_rp: (hargaRp === null || isNaN(hargaRp)) ? null : hargaRp,
    kelompok_belanja: kelompokBelanja,
    treatment_family: treatmentFamily,
    surface_type: surfaceType,
    width_m: widthM,
    layer_thickness_cm: layerThicknessCm
  });
  
  asbCounter++;
}

// Generate CSV
const csvHeader = ["asb_id", "no", "kelompok_barang", "kode_barang", "uraian", "spesifikasi", "satuan", "harga_rp", "kelompok_belanja", "treatment_family", "surface_type", "width_m", "layer_thickness_cm"].join('|');
const csvRows = items.map(it => [
  it.asb_id,
  it.no,
  `"${(it.kelompok_barang||'').replace(/"/g, '""')}"`,
  `"${(it.kode_barang||'').replace(/"/g, '""')}"`,
  `"${(it.uraian||'').replace(/"/g, '""')}"`,
  `"${(it.spesifikasi||'').replace(/"/g, '""')}"`,
  `"${(it.satuan||'').replace(/"/g, '""')}"`,
  it.harga_rp !== null ? it.harga_rp : '',
  `"${(it.kelompok_belanja||'').replace(/"/g, '""')}"`,
  it.treatment_family || '',
  it.surface_type || '',
  it.width_m !== null ? it.width_m : '',
  it.layer_thickness_cm !== null ? it.layer_thickness_cm : ''
].join('|'));

fs.writeFileSync(OUT_CSV, [csvHeader, ...csvRows].join('\n'));
console.log(`Generated CSV at ${OUT_CSV} with ${items.length} records.`);

// Generate JSON
const outputJson = {
  metadata: {
    source_file: path.basename(RAW_FILE),
    sheet: SHEET_NAME,
    year: 2027,
    currency: "IDR",
    unit_price_basis: "asb_item",
    status: "official_asb_reference",
    generated_at: new Date().toISOString(),
    total_items: items.length
  },
  items: items
};

fs.writeFileSync(OUT_JSON, JSON.stringify(outputJson, null, 2));
console.log(`Generated JSON at ${OUT_JSON}`);

console.log('\\nSample 5 rows:');
console.log(JSON.stringify(items.slice(0, 5), null, 2));
