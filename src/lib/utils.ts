import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number to a fixed number of decimal places */
export function fmt(value: number | null | undefined, decimals = 4): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

/** Format as percentage */
export function pct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format large numbers with comma separators */
export function fmtInt(value: number | null | undefined): string {
  if (value == null) return '—';
  return Math.round(value).toLocaleString();
}

/** Centralized CSV Export Utility */
export function exportToCsv(filename: string, tableData: any[], headers: string[], keys: (string | ((row: any) => any))[]) {
  if (tableData.length === 0) return;
  
  const headerRow = headers.join(',');
  const rows = tableData.map(row => {
    return keys.map(key => {
      let val = typeof key === 'function' ? key(row) : row[key as string];
      if (val == null) val = '';
      let str = String(val);
      if (str.includes(',') || str.includes('\n')) str = `"${str.replace(/"/g, '""')}"`;
      return str;
    }).join(',');
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headerRow, ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ──────────────────────────────────────────────
// Road Identity Helpers
// ──────────────────────────────────────────────

/**
 * Derive a stable cross-scenario key from a road name.
 * Normalizes: trim, lowercase, collapse whitespace, normalize dashes.
 * When nama_ruas_norm is later added to the data pipeline,
 * this function will automatically prefer it.
 */
export function getRoadKey(row: Partial<{ nama_ruas_norm?: string; road_name: string }>): string {
  if (!row) {
    if (import.meta.env.DEV) console.warn('[getRoadKey] Row object is undefined/null');
    return 'unknown';
  }
  const name = row.nama_ruas_norm || row.road_name;
  if (!name) {
    if (import.meta.env.DEV) console.warn('[getRoadKey] Missing road_name on row', row);
    return 'unknown';
  }
  
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2013\u2014]/g, '-');
}

/**
 * Normalize model names to avoid case-sensitivity mismatches during joins.
 * e.g., 'xgboost' and 'XGBoost' -> 'xgboost'
 */
export function getModelKey(model: string): string {
  if (!model) return 'unknown';
  return model.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build a composite key for SHAP local indexing.
 * SHAP values are scenario + model specific, so scoping is required.
 */
export function getShapKey(scenarioId: string, model: string, roadKey: string): string {
  if (!scenarioId || !model || !roadKey) {
    if (import.meta.env.DEV) console.warn(`[getShapKey] Incomplete key parts (scenario: ${scenarioId}, model: ${model}, key: ${roadKey})`);
  }
  
  const mKey = getModelKey(model);
  return `${scenarioId}::${mKey}::${roadKey}`;
}

// ──────────────────────────────────────────────
// Target Field Helpers
// ──────────────────────────────────────────────

/** Check if target is positively confirmed (not null, not 0). */
export function isTargetPositive(val: number | null | undefined): boolean {
  return val !== null && val !== undefined && val > 0;
}

/** Check if target data is available (not null/undefined). */
export function isTargetKnown(val: number | null | undefined): boolean {
  return val !== null && val !== undefined;
}
