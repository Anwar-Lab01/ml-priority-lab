// ── Treatment Engine — Pure Logic & Constants ────────────────────────────────
//
// Extracted from TreatmentEnginePage.tsx (Phase 1 refactor).
// Contains rule engine, ASB estimation, override logic, display helpers,
// and color/guide constants. Zero React dependencies.
//
// SAFETY: No behavioral changes. Functions are byte-identical to originals.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DD2RoadFeature,
  DD2RoadFeatureWithRule,
  RuleV1Result,
  ASBItem,
  ASBBudgetResult,
  ManualASBOverride,
  DominantCondition,
} from './treatmentTypes';

// ── Rule Engine ──────────────────────────────────────────────────────────────

export function evaluateTreatmentRuleV1(road: DD2RoadFeature): RuleV1Result {
  const baseResult = {
    rule_basis: "proxy_dd2_aggregate",
    pkrms_alignment: "inspired_by_pkrms_not_tti"
  };

  if (!road.panjang_ruas_km || road.panjang_ruas_km <= 0) {
    return {
      ...baseResult,
      treatment_category: 'Data Tidak Cukup',
      rule_reason: 'Panjang ruas tidak valid atau 0 km.',
      rule_confidence: 'High',
      fields_used: ['panjang_ruas_km']
    };
  }

  const sumCondition = (road.kondisi_baik_pct || 0) + (road.kondisi_sedang_pct || 0) + (road.kondisi_rusak_ringan_pct || 0) + (road.kondisi_rusak_berat_pct || 0);
  if (sumCondition < 90) {
    return {
      ...baseResult,
      treatment_category: 'Data Tidak Cukup',
      rule_reason: 'Total persentase kondisi tidak mencapai 100%.',
      rule_confidence: 'High',
      fields_used: ['kondisi_baik_pct', 'kondisi_sedang_pct', 'kondisi_rusak_ringan_pct', 'kondisi_rusak_berat_pct']
    };
  }

  const unpavedKm = (road.perkerasan_tanah_belum_tembus_km || 0) + (road.perkerasan_telford_kerikil_km || 0);
  const unpavedPct = (unpavedKm / road.panjang_ruas_km) * 100;
  if (unpavedPct > 50) {
    return {
      ...baseResult,
      treatment_category: 'Kandidat Peningkatan Permukaan',
      rule_reason: `Lebih dari 50% (${unpavedPct.toFixed(1)}%) permukaan berupa tanah/kerikil/belum tembus; secara indikatif diklasifikasikan sebagai kandidat peningkatan permukaan.`,
      rule_confidence: 'High',
      fields_used: ['panjang_ruas_km', 'perkerasan_tanah_belum_tembus_km', 'perkerasan_telford_kerikil_km']
    };
  }

  const rb = road.kondisi_rusak_berat_pct || 0;
  const rr = road.kondisi_rusak_ringan_pct || 0;
  const sd = road.kondisi_sedang_pct || 0;
  const bk = road.kondisi_baik_pct || 0;
  const nonMantap = (road.non_mantap_pct !== null && road.non_mantap_pct !== undefined) ? road.non_mantap_pct : (rb + rr);

  if (rb >= 30) {
    return {
      ...baseResult,
      treatment_category: 'Rehabilitasi / Rekonstruksi Indikatif',
      rule_reason: `Rusak berat merupakan kondisi dominan pada agregasi DD2 ruas ini sebesar ${rb.toFixed(1)}%; secara indikatif mengarah pada kebutuhan rehabilitasi/rekonstruksi.`,
      rule_confidence: 'Medium',
      fields_used: ['kondisi_rusak_berat_pct']
    };
  }

  if (nonMantap >= 15) {
    return {
      ...baseResult,
      treatment_category: 'Rehabilitasi / Rekonstruksi Indikatif',
      rule_reason: `Kondisi Non-Mantap (Rusak Ringan + Berat) mencapai ${nonMantap.toFixed(1)}%.`,
      rule_confidence: 'Medium',
      fields_used: ['non_mantap_pct', 'kondisi_rusak_ringan_pct', 'kondisi_rusak_berat_pct']
    };
  }

  if (sd > 50) {
    return {
      ...baseResult,
      treatment_category: 'Pemeliharaan Berkala',
      rule_reason: `Kondisi Sedang mendominasi sebesar ${sd.toFixed(1)}%.`,
      rule_confidence: 'Low',
      fields_used: ['kondisi_sedang_pct', 'non_mantap_pct']
    };
  }

  return {
    ...baseResult,
    treatment_category: 'Pemeliharaan Rutin',
    rule_reason: `Kondisi Baik (${bk.toFixed(1)}%) dan Sedang (${sd.toFixed(1)}%) dominan (Jalan Mantap).`,
    rule_confidence: 'Low',
    fields_used: ['kondisi_baik_pct', 'kondisi_sedang_pct', 'non_mantap_pct']
  };
}

