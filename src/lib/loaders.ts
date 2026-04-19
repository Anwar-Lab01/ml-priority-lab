import type {
  Scenario,
  ModelMetric,
  RankingRow,
  ShapGlobalRow,
  ShapLocalRow,
  TargetCaptureRow,
  TargetRow,
  RoadFeatureRow,
  ConversionReport,
  AppData,
  FileLoadStatus,
  LoadStatus,
} from '../types/contracts';
import { getRoadKey, getShapKey } from './utils';

/**
 * Development-only logger
 */
const log = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('[Data Layer]', ...args);
  }
};

/**
 * Generic fetcher with basic error handling and runtime validation guards.
 */
async function loadFile<T>(
  filename: string,
  validator: (data: any) => data is T,
  defaultValue: T
): Promise<[T, FileLoadStatus]> {
  const path = `/data/${filename}`;
  try {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} when fetching ${filename}`);
    }
    const rawData = await res.json();
    
    // Runtime validation: ensure it's at least an array if expected, or an object
    if (validator(rawData)) {
      log(`Successfully loaded ${filename} (${Array.isArray(rawData) ? rawData.length : 1} records)`);
      return [rawData, { file: filename, loaded: true, rowCount: Array.isArray(rawData) ? rawData.length : 1 }];
    } else {
      throw new Error(`Validation failed for ${filename}: Required fields missing or data format mismatch.`);
    }
  } catch (err) {
    console.error(`[Data Layer] Error loading ${filename}:`, err);
    return [defaultValue, { 
      file: filename, 
      loaded: false, 
      rowCount: 0, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }];
  }
}

// ──────────────────────────────────────────────
// Validation Guards
// ──────────────────────────────────────────────

function isArrayOf<T>(data: any, checkField: keyof T): data is T[] {
  return Array.isArray(data) && (data.length === 0 || checkField in data[0]);
}

const guards = {
  scenarios: (data: any): data is Scenario[] => isArrayOf<Scenario>(data, 'scenario_id'),
  modelMetrics: (data: any): data is ModelMetric[] => isArrayOf<ModelMetric>(data, 'model'),
  rankings: (data: any): data is RankingRow[] => isArrayOf<RankingRow>(data, 'road_id'),
  shapGlobal: (data: any): data is ShapGlobalRow[] => isArrayOf<ShapGlobalRow>(data, 'mean_abs_shap'),
  shapLocal: (data: any): data is ShapLocalRow[] => isArrayOf<ShapLocalRow>(data, 'shap_value'),
  targetCapture: (data: any): data is TargetCaptureRow[] => isArrayOf<TargetCaptureRow>(data, 'K'),
  targetRows: (data: any): data is TargetRow[] => isArrayOf<TargetRow>(data, 'road_id'),
  roadFeatures: (data: any): data is RoadFeatureRow[] => isArrayOf<RoadFeatureRow>(data, 'road_id'),
  conversionReport: (data: any): data is ConversionReport => data && 'generated_from_zip' in data,
};

// ──────────────────────────────────────────────
// Data Loader (Main entry point)
// ──────────────────────────────────────────────

export async function loadAllData(): Promise<AppData> {
  log('Starting full data load sequence...');
  
  const [
    [scenarios, stScenarios],
    [metrics, stMetrics],
    [rankings, stRankings],
    [shapGlobal, stShapGlobal],
    [shapLocal, stShapLocal],
    [targetCapture, stTargetCapture],
    [targetRows, stTargetRows],
    [roadFeatures, stRoadFeatures],
    [conversionReport, stReport],
  ] = await Promise.all([
    loadFile<Scenario[]>('scenarios.json', guards.scenarios, []),
    loadFile<ModelMetric[]>('model_metrics.json', guards.modelMetrics, []),
    loadFile<RankingRow[]>('rankings.json', guards.rankings, []),
    loadFile<ShapGlobalRow[]>('shap_global.json', guards.shapGlobal, []),
    loadFile<ShapLocalRow[]>('shap_local.json', guards.shapLocal, []),
    loadFile<TargetCaptureRow[]>('target_capture.json', guards.targetCapture, []),
    loadFile<TargetRow[]>('target_rows.json', guards.targetRows, []),
    loadFile<RoadFeatureRow[]>('road_features.json', guards.roadFeatures, []),
    loadFile<ConversionReport | null>('conversion_report.json', guards.conversionReport, null),
  ]);

  log('Data fetching complete. Initializing indexes...');

  // Cross-pollinate physical target truths from targetRows to compensate for scenarios that lack them
  const targetKeysMap = new Map<string, {any: number|null, tender: number|null, pl: number|null, tek26: number|null, tek27: number|null}>();
  targetRows.forEach(tr => {
    const k = getRoadKey(tr);
    if (!targetKeysMap.has(k)) {
        targetKeysMap.set(k, {
            any: tr.planned_any_2026,
            tender: tr.planned_tender_2026,
            pl: tr.planned_pl_2026,
            tek26: tr.planned_teknokratis_2026,
            tek27: tr.planned_teknokratis_2027
        });
    } else {
        const cur = targetKeysMap.get(k)!;
        if (tr.planned_any_2026 === 1) cur.any = 1;
        if (tr.planned_tender_2026 === 1) cur.tender = 1;
        if (tr.planned_pl_2026 === 1) cur.pl = 1;
        if (tr.planned_teknokratis_2026 === 1) cur.tek26 = 1;
        if (tr.planned_teknokratis_2027 === 1) cur.tek27 = 1;
    }
  });

  // Build performance indexes
  const index = {
    rankingsByScenario: new Map<string, RankingRow[]>(),
    rankingsByRoadKey: new Map<string, RankingRow[]>(),
    shapGlobalByScenario: new Map<string, ShapGlobalRow[]>(),
    shapLocalByKey: new Map<string, ShapLocalRow[]>(),
    metricsByScenario: new Map<string, ModelMetric[]>(),
    targetCaptureByScenario: new Map<string, TargetCaptureRow[]>(),
  };

  rankings.forEach((r, idx) => {
    try {
      const rk = getRoadKey(r);
      
      // Reconcile Ground Truth Targets
      const tTruth = targetKeysMap.get(rk);
      
      // Preserve original for debugging
      (r as any)._raw_planned_any = r.planned_any_2026;
      (r as any)._raw_planned_tender = r.planned_tender_2026;
      
      if (tTruth) {
        r.planned_any_2026 = tTruth.any !== null ? tTruth.any : 0;
        r.planned_tender_2026 = tTruth.tender !== null ? tTruth.tender : 0;
        r.planned_pl_2026 = tTruth.pl !== null ? tTruth.pl : 0;
        r.planned_teknokratis_2026 = tTruth.tek26 !== null ? tTruth.tek26 : 0;
        r.planned_teknokratis_2027 = tTruth.tek27 !== null ? tTruth.tek27 : 0;
      } else {
        r.planned_any_2026 = 0;
        r.planned_tender_2026 = 0;
        r.planned_pl_2026 = 0;
        r.planned_teknokratis_2026 = 0;
        r.planned_teknokratis_2027 = 0;
      }

      if (!index.rankingsByScenario.has(r.scenario_id)) index.rankingsByScenario.set(r.scenario_id, []);
      index.rankingsByScenario.get(r.scenario_id)!.push(r);
      
      if (!index.rankingsByRoadKey.has(rk)) index.rankingsByRoadKey.set(rk, []);
      index.rankingsByRoadKey.get(rk)!.push(r);
    } catch (e) {
      if (idx < 5) console.warn(`[Index] Failed to index ranking row ${idx}:`, e, r);
    }
  });

  shapGlobal.forEach((s, idx) => {
    if (!index.shapGlobalByScenario.has(s.scenario_id)) index.shapGlobalByScenario.set(s.scenario_id, []);
    index.shapGlobalByScenario.get(s.scenario_id)!.push(s);
  });

  shapLocal.forEach((s, idx) => {
    try {
      const sk = getShapKey(s.scenario_id, s.model, getRoadKey(s));
      if (!index.shapLocalByKey.has(sk)) index.shapLocalByKey.set(sk, []);
      index.shapLocalByKey.get(sk)!.push(s);
    } catch (e) {
      if (idx < 5) console.warn(`[Index] Failed to index SHAP local row ${idx}:`, e, s);
    }
  });

  metrics.forEach(m => {
    if (!index.metricsByScenario.has(m.scenario_id)) index.metricsByScenario.set(m.scenario_id, []);
    index.metricsByScenario.get(m.scenario_id)!.push(m);
  });

  targetCapture.forEach(c => {
    if (!index.targetCaptureByScenario.has(c.scenario_id)) index.targetCaptureByScenario.set(c.scenario_id, []);
    index.targetCaptureByScenario.get(c.scenario_id)!.push(c);
  });

  const allDetectedScenarios = new Set<string>();
  scenarios.forEach(s => allDetectedScenarios.add(s.scenario_id));
  rankings.forEach(r => allDetectedScenarios.add(r.scenario_id));

  const allDetectedModels = new Set<string>();
  metrics.forEach(m => allDetectedModels.add(m.model));
  rankings.forEach(r => allDetectedModels.add(r.model));

  const metadata = {
    detectedScenarios: Array.from(allDetectedScenarios),
    detectedModels: Array.from(allDetectedModels),
  };

  const status: LoadStatus = {
    scenarios: stScenarios,
    modelMetrics: stMetrics,
    rankings: stRankings,
    shapGlobal: stShapGlobal,
    shapLocal: stShapLocal,
    targetCapture: stTargetCapture,
    targetRows: stTargetRows,
    roadFeatures: stRoadFeatures,
    conversionReport: stReport || { file: 'conversion_report.json', loaded: false, rowCount: 0, error: 'File missing or invalid' },
  };

  log('Indexes built. Metadata detected:', metadata);

  return {
    scenarios,
    modelMetrics: metrics,
    rankings,
    shapGlobal,
    shapLocal,
    targetCapture,
    targetRows,
    roadFeatures,
    conversionReport,
    indexes: index,
    status,
    ...metadata,
  };
}
