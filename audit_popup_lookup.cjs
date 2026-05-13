const fs = require('fs');

function preprocessMapExplorerRoadName(name) {
  return name
    .replace(/\b(?:jalan|jln?|jl)\.?\s*/gi, '')
    .replace(/\bds\.?(?=\s|$|[-/()])/gi, 'desa ')
    .replace(/\bsimp(?:ang)?\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*0*4\b/gi, 'sp 4')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoadIdentity(name) {
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

const roadAliasMap = new Map(); // Empty based on the user's config currently, assuming road_alias_map.json handles it? Let's check `road_alias_map.json`

function applyRoadAlias(normalizedKey) {
  let current = normalizedKey;
  const visited = new Set();
  while (roadAliasMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = roadAliasMap.get(current);
  }
  return current;
}

function getRoadKey(name) {
  if (!name) return 'unknown';
  return applyRoadAlias(normalizeRoadIdentity(name));
}

function getMapExplorerRoadKey(name) {
  if (!name) return 'unknown';
  return getRoadKey(preprocessMapExplorerRoadName(name));
}

// Load Alias Maps
const MAP_EXPLORER_ROAD_ALIASES = {
  'Jl. Mondar (Ulin - Pantai Ulin)': { target: 'Mondar (Ulin-Pantai Ulin) - Ds. Ulin', method: 'alias' },
  'Jl. Muning Tengah - Muning Dalam': { target: 'Muning Tengah - Ds. Muning Dalam', method: 'alias' },
  'Jl. Pangeran Antasari - SP. Loklua': { target: 'Pangeran Antasari - Loklua', method: 'alias' },
  'Sp.4 Lungau - Garis': { target: 'Sp. Empat Lungau - Garis', method: 'alias' },
  'SP.4 Lungau - Bangkau': { target: 'Sp. Empat Lungau - Bangkau', method: 'alias' },
  'Jl. Hamayung - Ds. Hakurung Dalam': { target: 'Hamayung - Hakurung Dalam', method: 'alias' },
  'Jl. Makam Habib Ds. Lumpangi': { target: 'Makam Habib - Desa Lumpangi', method: 'alias' },
  'Jl. Karya Bakti TNI - Ds. Balimau': { target: 'Karya Bakti - Ds. Balimau', method: 'alias' },
  'Jl.Panggang Hijau - DsTawar': { target: 'Panggang Hijau - Ds. Tawar', method: 'alias' },
  'Tembok Kacil - Sei Kudung': { target: 'Tembok Kacil Sei Kudung', method: 'alias' },
  'Wasah Hulu - Tamiyang - Ds. Tamiyang': { target: 'Wasah Hulu - Tamiyang - Ds. Tamiyang', method: 'alias' }, // Self alias, doesn't matter
  'Tamiyang - Ds. Tamiyang (Eks TMMD)': { target: 'Wasah Hulu - Tamiyang - Ds. Tamiyang', method: 'manual_alias' },
  'Bangga TMMD': { target: 'Ds. Bangga - Jambu Hilir', method: 'manual_alias' },
  'Desa Lumpangi - Datar Belimbing (Eks TMMD)': { target: 'Desa Lumpangi - Datar Belimbing', method: 'manual_alias' },
  'Pihandam - Karasikan (Eks TMMD)': { target: 'Pihandam - Karasikan', method: 'manual_alias' },
  'H. Jarkasi - Desa Sei. Paring': { target: 'H Jarkasi - Desa Sei Paring', method: 'manual_alias' },
  'Harapan SDN Habirau II': { target: 'Harapan SDN Habirau II Sei Palangan', method: 'manual_alias' },
  'Biti - Sei Kupang (Karya Bakti TNI)': { target: 'Biti - Sei Kupang Karya Bakti TNI', method: 'manual_alias' },
  'Habib Ibrahim - Desa Sei. Mandala': { target: 'Habib Ibrahim - Desa Sei Mandala', method: 'manual_alias' },
  'Jl. Manggis': { target: 'Manggis - Ds. Baru', method: 'manual_alias' },
  'Jl. Firdaus': { target: 'Firdaus - Ds. Kapuh', method: 'manual_alias' }
};

function getMapExplorerAliasCandidate(name) {
  if (!name) return null;
  const sourceKey = getMapExplorerRoadKey(name);
  for (const [sourceName, aliasEntry] of Object.entries(MAP_EXPLORER_ROAD_ALIASES)) {
    if (getMapExplorerRoadKey(sourceName) === sourceKey) {
      return { key: getMapExplorerRoadKey(aliasEntry.target), method: aliasEntry.method };
    }
  }
  return null;
}

const MAP_EXPLORER_ROAD_REF_ALIASES = [
  { ref: 'ruas_035', roadName: 'Jl. Mawar', target: 'Mawar (Kandangan Utara)', method: 'manual_ref_alias' },
  { ref: 'ruas_038', roadName: 'Jl. Musyawarah', target: 'Musyawarah (Kandangan)', method: 'manual_ref_alias' },
  { ref: 'ruas_083', roadName: 'Jl. Sekolah Islam', target: 'Sekolah Islam (Kandangan Barat)', method: 'manual_ref_alias' },
  { ref: 'ruas_129', roadName: 'Jl. Mawar', target: 'Mawar (Daha Selatan)', method: 'manual_ref_alias' },
  { ref: 'ruas_139', roadName: 'Jl. Sekolah Islam', target: 'Sekolah Islam (Sungai Pinang)', method: 'manual_ref_alias' },
  { ref: 'ruas_196', roadName: 'Jl. Musyawarah', target: 'Musyawarah (Nagara)', method: 'manual_ref_alias' }
];

function getMapExplorerRefAliasCandidate(ref, roadName) {
  if (!ref || !roadName) return null;
  const entry = MAP_EXPLORER_ROAD_REF_ALIASES.find(c => c.ref === ref && c.roadName === roadName);
  if (!entry) return null;
  return { key: getMapExplorerRoadKey(entry.target), method: entry.method };
}

// Main logic
const dd2Data = require('./public/data/dd2_road_features.json');
const geos = require('./public/data/maps/road-geometries.json');

// Build dd2Map exactly as in TreatmentEnginePage
const dd2Map = new Map();
for (const r of dd2Data.roads) {
  const k = r.road_key;
  const bucket = dd2Map.get(k) || [];
  bucket.push(r);
  dd2Map.set(k, bucket);

  const mapKey = getMapExplorerRoadKey(r.canonical_road_name);
  if (mapKey && mapKey !== k) {
    const altBucket = dd2Map.get(mapKey) || [];
    altBucket.push(r);
    dd2Map.set(mapKey, altBucket);
  }
}

let collisions = 0;
for (const [k, v] of dd2Map) {
  if (v.length > 1) {
    collisions++;
  }
}

const resolve = (key) => {
  if (!key) return null;
  const bucket = dd2Map.get(key) || [];
  return bucket.length === 1 ? bucket[0] : null;
};

const auditResults = [];
let foundCount = 0;
let missingCount = 0;

for (const geo of geos) {
  const directKey = getMapExplorerRoadKey(geo.road_name);
  const refAliasCandidate = getMapExplorerRefAliasCandidate(geo.legacy_ref, geo.road_name);
  const aliasCandidate = getMapExplorerAliasCandidate(geo.road_name);
  const matchedNameKey = geo.matched_name ? getMapExplorerRoadKey(geo.matched_name) : null;

  let feature = resolve(directKey);
  let method = 'direct';
  let resolvedKey = directKey;

  if (!feature && refAliasCandidate && refAliasCandidate.key) {
    feature = resolve(refAliasCandidate.key);
    method = refAliasCandidate.method;
    resolvedKey = refAliasCandidate.key;
  }

  if (!feature && aliasCandidate && aliasCandidate.key) {
    feature = resolve(aliasCandidate.key);
    method = aliasCandidate.method;
    resolvedKey = aliasCandidate.key;
  }

  if (!feature && matchedNameKey) {
    feature = resolve(matchedNameKey);
    method = 'matched_name';
    resolvedKey = matchedNameKey;
  }

  if (!feature) {
    method = 'unmatched';
    resolvedKey = directKey; // Default to direct key for missing
  }

  if (feature) {
    foundCount++;
  } else {
    missingCount++;
  }

  auditResults.push({
    geometry_road_name: geo.road_name,
    geometry_legacy_ref: geo.legacy_ref,
    resolved_key: resolvedKey,
    dd2_feature_found: !!feature,
    lookup_method: method,
    matched_dd2_name: feature ? feature.canonical_road_name : null,
    reason_if_missing: feature ? null : 'No DD2 feature data matched'
  });
}

// Write outputs
fs.writeFileSync('popup_lookup_audit.csv', 'geometry_road_name,geometry_legacy_ref,resolved_key,dd2_feature_found,lookup_method,matched_dd2_name,reason_if_missing\n' + auditResults.map(r => `"${r.geometry_road_name}","${r.geometry_legacy_ref}","${r.resolved_key}",${r.dd2_feature_found},"${r.lookup_method}","${r.matched_dd2_name || ''}","${r.reason_if_missing || ''}"`).join('\n'));

fs.writeFileSync('popup_lookup_summary.json', JSON.stringify({
  total_geometries: geos.length,
  popup_dd2_found_count: foundCount,
  popup_dd2_missing_count: missingCount,
  collision_count: collisions,
  missing_roads: auditResults.filter(r => !r.dd2_feature_found)
}, null, 2));

console.log('Audit complete.');
console.log('Total geometries:', geos.length);
console.log('FOUND:', foundCount);
console.log('MISSING:', missingCount);
