const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('./public/data/dd2_road_features.json', 'utf8'));
const roads = rawData.roads;

function getDominantCondition(r) {
  const c = {
    'Baik': r.kondisi_baik_pct ?? 0,
    'Sedang': r.kondisi_sedang_pct ?? 0,
    'Rusak Ringan': r.kondisi_rusak_ringan_pct ?? 0,
    'Rusak Berat': r.kondisi_rusak_berat_pct ?? 0,
  };
  const maxVal = Math.max(c['Baik'], c['Sedang'], c['Rusak Ringan'], c['Rusak Berat']);
  if (maxVal === 0 && r.kondisi_baik_pct == null) return 'N/A';
  
  if (c['Rusak Berat'] === maxVal) return 'Rusak Berat';
  if (c['Rusak Ringan'] === maxVal) return 'Rusak Ringan';
  if (c['Sedang'] === maxVal) return 'Sedang';
  if (c['Baik'] === maxVal) return 'Baik';
  return 'N/A';
}

function evaluateTreatmentRuleV1(road) {
  if (!road.panjang_ruas_km || road.panjang_ruas_km <= 0) {
    return { treatment_category: 'Data Tidak Cukup' };
  }

  const sumCondition = (road.kondisi_baik_pct || 0) + (road.kondisi_sedang_pct || 0) + (road.kondisi_rusak_ringan_pct || 0) + (road.kondisi_rusak_berat_pct || 0);
  if (sumCondition < 90) {
    return { treatment_category: 'Data Tidak Cukup' };
  }

  const unpavedKm = (road.perkerasan_tanah_belum_tembus_km || 0) + (road.perkerasan_telford_kerikil_km || 0);
  const unpavedPct = (unpavedKm / road.panjang_ruas_km) * 100;
  if (unpavedPct > 50) {
    return { treatment_category: 'Kandidat Peningkatan Permukaan' };
  }

  const rb = road.kondisi_rusak_berat_pct || 0;
  const rr = road.kondisi_rusak_ringan_pct || 0;
  const sd = road.kondisi_sedang_pct || 0;
  const nonMantap = (road.non_mantap_pct !== null && road.non_mantap_pct !== undefined) ? road.non_mantap_pct : (rb + rr);

  if (rb >= 30) {
    return { treatment_category: 'Rehabilitasi / Rekonstruksi Indikatif' };
  }
  if (nonMantap >= 15) {
    return { treatment_category: 'Rehabilitasi' };
  }
  if (sd > 50) {
    return { treatment_category: 'Pemeliharaan Berkala' };
  }
  return { treatment_category: 'Pemeliharaan Rutin' };
}

const domCounts = { 'Baik': 0, 'Sedang': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0, 'N/A': 0 };
const ruleCounts = {};

roads.forEach(r => {
  domCounts[getDominantCondition(r)]++;
  const rule = evaluateTreatmentRuleV1(r);
  ruleCounts[rule.treatment_category] = (ruleCounts[rule.treatment_category] || 0) + 1;
});

console.log('Dominant Condition Counts:');
console.log(JSON.stringify(domCounts, null, 2));
console.log('\nRule v0.1 Category Counts:');
console.log(JSON.stringify(ruleCounts, null, 2));
console.log(`Total roads: ${roads.length}`);
