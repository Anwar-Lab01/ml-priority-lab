import * as fs from 'fs';
import { getMapExplorerRoadKey, getMapExplorerRefAliasCandidate, getMapExplorerAliasCandidate } from './src/lib/mapExplorerMatching';

const dd2Data = JSON.parse(fs.readFileSync('./public/data/dd2_road_features.json', 'utf8'));
const geos = JSON.parse(fs.readFileSync('./public/data/maps/road-geometries.json', 'utf8'));

const TE_DD2_LOCAL_ALIASES: Record<string, string> = {
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
  'Jl. Badaun - Ds. Bajayau Lama': 'Badaun - Ds. Bjayau Lama'
};

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
    collisions++;
  }
}

const resolve = (key: string | null) => {
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
