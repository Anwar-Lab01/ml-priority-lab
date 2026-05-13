import type { ScenarioFamily } from '../types/contracts';

// ──────────────────────────────────────────────
// Scenario-family display config
// ──────────────────────────────────────────────
export const FAMILY_CONFIG: Record<ScenarioFamily, { label: string; color: string; bgColor: string }> = {
  normatif: { label: 'Normatif', color: '#1d4ed8', bgColor: '#dbeafe' },
  historis: { label: 'Historis', color: '#9333ea', bgColor: '#f3e8ff' },
};

// ──────────────────────────────────────────────
// Model display config
// ──────────────────────────────────────────────
export const MODEL_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  XGBoost:       { label: 'XGBoost',       color: '#059669', bgColor: '#d1fae5' },
  RandomForest:  { label: 'Random Forest', color: '#d97706', bgColor: '#fef3c7' },
  DecisionTree:  { label: 'Decision Tree', color: '#dc2626', bgColor: '#fee2e2' },
};

// ──────────────────────────────────────────────
// Top-K thresholds for capture analysis
// ──────────────────────────────────────────────
export const TOP_K_OPTIONS = [19, 28, 35, 70, 105] as const;
export type TopK = typeof TOP_K_OPTIONS[number];

// ──────────────────────────────────────────────
// Metric labels
// ──────────────────────────────────────────────
export const NORMATIF_METRIC_LABELS: Record<string, string> = {
  roc_auc: 'ROC AUC',
  pr_auc: 'PR AUC',
  pos_rate: 'Positive Rate',
  best_threshold: 'Best Threshold',
  top30_precision: 'Top-30 Precision',
  top30_recall: 'Top-30 Recall',
  top30_mcc: 'Top-30 MCC',
  top30_bal_acc: 'Top-30 Balanced Acc.',
  mccopt_precision: 'MCC-Opt Precision',
  mccopt_recall: 'MCC-Opt Recall',
  mccopt_mcc: 'MCC-Opt MCC',
  mccopt_bal_acc: 'MCC-Opt Balanced Acc.',
  thr05_precision: 'Thr 0.5 Precision',
  thr05_recall: 'Thr 0.5 Recall',
  thr05_mcc: 'Thr 0.5 MCC',
  thr05_bal_acc: 'Thr 0.5 Balanced Acc.',
};

export const HISTORIS_METRIC_LABELS: Record<string, string> = {
  pr_auc: 'PR AUC',
  mcc: 'MCC',
  mean_rank_any: 'Mean Rank (Any)',
  median_rank_any: 'Median Rank (Any)',
};

// ──────────────────────────────────────────────
// Chart color palette
// ──────────────────────────────────────────────
export const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
] as const;

// ──────────────────────────────────────────────
// Navigation items
// ──────────────────────────────────────────────
export interface NavItem {
  path: string;
  label: string;
  icon: string; // lucide icon name
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/',                label: 'Dashboard',         icon: 'LayoutDashboard' },
  { path: '/ranking-compare', label: 'Ranking Compare',   icon: 'ArrowUpDown' },
  { path: '/target-hit-compare', label: 'Target Hit Compare', icon: 'Target' },
  { path: '/ranking-transition', label: 'Ranking Transition', icon: 'Route' },
  { path: '/map-explorer',    label: 'Map Explorer',      icon: 'Map' },
  { path: '/shap-explorer',   label: 'SHAP Explorer',     icon: 'Sparkles' },
  { path: '/road-inspector',  label: 'Road Inspector',    icon: 'Target' },
  { path: '/metrics-capture', label: 'Metrics & Capture', icon: 'Target' },
  { path: '/treatment-engine', label: 'Treatment Engine',  icon: 'Wrench' },
  { path: '/data-dictionary', label: 'Data Dictionary',   icon: 'BookOpen' },
];

// ──────────────────────────────────────────────
// Page titles & descriptions
// ──────────────────────────────────────────────
export const PAGE_META: Record<string, { title: string; description: string }> = {
  '/':                { title: 'Dashboard',         description: 'Overview of scenario performance, key metrics, and data coverage.' },
  '/ranking-compare': { title: 'Ranking Compare',   description: 'Side-by-side ranking comparison across scenarios and models.' },
  '/target-hit-compare': { title: 'Target Hit Compare', description: 'Compare target capture rates across multiple ranking series at top-K thresholds.' },
  '/ranking-transition': { title: 'Ranking Transition', description: 'Visual explanation of how rank positions change between two selected scenarios.' },
  '/map-explorer':    { title: 'Map Explorer',      description: 'Spatial exploration of road segments overlaid with prioritization rankings.' },
  '/shap-explorer':   { title: 'SHAP Explorer',     description: 'Global and local SHAP feature importance analysis.' },
  '/road-inspector':  { title: 'Road Inspector',    description: 'Drill into individual road segment features and rankings.' },
  '/metrics-capture': { title: 'Metrics & Capture', description: 'Model performance metrics and target capture at various K thresholds.' },
  '/treatment-engine': { title: 'Treatment Engine',  description: 'Rule-based treatment indication and indicative budgeting from DD2 / ASB data.' },
  '/data-dictionary': { title: 'Data Dictionary',   description: 'Documentation of all data fields and their sources.' },
};
