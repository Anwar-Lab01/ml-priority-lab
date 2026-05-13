const fs = require('fs');

// Read source data
const csvText = fs.readFileSync('staging-source/dd2-segments/processed/dd2_segments_2025_clean.csv', 'utf8');
const dd2Aggregate = JSON.parse(fs.readFileSync('public/data/dd2_road_features.json', 'utf8'));

// Map for manual override of naming discrepancies found in previous iteration
const MANUAL_ALIASES = {
  'Jl. Mawar (Kandangan Utara)': 'mawar kandangan utara',
  'Jl. Musyawarah (Kandangan)': 'musyawarah kandangan',
  'Jl. Sekolah Islam (Kandangan Barat)': 'sekolah islam kandangan barat',
  'Jl. Musyawarah (Nagara)': 'musyawarah nagara',
  'Jl. Sekolah Islam (Sungai Pinang / Sei Pinang)': 'sekolah islam sei pinang',
  'Jl. Mawar (Daha Selatan)': 'mawar daha selatan'
};

// Build inverse mapping from aggregate for standard fields
const featureMap = new Map();
dd2Aggregate.roads.forEach(r => {
  featureMap.set(r.road_key, r);
});

// Build lookup map from DD2 Aggregate
const aggregateMap = new Map();
dd2Aggregate.roads.forEach(r => {
  if (r.dd2_road_name_raw) {
    aggregateMap.set(r.dd2_road_name_raw.trim().toLowerCase(), r);
  }
});

// Parse CSV manually
const lines = csvText.split(/\r?\n/).filter(line => line.trim());
const headers = lines[0].split(',').map(h => h.trim());

const segments = [];
let missingRoadKeys = new Set();
let uniqueRoads = new Set();

for (let i = 1; i < lines.length; i++) {
  const rowStr = lines[i];
  if (!rowStr.trim()) continue;
  
  let current = '';
  let inQuotes = false;
  const cols = [];
  for (let char of rowStr) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current);

  const row = {};
  headers.forEach((h, idx) => {
    row[h] = cols[idx] ? cols[idx].trim().replace(/^"|"$/g, '') : null;
  });

  const rawName = row['nama_ruas_raw'];
  let aggregateTarget = null;

  // Check Manual Aliases FIRST for safety on duplicates
  if (MANUAL_ALIASES[rawName]) {
    const key = MANUAL_ALIASES[rawName];
    aggregateTarget = featureMap.get(key);
  } else {
    aggregateTarget = aggregateMap.get(rawName.trim().toLowerCase());
  }

  if (!aggregateTarget) {
    missingRoadKeys.add(row['nomor_ruas'] + ' | ' + rawName);
    continue;
  }

  const road_key = aggregateTarget.road_key;
  uniqueRoads.add(road_key);

  segments.push({
    road_key: road_key,
    canonical_road_name: aggregateTarget.canonical_road_name,
    raw_road_name: rawName,
    nomor_ruas: row['nomor_ruas'],
    segment_index: i - 1, 
    sta_start_m: parseFloat(row['sta_start_m']),
    sta_end_m: parseFloat(row['sta_end_m']),
    panjang_m: parseFloat(row['panjang_m']),
    dominant_condition: row['dominant_condition'],
    segment_status: row['segment_status'],
    jenis_penanganan_norm: row['jenis_penanganan_norm'],
    surface_label: row['surface_label'],
    lebar_m: parseFloat(row['lebar_m']),
    tahun_survei: parseInt(row['tahun_survei'], 10)
  });
}

const metadata = {
  source_file: 'dd2_segments_2025_clean.csv',
  generated_at: new Date().toISOString(),
  total_segments: segments.length,
  unique_roads: uniqueRoads.size,
  validation_status: missingRoadKeys.size === 0 ? 'clean' : 'has_missing_keys',
  note: "Segment geometry is projected at runtime from STA proportion along road polyline."
};

const output = {
  metadata: metadata,
  segments: segments
};

fs.writeFileSync('public/data/dd2_damage_segments.json', JSON.stringify(output));

console.log(JSON.stringify({
  total_segments: segments.length,
  unique_roads: uniqueRoads.size,
  missing_keys: missingRoadKeys.size,
  missing_list: Array.from(missingRoadKeys).slice(0, 5)
}, null, 2));
