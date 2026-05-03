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

function formatDelimitedCell(value: unknown, delimiter: ',' | '\t'): string {
  if (value == null) return '';

  let str = String(value);
  if (delimiter === '\t') {
    str = str.replace(/\r?\n/g, ' ');
  }

  const shouldQuote =
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (!shouldQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function exportDelimited(
  filename: string,
  extension: 'csv' | 'tsv',
  delimiter: ',' | '\t',
  tableData: any[],
  headers: string[],
  keys: (string | ((row: any) => any))[]
) {
  if (tableData.length === 0) return;

  const headerRow = headers.map((header) => formatDelimitedCell(header, delimiter)).join(delimiter);
  const rows = tableData.map((row) =>
    keys
      .map((key) => {
        const val = typeof key === 'function' ? key(row) : row[key as string];
        return formatDelimitedCell(val, delimiter);
      })
      .join(delimiter)
  );

  const mimeType = extension === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
  const content = `data:${mimeType};charset=utf-8,` + [headerRow, ...rows].join('\n');
  const encodedUri = encodeURI(content);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename}.${extension}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Centralized CSV Export Utility */
export function exportToCsv(filename: string, tableData: any[], headers: string[], keys: (string | ((row: any) => any))[]) {
  exportDelimited(filename, 'csv', ',', tableData, headers, keys);
}

/** Centralized TSV Export Utility */
export function exportToTsv(filename: string, tableData: any[], headers: string[], keys: (string | ((row: any) => any))[]) {
  exportDelimited(filename, 'tsv', '\t', tableData, headers, keys);
}

// ──────────────────────────────────────────────
// Road Identity Helpers
// ──────────────────────────────────────────────

export interface RoadAliasMapConfig {
  aliases?: Record<string, string>;
}

let roadAliasMap = new Map<string, string>();

export function configureRoadAliases(config?: RoadAliasMapConfig | null): void {
  roadAliasMap = new Map(Object.entries(config?.aliases || {}));
}

export function normalizeRoadIdentity(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bjl\.?\s*/g, '')
    .replace(/\bds\.?(?=\s|$)/g, 'desa')
    .replace(/\bsp\.?\s*/g, 'sp ')
    .replace(/\bsei\.?\s*/g, 'sei ')
    .replace(/\//g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyRoadAlias(normalizedKey: string): string {
  let current = normalizedKey;
  const visited = new Set<string>();

  while (roadAliasMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = roadAliasMap.get(current)!;
  }

  return current;
}

/**
 * Derive a stable cross-scenario key from a road name.
 * Applies shared identity normalization plus any configured alias map.
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

  return applyRoadAlias(normalizeRoadIdentity(name));
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
