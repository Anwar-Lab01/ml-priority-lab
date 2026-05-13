const fs = require('fs');

function preprocessMapExplorerRoadName(name) {
  return name.replace(/\b(?:jalan|jln?|jl)\.?\s*/gi, '').replace(/\bds\.?(?=\s|$|[-/()])/gi, 'desa ').replace(/\bsimp(?:ang)?\.?\s*empat\b/gi, 'sp 4').replace(/\bsp\.?\s*empat\b/gi, 'sp 4').replace(/\bsp\.?\s*0*4\b/gi, 'sp 4').replace(/\s*-\s*/g, ' - ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeRoadIdentity(name) {
  return name.trim().toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\bjl\.?\s*/g, '').replace(/\bds\.?(?=\s|$)/g, 'desa').replace(/\bsp\.?\s*/g, 'sp ').replace(/\bsei\.?\s*/g, 'sei ').replace(/\//g, ' ').replace(/[()]/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const roadAliasMap = new Map();
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

// FULL ALIAS MAP from mapExplorerRoadAliases.ts
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
  'Wasah Hulu - Tamiyang - Ds. Tamiyang': { target: 'Wasah Hulu - Tamiyang - Ds. Tamiyang', method: 'alias' },
  'Tamiyang - Ds. Tamiyang (Eks TMMD)': { target: 'Wasah Hulu - Tamiyang - Ds. Tamiyang', method: 'manual_alias' },
  'Bangga TMMD': { target: 'Ds. Bangga - Jambu Hilir', method: 'manual_alias' },
  'Desa Lumpangi - Datar Belimbing (Eks TMMD)': { target: 'Desa Lumpangi - Datar Belimbing', method: 'manual_alias' },
  'Pihandam - Karasikan (Eks TMMD)': { target: 'Pihandam - Karasikan', method: 'manual_alias' },
  'H. Jarkasi - Desa Sei. Paring': { target: 'H Jarkasi - Desa Sei Paring', method: 'manual_alias' },
  'Harapan SDN Habirau II': { target: 'Harapan SDN Habirau II Sei Palangan', method: 'manual_alias' },
  'Biti - Sei Kupang (Karya Bakti TNI)': { target: 'Biti - Sei Kupang Karya Bakti TNI', method: 'manual_alias' },
  'Habib Ibrahim - Desa Sei. Mandala': { target: 'Habib Ibrahim - Desa Sei Mandala', method: 'manual_alias' },
  'Jl. Manggis': { target: 'Manggis - Ds. Baru', method: 'manual_alias' },
  'Jl. Firdaus': { target: 'Firdaus - Ds. Kapuh', method: 'manual_alias' },
  'Jl. Baru - Asam Desa Baru/Asam': { target: 'Baru - Asam Desa Baru', method: 'alias' },
  'Jl. Buluh Ds. Tebing Tinggi': { target: 'Buluh - Ds. Tebing Tinggi', method: 'alias' },
  'Jl. Gerilya Ds. Simpur': { target: 'Gerilya - Ds. Simpur', method: 'alias' },
  'Jl. Tembok Baru - Baluti': { target: 'Tembok Baru - Ds. Baluti', method: 'alias' },
  'Tandik - Wasah Hilir': { target: 'Tandik - Ds. Wasah Hilir', method: 'alias' },
  'Bajayau - Bajayau Tengah': { target: 'Bajayau - Ds. Bajayau Tengah', method: 'alias' },
  'Jl. Ds. Kapuh Tengah (Jl. Menuju Majelis Taklim)': { target: 'Ds. Kapuh Tengah (Menuju Majelis Talim)', method: 'alias' },
  'Jl. Bubuih (Ds. Halunuk)': { target: 'Bubuih - Ds. Halunuk', method: 'alias' },
  'Jl. Banua Hanyar - Tanjung Selor': { target: 'Banua Hanyar - Ds. Tanjung Selor', method: 'alias' },
  'Jl. Kesehatan - Komp. Rumah Dokter': { target: 'Kesehatan - Komp. Rmh Dokter', method: 'alias' },
  'Jl. Soeprapto - Jl. HM. Rusli': { target: 'Soeprapto - H.M Rusli', method: 'alias' },
  'Sei. Kupang Utara - SP.4 Lungau': { target: 'Sei Kupang Utara - Simp. Empat Lungau', method: 'alias' },
  'Jl. Guru H. Izim': { target: 'Guru H. Izim - Ds. Pantai Ulin', method: 'alias' },
  'SP. Mandampa Telaga Sili-Sili - SP. Sungai Bungur': { target: 'Sp. Mandampa Tel. Sili-Sili - Sp. Sei. Bungur', method: 'alias' },
  'Jl. Brigjend. Katamso': { target: 'Brigjen Katamso', method: 'alias' },
  'Jl. Tungkaran': { target: 'Tungkaran - Ds. Ulin', method: 'alias' },
  'Jl. Papagaran/Pelangsatan': { target: 'Papagaran/Palangsatan', method: 'alias' },
  'Jl. Mangamol': { target: 'Mangamol - Ds. Pantai Ulin', method: 'alias' },
  'Jl. Cakingan Herman': { target: 'Cangkingan Herman', method: 'alias' },
  'Jl. Tukang Garit': { target: 'Tukang Garit (Tambangan)', method: 'alias' },
  'Jl. Keminting Batu': { target: 'Kaminting Batu', method: 'alias' },
  'Jl. Instalasi PDAM Negara': { target: 'Inst. PDAM Negara', method: 'alias' },
  'Jl. Rahma Bahran': { target: 'Rahmah Bahran', method: 'alias' },
  'Jl. Mesjid Kuba': { target: 'Mesjid Quba', method: 'alias' },
  'Jl. KH. Ramli': { target: 'KH. Ramli - DS. Amparaya', method: 'alias' },
  'Jl. Haratai 2 (SDN Haratai2)': { target: 'Haratai 2 (Balai Ujung Atas) SDN Haratai2', method: 'alias' },
  'Jl. Bubuih - Kandihin': { target: 'Bubuih (Ds. Halunuk) - Kandihin', method: 'alias' },
  'Jl. Silaturahim': { target: 'Silaturrahim', method: 'alias' },
  'Jl. Baiturrahim': { target: 'Baiturrahim Parincahan', method: 'alias' },
  'Jl. H. Saim/Garunggang': { target: 'H. Saim Garunggang - Kalimput', method: 'alias' },
  'Jl. Air Miris': { target: 'Air Miris - Ds. Wasah Hilir', method: 'alias' },
  'Jl. Karampaci': { target: 'Karampaci - Ds. Kapuh', method: 'alias' },
  'Jl. At-Taubah': { target: 'At-Taubah - Ds. Kapuh', method: 'alias' },
  'Jl. HM. Thaib': { target: 'H.M. Thaib', method: 'alias' },
  'Jl. Sakincung Ds. Hakurun Dalam': { target: 'Sakincung - Ds. Hakurung Dalam', method: 'alias' },
  'Jl. H. Jarkasi': { target: 'H. Jarkasi - Ds. Sungai Paring', method: 'alias' },
  'Jl. Mangunang': { target: 'Mangunang - Ds. Sungai Raya Utara', method: 'alias' },
  'Jl. Buntu Muara Hatib': { target: 'Buntu Muara Hatib - Bts. Kab. HST', method: 'alias' },
  'Jl. Pajah Api': { target: 'Pajah Api - Ds. Kapuh', method: 'alias' },
  'Jl. Banua Kambang': { target: 'Banua Kambang - Ds. Wasah Tengah', method: 'alias' },
  'Jl. TPA Sungai Raya Selatan': { target: 'TPA - Ds. Sungai Raya Selatan', method: 'alias' },
  'Jl. Telapak Manuk': { target: 'Talapak Manuk - Ds. Kapuh', method: 'alias' },
  'Jl. Sungai Karuh Tembus Tawar': { target: 'Sungai Karuh', method: 'manual_alias' },
  'Jl. Habib Iberahim': { target: 'Habib Ibrahim - Ds. Sei Mandala', method: 'manual_alias' },
  'Jl. Pandan Sari': { target: 'Pandan Sari - Ds. Angkinang', method: 'manual_alias' },
  'Jl. Rawati': { target: 'Rawati - Ds. Panjampang Bahagia', method: 'manual_alias' },
  'Jl. Suriangpati': { target: 'Suriangpati - Gambah Dalam Barat', method: 'manual_alias' }
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

const TE_DD2_LOCAL_ALIASES = {
  'Taal Batang Kulur - SP.3 Muara Paring Agung': 'Taal Batang Kulur - Sp. 3 Muara Prg Agung',
  'Batulaki - Muara Pipii': 'Batu Laki - Muara Pipii',
  'SP.4 Baru/Tampang - SP. Biluy Pamujaan': 'Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan',
  'Jl. Brigjend. Katamso': 'Brigjen Katamso',
  'Kalumpang (Ds. Belanti) - Teratai': 'Kalumpang (Ds. Balanti) - Teratai',
  'Jl. Soeprapto - Jl. HM. Rusli': 'Soeprapto - H.M Rusli',
  'Jl. Papagaran/Pelangsatan': 'Papagaran/Palangsatan',
  'Tanayung - Simpang Ambarai': 'Tanayung - Simp. Ambarai',
  'Simpur - Simpang Bilui': 'Simpur - Simp. Bilui',
  'Sei. Mandala - Murung Raya': 'Sei. Mandala Murung Raya',
  'Jl. Cakingan Herman': 'Cangkingan Herman',
  'Pakan Dalam - Keminting Batu': 'Pakan Dalam - Kaminting Batu',
  'Jl. Keminting Batu': 'Kaminting Batu',
  'Banyu Barau - Sungai Kalang': 'Banyu Barau - Sei Kalang',
  'Paharuangan - Sungai Raya Selatan': 'Paharuangan - Sei. Raya Selatan',
  'Jl. Rahma Bahran': 'Rahmah Bahran',
  'Jl. Pasar Kandangan - Oprit Jembatan Loklua': 'Pasar Kandangan - Oprit Jembt. Loklua',
  'Jl. Kesehatan - Komp. Rumah Dokter': 'Kesehatan - Komp. Rmh Dokter',
  'Tibung Raya - Asam Cangkok': 'Tibung Raya - Asam Cangkuk',
  'Jl. Mesjid Kuba': 'Mesjid Quba',
  'Bamban Selatan - Tangang - Panggang Hijau': 'Bamban Selatan - Tanggang - Panggang Hijau',
  'Jl. Silaturahim': 'Silaturrahim',
  'Jl. Buluh Ds. Tebing Tinggi': 'Buluh - Ds. Tebing Tinggi',
  'Jl. HM. Thaib': 'H.M. Thaib',
  'Jl. Sakincung Ds. Hakurun Dalam': 'Sakincung - Ds. Hakurung Dalam',
  'Jl. Ds. Kapuh Tengah (Jl. Menuju Majelis Taklim)': 'Ds. Kapuh Tengah (Menuju Majelis Talim)',
  'Jl. Gerilya Ds. Simpur': 'Gerilya - Ds. Simpur',
  'Jl. Bubuih (Ds. Halunuk)': 'Bubuih - Ds. Halunuk',
  'Padang Batung - Batu Laki - Malilingin': 'Padang Batung - Batulaki - Malilingin',
  'Jl. Badaun - Ds. Bajayau Lama': 'Badaun - Ds. Bjayau Lama',
  'Simp. Bakarung Selatan - Sungai Kudung': 'Sp. Bakarung Selatan - Sungai Kudung',
  'Simpang Jadi Makmur Ds. Samuda': 'Simpang Jadi Makmur - Ds. Samuda'
};

const dd2Data = require('./public/data/dd2_road_features.json');
const geos = require('./public/data/maps/road-geometries.json');

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

  const rawKey = getMapExplorerRoadKey(r.dd2_road_name_raw);
  if (rawKey && rawKey !== k && rawKey !== mapKey) {
    const rawBucket = dd2Map.get(rawKey) || [];
    rawBucket.push(r);
    dd2Map.set(rawKey, rawBucket);
  }
}

let collisions = 0;
for (const [k, v] of dd2Map) {
  if (v.length > 1) {
    collisions++; console.log(Collision on key:  ->, v.map(r=>r.road_key).join(
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

  let feature = null;
  let method = 'unmatched';
  let resolvedKey = directKey;

  if (refAliasCandidate?.key) {
    feature = resolve(refAliasCandidate.key);
    if (feature) {
      method = refAliasCandidate.method;
      resolvedKey = refAliasCandidate.key;
    }
  }

  if (!feature && aliasCandidate?.key) {
    feature = resolve(aliasCandidate.key);
    if (feature) {
      method = aliasCandidate.method;
      resolvedKey = aliasCandidate.key;
    }
  }

  if (!feature) {
    feature = resolve(directKey);
    if (feature) {
      method = 'direct';
      resolvedKey = directKey;
    }
  }

  if (!feature) {
    const teAliasTarget = TE_DD2_LOCAL_ALIASES[geo.road_name];
    if (teAliasTarget) {
      const teAliasKey = getMapExplorerRoadKey(teAliasTarget);
      feature = resolve(teAliasKey);
      if (feature) {
        method = 'te_local_alias';
        resolvedKey = teAliasKey;
      }
    }
  }

  if (!feature && matchedNameKey) {
    feature = resolve(matchedNameKey);
    if (feature) {
      method = 'matched_name';
      resolvedKey = matchedNameKey;
    }
  }

  if (!feature) {
    method = 'unmatched';
    resolvedKey = directKey;
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

fs.writeFileSync('popup_lookup_audit.csv', 'geometry_road_name,geometry_legacy_ref,resolved_key,dd2_feature_found,lookup_method,matched_dd2_name,reason_if_missing\n' + auditResults.map(r => `"${r.geometry_road_name}","${r.geometry_legacy_ref}","${r.resolved_key}",${r.dd2_feature_found},"${r.lookup_method}","${r.matched_dd2_name || ''}","${r.reason_if_missing || ''}"`).join('\n'));

fs.writeFileSync('popup_lookup_summary.json', JSON.stringify({
  total_geometries: geos.length,
  popup_dd2_found_count: foundCount,
  popup_dd2_missing_count: missingCount,
  collision_count: collisions,
  missing_roads: auditResults.filter(r => !r.dd2_feature_found)
}, null, 2));

console.log('Audit complete.');
console.log('FOUND:', foundCount);
console.log('MISSING:', missingCount);
