// Comprehensive diagnostic: trace exactly why aliasCandidate lookups fail for each missing road
const fs = require('fs');

// Reproduce normalizer functions
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
  return name.trim().toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bjl\.?\s*/g, '')
    .replace(/\bds\.?(?=\s|$)/g, 'desa')
    .replace(/\bsp\.?\s*/g, 'sp ')
    .replace(/\bsei\.?\s*/g, 'sei ')
    .replace(/\//g, ' ').replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function gk(name) { if (!name) return 'unknown'; return normalizeRoadIdentity(preprocessMapExplorerRoadName(name)); }

// Load data
const dd2 = require('./public/data/dd2_road_features.json');
const summary = JSON.parse(fs.readFileSync('popup_lookup_summary.json'));

// Build current dd2Map (primary + secondary only)
const dd2Map = new Map();
for (const r of dd2.roads) {
  const k = r.road_key;
  if (!dd2Map.has(k)) dd2Map.set(k, []);
  dd2Map.get(k).push(r);
  
  const mk = gk(r.canonical_road_name);
  if (mk && mk !== k) {
    if (!dd2Map.has(mk)) dd2Map.set(mk, []);
    dd2Map.get(mk).push(r);
  }
}

// Load the alias targets (from aliases file)
const ALIAS_TARGETS = {
  'Jl. Guru H. Izim': 'Guru H. Izim - Ds. Pantai Ulin',
  'SP. Mandampa Telaga Sili-Sili - SP. Sungai Bungur': 'Sp. Mandampa Tel. Sili-Sili - Sp. Sei. Bungur',
  'Jl. Sungai Karuh Tembus Tawar': 'Sungai Karuh',
  'Jl. Brigjend. Katamso': 'Brigjen Katamso',
  'Jl. Tungkaran': 'Tungkaran - Ds. Ulin',
  'Jl. Papagaran/Pelangsatan': 'Papagaran/Palangsatan',
  'Jl. Mangamol': 'Mangamol - Ds. Pantai Ulin',
  'Jl. Cakingan Herman': 'Cangkingan Herman',
  'Jl. Tukang Garit': 'Tukang Garit (Tambangan)',
  'Jl. Keminting Batu': 'Kaminting Batu',
  'Jl. Instalasi PDAM Negara': 'Inst. PDAM Negara',
  'Jl. Rahma Bahran': 'Rahmah Bahran',
  'Jl. Mesjid Kuba': 'Mesjid Quba',
  'Jl. KH. Ramli': 'KH. Ramli - DS. Amparaya',
  'Jl. Haratai 2 (SDN Haratai2)': 'Haratai 2 (Balai Ujung Atas) SDN Haratai2',
  'Jl. Bubuih - Kandihin': 'Bubuih (Ds. Halunuk) - Kandihin',
  'Jl. Silaturahim': 'Silaturrahim',
  'Jl. Baiturrahim': 'Baiturrahim Parincahan',
  'Jl. H. Saim/Garunggang': 'H. Saim Garunggang - Kalimput',
  'Jl. Air Miris': 'Air Miris - Ds. Wasah Hilir',
  'Jl. Karampaci': 'Karampaci - Ds. Kapuh',
  'Jl. At-Taubah': 'At-Taubah - Ds. Kapuh',
  'Jl. HM. Thaib': 'H.M. Thaib',
  'Jl. Sakincung Ds. Hakurun Dalam': 'Sakincung - Ds. Hakurung Dalam',
  'Jl. H. Jarkasi': 'H. Jarkasi - Ds. Sungai Paring',
  'Jl. Mangunang': 'Mangunang - Ds. Sungai Raya Utara',
  'Jl. Buntu Muara Hatib': 'Buntu Muara Hatib - Bts. Kab. HST',
  'Jl. Pajah Api': 'Pajah Api - Ds. Kapuh',
  'Jl. Banua Kambang': 'Banua Kambang - Ds. Wasah Tengah',
  'Jl. TPA Sungai Raya Selatan': 'TPA - Ds. Sungai Raya Selatan',
  'Jl. Telapak Manuk': 'Talapak Manuk - Ds. Kapuh',
  'Jl. Habib Iberahim': 'Habib Ibrahim - Ds. Sei Mandala',
  'Jl. Pandan Sari': 'Pandan Sari - Ds. Angkinang',
  'Jl. Rawati': 'Rawati - Ds. Panjampang Bahagia',
  'Jl. Suriangpati': 'Suriangpati - Gambah Dalam Barat',
  // Non-Jl roads
  'Taal Batang Kulur - SP.3 Muara Paring Agung': null, // No alias for this
  'Batulaki - Muara Pipii': null,
  'SP.4 Baru/Tampang - SP. Biluy Pamujaan': null,
  'Kalumpang (Ds. Belanti) - Teratai': null,
  'Tanayung - Simpang Ambarai': null,
  'Simpur - Simpang Bilui': null,
  'Sei. Mandala - Murung Raya': null,
  'Pakan Dalam - Keminting Batu': null,
  'Banyu Barau - Sungai Kalang': null,
  'Paharuangan - Sungai Raya Selatan': null,
  'Jl. Pasar Kandangan - Oprit Jembatan Loklua': null,
  'Tibung Raya - Asam Cangkok': null,
  'Bamban Selatan - Tangang - Panggang Hijau': null,
  'Simp. Bakarung Selatan - Sungai Kudung': null,
  'Jl. Buluh Ds. Tebing Tinggi': 'Buluh - Ds. Tebing Tinggi',
  'Jl. Baru - Asam Desa Baru/Asam': 'Baru - Asam Desa Baru',
  'Tandik - Wasah Hilir': 'Tandik - Ds. Wasah Hilir',
  'Bajayau - Bajayau Tengah': 'Bajayau - Ds. Bajayau Tengah',
  'Jl. Ds. Kapuh Tengah (Jl. Menuju Majelis Taklim)': 'Ds. Kapuh Tengah (Menuju Majelis Talim)',
  'Jl. Gerilya Ds. Simpur': 'Gerilya - Ds. Simpur',
  'Jl. Bubuih (Ds. Halunuk)': 'Bubuih - Ds. Halunuk',
  'Jl. Tembok Baru - Baluti': 'Tembok Baru - Ds. Baluti',
  'Jl. Banua Hanyar - Tanjung Selor': 'Banua Hanyar - Ds. Tanjung Selor',
  'Jl. Kesehatan - Komp. Rumah Dokter': 'Kesehatan - Komp. Rmh Dokter',
  'Jl. Soeprapto - Jl. HM. Rusli': 'Soeprapto - H.M Rusli',
  'Jl. Badaun - Ds. Bajayau Lama': null,
  'Simpang Jadi Makmur Ds. Samuda': null,
  'Padang Batung - Batu Laki - Malilingin': null,
  'Jl. Habib Iberahim': 'Habib Ibrahim - Ds. Sei Mandala',
};

// For each missing road, trace what aliasCandidate key resolves to and check dd2Map
console.log('=== DIAGNOSTIC: Why aliasCandidate fails for missing roads ===\n');
let aliasFoundInDD2 = 0;
let aliasNotInDD2 = 0;
let noAlias = 0;

for (const m of summary.missing_roads) {
  const aliasTarget = ALIAS_TARGETS[m.geometry_road_name];
  if (!aliasTarget) {
    // Check if there's a non-Jl alias we missed
    noAlias++;
    console.log(`NO_ALIAS | ${m.geometry_road_name} [${m.geometry_legacy_ref}] | directKey: ${m.resolved_key}`);
    continue;
  }
  
  const aliasTargetKey = gk(aliasTarget);
  const inDD2 = dd2Map.has(aliasTargetKey);
  
  if (inDD2) {
    aliasFoundInDD2++;
    const dd2r = dd2Map.get(aliasTargetKey);
    console.log(`ALIAS_KEY_EXISTS | ${m.geometry_road_name} -> ${aliasTarget} | aliasKey: ${aliasTargetKey} | dd2_match: ${dd2r[0].canonical_road_name}`);
  } else {
    aliasNotInDD2++;
    // Find the closest DD2 key
    let best = null; let bestDist = Infinity;
    for (const r of dd2.roads) {
      const d = Math.abs(r.road_key.length - aliasTargetKey.length);
      if (d < bestDist && r.road_key.includes(aliasTargetKey.substring(0, 8))) {
        bestDist = d;
        best = r;
      }
    }
    console.log(`ALIAS_KEY_MISSING | ${m.geometry_road_name} -> ${aliasTarget} | aliasKey: ${aliasTargetKey} | not in dd2Map`);
    // Search DD2 for partial matches
    const partials = dd2.roads.filter(r => {
      const words = aliasTargetKey.split(/\s+/).filter(w => w.length > 3);
      return words.length > 0 && words.every(w => r.road_key.includes(w));
    });
    if (partials.length > 0) {
      console.log(`  -> Partial matches: ${partials.map(p => p.road_key).join(', ')}`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Alias target key EXISTS in dd2Map: ${aliasFoundInDD2}`);
console.log(`Alias target key MISSING from dd2Map: ${aliasNotInDD2}`);
console.log(`No alias at all: ${noAlias}`);
