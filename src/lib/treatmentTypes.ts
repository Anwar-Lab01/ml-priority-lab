// ── Treatment Engine — Shared Types ──────────────────────────────────────────
//
// Extracted from TreatmentEnginePage.tsx (Phase 1 refactor).
// These types are used by treatmentEngine.ts, projectSegment.ts,
// and TreatmentEnginePage.tsx.
//
// SAFETY: No behavioral changes. Pure type definitions only.
// ─────────────────────────────────────────────────────────────────────────────

export interface MapConfig {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  showZoomControl?: boolean;
}

export interface GeoRoad {
  legacy_ref: string | null;
  road_id: number | null;
  road_name: string;
  matched_name: string | null;
  coordinates: [number, number][];
}

export interface DD2FeatureMetadata {
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

export interface DD2RoadFeature {
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
  asb_budget?: ASBBudgetResult; // auto_estimate
  final_asb_budget?: ASBBudgetResult; // final_estimate
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

export interface ManualASBOverride {
  override_active: boolean;
  manual_reason_code: string;
  manual_reason_text?: string;
  selected_asb_type: string;
  structural_profile: string;
  width_matching: 'auto_round_up' | 'manual_variant';
  manual_width_m?: number;
  surface_preference: 'auto' | 'manual';
  manual_surface_type?: string;
  costing_mode: 'full_segment_mode' | 'effective_length_mode';
  effective_length_ratio?: number;
  created_at: string;
  updated_at: string;
}

export interface ASBBudgetResult {
  status: 'estimated' | 'no_major_asb_package' | 'manual_estimated' | 'no_rule_matched' | 'no_asb_candidate_found' | 'insufficient_data' | 'missing_asb_item';
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
  
  // Override tracking
  manual_override_used?: boolean;
  override_details?: ManualASBOverride;
  
  // The final applied budget (which is what the UI should display)
  final_pagu_indikatif_rp?: number | null;
  final_asb_type?: string | null;
  final_asb_id?: string | null;
  final_costing_mode?: string | null;
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
    manualOverridesActive: number;
  };
}

export interface MLPriorityScore {
  road_key: string;
  rank: number | null;
  score: number | null;
  model?: string | null;
  scenario?: string | null;
  score_type?: string | null;
  top35?: boolean;
  top70?: boolean;
  top105?: boolean;
  hit_2026?: boolean | null;
}

export interface MLPriorityMetadata {
  source?: string;
  source_scenario_id?: string;
  scenario?: string;
  target?: string;
  model?: string;
  score_type?: string;
  model_family?: string;
  generated_at?: string;
  identity?: 'road_key' | string;
  total_ml_records?: number;
  dd2_road_key_matches?: number;
  treatment_engine_total_roads?: number;
}

export interface MLPriorityScoresByRoadKey {
  metadata: MLPriorityMetadata;
  scores: Record<string, MLPriorityScore>;
  configurations?: Record<string, Record<string, Record<string, {
    metadata: MLPriorityMetadata;
    scores: Record<string, MLPriorityScore>;
  }>>>;
}

// ── Display type aliases ──────────────────────────────────────────────────────

export type MapDisplayMode = 'threshold' | 'dominant' | 'rule';
export type DominantCondition = 'Baik' | 'Sedang' | 'Rusak Ringan' | 'Rusak Berat' | 'N/A';

// ── HPS/AHSP Item Profile Types ───────────────────────────────────────────────

export type HPSSourceType = 'catalog' | 'manual_custom';
export type HPSItemRole = 'primary' | 'support' | 'optional';
export type BudgetSourcePreference = 'ASB_PAGU' | 'HPS_MANUAL_ESTIMATE';

export interface SelectedHPSItem {
  id: string; // Unique instance ID (UUID or generated)
  source: HPSSourceType;
  hps_id: string | null; // null if custom item
  payment_code: string | null;
  uraian: string;
  satuan: string | null;
  harga_rp: number;
  quantity: number | null;
  subtotal_rp: number | null;
  role: HPSItemRole;
  notes?: string;
}

export interface HPSManualOverride {
  road_key: string;
  is_active: boolean;
  final_hps_profile: string; // profile_id (e.g., 'profile_asb_a')
  items: SelectedHPSItem[];
  total_hps_estimate_rp: number | null;
  budget_source_preference: BudgetSourcePreference;
  hps_can_replace_asb: false;
  justification: string;
  updated_at: string;
}

export type HPSComparisonStatus = 
  | 'profile_only'
  | 'selected_no_quantity'
  | 'within_reference' 
  | 'above_reference' 
  | 'below_reference' 
  | 'needs_review';

export interface HPSComparisonResult {
  asb_pagu_indikatif_rp: number;
  total_hps_estimate_rp: number;
  ratio_to_asb: number;
  status: HPSComparisonStatus;
}

export interface HPSProfileSuggestedRule {
  rule_id: string;
  description: string;
  division_code: number;
  item_family: string;
  keywords_in_uraian: string[];
  quantity_basis: string;
  role: HPSItemRole;
  confidence: string;
}

export interface HPSProfileRule {
  profile_id: string;
  asb_type: string;
  structural_profile: string;
  purpose: string;
  disclaimer: string;
  suggested_item_rules: HPSProfileSuggestedRule[];
}

export interface HPSCatalogItem {
  hps_id: string;
  source_row: number | null;
  division_code: number | null;
  division_name: string;
  payment_code: string | null;
  uraian: string;
  original_satuan: string;
  satuan: string | null;
  harga_rp: number;
  source_reference: string;
  item_family: string;
  quantity_basis: string;
  is_support_item: boolean;
}

// ── Phase 5: Planning Scenario Types ─────────────────────────────────────────

export type CandidateStatus = 'included' | 'force_include' | 'force_exclude' | 'deferred';

export interface PlanningNote {
  road_key: string;
  note: string;
  updated_at: string;
}

export interface CandidateBasketItem {
  road_key: string;
  canonical_road_name: string;
  status: CandidateStatus;
  /** Snapshot from final_asb_budget.final_pagu_indikatif_rp at time of adding */
  pagu_indikatif_rp: number | null;
  /** Snapshot from final_asb_budget.final_asb_type at time of adding */
  asb_type: string | null;
  /** Snapshot from rule_v1.treatment_category at time of adding */
  treatment_category: string | null;
  added_at: string;
  updated_at: string;
}
