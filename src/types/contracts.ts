// ──────────────────────────────────────────────
// Scenario
// ──────────────────────────────────────────────
export type ScenarioFamily = 'normatif' | 'historis';
export type CompletenessLevel = 'full' | 'ranking+capture only';

export interface Scenario {
  scenario_id: string;
  scenario_label: string;
  family: ScenarioFamily;
  source: string;
  completeness: CompletenessLevel;
}

// ──────────────────────────────────────────────
// Model Metrics
// ──────────────────────────────────────────────
export type ModelName = 'XGBoost' | 'RandomForest' | 'DecisionTree';

/** Normatif scenarios include classification metrics; historis include ranking-alignment metrics. */
export interface ModelMetric {
  scenario_id: string;
  model: ModelName;
  source_file: string;
  source_sheet: string;

  // Classification metrics (normatif)
  roc_auc?: number;
  pr_auc?: number;
  pos_rate?: number;
  best_threshold?: number;
  top30_precision?: number;
  top30_recall?: number;
  top30_mcc?: number;
  top30_bal_acc?: number;
  mccopt_precision?: number;
  mccopt_recall?: number;
  mccopt_mcc?: number;
  mccopt_bal_acc?: number;
  thr05_precision?: number;
  thr05_recall?: number;
  thr05_mcc?: number;
  thr05_bal_acc?: number;

  // Ranking-alignment metrics (historis)
  mcc?: number;
  mean_rank_any?: number;
  median_rank_any?: number;
  overlap_any_k19?: number;
  recall_any_k19?: number;
  precision_any_k19?: number;
  overlap_any_k28?: number;
  recall_any_k28?: number;
  precision_any_k28?: number;
  overlap_any_k35?: number;
  recall_any_k35?: number;
  precision_any_k35?: number;
  overlap_any_k70?: number;
  recall_any_k70?: number;
  precision_any_k70?: number;
  overlap_any_k105?: number;
  recall_any_k105?: number;
  precision_any_k105?: number;
}

// ──────────────────────────────────────────────
// Rankings
// ──────────────────────────────────────────────
export interface RankingRow {
  road_id: number;
  road_name: string;
  scenario_id: string;
  model: string;
  score: number;
  rank: number;
  wsm_score: number | null;
  y_true: number | null;
  pred_top_pct: number | null;
  planned_any_2026: number | null;
  planned_tender_2026: number | null;
  planned_pl_2026: number | null;
  planned_teknokratis_2026: number | null;
  planned_teknokratis_2027: number | null;
  captured_any: number | null;
  source_file: string;
  source_sheet: string;
  score_type?: string;
  nama_ruas_norm?: string;
}

// ──────────────────────────────────────────────
// SHAP – Global
// ──────────────────────────────────────────────
export interface ShapGlobalRow {
  scenario_id: string;
  model: string;
  feature: string;
  mean_abs_shap: number;
  source_file: string;
  source_sheet: string;
}

// ──────────────────────────────────────────────
// SHAP – Local
// ──────────────────────────────────────────────
export interface ShapLocalRow {
  road_id: number;
  road_name: string;
  scenario_id: string;
  model: string;
  feature: string;
  shap_value: number;
  feature_value: number | null;
  predicted_score: number;
  actual_label: number;
  source_file: string;
  source_sheet: string;
  nama_ruas_norm?: string;
}

// ──────────────────────────────────────────────
// Target Capture
// ──────────────────────────────────────────────
export interface TargetCaptureRow {
  scenario_id: string;
  report_file: string;
  best_temporal_model: string;
  best_temporal_pr_auc: number;
  best_temporal_mcc: number;
  plan_target: string;
  K: number;
  total_target_rows: number;
  overlap_top_k: number;
  recall_at_k: number;
  precision_at_k: number;
  mean_rank_of_all_target_rows: number;
  median_rank_of_all_target_rows: number;
  mean_rank_within_hits: number | null;
  median_rank_within_hits: number | null;
  hits_planned_tender: number;
  hits_planned_pl: number;
  source_file: string;
  source_sheet: string;
}

// ──────────────────────────────────────────────
// Target Rows  (ranked rows that are in the plan)
// ──────────────────────────────────────────────
export interface TargetRow {
  scenario_id: string;
  best_temporal_model: string;
  plan_target: string;
  road_id: number;
  road_name: string;
  rank_prioritas: number;
  pred_prob: number;
  planned_any_2026: number;
  planned_tender_2026: number;
  planned_pl_2026: number;
  planned_teknokratis_2026: number;
  planned_teknokratis_2027: number;
  source_file: string;
  source_sheet: string;
  nama_ruas_norm?: string;
}

// ──────────────────────────────────────────────
// Road Features (normatif AHP scores + raw features)
// ──────────────────────────────────────────────
export interface RoadFeatureRow {
  scenario_id: string;
  road_id: number;
  road_name: string;
  wsm_score?: number;
  rank?: number;
  source_file: string;
  source_sheet: string;
  nama_ruas_norm?: string;
  [featureKey: `Norm01_${string}`]: number | undefined;
  // historis features use snake_case keys
  [featureKey: string]: string | number | undefined;
}

// ──────────────────────────────────────────────
// Conversion Report
// ──────────────────────────────────────────────
export interface ConversionReport {
  generated_from_zip: string;
  output_files: Record<string, number>;
  notes: string[];
  source_sheets_used: string[];
  source_sheets_ignored: string[];
}

// ──────────────────────────────────────────────
// Runtime Validation & Load Status
// ──────────────────────────────────────────────
export interface FileLoadStatus {
  file: string;
  loaded: boolean;
  rowCount: number;
  error?: string;
}

export interface LoadStatus {
  scenarios: FileLoadStatus;
  modelMetrics: FileLoadStatus;
  rankings: FileLoadStatus;
  shapGlobal: FileLoadStatus;
  shapLocal: FileLoadStatus;
  targetCapture: FileLoadStatus;
  targetRows: FileLoadStatus;
  roadFeatures: FileLoadStatus;
  conversionReport: FileLoadStatus;
}

// ──────────────────────────────────────────────
// Composite App Data with Performance Indexes
// ──────────────────────────────────────────────
export interface AppData {
  // Raw lists
  scenarios: Scenario[];
  modelMetrics: ModelMetric[];
  rankings: RankingRow[];
  shapGlobal: ShapGlobalRow[];
  shapLocal: ShapLocalRow[];
  targetCapture: TargetCaptureRow[];
  targetRows: TargetRow[];
  roadFeatures: RoadFeatureRow[];
  conversionReport: ConversionReport | null;

  // Performance Indexes
  indexes: {
    rankingsByScenario: Map<string, RankingRow[]>;
    rankingsByRoadKey: Map<string, RankingRow[]>;
    shapGlobalByScenario: Map<string, ShapGlobalRow[]>;
    shapLocalByKey: Map<string, ShapLocalRow[]>;
    metricsByScenario: Map<string, ModelMetric[]>;
    targetCaptureByScenario: Map<string, TargetCaptureRow[]>;
  };

  // Status for Debug Page
  status: LoadStatus;
  
  // High-level metadata
  detectedScenarios: string[];
  detectedModels: string[];
}
