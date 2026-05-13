const fs = require('fs');

function parseCSVRow(str) {
  const result = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      if (inQuote && str[i+1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function normalizeRoadIdentity(name) {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bjl\.?\s*/g, '')
    .replace(/\bds\.?(?=\s|$)/g, 'desa')
    .replace(/\bsp\.?\s*/g, 'sp ')
    .replace(/\bsei\.?\s*/g, 'sei ')
    .replace(/\//g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRoadKey(name) {
  const aliasMapData = JSON.parse(fs.readFileSync('public/data/road_alias_map.json'));
  const roadAliasMap = new Map(Object.entries(aliasMapData.aliases || {}));
  
  let current = normalizeRoadIdentity(name);
  const visited = new Set();
  while (roadAliasMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = roadAliasMap.get(current);
  }
  return current;
}

const csvText = fs.readFileSync('staging-source/dd2/processed/dd2_roads_2025_clean.csv', 'utf8');
const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
const headers = parseCSVRow(lines[0]);
const namaRuasRawIndex = headers.indexOf('nama_ruas_raw');
const kecamatanIndex = headers.indexOf('kecamatan_dilalui');

const unmatchedData = fs.readFileSync('staging-source/dd2/audit/dd2_unmatched.csv', 'utf8');
const unmatchedLines = unmatchedData.split(/\r?\n/).filter(l => l.trim().length > 0);
const unmatchedHeaders = parseCSVRow(unmatchedLines[0]);
const rowIndexIdx = unmatchedHeaders.indexOf('dd2_row_index');
const rawNameIdx = unmatchedHeaders.indexOf('dd2_road_name_raw');

const proposals = [];

const TARGET_MAPPING = {
  // Kandangan / urban group
  'Jl. Mawar': ['Mawar (Kandangan Utara)', 'Mawar (Daha Selatan)'],
  'Jl. Musyawarah': ['Musyawarah (Kandangan)', 'Musyawarah (Nagara)'],
  'Jl. Sekolah Islam': ['Sekolah Islam (Kandangan Barat)', 'Sekolah Islam (Sungai Pinang)']
};

console.log("Analyzing unmatched rows context...");

for (let i = 1; i < unmatchedLines.length; i++) {
  const uRow = parseCSVRow(unmatchedLines[i]);
  const rowIndex = parseInt(uRow[rowIndexIdx], 10);
  const rawName = uRow[rawNameIdx];
  
  const ctxPrev = [];
  for (let j = Math.max(1, rowIndex - 5); j < rowIndex; j++) {
    const r = parseCSVRow(lines[j]);
    ctxPrev.push(`${r[namaRuasRawIndex]} [${r[kecamatanIndex]}]`);
  }
  
  const ctxNext = [];
  for (let j = rowIndex + 1; j <= Math.min(lines.length - 1, rowIndex + 5); j++) {
    const r = parseCSVRow(lines[j]);
    ctxNext.push(`${r[namaRuasRawIndex]} [${r[kecamatanIndex]}]`);
  }
  
  const targetRow = parseCSVRow(lines[rowIndex]);
  const kec = targetRow[kecamatanIndex];
  
  console.log(`\nRow ${rowIndex}: ${rawName}`);
  console.log(`Location (from CSV): ${kec}`);
  console.log(`Previous 5:`);
  ctxPrev.forEach(c => console.log(`  - ${c}`));
  console.log(`Next 5:`);
  ctxNext.forEach(c => console.log(`  - ${c}`));
  
  let canonical_name = '';
  
  // Logic from prompt:
  // "First urban/Kandangan occurrence group:"
  // "Second Daha/Nagara occurrence group:"
  if (kec.toLowerCase().includes('kandangan') || kec.toLowerCase().includes('urban')) {
    canonical_name = TARGET_MAPPING[rawName][0];
  } else if (kec.toLowerCase().includes('daha') || kec.toLowerCase().includes('nagara')) {
    canonical_name = TARGET_MAPPING[rawName][1];
  } else {
    // Fallback logic by looking at context if kecamatan is missing
    const isKandangan = ctxPrev.concat(ctxNext).some(c => c.toLowerCase().includes('kandangan'));
    if (isKandangan) {
      canonical_name = TARGET_MAPPING[rawName][0];
    } else {
      canonical_name = TARGET_MAPPING[rawName][1];
    }
  }

  const canonical_key = getRoadKey(canonical_name);

  proposals.push({
    dd2_row_index: rowIndex,
    raw_name: rawName,
    canonical_name: canonical_name,
    canonical_key: canonical_key,
    resolution_method: 'occurrence_specific_manual',
    evidence_context: `Found in block with kecamatan=${kec}. Surrounded by: ${ctxPrev.concat(ctxNext).slice(0,2).join(', ')}...`,
    confidence: 'high'
  });
}

fs.writeFileSync('staging-source/dd2/audit/dd2_duplicate_resolution_proposal.json', JSON.stringify(proposals, null, 2));
console.log("\nCreated dd2_duplicate_resolution_proposal.json");