// ── ASB Budget Estimation ────────────────────────────────────────────────────

export function estimatePaguIndikatif(road: DD2RoadFeature, rules: any, asbItems: ASBItem[]): ASBBudgetResult {
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
       status: !selectedRule ? 'no_rule_matched' : 'no_major_asb_package', 
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

  let flags: string[] = [];
  let roadWidth = road.lebar_ruas_m;
  if (!roadWidth || roadWidth <= 0) {
     roadWidth = rules.heuristics.width_matching.default_width_m || 4.5;
     flags.push('width_assumption_used');
  }

  let matchedWidth = candidates.filter(i => (i.width_m || 0) >= (roadWidth as number)).sort((a,b) => (a.width_m || 0) - (b.width_m || 0));
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

// ── Manual Override Application ──────────────────────────────────────────────

export function applyManualOverride(
  road: DD2RoadFeature, 
  autoBudget: ASBBudgetResult, 
  override: ManualASBOverride | undefined, 
  asbItems: ASBItem[]
): ASBBudgetResult {
  if (!override || !override.override_active) {
    return {
      ...autoBudget,
      manual_override_used: false,
      final_pagu_indikatif_rp: autoBudget.pagu_indikatif_rp || null,
      final_asb_type: autoBudget.asb_type || null,
      final_asb_id: autoBudget.asb_id || null,
      final_costing_mode: autoBudget.costing_mode || null
    };
  }

  let flags: string[] = [];
  
  if (override.selected_asb_type === 'NONE') {
    return {
      ...autoBudget,
      status: 'no_major_asb_package',
      structural_profile: 'no_major_asb_package',
      manual_override_used: true,
      override_details: override,
      reason: 'Manual override: no major ASB package selected.',
      final_asb_type: 'NONE',
      final_asb_id: null,
      final_pagu_indikatif_rp: null,
      harga_satuan_rp: undefined,
      final_costing_mode: null
    };
  }

  // Find candidates for the selected type
  const candidates = asbItems.filter(i => {
    const match = (i.uraian || '').match(/Jalan Tipe ([A-Z])/i);
    return match && match[1].toUpperCase() === override.selected_asb_type;
  });

  if (candidates.length === 0) {
    return {
      ...autoBudget,
      status: 'missing_asb_item',
      manual_override_used: true,
      override_details: override,
      reason: 'No ASB candidates found for manually selected Type ' + override.selected_asb_type,
      flags: ['manual_override_failed_no_candidates']
    };
  }

  // Width matching
  let selectedWidth = road.lebar_ruas_m || 4.5;
  if (override.width_matching === 'manual_variant' && override.manual_width_m) {
    selectedWidth = override.manual_width_m;
  }
  
  let matchedWidthCandidates = candidates.filter(i => (i.width_m || 0) >= selectedWidth).sort((a,b) => (a.width_m || 0) - (b.width_m || 0));
  if (matchedWidthCandidates.length === 0) {
    matchedWidthCandidates = candidates.sort((a,b) => (b.width_m || 0) - (a.width_m || 0));
    flags.push('manual_review_width_exceeded_in_override');
  }
  
  const widthToUse = matchedWidthCandidates[0].width_m;
  const widthCandidates = matchedWidthCandidates.filter(i => i.width_m === widthToUse);

  // Surface matching
  let surfaceCandidates = widthCandidates;
  if (override.surface_preference === 'manual' && override.manual_surface_type) {
    const specificSurfaceCandidates = widthCandidates.filter(i => i.surface_type === override.manual_surface_type);
    if (specificSurfaceCandidates.length > 0) {
      surfaceCandidates = specificSurfaceCandidates;
    } else {
      flags.push('manual_surface_fallback_used');
    }
  }

  const selectedASB = surfaceCandidates[0];

  // Calculate Length and Cost
  const panjangM = (road.panjang_ruas_km || 0) * 1000;
  let calculationLengthM = panjangM;
  if (override.costing_mode === 'effective_length_mode' && override.effective_length_ratio) {
    calculationLengthM = panjangM * override.effective_length_ratio;
  }
  const pagu = selectedASB.harga_rp * calculationLengthM;

  return {
    status: 'manual_estimated',
    rule_id: autoBudget.rule_id, // keep auto rule for tracking
    rule_label: autoBudget.rule_label,
    confidence: 'high', // user override implies high confidence in the decision
    structural_profile: override.structural_profile,
    asb_type: override.selected_asb_type,
    asb_id: selectedASB.asb_id,
    asb_uraian: selectedASB.uraian,
    asb_spesifikasi: selectedASB.spesifikasi,
    harga_satuan_rp: selectedASB.harga_rp,
    satuan: selectedASB.satuan,
    panjang_m: calculationLengthM, // effective length used
    pagu_indikatif_rp: pagu,
    width_matched_m: selectedASB.width_m || 0,
    surface_matched: selectedASB.surface_type || 'Unknown',
    costing_mode: override.costing_mode,
    flags: [...(autoBudget.flags || []), ...flags],
    disclaimer: autoBudget.disclaimer || 'Estimasi kewajaran anggaran indikatif berdasarkan ASB BM 2027. Bukan RAB final atau DED teknis.',
    reason: override.manual_reason_text || override.manual_reason_code,
    
    // Override tracking
    manual_override_used: true,
    override_details: override,
    
    // Final
    final_pagu_indikatif_rp: pagu,
    final_asb_type: override.selected_asb_type,
    final_asb_id: selectedASB.asb_id,
    final_costing_mode: override.costing_mode
  };
}

// ── Display Helpers ──────────────────────────────────────────────────────────

export function getDominantCondition(r: DD2RoadFeatureWithRule): DominantCondition {
  const c = {
    'Baik': r.kondisi_baik_pct ?? 0,
    'Sedang': r.kondisi_sedang_pct ?? 0,
    'Rusak Ringan': r.kondisi_rusak_ringan_pct ?? 0,
    'Rusak Berat': r.kondisi_rusak_berat_pct ?? 0,
  };
  const maxVal = Math.max(c['Baik'], c['Sedang'], c['Rusak Ringan'], c['Rusak Berat']);
  if (maxVal === 0 && 
      r.kondisi_baik_pct == null && 
      r.kondisi_sedang_pct == null && 
      r.kondisi_rusak_ringan_pct == null && 
      r.kondisi_rusak_berat_pct == null) {
    return 'N/A';
  }
  if (c['Rusak Berat'] === maxVal) return 'Rusak Berat';
  if (c['Rusak Ringan'] === maxVal) return 'Rusak Ringan';
  if (c['Sedang'] === maxVal) return 'Sedang';
  if (c['Baik'] === maxVal) return 'Baik';
  return 'N/A';
}

export function getDisplayRuleCategory(cat: string | undefined): string {
  if (!cat) return '—';
  if (cat === 'Rehabilitasi') return 'Rehabilitasi / Rekonstruksi Indikatif';
  return cat;
}

// ── Color Constants ──────────────────────────────────────────────────────────

export const DOMINANT_COLORS: Record<DominantCondition, string> = {
  'Baik': '#10b981',
  'Sedang': '#3b82f6',
  'Rusak Ringan': '#f59e0b',
  'Rusak Berat': '#ef4444',
  'N/A': '#94a3b8',
};

export const RULE_CATEGORY_COLORS: Record<string, string> = {
  'Pemeliharaan Rutin': '#10b981',
  'Pemeliharaan Berkala': '#3b82f6',
  'Rehabilitasi / Rekonstruksi Indikatif': '#ea580c',
  'Kandidat Peningkatan Permukaan': '#8b5cf6',
  'Data Tidak Cukup': '#f43f5e',
};

export const SEGMENT_CONDITION_COLORS: Record<string, string> = {
  'baik': '#10b981',        
  'sedang': '#eab308',      
  'rusak_ringan': '#f97316', 
  'rusak_berat': '#ef4444',  
  'default': '#94a3b8'       
};

// ── ASB Type Guide Reference ─────────────────────────────────────────────────

export const ASB_TYPE_GUIDE: Record<string, { label: string; desc: string; composition: string; use: string; isSupport?: boolean }> = {
  'A': { label: 'A — Surface only', desc: 'Lapisan permukaan aspal saja', composition: 'Permukaan', use: 'Pemeliharaan / pelapisan ulang permukaan' },
  'B': { label: 'B — Surface + LPA', desc: 'Permukaan + LPA', composition: 'Permukaan + Lapis Pondasi Atas (LPA)', use: 'Perbaikan dengan pondasi atas' },
  'C': { label: 'C — Surface + LPA + LPB', desc: 'Permukaan + LPA + LPB', composition: 'Permukaan + LPA + Lapis Pondasi Bawah (LPB)', use: 'Rehabilitasi mayor / pondasi penuh' },
  'D': { label: 'D — Surface + LPA + LPB + Timbunan', desc: 'Permukaan + LPA + LPB + timbunan pilihan', composition: 'Permukaan + LPA + LPB + Timbunan', use: 'Rekonstruksi dengan peninggian badan jalan' },
  'E': { label: 'E — Surface + Bahu Beton', desc: 'Permukaan + bahu beton', composition: 'Permukaan + Bahu Jalan Beton', use: 'Peningkatan kapasitas / pelebaran bahu' },
  'F': { label: 'F — Full package + Drainase + Bahu', desc: 'Permukaan + LPA + LPB + timbunan + drainase + bahu', composition: 'Permukaan + LPA + LPB + Timbunan + Drainase + Bahu', use: 'Rekonstruksi komprehensif' },
  'G': { label: 'G — Rigid / Beton', desc: 'Jalan cor beton', composition: 'Perkerasan Beton Semen', use: 'Jalan beban berat / daerah genangan' },
  'H': { label: 'H — Retaining Wall', desc: 'Siring/pasangan batu', composition: 'Pasangan Batu', use: 'Penahan tanah', isSupport: true },
  'I': { label: 'I — Gabion', desc: 'Bronjong', composition: 'Bronjong kawat', use: 'Pengendali erosi / tebing', isSupport: true },
  'J': { label: 'J — Culvert', desc: 'Slab culvert', composition: 'Slab Culvert', use: 'Gorong-gorong / saluran melintang', isSupport: true },
  'K': { label: 'K — Earthwork Select', desc: 'Timbunan pilihan', composition: 'Timbunan Pilihan', use: 'Peninggian badan jalan', isSupport: true },
  'L': { label: 'L — Base Repair', desc: 'Perbaikan LPA', composition: 'Lapis Pondasi Atas (LPA)', use: 'Perbaikan pondasi lokal', isSupport: true },
  'M': { label: 'M — Sheet Pile', desc: 'Dinding turap beton', composition: 'Turap Beton', use: 'Penahan tebing kritis', isSupport: true },
  'N': { label: 'N — Earthwork Common', desc: 'Timbunan biasa', composition: 'Timbunan Biasa', use: 'Pekerjaan tanah standar', isSupport: true }
};
