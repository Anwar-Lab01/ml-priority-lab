import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Wrench,
  Database,
  Route,
  FileJson,
  DollarSign,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Map as MapIcon,
  X,
  Info,
  Search
} from 'lucide-react';
import {
  getMapExplorerRoadKey,
  getMapExplorerRefAliasCandidate,
  getMapExplorerAliasCandidate
} from '../../lib/mapExplorerMatching';

/* ──────────────────────────────────────────────
   Treatment Engine — Map Shell + Placeholder
   Rule-based treatment indication & indicative
   budgeting from DD2 / ASB data.

   SAFETY NOTE:
   - Map data reuses existing /data/maps/ files.
   - Now loads verified public/data/dd2_road_features.json
   - No treatment rules are applied yet.
   - Map Explorer matcher / scoring NOT used here.
   ────────────────────────────────────────────── */

// ── Types ─────────────────────────────────────────────────────────────────────

interface MapConfig {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  showZoomControl?: boolean;
}

interface GeoRoad {
  legacy_ref: string | null;
  road_id: number | null;
  road_name: string;
  matched_name: string | null;
  coordinates: [number, number][];
}

interface DD2FeatureMetadata {
  generated_at: string;
  total_records: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
}

export interface DD2DamageSegment {
  road_key: string;
  canonical_road_name: string;
  raw_road_name: string;
  nomor_ruas: string;
  segment_index: number;
  sta_start_m: number;
  sta_end_m: number;
  panjang_m: number;
  dominant_condition: string;
  segment_status: string;
  jenis_penanganan_norm: string;
  surface_label: string;
  lebar_m: number;
  tahun_survei: number;
}

export interface DD2DamageSegmentData {
  metadata: {
    total_segments: number;
    unique_roads: number;
    generated_at: string;
  };
  segments: DD2DamageSegment[];
}

interface DD2RoadFeature {
  road_key: string;
  nama_ruas_norm: string;
  canonical_road_name: string;
  dd2_road_name_raw: string;
  dd2_row_index: number;
  identity_match_method: string;
  kecamatan_dilalui: string | null;
  no_ruas: string | null;
  panjang_ruas_km: number | null;
  lebar_ruas_m: number | null;
  perkerasan_hotmix_km: number | null;
  perkerasan_lapen_makadam_km: number | null;
  perkerasan_beton_km: number | null;
  perkerasan_telford_kerikil_km: number | null;
  perkerasan_tanah_belum_tembus_km: number | null;
  kondisi_baik_pct: number | null;
  kondisi_sedang_pct: number | null;
  kondisi_rusak_ringan_pct: number | null;
  kondisi_rusak_berat_pct: number | null;
  non_mantap_pct: number | null;
}

export interface RuleV1Result {
  treatment_category: string;
  rule_reason: string;
  rule_confidence: 'High' | 'Medium' | 'Low';
  fields_used: string[];
  rule_basis?: string;
  pkrms_alignment?: string;
}

export interface DD2RoadFeatureWithRule extends DD2RoadFeature {
  rule_v1: RuleV1Result;
  asb_budget?: ASBBudgetResult;
}

export interface ASBItem {
  asb_id: string;
  no: number;
  kelompok_barang: string;
  kode_barang: string;
  uraian: string;
  spesifikasi: string;
  satuan: string;
  harga_rp: number;
  kelompok_belanja: string;
  treatment_family: string | null;
  surface_type: string | null;
  width_m: number | null;
  layer_thickness_cm: number | null;
}

export interface ASBBudgetResult {
  status: 'estimated' | 'no_rule_matched' | 'no_asb_candidate_found' | 'insufficient_data';
  rule_id?: string;
  rule_label?: string;
  confidence?: 'high' | 'medium' | 'low';
  structural_profile?: string;
  asb_type?: string;
  asb_id?: string;
  asb_uraian?: string;
  asb_spesifikasi?: string;
  harga_satuan_rp?: number;
  satuan?: string;
  panjang_m?: number;
  pagu_indikatif_rp?: number;
  width_matched_m?: number;
  surface_matched?: string;
  costing_mode?: string;
  flags?: string[];
  disclaimer?: string;
  reason?: string;
}

export interface DD2DataWithRules {
  _metadata: DD2FeatureMetadata;
  roads: DD2RoadFeatureWithRule[];
  ruleStats?: {
    totalEvaluated: number;
    insufficientData: number;
    rutin: number;
    berkala: number;
    rehab: number;
    rekon: number;
    peningkatan: number;
  };
  asbStats?: {
    totalItemsLoaded: number;
    totalRulesLoaded: number;
    estimatedRoads: number;
    noMajorPackage: number;
    manualReviewRequired: number;
  };
}

function evaluateTreatmentRuleV1(road: DD2RoadFeature): RuleV1Result {
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

function estimatePaguIndikatif(road: DD2RoadFeature, rules: any, asbItems: ASBItem[]): ASBBudgetResult {
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

// ── Data Loaders ──────────────────────────────────────────────────────────────

function useTreatmentData() {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [geos, setGeos] = useState<GeoRoad[]>([]);
  const [dd2Data, setDd2Data] = useState<DD2DataWithRules | null>(null);
  const [segmentData, setSegmentData] = useState<DD2DamageSegmentData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    async function load() {
      setStatus('loading');
      try {
        const [resCfg, resGeo, resDd2, resSeg, resAsbItems, resAsbRules] = await Promise.all([
          fetch('/data/maps/map-config.json'),
          fetch('/data/maps/road-geometries.json'),
          fetch('/data/dd2_road_features.json'),
          fetch('/data/dd2_damage_segments.json'),
          fetch('/data/asb_unit_prices.json'),
          fetch('/data/asb_budget_package_rules.json')
        ]);
        
        if (!resCfg.ok || !resGeo.ok) throw new Error('Failed to load map data');
        
        setConfig(await resCfg.json());
        setGeos(await resGeo.json());
        
        const asbItemsData = resAsbItems.ok ? await resAsbItems.json() : null;
        const asbRulesData = resAsbRules.ok ? await resAsbRules.json() : null;
        
        if (resDd2.ok) {
          const rawData = await resDd2.json();
          let totalEvaluated = 0, insufficientData = 0, rutin = 0, berkala = 0, rehab = 0, rekon = 0, peningkatan = 0;
          let estimatedRoads = 0, noMajorPackage = 0, manualReviewRequired = 0;
          
          const sourceRoads = Array.isArray(rawData?.roads) ? rawData.roads : [];
          const roadsWithRules = sourceRoads.map((r: DD2RoadFeature) => {
            const rule = evaluateTreatmentRuleV1(r);
            totalEvaluated++;
            if (rule.treatment_category === 'Data Tidak Cukup') insufficientData++;
            else if (rule.treatment_category === 'Pemeliharaan Rutin') rutin++;
            else if (rule.treatment_category === 'Pemeliharaan Berkala') berkala++;
            else if (rule.treatment_category === 'Rehabilitasi') rehab++;
            else if (rule.treatment_category === 'Rehabilitasi / Rekonstruksi Indikatif') rekon++;
            else if (rule.treatment_category === 'Kandidat Peningkatan Permukaan') peningkatan++;
            
            let asb_budget;
            if (asbItemsData && asbRulesData) {
               asb_budget = estimatePaguIndikatif(r, asbRulesData, asbItemsData.items || []);
               if (asb_budget.status === 'estimated') estimatedRoads++;
               else if (asb_budget.status === 'no_rule_matched') noMajorPackage++;
               
               if (asb_budget.flags && asb_budget.flags.length > 0) manualReviewRequired++;
            }
            
            return { ...r, rule_v1: rule, asb_budget };
          });
          
          setDd2Data({
             ...rawData,
             _metadata: rawData?._metadata ?? { generated_at: '', total_records: sourceRoads.length, matched: 0, unmatched: 0, ambiguous: 0 },
             roads: roadsWithRules,
             ruleStats: { totalEvaluated, insufficientData, rutin, berkala, rehab, rekon, peningkatan },
             asbStats: {
                totalItemsLoaded: asbItemsData?.items?.length || 0,
                totalRulesLoaded: asbRulesData?.selection_rules?.length || 0,
                estimatedRoads,
                noMajorPackage,
                manualReviewRequired
             }
          });

          // DEV diagnostics global variable
          (window as any).__ASB_BUDGET_REASONABLENESS_DIAGNOSTICS__ = {
             rulesLoaded: asbRulesData?.selection_rules?.length || 0,
             asbItemsLoaded: asbItemsData?.items?.length || 0,
             totalRoadsEvaluated: totalEvaluated,
             estimatedRoads,
             noMajorPackage,
             missingRules: !asbRulesData,
             missingItems: !asbItemsData,
             sampleEstimates: roadsWithRules.slice(0, 10).map((r: any) => ({
                road_name: r.canonical_road_name,
                non_mantap_pct: r.non_mantap_pct,
                asb_budget: r.asb_budget
             }))
          };
        }

        if (resSeg && resSeg.ok) {
          const rawSegments = await resSeg.json();
          setSegmentData({
            metadata: rawSegments?.metadata ?? { total_segments: 0, unique_roads: 0, generated_at: '' },
            segments: Array.isArray(rawSegments?.segments) ? rawSegments.segments : []
          });
        }
        
        setStatus('done');
      } catch (err) {
        console.error('[TreatmentEngine] Data load error:', err);
        setStatus('error');
      }
    }
    load();
  }, []);

  return { config, geos, dd2Data, segmentData, status };
}

