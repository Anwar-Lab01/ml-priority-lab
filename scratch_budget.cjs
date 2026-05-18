const fs = require('fs');
const path = require('path');

const dd2Path = path.join(__dirname, 'public/data/dd2_road_features.json');
const asbRulesPath = path.join(__dirname, 'public/data/asb_budget_package_rules.json');
const asbItemsPath = path.join(__dirname, 'public/data/asb_unit_prices.json');

const dd2Data = JSON.parse(fs.readFileSync(dd2Path, 'utf8'));
const asbRules = JSON.parse(fs.readFileSync(asbRulesPath, 'utf8'));
const asbItemsData = JSON.parse(fs.readFileSync(asbItemsPath, 'utf8'));

const asbItems = asbItemsData.items || [];
const roads = dd2Data.roads || [];

function estimatePaguIndikatif(road, rules, asbItems) {
  if (!road.panjang_ruas_km) {
     return { status: 'insufficient_data', flags: ['missing_length'], reason: 'Panjang ruas tidak tersedia.' };
  }

  let selectedRule = null;
  const unpaved_pct = ((road.perkerasan_tanah_belum_tembus_km || 0) + (road.perkerasan_telford_kerikil_km || 0)) / road.panjang_ruas_km * 100;
  const non_mantap_pct = road.non_mantap_pct ?? ((road.kondisi_rusak_ringan_pct || 0) + (road.kondisi_rusak_berat_pct || 0));
  const rusak_berat_pct = road.kondisi_rusak_berat_pct ?? 0;

  for (const r of rules.selection_rules) {
     let match = false;
     if (r.rule_id === 'R01') {
        match = unpaved_pct >= 50 || (non_mantap_pct >= 40 && rusak_berat_pct >= 20);
     } else if (r.rule_id === 'R02') {
        match = non_mantap_pct >= 40;
     } else if (r.rule_id === 'R03') {
        match = non_mantap_pct >= 25 && rusak_berat_pct >= 10;
     } else if (r.rule_id === 'R04') {
        match = non_mantap_pct >= 25 && rusak_berat_pct < 10;
     } else if (r.rule_id === 'R05') {
        match = non_mantap_pct >= 10 && non_mantap_pct < 25;
     } else if (r.rule_id === 'R06') {
        match = non_mantap_pct < 10;
     }
     if (match) {
        selectedRule = r;
        break;
     }
  }

  if (!selectedRule || selectedRule.selected_profile === 'no_major_asb_package') {
     return { 
       status: 'no_rule_matched', 
       rule_id: selectedRule?.rule_id, 
       rule_label: selectedRule?.label, 
       confidence: selectedRule?.confidence,
       reason: 'Kondisi mantap, tidak memerlukan paket ASB struktural besar.'
     };
  }

  const profileKey = selectedRule.selected_profile;
  const asbType = rules.structural_profiles[profileKey].asb_type;

  const candidates = asbItems.filter(i => {
      const match = (i.uraian || '').match(/Jalan Tipe ([A-Z])/i);
      return match && match[1].toUpperCase() === asbType;
  });

  if (candidates.length === 0) return { status: 'no_asb_candidate_found', reason: 'No ASB candidates found for Type ' + asbType };

  let flags = [];
  let roadWidth = road.lebar_ruas_m;
  if (!roadWidth || roadWidth <= 0) {
     roadWidth = rules.heuristics.width_matching.default_width_m || 4.5;
     flags.push('width_assumption_used');
  }

  let matchedWidth = candidates.filter(i => (i.width_m || 0) >= roadWidth).sort((a,b) => (a.width_m || 0) - (b.width_m || 0));
  if (matchedWidth.length === 0) {
      matchedWidth = candidates.sort((a,b) => (b.width_m || 0) - (a.width_m || 0));
      flags.push('manual_review_width_exceeded');
  }

  const selectedWidth = matchedWidth[0].width_m;
  const widthCandidates = matchedWidth.filter(i => i.width_m === selectedWidth);

  let prefSurface = asbType === 'A' ? rules.heuristics.surface_preference.Tipe_A : rules.heuristics.surface_preference.Tipe_BCD;
  let surfaceCandidates = widthCandidates.filter(i => i.surface_type === prefSurface);

  if (surfaceCandidates.length === 0) {
      surfaceCandidates = widthCandidates;
      flags.push('surface_fallback_used');
  }

  const selectedASB = surfaceCandidates[0];
  const panjangM = road.panjang_ruas_km * 1000;
  const pagu = selectedASB.harga_rp * panjangM;

  return {
    status: 'estimated',
    rule_id: selectedRule.rule_id,
    rule_label: selectedRule.label,
    confidence: selectedRule.confidence,
    structural_profile: profileKey,
    asb_type: asbType,
    asb_id: selectedASB.asb_id,
    asb_uraian: selectedASB.uraian,
    asb_spesifikasi: selectedASB.spesifikasi,
    harga_satuan_rp: selectedASB.harga_rp,
    satuan: selectedASB.satuan,
    panjang_m: panjangM,
    pagu_indikatif_rp: pagu,
    width_matched_m: selectedASB.width_m || 0,
    surface_matched: selectedASB.surface_type || 'Unknown',
    costing_mode: rules.heuristics.costing_mode_defaults.v0_1,
    flags,
    disclaimer: rules.metadata.disclaimer
  };
}

let estimatedRoads = 0;
let noMajorPackage = 0;
let manualReviewRequired = 0;
let flagCounts = {};

const sampleRoads = [];

for (const road of roads) {
  const budget = estimatePaguIndikatif(road, asbRules, asbItems);
  
  if (budget.status === 'estimated') {
     estimatedRoads++;
     if (sampleRoads.length < 5) {
         sampleRoads.push({
             name: road.canonical_road_name,
             rule: budget.rule_id,
             asb_type: budget.asb_type,
             pagu: budget.pagu_indikatif_rp
         });
     }
  } else if (budget.status === 'no_rule_matched') {
     noMajorPackage++;
  }
  
  if (budget.flags && budget.flags.length > 0) {
      manualReviewRequired++;
      for (const flag of budget.flags) {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }
  }
}

console.log("=== ASB BUDGET REASONABLENESS REPORT ===");
console.log("ASB Rules Loaded:", asbRules.selection_rules.length);
console.log("ASB Items Loaded:", asbItems.length);
console.log("Total Roads Evaluated:", roads.length);
console.log("Roads with Estimated Pagu:", estimatedRoads);
console.log("Roads with no_major_asb_package:", noMajorPackage);
console.log("Roads requiring Manual Review (Flags):", manualReviewRequired);
console.log("Flag Counts:", flagCounts);
console.log("\nSample 5 Road Estimates:");
sampleRoads.forEach(r => {
    console.log(`- ${r.name} | Rule: ${r.rule} | Pkg: Tipe ${r.asb_type} | Pagu: Rp ${r.pagu.toLocaleString('id-ID')}`);
});