// We now use mapExplorerMatching utilities instead of local normalizeRoadIdentity

// ── Roadmap step data ─────────────────────────────────────────────────────────

const NEXT_STEPS = [
  {
    step: 1,
    label: 'Ingest DD2 CSV',
    description: 'Load dd2_roads_2025_clean.csv from staging-source/dd2/processed/',
    icon: Database,
    status: 'done' as const,
  },
  {
    step: 2,
    label: 'Resolve road identity',
    description: 'Map DD2 road names to the canonical 350-road universe via nama_ruas_norm / road_key',
    icon: Route,
    status: 'done' as const,
  },
  {
    step: 3,
    label: 'Generate dd2_road_features.json',
    description: 'Produce verified runtime JSON for public/data/ after identity audit',
    icon: FileJson,
    status: 'done' as const,
  },
  {
    step: 4,
    label: 'Connect ASB price table & Rules',
    description: 'Integrate ASB unit-price reference and structural mapping rules',
    icon: DollarSign,
    status: 'done' as const,
  },
  {
    step: 5,
    label: 'Estimate Pagu Indikatif',
    description: 'Read-only ASB package selection to preview indicative budget reasonableness',
    icon: Calculator,
    status: 'done' as const,
  },
];

const STATUS_STYLES = {
  pending:     { dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500',   label: 'Pending' },
  in_progress: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600',    label: 'In Progress' },
  done:        { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: 'Done' },
};

// ── Constants & Helpers for Map Modes ──────────────────────────────────────────

type MapDisplayMode = 'threshold' | 'dominant' | 'rule';
type DominantCondition = 'Baik' | 'Sedang' | 'Rusak Ringan' | 'Rusak Berat' | 'N/A';

function getDominantCondition(r: DD2RoadFeatureWithRule): DominantCondition {
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

const DOMINANT_COLORS: Record<DominantCondition, string> = {
  'Baik': '#10b981',
  'Sedang': '#3b82f6',
  'Rusak Ringan': '#f59e0b',
  'Rusak Berat': '#ef4444',
  'N/A': '#94a3b8',
};

const RULE_CATEGORY_COLORS: Record<string, string> = {
  'Pemeliharaan Rutin': '#10b981',
  'Pemeliharaan Berkala': '#3b82f6',
  'Rehabilitasi / Rekonstruksi Indikatif': '#ea580c',
  'Kandidat Peningkatan Permukaan': '#8b5cf6',
  'Data Tidak Cukup': '#f43f5e',
};

function getDisplayRuleCategory(cat: string | undefined): string {
  if (!cat) return '—';
  if (cat === 'Rehabilitasi') return 'Rehabilitasi / Rekonstruksi Indikatif';
  return cat;
}

const SEGMENT_CONDITION_COLORS: Record<string, string> = {
  'baik': '#10b981',        
  'sedang': '#eab308',      
  'rusak_ringan': '#f97316', 
  'rusak_berat': '#ef4444',  
  'default': '#94a3b8'       
};

/**
 * Extract exact partial subset of original polyline between specific STA meter range 
 */
function projectSegment(coords: [number, number][], startM: number, endM: number, totalLengthM: number): [number, number][] {
  if (!coords || coords.length < 2 || totalLengthM <= 0) return [];
  const startFraction = Math.max(0, Math.min(1, startM / totalLengthM));
  const endFraction = Math.max(startFraction, Math.min(1, endM / totalLengthM));
  if (startFraction === endFraction) return [];

  const cumulative: number[] = [0];
  let runningDist = 0;
  for (let i = 1; i < coords.length; i++) {
    runningDist += Math.sqrt(Math.pow(coords[i][0] - coords[i-1][0], 2) + Math.pow(coords[i][1] - coords[i-1][1], 2));
    cumulative.push(runningDist);
  }
  
  const totalMapDist = runningDist;
  if (totalMapDist === 0) return coords;

  const targetStart = startFraction * totalMapDist;
  const targetEnd = endFraction * totalMapDist;
  const result: [number, number][] = [];

  // 1. Interpolate dynamic head point
  for (let i = 0; i < coords.length - 1; i++) {
    if (targetStart >= cumulative[i] && targetStart <= cumulative[i+1]) {
       const distInSeg = targetStart - cumulative[i];
       const segLen = cumulative[i+1] - cumulative[i];
       const f = segLen === 0 ? 0 : distInSeg / segLen;
       result.push([
         coords[i][0] + f * (coords[i+1][0] - coords[i][0]),
         coords[i][1] + f * (coords[i+1][1] - coords[i][1])
       ]);
       break;
    }
  }

  // 2. Attach rigid central nodes
  for (let i = 0; i < coords.length; i++) {
    if (cumulative[i] > targetStart && cumulative[i] < targetEnd) {
      result.push(coords[i]);
    }
  }

  // 3. Interpolate dynamic tail point
  for (let i = 0; i < coords.length - 1; i++) {
    if (targetEnd >= cumulative[i] && targetEnd <= cumulative[i+1]) {
       const distInSeg = targetEnd - cumulative[i];
       const segLen = cumulative[i+1] - cumulative[i];
       const f = segLen === 0 ? 0 : distInSeg / segLen;
       result.push([
         coords[i][0] + f * (coords[i+1][0] - coords[i][0]),
         coords[i][1] + f * (coords[i+1][1] - coords[i][1])
       ]);
       break;
    }
  }
  
  return result;
}

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
  'Jl. Badaun - Ds. Bajayau Lama': 'Badaun - Ds. Bjayau Lama',
  'Simp. Bakarung Selatan - Sungai Kudung': 'Sp. Bakarung Selatan - Sungai Kudung',
  'Simpang Jadi Makmur Ds. Samuda': 'Simpang Jadi Makmur - Ds. Samuda'
};

// Helper component to adjust map viewport to selected geometry
function MapAutoFitter({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      map.fitBounds(coords as any, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [coords, map]);
  return null;
}

// ── Page component ────────────────────────────────────────────────────────────

export function TreatmentEnginePage() {
  const { config, geos, dd2Data, segmentData, status: mapStatus } = useTreatmentData();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSegments, setShowSegments] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Map Display Mode State
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>('threshold');

  // Condition Highlighting State
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [highlightField, setHighlightField] = useState<keyof DD2RoadFeatureWithRule>('non_mantap_pct');
  const [highlightThreshold, setHighlightThreshold] = useState(30);
  const [highlightOperator, setHighlightOperator] = useState<'>=' | '<='>('>=');

  // Dominant Condition Counts
  const dominantCounts = useMemo(() => {
    const counts = { 'Baik': 0, 'Sedang': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0, 'N/A': 0 };
    if (!dd2Data) return counts;
    for (const r of dd2Data.roads) {
       const dom = getDominantCondition(r);
       counts[dom]++;
    }
    return counts;
  }, [dd2Data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Find map selection
  const selectedGeo = geos.find(
    (g) => `te-${g.legacy_ref ?? g.road_id ?? g.road_name}` === selectedKey,
  );

  // Build DD2 lookup map — indexed by BOTH the DD2 native road_key
  // AND the Map Explorer–derived key from canonical_road_name.
  // This bridges the sungai→sei normalization gap in the DD2 pipeline.
  const dd2Map = useMemo(() => {
    const map = new Map<string, DD2RoadFeatureWithRule[]>();
    if (!dd2Data) return map;
    for (const r of dd2Data.roads) {
      // Primary key: DD2's own road_key (may use "sei" abbreviation)
      const k = r.road_key;
      const bucket = map.get(k) || [];
      bucket.push(r);
      map.set(k, bucket);

      // Secondary key: derived from canonical_road_name via Map Explorer normalizer
      // This produces the key the popup resolver will look up (uses full "sungai")
      const mapKey = getMapExplorerRoadKey(r.canonical_road_name);
      if (mapKey && mapKey !== k) {
        const altBucket = map.get(mapKey) || [];
        altBucket.push(r);
        map.set(mapKey, altBucket);
      }

      // Tertiary key: Map Explorer-derived key from raw_dd2_name
      const rawKey = getMapExplorerRoadKey(r.dd2_road_name_raw);
      if (rawKey && rawKey !== k && rawKey !== mapKey) {
        const rawBucket = map.get(rawKey) || [];
        rawBucket.push(r);
        map.set(rawKey, rawBucket);
      }
    }
    return map;
  }, [dd2Data]);

  // Central resolver for Geo -> DD2 Road mapping
  const resolveGeoToFeature = useCallback((geo: GeoRoad) => {
    if (!dd2Data) return null;
    const directKey = getMapExplorerRoadKey(geo.road_name);
    const refAliasCandidate = getMapExplorerRefAliasCandidate(geo.legacy_ref, geo.road_name);
    const aliasCandidate = getMapExplorerAliasCandidate(geo.road_name);
    const matchedNameKey = geo.matched_name ? getMapExplorerRoadKey(geo.matched_name) : null;

    const resolve = (key: string | null) => {
      if (!key) return null;
      const bucket = dd2Map.get(key) || [];
      return bucket.length === 1 ? bucket[0] : null;
    };

    let feature = null;
    if (refAliasCandidate?.key) {
      feature = resolve(refAliasCandidate.key);
      if (feature) return { feature, method: refAliasCandidate.method, diagKey: refAliasCandidate.key };
    }
    if (aliasCandidate?.key) {
      feature = resolve(aliasCandidate.key);
      if (feature) return { feature, method: aliasCandidate.method, diagKey: aliasCandidate.key };
    }
    feature = resolve(directKey);
    if (feature) return { feature, method: 'direct', diagKey: directKey };

    const teAliasTarget = TE_DD2_LOCAL_ALIASES[geo.road_name];
    if (teAliasTarget) {
      const teAliasKey = getMapExplorerRoadKey(teAliasTarget);
      feature = resolve(teAliasKey);
      if (feature) return { feature, method: 'te_local_alias', diagKey: teAliasKey };
    }
    if (matchedNameKey) {
      feature = resolve(matchedNameKey);
      if (feature) return { feature, method: 'matched_name', diagKey: matchedNameKey };
    }
    return { feature: null, method: 'unmatched', diagKey: directKey };
  }, [dd2Data, dd2Map]);

  // Find matching DD2 feature for selected map road
  const { selectedDd2Feature, matchMethod, diagnosticKey } = useMemo(() => {
    if (!selectedGeo) return { selectedDd2Feature: null, matchMethod: 'unmatched', diagnosticKey: '' };
    const res = resolveGeoToFeature(selectedGeo);
    return { 
      selectedDd2Feature: res?.feature ?? null, 
      matchMethod: res?.method ?? 'unmatched', 
      diagnosticKey: res?.diagKey ?? '' 
    };
  }, [selectedGeo, resolveGeoToFeature]);

  // Reverse Mapping for Table -> Map lookups
  const roadKeyToGeoKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!dd2Data || !geos.length) return map;
    geos.forEach(geo => {
       const res = resolveGeoToFeature(geo);
       if (res && res.feature) {
         const lookupKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}`;
         map.set(res.feature.road_key, lookupKey);
       }
    });
    return map;
  }, [dd2Data, geos, resolveGeoToFeature]);

  // Lookup segments by key
  const segmentsByRoadKey = useMemo(() => {
     const m = new Map<string, DD2DamageSegment[]>();
     if (!segmentData) return m;
     segmentData.segments.forEach(s => {
        const list = m.get(s.road_key) || [];
        list.push(s);
        m.set(s.road_key, list);
     });
     return m;
  }, [segmentData]);

  // Compute summary metrics for currently selected road's segments
  const selectedSegmentSummary = useMemo(() => {
    if (!selectedDd2Feature) return null;
    const segments = segmentsByRoadKey.get(selectedDd2Feature.road_key) || [];
    if (segments.length === 0) return null;

    let totalLenM = 0;
    let lenBaik = 0, lenSedang = 0, lenRingan = 0, lenBerat = 0, lenUnknown = 0;
    const treatmentCounts = new Map<string, number>();
    const surfaceCounts = new Map<string, number>();

    // Sequence them by ascending chainage for intuitive left-to-right visualization
    const sortedSegments = [...segments].sort((a, b) => a.sta_start_m - b.sta_start_m);

    sortedSegments.forEach(seg => {
       const l = seg.panjang_m || (seg.sta_end_m - seg.sta_start_m);
       totalLenM += l;

       const cond = (seg.dominant_condition || '').toLowerCase();
       if (cond.includes('baik')) lenBaik += l;
       else if (cond.includes('sedang')) lenSedang += l;
       else if (cond.includes('ringan')) lenRingan += l;
       else if (cond.includes('berat')) lenBerat += l;
       else lenUnknown += l;

       const treat = seg.jenis_penanganan_norm || 'N/A';
       treatmentCounts.set(treat, (treatmentCounts.get(treat) || 0) + l);

       const surf = seg.surface_label || 'N/A';
       surfaceCounts.set(surf, (surfaceCounts.get(surf) || 0) + l);
    });

    const nonMantapM = lenRingan + lenBerat;
    const nonMantapPct = totalLenM > 0 ? (nonMantapM / totalLenM) * 100 : 0;

    // Resolve dominant condition by cumulative spatial magnitude
    const conditionPool = [
       { label: 'Baik', len: lenBaik },
       { label: 'Sedang', len: lenSedang },
       { label: 'Rusak Ringan', len: lenRingan },
       { label: 'Rusak Berat', len: lenBerat }
    ];
    conditionPool.sort((a,b) => b.len - a.len);
    const dominantCondition = conditionPool[0].len > 0 ? conditionPool[0].label : 'N/A';

    // Top distribution indicators
    let topTreatment = 'N/A';
    let topTreatLen = 0;
    treatmentCounts.forEach((len, name) => {
       if (len > topTreatLen) {
          topTreatLen = len;
          topTreatment = name;
       }
    });

    let topSurface = 'N/A';
    let topSurfLen = 0;
    surfaceCounts.forEach((len, name) => {
       if (len > topSurfLen) {
          topSurfLen = len;
          topSurface = name;
       }
    });

    return {
       segments: sortedSegments,
       count: segments.length,
       totalLenM,
       lenBaik,
       lenSedang,
       lenRingan,
       lenBerat,
       lenUnknown,
       nonMantapM,
       nonMantapPct,
       dominantCondition,
       topTreatment,
       topSurface
    };
  }, [selectedDd2Feature, segmentsByRoadKey]);

  // Verified Segment diagnostic telemetry — synchronous simulation logic
  const segmentDiagStats = useMemo(() => {
     if (!segmentData || !geos.length) return null;

     const roadGeometriesMap = new Map<string, [number, number][]>();
     const roadKeysWithGeo = new Set<string>();
     
     geos.forEach(geo => {
        const res = resolveGeoToFeature(geo);
        if (res && res.feature) {
           const key = res.feature.road_key;
           roadKeysWithGeo.add(key);
           roadGeometriesMap.set(key, geo.coordinates);
        }
     });

     let totalRowsLoaded = segmentData.segments.length;
     let segmentsLinkedToGeometry = 0;
     let segmentsProjectable = 0;
     let segmentsProjectionFailed = 0;
     
     // Find maximum STA references per road just as the renderer does
     const roadMaxSta = new Map<string, number>();
     segmentData.segments.forEach(s => {
        const cur = roadMaxSta.get(s.road_key) || 0;
        if (s.sta_end_m > cur) roadMaxSta.set(s.road_key, s.sta_end_m);
     });

     // Dry-run simulate the projection logic per loaded segment record
     segmentData.segments.forEach(seg => {
        const coords = roadGeometriesMap.get(seg.road_key);
        if (!coords) return; // Orphaned segment missing geometry container
        
        segmentsLinkedToGeometry++;
        
        const totalLen = roadMaxSta.get(seg.road_key) || seg.sta_end_m;
        const proj = projectSegment(coords, seg.sta_start_m, seg.sta_end_m, totalLen);
        
        if (proj.length >= 2) {
           segmentsProjectable++;
        } else {
           segmentsProjectionFailed++;
        }
     });

     return {
        totalRowsLoaded,
        uniqueRoadsRepresented: segmentData.metadata.unique_roads,
        roadsMatchedToGeometries: roadKeysWithGeo.size,
        segmentsLinkedToGeometry,
        segmentsProjectable,
        segmentsProjectionFailed,
        skippedDueToMissingGeo: totalRowsLoaded - segmentsLinkedToGeometry
     };
  }, [segmentData, geos, resolveGeoToFeature]);

  // Transparent secondary export hook to preserve console window visibility
  useEffect(() => {
     if (segmentDiagStats) {
        (window as any).__TREATMENT_SEGMENT_LAYER_DIAGNOSTICS__ = {
           ...segmentDiagStats,
           diagnosticTime: new Date().toISOString()
        };
     }
  }, [segmentDiagStats]);

  // Filtered table data
  const filteredTableData = useMemo(() => {
    if (!dd2Data) return [];
    if (!searchTerm) return dd2Data.roads;
    const term = (searchTerm || '').toLowerCase();
    return dd2Data.roads.filter(r => 
      (r.canonical_road_name || '').toLowerCase().includes(term) ||
      (r.dd2_road_name_raw || '').toLowerCase().includes(term) ||
      ((r.kecamatan_dilalui || '').toLowerCase().includes(term))
    );
  }, [dd2Data, searchTerm]);

  // Paginated data
  const paginatedTableData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTableData.slice(start, start + pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  // Automatic Paging Sync: when map selects a road, scroll table to the correct page
  useEffect(() => {
    if (!selectedDd2Feature || !filteredTableData.length) return;
    const idx = filteredTableData.findIndex(r => r.road_key === selectedDd2Feature.road_key);
    if (idx >= 0) {
       const targetPage = Math.floor(idx / pageSize) + 1;
       if (targetPage !== currentPage) {
         setCurrentPage(targetPage);
       }
    }
  }, [selectedDd2Feature, filteredTableData, pageSize]);

  const isSelectedRoadFilteredOut = useMemo(() => {
    if (!selectedDd2Feature || !searchTerm) return false;
    return !filteredTableData.some(r => r.road_key === selectedDd2Feature.road_key);
  }, [selectedDd2Feature, filteredTableData, searchTerm]);

  // Map Highlight Logic
  const highlightedRoadKeys = useMemo(() => {
    if (!highlightEnabled || !dd2Data) return new Set<string>();
    
    const highlighted = new Set<string>();
    for (const road of dd2Data.roads) {
      const val = road[highlightField] as number | null;
      if (val === null || val === undefined) continue;
      
      const passes = highlightOperator === '>=' ? val >= highlightThreshold : val <= highlightThreshold;
      if (passes) {
        highlighted.add(road.road_key);
      }
    }
    return highlighted;
  }, [highlightEnabled, dd2Data, highlightField, highlightThreshold, highlightOperator]);

  // Derived percentages
  const highlightStats = useMemo(() => {
    if (!dd2Data) return { count: 0, pct: 0 };
    const count = highlightedRoadKeys.size;
    const total = dd2Data.roads.length;
    return {
      count,
      pct: total > 0 ? (count / total) * 100 : 0
    };
  }, [highlightedRoadKeys, dd2Data]);

  return (
    <div id="treatment-engine-page" className="space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-100/40 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-violet-100/40 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">Treatment Engine</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Rule-based treatment indication and indicative budgeting from DD2&nbsp;/&nbsp;ASB.
              This module will apply road-condition rules from FormDD data to recommend
              treatment types and estimate budget allocations using ASB unit prices.
            </p>
          </div>
        </div>
      </div>

      {/* ── Data provenance & Identity Status ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-800">Data Provenance</h3>
          </div>
          <div className="grid gap-px bg-slate-100 grid-rows-3 flex-1">
            {[
              { label: 'Raw Source',        value: 'FormDD1-2025.xlsx', sub: 'staging-source/dd2/raw/',       icon: Database,    color: 'text-blue-600 bg-blue-50' },
              { label: 'Processed Staging', value: '2 CSV files',       sub: 'staging-source/dd2/processed/', icon: FileJson,    color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Extraction Audit',  value: '350 rows confirmed', sub: 'staging-source/dd2/audit/',    icon: CheckCircle, color: 'text-violet-600 bg-violet-50' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 bg-white px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{item.value}</p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-800">DD2 Identity Audit Status</h3>
            {dd2Data && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle className="h-3 w-3" />
                Clean Audit
              </span>
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center">
            {dd2Data ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DD2 Roads Loaded</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.total_records}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Identity Matched</p>
                  <p className="mt-1 text-3xl font-bold text-emerald-700">{dd2Data._metadata.matched}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unmatched</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.unmatched}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ambiguous</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.ambiguous}</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">Loading identity summary...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Rule v0.1 Indicative Classification ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Rule v0.1 Indicative Classification</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
            Read-Only Preview
          </span>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
           <p className="text-xs text-slate-500 flex items-center gap-2">
             <Info className="h-4 w-4 shrink-0 text-slate-400" />
             Rule v0.1 bersifat indikatif berbasis agregasi DD2 per ruas. PKRMS resmi menggunakan Treatment Trigger Index (TTI) per segmen survei untuk menentukan kebutuhan penanganan.
           </p>
        </div>
        {dd2Data?.ruleStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-slate-100">
             <div className="p-4 text-center bg-slate-50">
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evaluated</p>
               <p className="mt-1 text-2xl font-black text-slate-800">{dd2Data.ruleStats.totalEvaluated}</p>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Rutin</p>
               <p className="mt-1 text-2xl font-black text-emerald-700">{dd2Data.ruleStats.rutin}</p>
               <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                 <div className="h-full bg-emerald-500" style={{ width: `${(dd2Data.ruleStats.rutin / dd2Data.ruleStats.totalEvaluated) * 100}%` }} />
               </div>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Berkala</p>
               <p className="mt-1 text-2xl font-black text-blue-700">{dd2Data.ruleStats.berkala}</p>
               <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                 <div className="h-full bg-blue-500" style={{ width: `${(dd2Data.ruleStats.berkala / dd2Data.ruleStats.totalEvaluated) * 100}%` }} />
               </div>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Rehabilitasi / Rekonstruksi</p>
               <p className="mt-1 text-2xl font-black text-orange-700">
                 {(dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0)}
               </p>
               <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                 <div className="h-full bg-orange-500" style={{ width: `${(((dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0)) / dd2Data.ruleStats.totalEvaluated) * 100}%` }} />
               </div>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Peningkatan Permukaan</p>
               <p className="mt-1 text-2xl font-black text-purple-700">{dd2Data.ruleStats.peningkatan}</p>
               <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                 <div className="h-full bg-purple-500" style={{ width: `${(dd2Data.ruleStats.peningkatan / dd2Data.ruleStats.totalEvaluated) * 100}%` }} />
               </div>
             </div>
             <div className="p-4 text-center bg-rose-50">
               <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Tidak Cukup</p>
               <p className="mt-1 text-2xl font-black text-rose-600">{dd2Data.ruleStats.insufficientData}</p>
               <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-rose-100/50 overflow-hidden">
                 <div className="h-full bg-rose-500" style={{ width: `${(dd2Data.ruleStats.insufficientData / dd2Data.ruleStats.totalEvaluated) * 100}%` }} />
               </div>
             </div>
          </div>
        )}
      </div>
      
      {/* ── ASB Budget Estimator Overview ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <DollarSign className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Estimasi Kewajaran Anggaran (ASB)</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
            Read-Only Preview
          </span>
        </div>
        {dd2Data?.asbStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-100">
             <div className="p-4 text-center bg-slate-50">
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Roads Estimated</p>
               <p className="mt-1 text-2xl font-black text-slate-800">{dd2Data.asbStats.estimatedRoads}</p>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mantap (No Major Pkg)</p>
               <p className="mt-1 text-2xl font-black text-slate-600">{dd2Data.asbStats.noMajorPackage}</p>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Flags / Manual Review</p>
               <p className="mt-1 text-2xl font-black text-amber-600">{dd2Data.asbStats.manualReviewRequired}</p>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">ASB Items Loaded</p>
               <p className="mt-1 text-xl font-bold text-indigo-600">{dd2Data.asbStats.totalItemsLoaded}</p>
             </div>
             <div className="p-4 text-center">
               <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Rules Loaded</p>
               <p className="mt-1 text-xl font-bold text-indigo-600">{dd2Data.asbStats.totalRulesLoaded}</p>
             </div>
          </div>
        )}
      </div>

      {/* ── Spatial Treatment Context ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <MapIcon className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Spatial Treatment Context</h3>
          </div>
          {/* Status chip */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            DD2 Verified Data Loaded
          </span>
        </div>

        {/* Map Control Toolbar — Primary Row */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap items-center gap-4">
           {/* Mode Selector */}
           <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">View Mode:</label>
              <select
                 value={displayMode}
                 onChange={(e) => setDisplayMode(e.target.value as MapDisplayMode)}
                 className="text-xs font-bold border border-slate-200 rounded-md bg-white py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 text-slate-700"
              >
                 <option value="threshold">Threshold Highlight</option>
                 <option value="dominant">Dominant Condition</option>
                 <option value="rule">Rule v0.1 Category</option>
              </select>
           </div>

           {/* Segment Layer Toggle */}
           <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={showSegments} 
                   onChange={(e) => setShowSegments(e.target.checked)}
                   className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                   disabled={!segmentData}
                 />
                 Show Segment Damage
              </label>
           </div>

           {displayMode !== 'threshold' && dd2Data && (
              <div className="ml-auto flex items-center gap-2 text-xs">
                 <span className="font-semibold text-slate-700">{dd2Data.roads.length}</span>
                 <span className="text-slate-500">roads classified</span>
              </div>
           )}
        </div>

        {/* Map Control Toolbar — Secondary Row (Conditional Context) */}
        {displayMode === 'threshold' && (
           <div className="border-b border-slate-100 bg-white px-5 py-2.5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                 <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={highlightEnabled} 
                      onChange={(e) => setHighlightEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Condition Highlight
                 </label>
              </div>
              
              <div className={`flex items-center gap-3 transition-opacity ${highlightEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <select 
                   value={highlightField} 
                   onChange={(e) => setHighlightField(e.target.value as any)}
                   className="text-xs border border-slate-200 rounded-md bg-white py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500"
                >
                   <option value="non_mantap_pct">Non-Mantap %</option>
                   <option value="kondisi_rusak_berat_pct">Rusak Berat %</option>
                   <option value="kondisi_rusak_ringan_pct">Rusak Ringan %</option>
                   <option value="kondisi_sedang_pct">Sedang %</option>
                   <option value="kondisi_baik_pct">Baik %</option>
                </select>
                
                <select
                   value={highlightOperator}
                   onChange={(e) => setHighlightOperator(e.target.value as any)}
                   className="text-xs border border-slate-200 rounded-md bg-white py-1 px-2 focus:ring-1 focus:ring-indigo-500"
                >
                   <option value=">=">&ge;</option>
                   <option value="<=">&le;</option>
                </select>

                <div className="flex items-center gap-1">
                   <input
                     type="number"
                     value={highlightThreshold}
                     onChange={(e) => setHighlightThreshold(Number(e.target.value))}
                     className="w-16 text-xs border border-slate-200 rounded-md bg-white py-1 px-2 text-center focus:ring-1 focus:ring-indigo-500"
                   />
                   <span className="text-xs text-slate-500">%</span>
                </div>
              </div>

              {highlightEnabled && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                   <span className="font-semibold text-red-500">{highlightStats.count}</span>
                   <span className="text-slate-500">roads highlighted</span>
                   <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                     {highlightStats.pct.toFixed(1)}%
                   </span>
                </div>
              )}
           </div>
        )}

                 {/* Diagnostics summary for segments if enabled */}
         {showSegments && segmentDiagStats && (
            <div className="border-b border-slate-100 bg-indigo-50/30 px-5 py-2 flex flex-wrap items-center gap-y-1 gap-x-3.5 text-[10px]">
               <div className="flex items-center gap-1 font-medium text-slate-500">
                  <Database className="h-3 w-3 text-indigo-400" />
                  Loaded: <span className="text-slate-700 font-bold">{segmentDiagStats.totalRowsLoaded}</span>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Roads: <strong className="text-emerald-600">{segmentDiagStats.roadsMatchedToGeometries}/{segmentDiagStats.uniqueRoadsRepresented}</strong>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Linked: <strong className="text-indigo-600">{segmentDiagStats.segmentsLinkedToGeometry}</strong>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Projected: <strong className="text-indigo-700">{segmentDiagStats.segmentsProjectable}</strong>
               </div>
               {segmentDiagStats.segmentsProjectionFailed > 0 && (
                  <>
                     <div className="h-3 w-px bg-slate-200" />
                     <div className="flex items-center gap-1 text-red-600 font-medium">
                        Failed: {segmentDiagStats.segmentsProjectionFailed}
                     </div>
                  </>
               )}
               {segmentDiagStats.skippedDueToMissingGeo > 0 && (
                  <>
                     <div className="h-3 w-px bg-slate-200" />
                     <div className="flex items-center gap-1 text-amber-600">
                        No Geo: {segmentDiagStats.skippedDueToMissingGeo}
                     </div>
                  </>
               )}
            </div>
         )}

        {/* Explanatory note */}
        <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            {showSegments 
               ? "Segment damage view enabled. Road geometries are projected using fractional STA positions from source DD2 data."
               : "This map displays road geometries and their loaded DD2 attributes. Treatment logic and ASB costing will be implemented in subsequent phases."
            }
          </p>
        </div>

        {/* Map area */}
        <div className="relative h-[480px] lg:h-[560px]">
          {/* Loading overlay */}
          {mapStatus === 'loading' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-xs font-medium text-slate-500">Loading map data...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {mapStatus === 'error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
                <p className="mt-2 text-xs font-medium text-slate-500">Failed to load map data</p>
              </div>
            </div>
          )}

          {/* Leaflet map — shown only when data is ready */}
          {mapStatus === 'done' && config && (
            <MapContainer
              center={config.center}
              zoom={config.zoom}
              minZoom={config.minZoom}
              maxZoom={config.maxZoom}
              zoomControl={config.showZoomControl ?? true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Sync view to selected object */}
              <MapAutoFitter coords={selectedGeo?.coordinates || null} />

              {/* 350 road geometries */}
              {geos.map((geo, idx) => {
                const layerKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}-${idx}`;
                const lookupKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}`;
                const isSelected = selectedKey === lookupKey;

                // Use DRY central resolver
                const resolution = resolveGeoToFeature(geo);
                const f = resolution?.feature ?? null;

                // Styling logic
                let color = '#6366f1';
                let weight = 3;
                let opacity = 0.65;

                if (isSelected) {
                   color = '#f59e0b';
                   weight = 7;
                   opacity = 1;
                } else if (displayMode === 'threshold') {
                   if (highlightEnabled && f && highlightedRoadKeys.has(f.road_key)) {
                      color = '#ef4444'; 
                      weight = 5;
                      opacity = 0.9;
                   } else if (highlightEnabled) {
                      color = '#cbd5e1'; 
                      weight = 2;
                      opacity = 0.3;
                   }
                } else if (displayMode === 'dominant') {
                   if (f) {
                      const dom = getDominantCondition(f);
                      color = DOMINANT_COLORS[dom];
                      weight = 3.5;
                      opacity = 0.85;
                   } else {
                      color = '#e2e8f0';
                      weight = 1.5;
                      opacity = 0.3;
                   }
                } else if (displayMode === 'rule') {
                   if (f) {
                      const cat = getDisplayRuleCategory(f.rule_v1.treatment_category);
                      color = RULE_CATEGORY_COLORS[cat] || '#cbd5e1';
                      weight = 3.5;
                      opacity = 0.85;
                   } else {
                      color = '#e2e8f0';
                      weight = 1.5;
                      opacity = 0.3;
                   }
                }

                const isHighlighted = highlightEnabled && f && highlightedRoadKeys.has(f.road_key);
                const roadSegments = showSegments && f ? (segmentsByRoadKey.get(f.road_key) || []) : [];
                const totalLenM = roadSegments.length > 0 
                   ? Math.max(...roadSegments.map(s => s.sta_end_m)) 
                   : (f ? (f.panjang_ruas_km || 0) * 1000 : 0);

                 return (
                   <Fragment key={layerKey}>
                     {/* Underlying Baseline */}
                     <Polyline
                       positions={geo.coordinates as any}
                       pathOptions={{ 
                          color: showSegments ? '#cbd5e1' : color, 
                          weight: showSegments ? 2 : weight, 
                          opacity: showSegments ? 0.35 : opacity 
                       }}
                       eventHandlers={{
                         click: () => setSelectedKey(isSelected ? null : lookupKey),
                       }}
                     >
                       {!showSegments && (
                          <Tooltip sticky>
                            <span className="font-mono text-[11px] font-bold text-slate-700 block">
                              {geo.road_name}
                              {geo.legacy_ref && (
                                <span className="ml-1 font-normal text-slate-400">
                                  [{geo.legacy_ref}]
                                </span>
                              )}
                            </span>
                            {f && (
                              <span className="block mt-1 text-[10px] font-medium text-indigo-600">
                                {getDisplayRuleCategory(f.rule_v1.treatment_category)}
                              </span>
                            )}
                            {highlightEnabled && f && (
                               <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                  <span className="block text-[9px] text-slate-500 mb-0.5">
                                    {highlightField}: <strong className="text-slate-700">{(f[highlightField] as number) ?? 'N/A'}%</strong>
                                  </span>
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${isHighlighted ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {isHighlighted ? 'PASSES THRESHOLD' : 'DOES NOT PASS'}
                                  </span>
                               </div>
                            )}
                          </Tooltip>
                       )}
                     </Polyline>

                     {/* Projected Overlay Segments */}
                     {showSegments && roadSegments.map((seg, sIdx) => {
                        const sCoords = projectSegment(geo.coordinates, seg.sta_start_m, seg.sta_end_m, totalLenM);
                        if (sCoords.length < 2) return null;

                        const normalized = (seg.dominant_condition || '').toLowerCase().replace(/\s+/g, '_');
                        const sColor = SEGMENT_CONDITION_COLORS[normalized] || SEGMENT_CONDITION_COLORS['default'];
                        
                        // Visual tuning
                        const sWeight = isSelected ? 7 : 4.5;
                        const sOpacity = isSelected ? 1 : 0.9;

                        return (
                           <Polyline
                              key={`${layerKey}-seg-${sIdx}`}
                              positions={sCoords as any}
                              pathOptions={{ color: sColor, weight: sWeight, opacity: sOpacity }}
                              eventHandlers={{
                                 click: () => setSelectedKey(isSelected ? null : lookupKey),
                              }}
                           >
                              <Tooltip sticky>
                                 <div className="flex flex-col gap-0.5 text-[10px]">
                                    <span className="font-bold text-slate-700">{geo.road_name}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">STA {seg.sta_start_m} - {seg.sta_end_m}</span>
                                    <span className="mt-0.5 font-bold text-indigo-600 uppercase">{seg.dominant_condition}</span>
                                 </div>
                              </Tooltip>
                              <Popup>
                                 <div className="w-56 text-[11px]">
                                    <div className="mb-1.5 pb-1 border-b border-slate-100">
                                       <h5 className="font-black uppercase tracking-wider text-slate-400 text-[9px]">Segment Details</h5>
                                       <p className="font-bold leading-tight mt-0.5">{seg.canonical_road_name || geo.road_name}</p>
                                       <p className="text-[9px] font-mono text-slate-500">Raw: {seg.raw_road_name}</p>
                                    </div>
                                    <div className="space-y-1 text-slate-600">
                                       <div className="flex justify-between"><span className="font-medium">Stationing:</span> <span className="font-mono font-semibold">KM {seg.sta_start_m/1000} - {seg.sta_end_m/1000}</span></div>
                                       <div className="flex justify-between"><span>Panjang:</span> <strong>{seg.panjang_m} m</strong></div>
                                       <div className="flex justify-between"><span>Lebar:</span> <strong>{seg.lebar_m} m</strong></div>
                                       <div className="flex justify-between"><span>Kondisi:</span> <strong style={{ color: sColor }} className="uppercase">{seg.dominant_condition}</strong></div>
                                       <div className="flex justify-between"><span>Status:</span> <strong>{seg.segment_status}</strong></div>
                                       <div className="flex justify-between"><span>Treatment:</span> <strong>{seg.jenis_penanganan_norm}</strong></div>
                                       <div className="flex justify-between"><span>Surface:</span> <strong>{seg.surface_label}</strong></div>
                                       <div className="flex justify-between"><span>Thn Survei:</span> <strong>{seg.tahun_survei}</strong></div>
                                    </div>
                                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-center gap-1 text-[8px] text-slate-400 italic leading-tight">
                                       <Info className="h-2.5 w-2.5 shrink-0" />
                                       Segment projected via STA proportion along road polyline.
                                    </div>
                                 </div>
                              </Popup>
                           </Polyline>
                        );
                     })}
                   </Fragment>
                 );
              })}
            </MapContainer>
          )}

          {/* Road detail popup */}
          {selectedGeo && (
            <div className="absolute right-3 top-3 z-[1000] w-80 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 p-3.5">
                <div className="pr-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Road Segment
                  </p>
                  <h4 className="mt-0.5 text-sm font-bold leading-snug text-slate-800">
                    {selectedGeo.road_name}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedKey(null)}
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Fields */}
              <div className="max-h-96 overflow-y-auto p-3.5 space-y-3">
                {selectedDd2Feature ? (
                  <>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                        Canonical Match
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                        {selectedDd2Feature.canonical_road_name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-emerald-600">
                        Key: {selectedDd2Feature.road_key}
                      </p>
                    </div>

                    {/* DD2 treatment status */}
                <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 text-indigo-500" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">
                      Rule v0.1 Category
                    </p>
                  </div>
                  <p className="text-xs font-bold text-indigo-900">
                    {getDisplayRuleCategory(selectedDd2Feature.rule_v1.treatment_category)}
                  </p>
                  <p className="text-[10px] leading-relaxed text-indigo-700/80 italic">
                    "{selectedDd2Feature.rule_v1.rule_reason}"
                  </p>
                  <div className="mt-1 flex gap-1.5">
                     <span className="text-[9px] font-mono font-medium rounded border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-indigo-600">
                        Confidence: {selectedDd2Feature.rule_v1.rule_confidence}
                     </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Length</p>
                        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                          {selectedDd2Feature.panjang_ruas_km !== null ? `${selectedDd2Feature.panjang_ruas_km} km` : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Width</p>
                        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                          {selectedDd2Feature.lebar_ruas_m !== null ? `${selectedDd2Feature.lebar_ruas_m} m` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Surface Condition</p>
                        <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                          Dom: {getDominantCondition(selectedDd2Feature)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Baik</span>
                          <span className="font-mono text-[10px] font-medium text-emerald-600">
                            {selectedDd2Feature.kondisi_baik_pct !== null ? `${selectedDd2Feature.kondisi_baik_pct}%` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Sedang</span>
                          <span className="font-mono text-[10px] font-medium text-blue-600">
                            {selectedDd2Feature.kondisi_sedang_pct !== null ? `${selectedDd2Feature.kondisi_sedang_pct}%` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Rusak Ringan</span>
                          <span className="font-mono text-[10px] font-medium text-amber-600">
                            {selectedDd2Feature.kondisi_rusak_ringan_pct !== null ? `${selectedDd2Feature.kondisi_rusak_ringan_pct}%` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Rusak Berat</span>
                          <span className="font-mono text-[10px] font-medium text-red-600">
                            {selectedDd2Feature.kondisi_rusak_berat_pct !== null ? `${selectedDd2Feature.kondisi_rusak_berat_pct}%` : '—'}
                          </span>
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-600">Non-Mantap</span>
                          <span className="font-mono text-[11px] font-bold text-amber-600">
                            {selectedDd2Feature.non_mantap_pct !== null ? `${selectedDd2Feature.non_mantap_pct}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Segment Strip Visualization Section */}
                    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
                       <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-100">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Segment Profile</p>
                          {selectedSegmentSummary ? (
                             <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {selectedSegmentSummary.count} Segments
                             </span>
                          ) : null}
                       </div>

                       <div className="p-3 space-y-3">
                          {!selectedSegmentSummary ? (
                             <div className="py-2 flex items-center gap-2 text-slate-400">
                                <Info className="h-3.5 w-3.5" />
                                <span className="text-[10px] italic font-medium">No segment-level DD2 data available for this road.</span>
                             </div>
                          ) : (
                             <>
                                {/* Proportional Strip */}
                                <div className="flex h-4 w-full rounded-md overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
                                   {selectedSegmentSummary.segments.map((seg, idx) => {
                                      const wPct = ( (seg.panjang_m || (seg.sta_end_m - seg.sta_start_m)) / selectedSegmentSummary.totalLenM) * 100;
                                      const cond = (seg.dominant_condition || '').toLowerCase();
                                      
                                      const baseColor = cond.includes('baik') ? '#10b981' :
                                                        cond.includes('sedang') ? '#3b82f6' :
                                                        cond.includes('ringan') ? '#f59e0b' :
                                                        cond.includes('berat') ? '#ef4444' : '#94a3b8';

                                      return (
                                         <div 
                                            key={idx}
                                            style={{ width: `${wPct}%`, backgroundColor: baseColor }}
                                            className="h-full border-r border-white/20 last:border-r-0 transition-opacity hover:opacity-80 cursor-help"
                                            title={`STA ${seg.sta_start_m}-${seg.sta_end_m} | ${seg.dominant_condition} | ${seg.panjang_m}m | ${seg.jenis_penanganan_norm || ''}`}
                                         />
                                      );
                                   })}
                                </div>

                                {/* Mini Legend Row */}
                                <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase px-0.5">
                                   <div className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" /> B</div>
                                   <div className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" /> S</div>
                                   <div className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> RR</div>
                                   <div className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /> RB</div>
                                </div>

                                {/* Comparison Statistics */}
                                <div className="space-y-2 text-[10px] pt-1 border-t border-slate-100 mt-1">
                                   <div className="flex justify-between text-slate-500 font-medium">
                                      <span>Segmented Length:</span>
                                      <span className="text-slate-800 font-mono">{(selectedSegmentSummary.totalLenM / 1000).toFixed(3)} km</span>
                                   </div>
                                   
                                   <div className="pt-1.5 border-t border-dashed border-slate-200">
                                      <div className="flex justify-between items-center">
                                         <span className="text-slate-500">Derived Non-Mantap:</span>
                                         <span className="font-mono font-bold text-indigo-700">{selectedSegmentSummary.nonMantapPct.toFixed(1)}%</span>
                                      </div>
                                      
                                      {/* Comparison logic */}
                                      {selectedDd2Feature.non_mantap_pct !== null && (
                                         <div className="mt-1 flex items-center justify-between rounded bg-slate-50 px-2 py-1 border border-slate-100/50">
                                            <span className="text-[9px] text-slate-400">vs Agg ({selectedDd2Feature.non_mantap_pct}%)</span>
                                            {(() => {
                                               const diff = Math.abs(selectedSegmentSummary.nonMantapPct - selectedDd2Feature.non_mantap_pct);
                                               const isAligned = diff <= 5;
                                               return (
                                                  <span className={`flex items-center gap-0.5 text-[9px] font-bold uppercase ${isAligned ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                     {isAligned ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                                     {isAligned ? 'Aligned' : `Check ${diff.toFixed(1)}%`}
                                                  </span>
                                               );
                                            })()}
                                         </div>
                                      )}
                                   </div>
                                   
                                   <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                                      <div>
                                         <p className="text-slate-400">Top Surface</p>
                                         <p className="font-bold truncate text-slate-700 leading-tight" title={selectedSegmentSummary.topSurface}>{selectedSegmentSummary.topSurface}</p>
                                      </div>
                                      <div>
                                         <p className="text-slate-400">Primary Treatment</p>
                                         <p className="font-bold truncate text-slate-700 leading-tight" title={selectedSegmentSummary.topTreatment}>{selectedSegmentSummary.topTreatment}</p>
                                      </div>
                                   </div>
                                </div>
                             </>
                          )}
                       </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Temporary Diagnostics</p>
                       <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>Map road_name:</span>
                             <span className="font-mono text-slate-700">{selectedGeo.road_name}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>Map ref:</span>
                             <span className="font-mono text-slate-700">{selectedGeo.legacy_ref || selectedGeo.road_id || 'null'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>Canonical Key:</span>
                             <span className="font-mono text-blue-600">{diagnosticKey}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>Lookup Result:</span>
                             <span className={`font-mono font-bold ${selectedDd2Feature ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {selectedDd2Feature ? 'FOUND' : 'NOT FOUND'}
                             </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>Match Method:</span>
                             <span className="font-mono text-slate-700">{matchMethod}</span>
                          </div>
                       </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-4 text-center">
                    <p className="text-[11px] font-medium text-amber-700">No DD2 feature data matched</p>
                    <p className="mt-1 text-[10px] text-amber-600">Check map identity rules</p>
                  </div>
                )}
                
                {/* DD2 treatment status */}
                {selectedDd2Feature && (
                  <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        Pagu Indikatif ASB
                      </p>
                    </div>
                    {selectedDd2Feature.asb_budget?.status === 'estimated' && (
                       <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-100 text-indigo-700">
                          {selectedDd2Feature.asb_budget.costing_mode === 'full_segment_mode' ? 'Full Ruas / Pagu Usulan' : selectedDd2Feature.asb_budget.costing_mode}
                       </span>
                    )}
                  </div>

                  {selectedDd2Feature.asb_budget?.status === 'estimated' ? (
                     <div className="space-y-2 text-xs">
                        <div className="bg-white rounded border border-slate-100 p-2 shadow-sm text-center">
                           <p className="text-[9px] font-bold text-slate-400 uppercase">Estimasi Pagu Indikatif</p>
                           <p className="text-lg font-black text-indigo-700 mt-0.5">
                              Rp {selectedDd2Feature.asb_budget.pagu_indikatif_rp?.toLocaleString('id-ID')}
                           </p>
                        </div>
                        <div className="space-y-1 mt-2">
                           <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">Paket Anggaran:</span>
                              <span className="font-semibold text-slate-800">Tipe {selectedDd2Feature.asb_budget.asb_type} ({selectedDd2Feature.asb_budget.structural_profile})</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">Dasar Pemilihan:</span>
                              <span className="font-medium text-slate-700 truncate max-w-[150px]" title={selectedDd2Feature.asb_budget.rule_label}>
                                {selectedDd2Feature.asb_budget.rule_id} — {selectedDd2Feature.asb_budget.rule_label}
                              </span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">Volume (m):</span>
                              <span className="font-mono text-slate-700">{selectedDd2Feature.asb_budget.panjang_m?.toLocaleString()} m</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">Harga ASB / m:</span>
                              <span className="font-mono text-slate-700">Rp {selectedDd2Feature.asb_budget.harga_satuan_rp?.toLocaleString('id-ID')}</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">Match Params:</span>
                              <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 rounded">
                                 {selectedDd2Feature.asb_budget.width_matched_m}m | {selectedDd2Feature.asb_budget.surface_matched}
                              </span>
                           </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-tight font-mono">{selectedDd2Feature.asb_budget.asb_uraian} — {selectedDd2Feature.asb_budget.asb_spesifikasi}</p>
                        
                        {selectedDd2Feature.asb_budget.flags && selectedDd2Feature.asb_budget.flags.length > 0 && (
                           <div className="mt-2 flex flex-wrap gap-1">
                              {selectedDd2Feature.asb_budget.flags.map(f => (
                                 <span key={f} className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 text-[9px] font-bold">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {f}
                                 </span>
                              ))}
                           </div>
                        )}
                        <p className="text-[8px] text-slate-400 italic leading-tight mt-1 pt-1 border-t border-slate-200">
                           {selectedDd2Feature.asb_budget.disclaimer}
                        </p>
                     </div>
                  ) : (
                     <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {selectedDd2Feature.asb_budget?.reason || 'Tidak ada estimasi pagu'}
                     </p>
                  )}
                </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Map Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Symbology</p>
          
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-5 rounded bg-amber-400" />
            <span className="text-[10px] font-semibold text-slate-700">Selected</span>
          </div>

          {displayMode === 'threshold' ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 rounded bg-indigo-500 opacity-65" />
                <span className="text-[10px] font-medium text-slate-600">Road geometry</span>
              </div>
              {highlightEnabled && (
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-5 rounded bg-red-500" />
                  <span className="text-[10px] font-bold text-red-600">Threshold Met</span>
                </div>
              )}
            </>
          ) : displayMode === 'dominant' ? (
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l border-slate-200 pl-4 ml-1">
                {(Object.keys(DOMINANT_COLORS) as DominantCondition[]).map(cond => (
                   <div key={cond} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOMINANT_COLORS[cond] }} />
                      <span className="text-[10px] font-semibold text-slate-600">{cond}</span>
                      <span className="font-mono text-[9px] text-slate-400">({dominantCounts[cond]})</span>
                   </div>
                ))}
             </div>
          ) : (
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l border-slate-200 pl-4 ml-1">
                {Object.entries(RULE_CATEGORY_COLORS).map(([cat, color]) => {
                   let count = 0;
                   if (dd2Data?.ruleStats) {
                      if (cat === 'Pemeliharaan Rutin') count = dd2Data.ruleStats.rutin;
                      else if (cat === 'Pemeliharaan Berkala') count = dd2Data.ruleStats.berkala;
                      else if (cat === 'Rehabilitasi / Rekonstruksi Indikatif') count = (dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0);
                      else if (cat === 'Kandidat Peningkatan Permukaan') count = dd2Data.ruleStats.peningkatan;
                      else if (cat === 'Data Tidak Cukup') count = dd2Data.ruleStats.insufficientData;
                   }
                   return (
                     <div key={cat} className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-semibold text-slate-600">{cat}</span>
                        <span className="font-mono text-[9px] text-slate-400">({count})</span>
                     </div>
                   );
                })}
             </div>
          )}
          
          <span className="ml-auto text-[9px] text-slate-400">
            {geos.length > 0 ? `${geos.length} geometries loaded` : ''}
          </span>
        </div>
      </div>

      {/* ── Read-only DD2 Table ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-wrap gap-y-3">
          <h3 className="text-sm font-semibold text-slate-800">DD2 Features (Read-Only)</h3>
          
          <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
             {isSelectedRoadFilteredOut && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 animate-pulse">
                   <AlertTriangle className="h-3 w-3" />
                   Target hidden by search filter
                </div>
             )}

             {selectedKey && (
                <button 
                  onClick={() => setSelectedKey(null)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors shadow-sm"
                >
                  <X className="h-3 w-3" />
                  Clear Selection
                </button>
             )}

             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search roads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-56 md:w-64"
                />
                {searchTerm && (
                   <button 
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                   >
                      <X className="h-3.5 w-3.5" />
                   </button>
                )}
             </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Canonical Name</th>
                <th className="px-5 py-3 font-medium">Raw DD2 Name</th>
                <th className="px-5 py-3 font-medium text-right">Length (km)</th>
                <th className="px-5 py-3 font-medium text-right">Non-Mantap %</th>
                <th className="px-5 py-3 font-medium">ASB Package</th>
                <th className="px-5 py-3 font-medium text-right">Pagu Indikatif</th>
                <th className="px-5 py-3 font-medium">Match Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTableData.length > 0 ? (
                paginatedTableData.map((road) => (
                  <tr 
                    key={`${road.road_key}-${road.dd2_row_index}`} 
                    className={`cursor-pointer transition-all duration-150 border-l-4 group ${
                       selectedDd2Feature?.road_key === road.road_key 
                       ? 'bg-indigo-50/70 border-indigo-500 shadow-sm z-10' 
                       : 'border-transparent hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                       const targetGeoKey = roadKeyToGeoKeyMap.get(road.road_key);
                       if (targetGeoKey) {
                          setSelectedKey(targetGeoKey);
                       }
                    }}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">{road.canonical_road_name}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">{road.dd2_road_name_raw}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-600">{road.panjang_ruas_km ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-mono text-[10px] font-medium ${
                        road.non_mantap_pct === null ? 'bg-slate-100 text-slate-500' :
                        road.non_mantap_pct > 40 ? 'bg-rose-100 text-rose-700' :
                        road.non_mantap_pct > 20 ? 'bg-amber-100 text-amber-700' : 
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {road.non_mantap_pct !== null ? `${road.non_mantap_pct}%` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                         {road.asb_budget?.status === 'estimated' ? (
                            <>
                               <span className="font-bold text-indigo-700 text-[11px]">Tipe {road.asb_budget.asb_type}</span>
                               <span className="text-[9px] text-slate-500">{road.asb_budget.rule_id}</span>
                            </>
                         ) : (
                            <span className="text-[10px] text-slate-400 italic">No package</span>
                         )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                       <span className="font-mono text-xs font-semibold text-slate-700">
                          {road.asb_budget?.status === 'estimated' ? `Rp ${(road.asb_budget.pagu_indikatif_rp || 0).toLocaleString('id-ID')}` : '—'}
                       </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                        {road.identity_match_method}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    {dd2Data ? 'No matching roads found.' : 'Loading DD2 data...'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                 value={pageSize}
                 onChange={(e) => {
                   setPageSize(Number(e.target.value));
                   setCurrentPage(1);
                 }}
                 className="border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={350}>350</option>
              </select>
              <span>records</span>
            </div>

            <div>
               Showing {filteredTableData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredTableData.length)} of {filteredTableData.length} records
            </div>

            <div className="flex items-center gap-1">
               <button
                 disabled={currentPage === 1}
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium"
               >
                 Prev
               </button>
               <span className="px-3 py-1.5 font-medium text-slate-700">
                 Page {currentPage} of {Math.ceil(filteredTableData.length / pageSize) || 1}
               </span>
               <button
                 disabled={currentPage >= Math.ceil(filteredTableData.length / pageSize)}
                 onClick={() => setCurrentPage(p => p + 1)}
                 className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium"
               >
                 Next
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Implementation roadmap ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Implementation Roadmap</h3>
          <p className="mt-0.5 text-xs text-slate-500">Steps required before this module is operational</p>
        </div>
        <div className="divide-y divide-slate-50">
          {NEXT_STEPS.map((item, idx) => {
            const style = STATUS_STYLES[item.status];
            return (
              <div key={item.step} className="flex items-start gap-4 px-5 py-4">
                {/* Timeline */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className={`h-3 w-3 rounded-full ${style.dot} ring-4 ring-white`} />
                  {idx < NEXT_STEPS.length - 1 && (
                     <div className={`h-full w-px flex-1 ${item.status === 'done' ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                  )}
                </div>
                {/* Icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === 'done' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <item.icon className={`h-4 w-4 ${item.status === 'done' ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="mr-1.5 font-mono text-xs text-slate-400">{item.step}.</span>
                      {item.label}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
                      {item.status === 'done' ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Identity rules reminder ───────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="text-xs leading-relaxed text-blue-700">
          <span className="font-semibold">Identity Rule Reminder:</span>{' '}
          All road matching must follow{' '}
          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[10px]">
            DATA_IDENTITY_RULES.md
          </code>
          . Logical road universe = <strong>350</strong>. Use canonical{' '}
          <code className="font-mono text-[10px]">nama_ruas_norm</code> /{' '}
          <code className="font-mono text-[10px]">road_key</code> identity. Do not use{' '}
          <code className="font-mono text-[10px]">road_id</code> as cross-scenario identity.
        </div>
      </div>
    </div>
  );
}
