import { useState, useMemo, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { Download, CheckCircle2 } from 'lucide-react';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ChartCard } from '../components/ui/ChartCard';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/tables/DataTable';
import { fmt, exportToCsv, exportToTsv, getRoadKey, isTargetPositive, isTargetKnown } from '../../lib/utils';
import { TARGET_LABELS, getTargetHitValue, type TargetType } from '../../lib/targetDefs';
import { computeSpearmanCorrelation, computeJaccardSimilarity, computeOverlapSet } from '../../lib/transforms';
import type { RankingRow, TargetRow } from '../../types/contracts';
import { TOP_K_OPTIONS } from '../../config/scenarios';

interface ComparisonRow {
  road_key: string;
  road_name: string;
  rankA: number | null;
  rankB: number | null;
  rankC: number | null;
  scoreA: number | null;
  scoreB: number | null;
  scoreC: number | null;
  rankDiffAB: number | null; 
  absDiffAB: number | null;
  planned_any: number | null;
  planned_tender: number | null;
  planned_pl: number | null;
  planned_teknokratis: number | null;
  planned_teknokratis_2027: number | null;
  selectedTargetHit: number | null;
  scoreTypeA: string | null;
  scoreTypeB: string | null;
  scoreTypeC: string | null;
}

type ExportScope = 'full' | 35 | 70 | 105;

interface RoadMeta {
  road_name: string;
  nomor_ruas: string;
  desa_yang_dilalui: string;
  kecamatan_yang_dilalui: string;
  planned_any_2026: number | null;
  planned_tender_2026: number | null;
  planned_pl_2026: number | null;
  planned_teknokratis_2026: number | null;
  planned_teknokratis_2027: number | null;
}

type CompareSide = 'A' | 'B' | 'C';

const SCORE_TYPE_GROUP_ORDER = [
  'Default',
  'Base ML',
  'Grid Search',
  'PolicyBoost Rerank',
  'Rerank Variants',
  'Rerank',
  'Other'
] as const;

function sanitizeFilePart(value: string): string {
  return (value || 'blank')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'blank';
}

function applyExportScope<T extends { rank: number }>(rows: T[], scope: ExportScope): T[] {
  if (scope === 'full') return rows;
  return rows.slice(0, scope);
}

function groupScoreType(scoreType: string): string {
  if (!scoreType) return 'Default';
  if (scoreType === 'base_ml') return 'Base ML';
  if (scoreType.startsWith('grid_')) return 'Grid Search';
  if (scoreType.startsWith('rerank_policy_boost')) return 'PolicyBoost Rerank';
  if (scoreType === 'rerank') return 'Rerank';
  if (scoreType.startsWith('rerank_')) return 'Rerank Variants';
  return 'Other';
}

function formatScoreTypeLabel(scoreType: string): string {
  return scoreType || '(default/blank)';
}

export function RankingComparePage() {
  const { data: appData, status, error } = useAppData();

  const [scenarioA, setScenarioA] = useState<string>('');
  const [modelA, setModelA] = useState<string>('');
  const [scenarioB, setScenarioB] = useState<string>('');
  const [modelB, setModelB] = useState<string>('');
  const [scenarioC, setScenarioC] = useState<string>(''); 
  const [modelC, setModelC] = useState<string>('');
  const [scoreTypeA, setScoreTypeA] = useState<string>('');
  const [scoreTypeB, setScoreTypeB] = useState<string>('');
  const [scoreTypeC, setScoreTypeC] = useState<string>('');
  
  const [topK, setTopK] = useState<number | 'all'>('all');
  const [search, setSearch] = useState<string>('');
  const [targetOnly, setTargetOnly] = useState<boolean>(false);
  const [targetType, setTargetType] = useState<TargetType>('planned_any_2026');
  const [exportScope, setExportScope] = useState<ExportScope>('full');
  const [scoreTypeSearchA, setScoreTypeSearchA] = useState<string>('');
  const [scoreTypeSearchB, setScoreTypeSearchB] = useState<string>('');
  const [scoreTypeSearchC, setScoreTypeSearchC] = useState<string>('');
  const [expandedScoreGroups, setExpandedScoreGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (appData && !scenarioA && appData.detectedScenarios.length > 0) {
      const allScen = appData.detectedScenarios;
      setScenarioA(allScen[0]);
      setScenarioB(allScen[1] || allScen[0]);
      setModelA(appData.detectedModels[0] ?? 'XGBoost');
      setModelB(appData.detectedModels[0] ?? 'XGBoost');
      setScenarioC('');
      setModelC(appData.detectedModels[0] ?? 'XGBoost');
    }
  }, [appData, scenarioA]);

  const getScoreTypes = (scen: string, model: string) => {
    if (!appData || !scen || !model) return [] as string[];
    return Array.from(
      new Set(
        (appData.indexes.rankingsByScenario.get(scen) || [])
          .filter(r => r.model === model)
          .map(r => r.score_type || '')
      )
    ).sort((a, b) => a.localeCompare(b));
  };

  const scoreTypesA = getScoreTypes(scenarioA, modelA);
  const scoreTypesB = getScoreTypes(scenarioB, modelB);
  const scoreTypesC = getScoreTypes(scenarioC, modelC);

  const pickDefaultScoreType = (scoreTypes: string[]) => {
    if (scoreTypes.length === 0) return '';
    if (scoreTypes.includes('pred_prob')) return 'pred_prob';
    if (scoreTypes.includes('base_ml')) return 'base_ml';
    if (scoreTypes.includes('rerank')) return 'rerank';
    if (scoreTypes.includes('')) return '';
    return scoreTypes[0];
  };

  useEffect(() => {
    const next = pickDefaultScoreType(scoreTypesA);
    if (!scoreTypesA.includes(scoreTypeA)) {
      setScoreTypeA(next);
    }
  }, [scenarioA, modelA, scoreTypeA, scoreTypesA.join('|')]);

  useEffect(() => {
    const next = pickDefaultScoreType(scoreTypesB);
    if (!scoreTypesB.includes(scoreTypeB)) {
      setScoreTypeB(next);
    }
  }, [scenarioB, modelB, scoreTypeB, scoreTypesB.join('|')]);

  useEffect(() => {
    const next = pickDefaultScoreType(scoreTypesC);
    if (!scoreTypesC.includes(scoreTypeC)) {
      setScoreTypeC(next);
    }
  }, [scenarioC, modelC, scoreTypeC, scoreTypesC.join('|')]);

  const { rows, metrics, similarities, rankingRowsA, rankingRowsB } = useMemo(() => {
    if (!appData || !scenarioA || !scenarioB || !modelA || !modelB) {
      return { rows: [], metrics: null, similarities: [], rankingRowsA: [], rankingRowsB: [], rankingRowsC: [] };
    }

    const getAllFiltered = (s: string, m: string, scoreType: string, applyPageTopK = true) => {
      let ranks = (appData.indexes.rankingsByScenario.get(s) || []).filter(r => r.model === m && (r.score_type || '') === scoreType);
      ranks = ranks.slice().sort((a,b) => a.rank - b.rank);
      if (applyPageTopK && topK !== 'all') {
        ranks = ranks.slice(0, Number(topK));
      }
      return ranks;
    };

    const fullDataA = getAllFiltered(scenarioA, modelA, scoreTypeA, false);
    const fullDataB = getAllFiltered(scenarioB, modelB, scoreTypeB, false);
    const fullDataC = scenarioC ? getAllFiltered(scenarioC, modelC, scoreTypeC, false) : [];

    const dataA = topK === 'all' ? fullDataA : fullDataA.slice(0, Number(topK));
    const dataB = topK === 'all' ? fullDataB : fullDataB.slice(0, Number(topK));
    const dataC = scenarioC ? (topK === 'all' ? fullDataC : fullDataC.slice(0, Number(topK))) : [];

    const mapA = new Map(dataA.map(r => [getRoadKey(r), r]));
    const mapB = new Map(dataB.map(r => [getRoadKey(r), r]));
    const mapC = new Map(dataC.map(r => [getRoadKey(r), r]));

    const allIds = Array.from(new Set([...mapA.keys(), ...mapB.keys(), ...mapC.keys()]));
    
    const rankMapA = new Map<string, number>();
    const rankMapB = new Map<string, number>();
    const rankMapC = new Map<string, number>();
    
    const combined: ComparisonRow[] = [];
    
    let hitAny = 0;
    let hitTender = 0;
    let hitPl = 0;
    let hitTek = 0;
    let hitTek2027 = 0;
    let hitSelected = 0;
    
    let overlapABC = 0; 
    let uniqueA = 0;
    let uniqueB = 0;

    for (const id of allIds) {
      const rA = mapA.get(id);
      const rB = mapB.get(id);
      const rC = mapC.get(id);
      
      if (rA) rankMapA.set(id, rA.rank);
      if (rB) rankMapB.set(id, rB.rank);
      if (rC) rankMapC.set(id, rC.rank);

      const inA = !!rA;
      const inB = !!rB;
      const inC = !!rC;

      if (scenarioC) {
         if (inA && inB && inC) overlapABC++;
         if (inA && !inB && !inC) uniqueA++;
         if (inB && !inA && !inC) uniqueB++;
      } else {
         if (inA && inB) overlapABC++;
         if (inA && !inB) uniqueA++;
         if (inB && !inA) uniqueB++;
      }

      const anyRecord = rA || rB || rC;
      const road_name = anyRecord?.road_name || 'Unknown';
      
      const pAny = anyRecord?.planned_any_2026 ?? null;
      const pTender = anyRecord?.planned_tender_2026 ?? null;
      const pPl = anyRecord?.planned_pl_2026 ?? null;
      const pTek = anyRecord?.planned_teknokratis_2026 ?? null;
      const pTek2027 = anyRecord?.planned_teknokratis_2027 ?? null;
      const selectedTargetHit = getTargetHitValue(
        {
          planned_any_2026: pAny,
          planned_tender_2026: pTender,
          planned_pl_2026: pPl,
          planned_teknokratis_2026: pTek,
          planned_teknokratis_2027: pTek2027
        },
        targetType
      );

      if (search && !road_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (targetOnly && !isTargetPositive(selectedTargetHit)) continue;

      if (isTargetPositive(pAny)) hitAny++;
      if (isTargetPositive(pTender)) hitTender++;
      if (isTargetPositive(pPl)) hitPl++;
      if (isTargetPositive(pTek)) hitTek++;
      if (isTargetPositive(pTek2027)) hitTek2027++;
      if (isTargetPositive(selectedTargetHit)) hitSelected++;

      combined.push({
        road_key: id,
        road_name,
        rankA: rA?.rank ?? null,
        rankB: rB?.rank ?? null,
        rankC: rC?.rank ?? null,
        scoreA: rA?.score ?? null,
        scoreB: rB?.score ?? null,
        scoreC: rC?.score ?? null,
        rankDiffAB: (rA && rB) ? rB.rank - rA.rank : null,
        absDiffAB: (rA && rB) ? Math.abs(rB.rank - rA.rank) : null,
        planned_any: pAny,
        planned_tender: pTender,
        planned_pl: pPl,
        planned_teknokratis: pTek,
        planned_teknokratis_2027: pTek2027,
        selectedTargetHit,
        scoreTypeA: rA?.score_type ?? null,
        scoreTypeB: rB?.score_type ?? null,
        scoreTypeC: rC?.score_type ?? null
      });
    }

    combined.sort((a,b) => (b.absDiffAB || 0) - (a.absDiffAB || 0));

    const simMatrix = [];
    simMatrix.push({
       pair: 'A vs B', 
       overlap: computeOverlapSet(new Set(rankMapA.keys()), new Set(rankMapB.keys())).size, 
       jaccard: computeJaccardSimilarity(new Set(rankMapA.keys()), new Set(rankMapB.keys())), 
       spearman: computeSpearmanCorrelation(rankMapA, rankMapB)
    });
    if (scenarioC) {
      simMatrix.push({
         pair: 'A vs C', 
         overlap: computeOverlapSet(new Set(rankMapA.keys()), new Set(rankMapC.keys())).size, 
         jaccard: computeJaccardSimilarity(new Set(rankMapA.keys()), new Set(rankMapC.keys())), 
         spearman: computeSpearmanCorrelation(rankMapA, rankMapC)
      });
      simMatrix.push({
         pair: 'B vs C', 
         overlap: computeOverlapSet(new Set(rankMapB.keys()), new Set(rankMapC.keys())).size, 
         jaccard: computeJaccardSimilarity(new Set(rankMapB.keys()), new Set(rankMapC.keys())), 
         spearman: computeSpearmanCorrelation(rankMapB, rankMapC)
      });
    }

    return { 
      rows: combined, 
      metrics: { hitAny, hitTender, hitPl, hitTek, hitTek2027, hitSelected, overlapABC, uniqueA, uniqueB, unionCount: allIds.length },
      similarities: simMatrix,
      rankingRowsA: fullDataA,
      rankingRowsB: fullDataB,
      rankingRowsC: fullDataC
    };
  }, [appData, scenarioA, modelA, scoreTypeA, scenarioB, modelB, scoreTypeB, scenarioC, modelC, scoreTypeC, topK, search, targetOnly, targetType]);

  const columns: ColumnDef<ComparisonRow>[] = [
    {
      accessorKey: 'road_name',
      header: 'Road Segment',
      cell: (info) => (
        <div className="flex flex-col min-w-[180px]">
          <span className="font-bold text-slate-800 leading-tight break-words">{info.getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'selectedTargetHit',
      header: `TGT: ${TARGET_LABELS[targetType]}`,
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (!isTargetKnown(val)) return <span className="text-amber-400 mx-auto text-[9px] font-bold italic" title="Target data unavailable">N/A</span>;
        return isTargetPositive(val) ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 mx-auto">—</span>;
      }
    },
    {
      accessorKey: 'rankDiffAB',
      header: 'Δ (B-A)',
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (val === null) return <span className="text-slate-200">—</span>;
        if (val > 0) return <span className="text-emerald-700 font-mono text-xs font-black">+{val}</span>;
        if (val < 0) return <span className="text-rose-600 font-mono text-xs font-black">{val}</span>;
        return <span className="text-slate-400 font-mono text-xs">0</span>;
      },
    },
    {
      accessorKey: 'absDiffAB',
      header: '|Δ|',
      cell: (info) => <div className="text-slate-500 text-xs font-mono font-bold">{info.getValue() as number ?? '—'}</div>
    },
    {
      accessorKey: 'rankA',
      header: 'Rank A',
      cell: (info) => <div className="font-mono font-black text-slate-900 text-xs">{info.getValue() as number || '—'}</div>
    },
    {
      accessorKey: 'rankB',
      header: 'Rank B',
      cell: (info) => <div className="font-mono font-black text-slate-900 text-xs">{info.getValue() as number || '—'}</div>
    }
  ];

  if (scenarioC) {
     columns.push({
       accessorKey: 'rankC',
       header: 'Rank C',
       cell: (info) => <div className="font-mono font-black text-slate-900 text-xs">{info.getValue() as number || '—'}</div>
     });
  }

  if (status === 'loading') return <LoadingState message="Computing index intersections..." />;
  if (status === 'error') return <EmptyState title="Error" message={error || 'Failed to load data.'} />;
  if (!appData) return <EmptyState />;

  const scenariosList = appData.detectedScenarios.map(id => {
    const s = appData.scenarios.find(x => x.scenario_id === id);
    return { id, label: s ? s.scenario_label : id };
  });
  
  const getModels = (scen: string) => {
    if (!scen) return [];
    const smodels = new Set((appData.indexes.rankingsByScenario.get(scen) || []).map(r => r.model));
    return smodels.size > 0 ? Array.from(smodels) : appData.detectedModels;
  };

  const modelsA = getModels(scenarioA);
  const modelsB = getModels(scenarioB);
  const modelsC = getModels(scenarioC);

  const roadMetaMap = new Map<string, RoadMeta>();
  for (const row of appData.targetRows) {
    const roadKey = getRoadKey(row);
    const anyRow = row as TargetRow & Record<string, unknown>;
    const existing = roadMetaMap.get(roadKey);
    roadMetaMap.set(roadKey, {
      road_name: row.road_name || existing?.road_name || 'Unknown',
      nomor_ruas: String(anyRow.nomor_ruas ?? existing?.nomor_ruas ?? ''),
      desa_yang_dilalui: String(anyRow.desa_yang_dilalui ?? existing?.desa_yang_dilalui ?? ''),
      kecamatan_yang_dilalui: String(anyRow.kecamatan_yang_dilalui ?? existing?.kecamatan_yang_dilalui ?? ''),
      planned_any_2026: row.planned_any_2026 ?? existing?.planned_any_2026 ?? null,
      planned_tender_2026: row.planned_tender_2026 ?? existing?.planned_tender_2026 ?? null,
      planned_pl_2026: row.planned_pl_2026 ?? existing?.planned_pl_2026 ?? null,
      planned_teknokratis_2026: row.planned_teknokratis_2026 ?? existing?.planned_teknokratis_2026 ?? null,
      planned_teknokratis_2027: row.planned_teknokratis_2027 ?? existing?.planned_teknokratis_2027 ?? null,
    });
  }

  const scenarioLabelMap = new Map(appData.scenarios.map((row) => [row.scenario_id, row.scenario_label]));
  const scoreTypeLabelA = scoreTypeA || 'blank';
  const scoreTypeLabelB = scoreTypeB || 'blank';

  const universeCount = appData.indexes.rankingsByRoadKey.size;
  const partialUniverseWarnings: string[] = [];
  if (rankingRowsA.length > 0 && rankingRowsA.length < universeCount) {
    partialUniverseWarnings.push(`Ranking A has ${rankingRowsA.length} rows, below the ${universeCount}-road universe. Export includes available rows only.`);
  }
  if (rankingRowsB.length > 0 && rankingRowsB.length < universeCount) {
    partialUniverseWarnings.push(`Ranking B has ${rankingRowsB.length} rows, below the ${universeCount}-road universe. Export includes available rows only.`);
  }

  const buildStandaloneExportRows = (rowsForSide: RankingRow[], scenarioId: string, model: string) => {
    const scopedRows = applyExportScope(rowsForSide, exportScope);
    return scopedRows.map((row, index) => {
      const roadKey = getRoadKey(row);
      const meta = roadMetaMap.get(roadKey);
      const anyRow = row as RankingRow & Record<string, unknown>;
      const selectedTargetHitValue = getTargetHitValue(
        {
          planned_any_2026: meta?.planned_any_2026 ?? row.planned_any_2026 ?? null,
          planned_tender_2026: meta?.planned_tender_2026 ?? row.planned_tender_2026 ?? null,
          planned_pl_2026: meta?.planned_pl_2026 ?? row.planned_pl_2026 ?? null,
          planned_teknokratis_2026: meta?.planned_teknokratis_2026 ?? row.planned_teknokratis_2026 ?? null,
          planned_teknokratis_2027: meta?.planned_teknokratis_2027 ?? row.planned_teknokratis_2027 ?? null
        },
        targetType
      );
      return {
        export_rank: index + 1,
        rank: row.rank ?? '',
        road_key: roadKey,
        road_name: meta?.road_name || row.road_name || 'Unknown',
        nomor_ruas: meta?.nomor_ruas || '',
        desa_yang_dilalui: meta?.desa_yang_dilalui || '',
        kecamatan_yang_dilalui: meta?.kecamatan_yang_dilalui || '',
        scenario_label: scenarioLabelMap.get(scenarioId) || scenarioId,
        scenario_key: scenarioId,
        scenario_id: scenarioId,
        model_name: model,
        model_key: model,
        model,
        score_type: row.score_type || '',
        score: row.score ?? '',
        pred_prob: anyRow.pred_prob ?? '',
        final_score: anyRow.final_score ?? '',
        base_prob: anyRow.base_prob ?? '',
        rerank_score: anyRow.rerank_score ?? '',
        selected_target_def_label: TARGET_LABELS[targetType],
        selected_target_def_key: targetType,
        selected_target_hit_value: selectedTargetHitValue ?? '',
        planned_any_2026: meta?.planned_any_2026 ?? row.planned_any_2026 ?? '',
        planned_tender_2026: meta?.planned_tender_2026 ?? row.planned_tender_2026 ?? '',
        planned_pl_2026: meta?.planned_pl_2026 ?? row.planned_pl_2026 ?? '',
        planned_teknokratis_2026: meta?.planned_teknokratis_2026 ?? row.planned_teknokratis_2026 ?? '',
        planned_teknokratis_2027: meta?.planned_teknokratis_2027 ?? row.planned_teknokratis_2027 ?? '',
        target_any: meta?.planned_any_2026 ?? row.planned_any_2026 ?? '',
        target_tender: meta?.planned_tender_2026 ?? row.planned_tender_2026 ?? '',
        target_pl: meta?.planned_pl_2026 ?? row.planned_pl_2026 ?? '',
        target_teknokratis: meta?.planned_teknokratis_2026 ?? row.planned_teknokratis_2026 ?? '',
        is_top35: index + 1 <= 35 ? 1 : 0,
        is_top70: index + 1 <= 70 ? 1 : 0,
        is_top105: index + 1 <= 105 ? 1 : 0
      };
    });
  };

  const buildCompareExportRows = () => {
    return rows
      .filter((row) => {
        if (exportScope === 'full') return true;
        const inA = row.rankA !== null && row.rankA <= exportScope;
        const inB = row.rankB !== null && row.rankB <= exportScope;
        return inA || inB;
      })
      .map((row) => {
        const delta = row.rankDiffAB;
        let direction = 'tidak lengkap';
        if (delta !== null) {
          if (delta < 0) direction = 'B naik dibanding A';
          else if (delta > 0) direction = 'B turun dibanding A';
          else direction = 'sama';
        }
        return {
          scenario_label_A: scenarioLabelMap.get(scenarioA) || scenarioA,
          scenario_key_A: scenarioA,
          model_name_A: modelA,
          model_key_A: modelA,
          scenario_label_B: scenarioLabelMap.get(scenarioB) || scenarioB,
          scenario_key_B: scenarioB,
          model_name_B: modelB,
          model_key_B: modelB,
          road_key: row.road_key,
          road_name: row.road_name,
          selected_target_def_label: TARGET_LABELS[targetType],
          selected_target_def_key: targetType,
          selected_target_hit_value: row.selectedTargetHit ?? '',
          planned_any_2026: row.planned_any,
          planned_tender_2026: row.planned_tender,
          planned_pl_2026: row.planned_pl,
          planned_teknokratis_2026: row.planned_teknokratis,
          planned_teknokratis_2027: row.planned_teknokratis_2027,
          target_any: row.planned_any,
          target_tender: row.planned_tender,
          target_pl: row.planned_pl,
          target_teknokratis: row.planned_teknokratis,
          scenario_A: scenarioA,
          model_A: modelA,
          score_type_A: row.scoreTypeA || '',
          rank_A: row.rankA ?? '',
          score_A: row.scoreA ?? '',
          scenario_B: scenarioB,
          model_B: modelB,
          score_type_B: row.scoreTypeB || '',
          rank_B: row.rankB ?? '',
          score_B: row.scoreB ?? '',
          abs_delta_AB: row.absDiffAB ?? '',
          rank_B_minus_rank_A: delta ?? '',
          direction,
          is_top35_A: row.rankA !== null && row.rankA <= 35 ? 1 : 0,
          is_top70_A: row.rankA !== null && row.rankA <= 70 ? 1 : 0,
          is_top105_A: row.rankA !== null && row.rankA <= 105 ? 1 : 0,
          is_top35_B: row.rankB !== null && row.rankB <= 35 ? 1 : 0,
          is_top70_B: row.rankB !== null && row.rankB <= 70 ? 1 : 0,
          is_top105_B: row.rankB !== null && row.rankB <= 105 ? 1 : 0
        };
      });
  };

  const compareExportHeaders = [
    'scenario_label_A', 'scenario_key_A', 'model_name_A', 'model_key_A',
    'scenario_label_B', 'scenario_key_B', 'model_name_B', 'model_key_B',
    'road_key', 'road_name',
    'selected_target_def_label', 'selected_target_def_key', 'selected_target_hit_value',
    'planned_any_2026', 'planned_tender_2026', 'planned_pl_2026', 'planned_teknokratis_2026', 'planned_teknokratis_2027',
    'target_any', 'target_tender', 'target_pl', 'target_teknokratis',
    'scenario_A', 'model_A', 'score_type_A', 'rank_A', 'score_A',
    'scenario_B', 'model_B', 'score_type_B', 'rank_B', 'score_B',
    'abs_delta_AB', 'rank_B_minus_rank_A', 'direction',
    'is_top35_A', 'is_top70_A', 'is_top105_A',
    'is_top35_B', 'is_top70_B', 'is_top105_B'
  ];

  const standaloneExportHeaders = [
    'export_rank', 'rank', 'road_key', 'road_name', 'nomor_ruas', 'desa_yang_dilalui', 'kecamatan_yang_dilalui',
    'scenario_label', 'scenario_key', 'scenario_id', 'model_name', 'model_key', 'model', 'score_type',
    'score', 'pred_prob', 'final_score', 'base_prob', 'rerank_score',
    'selected_target_def_label', 'selected_target_def_key', 'selected_target_hit_value',
    'planned_any_2026', 'planned_tender_2026', 'planned_pl_2026', 'planned_teknokratis_2026', 'planned_teknokratis_2027',
    'target_any', 'target_tender', 'target_pl', 'target_teknokratis', 'is_top35', 'is_top70', 'is_top105'
  ];

  const handleExportCompare = (format: 'csv' | 'tsv') => {
    const compareRows = buildCompareExportRows();
    const filename = `ranking_compare__${sanitizeFilePart(scenarioA)}_${sanitizeFilePart(modelA)}_${sanitizeFilePart(scoreTypeLabelA)}__vs__${sanitizeFilePart(scenarioB)}_${sanitizeFilePart(modelB)}_${sanitizeFilePart(scoreTypeLabelB)}__${sanitizeFilePart(targetType)}`;
    const exportFn = format === 'tsv' ? exportToTsv : exportToCsv;
    exportFn(filename, compareRows, compareExportHeaders, compareExportHeaders);
  };

  const handleExportRankingA = () => {
    if (rankingRowsA.length < appData.indexes.rankingsByRoadKey.size) {
      console.warn(`[RankingComparePage] Ranking A export is partial: ${rankingRowsA.length} rows available for ${scenarioA} / ${modelA}.`);
    }
    exportToCsv(
      `ranking_A__${sanitizeFilePart(scenarioA)}_${sanitizeFilePart(modelA)}_${sanitizeFilePart(scoreTypeLabelA)}`,
      buildStandaloneExportRows(rankingRowsA, scenarioA, modelA),
      standaloneExportHeaders,
      standaloneExportHeaders
    );
  };

  const handleExportRankingB = () => {
    if (rankingRowsB.length < appData.indexes.rankingsByRoadKey.size) {
      console.warn(`[RankingComparePage] Ranking B export is partial: ${rankingRowsB.length} rows available for ${scenarioB} / ${modelB}.`);
    }
    exportToCsv(
      `ranking_B__${sanitizeFilePart(scenarioB)}_${sanitizeFilePart(modelB)}_${sanitizeFilePart(scoreTypeLabelB)}`,
      buildStandaloneExportRows(rankingRowsB, scenarioB, modelB),
      standaloneExportHeaders,
      standaloneExportHeaders
    );
  };

  const toggleScoreGroup = (side: CompareSide, group: string) => {
    const key = `${side}:${group}`;
    setExpandedScoreGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderScoreTypePicker = (
    side: CompareSide,
    scoreTypes: string[],
    selectedScoreType: string,
    setSelectedScoreType: (value: string) => void,
    searchValue: string,
    setSearchValue: (value: string) => void
  ) => {
    if (scoreTypes.length <= 1) {
      return (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Score Type
          </div>
          <div className="mt-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
            {formatScoreTypeLabel(selectedScoreType)}
          </div>
        </div>
      );
    }

    const filteredScoreTypes = scoreTypes.filter(scoreType =>
      formatScoreTypeLabel(scoreType).toLowerCase().includes(searchValue.toLowerCase())
    );

    const grouped = SCORE_TYPE_GROUP_ORDER
      .map(group => ({
        group,
        scoreTypes: filteredScoreTypes.filter(scoreType => groupScoreType(scoreType) === group)
      }))
      .filter(group => group.scoreTypes.length > 0);

    const visibleCount = filteredScoreTypes.length;

    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Score Type
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
              <span className="rounded-full bg-white px-2 py-1 font-bold text-slate-700" title={formatScoreTypeLabel(selectedScoreType)}>
                Selected: {formatScoreTypeLabel(selectedScoreType)}
              </span>
              <span className="font-semibold text-slate-500">
                {visibleCount} filtered, total {scoreTypes.length}
              </span>
            </div>
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Filter score type..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-50 md:w-52"
          />
        </div>
        <div className="mt-3 space-y-2">
          {grouped.map(({ group, scoreTypes: groupScoreTypes }) => {
            const key = `${side}:${group}`;
            const autoExpanded = groupScoreTypes.includes(selectedScoreType) || grouped.length === 1;
            const isExpanded = expandedScoreGroups[key] ?? autoExpanded;
            return (
              <div key={key} className="rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleScoreGroup(side, group)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                    {group}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {groupScoreTypes.length} {isExpanded ? 'hide' : 'show'}
                  </span>
                </button>
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-slate-100 px-3 py-3">
                    <div className="flex min-w-max gap-2">
                      {groupScoreTypes.map(scoreType => {
                        const active = scoreType === selectedScoreType;
                        return (
                          <button
                            key={`${side}:${scoreType || 'blank'}`}
                            type="button"
                            title={formatScoreTypeLabel(scoreType)}
                            onClick={() => setSelectedScoreType(scoreType)}
                            className={`max-w-[220px] truncate rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                              active
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {formatScoreTypeLabel(scoreType)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {grouped.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
              No score type matches the current filter.
            </div>
          )}
        </div>
      </div>
    );
  };

  const scatterData = rows.filter(r => r.rankA != null && r.rankB != null).map(r => ({
    name: r.road_name,
    x: r.rankA,
    y: r.rankB,
    z: r.absDiffAB || 1
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 overflow-x-hidden">
      
      {/* Configuration Matrix */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-end">
         <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">A: Primary Reference</label>
            <div className="flex gap-2">
              <select value={scenarioA} onChange={e => setScenarioA(e.target.value)} className="flex-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select value={modelA} onChange={e => setModelA(e.target.value)} className="w-28 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                {modelsA.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {renderScoreTypePicker('A', scoreTypesA, scoreTypeA, setScoreTypeA, scoreTypeSearchA, setScoreTypeSearchA)}
         </div>
         <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">B: Comparison Subject</label>
            <div className="flex gap-2">
              <select value={scenarioB} onChange={e => setScenarioB(e.target.value)} className="flex-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select value={modelB} onChange={e => setModelB(e.target.value)} className="w-28 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                {modelsB.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {renderScoreTypePicker('B', scoreTypesB, scoreTypeB, setScoreTypeB, scoreTypeSearchB, setScoreTypeSearchB)}
         </div>
         <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">C: Control Subject (Optional)</label>
            <div className="flex gap-2">
              <select value={scenarioC} onChange={e => setScenarioC(e.target.value)} className="flex-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                <option value="">(None)</option>
                {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {scenarioC && (
                 <select value={modelC} onChange={e => setModelC(e.target.value)} className="w-28 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
                   {modelsC.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
              )}
            </div>
            {scenarioC && renderScoreTypePicker('C', scoreTypesC, scoreTypeC, setScoreTypeC, scoreTypeSearchC, setScoreTypeSearchC)}
         </div>
         <div className="space-y-2 xl:pl-6 xl:border-l border-slate-100 flex flex-col justify-end">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Def</label>
                <select
                  value={targetType}
                  onChange={e => setTargetType(e.target.value as TargetType)}
                  className="mt-2 w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none"
                >
                  <option value="planned_any_2026">Any 2026</option>
                  <option value="planned_tender_2026">Tender 2026</option>
                  <option value="planned_pl_2026">PL 2026</option>
                  <option value="planned_teknokratis_2026">Tekno 2026</option>
                  <option value="planned_teknokratis_2027">Tekno 2027</option>
                  <option value="both">Both (Any/Tender)</option>
                </select>
              </div>
            <div className="flex gap-3">
              <div className="flex-1">
                 <select value={topK} onChange={e => setTopK(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-full text-xs font-black rounded-lg border border-slate-300 bg-white p-2 outline-none uppercase tracking-tighter">
                   {TOP_K_OPTIONS.map(k => <option key={k} value={k}>{`Top ${k} Only`}</option>)}
                   <option value="all">View Complete Array</option>
                 </select>
              </div>
              <div className="flex items-center gap-2">
                 <input type="checkbox" id="tgt_chk" checked={targetOnly} onChange={e=>setTargetOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                 <label htmlFor="tgt_chk" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">
                   {`Target Filter: ${TARGET_LABELS[targetType]}`}
                 </label>
              </div>
            </div>
            </div>
         </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
             label={scenarioC ? "Irisan Top-K (AnBnC)" : "Irisan Top-K (AnB)"} 
             value={metrics.overlapABC} 
             subtitle={`Universe: ${appData.indexes.rankingsByRoadKey.size} segments`}
          />
          <MetricCard 
             label="Exclusive to A" 
             value={metrics.uniqueA} 
             subtitle="Absence in other subject arrays"
          />
          <MetricCard 
             label="Exclusive to B" 
             value={metrics.uniqueB} 
             subtitle="Absence in reference arrays"
          />
          <MetricCard 
             label={`Target Capture: ${TARGET_LABELS[targetType]}`}
             value={metrics.hitSelected} 
             subtitle={`Any ${metrics.hitAny} / Tender ${metrics.hitTender} / PL ${metrics.hitPl} / Tekno26 ${metrics.hitTek} / Tekno27 ${metrics.hitTek2027}`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <ChartCard 
            title="Comparative Analysis Table" 
            subtitle={`Perbandingan irisan Top-K antar konfigurasi ranking terpilih (${rows.length} segmen). Prioritas berdasarkan ? Rank.`}
            actions={
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  <input type="text" placeholder="Search by segment name..." value={search} onChange={e=>setSearch(e.target.value)} className="text-xs font-semibold border border-slate-300 p-2 rounded-lg w-48 outline-none focus:ring-2 focus:ring-blue-50 bg-slate-50" />
                  <select value={String(exportScope)} onChange={e => setExportScope(e.target.value === 'full' ? 'full' : Number(e.target.value) as ExportScope)} className="text-[11px] font-black rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none uppercase tracking-tight">
                    <option value="full">Full ranking</option>
                    <option value="35">Top-35</option>
                    <option value="70">Top-70</option>
                    <option value="105">Top-105</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button onClick={() => handleExportCompare('csv')} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition transform active:scale-95">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                  <button onClick={() => handleExportCompare('tsv')} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest bg-slate-700 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-slate-600 transition transform active:scale-95">
                    <Download className="w-3.5 h-3.5" /> Export TSV
                  </button>
                  <button onClick={handleExportRankingA} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest bg-blue-700 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-blue-600 transition transform active:scale-95">
                    <Download className="w-3.5 h-3.5" /> Export Ranking A CSV
                  </button>
                  <button onClick={handleExportRankingB} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest bg-emerald-700 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-emerald-600 transition transform active:scale-95">
                    <Download className="w-3.5 h-3.5" /> Export Ranking B CSV
                  </button>
                </div>
                {partialUniverseWarnings.length > 0 && (
                  <div className="text-right text-[10px] font-semibold text-amber-600">
                    {partialUniverseWarnings.map((note) => (
                      <div key={note}>{note}</div>
                    ))}
                  </div>
                )}
              </div>
            }
          >
             <div className="overflow-auto max-h-[600px] scrollbar-thin">
                {rows.length > 0 ? (
                  <DataTable columns={columns} data={rows} pageSize={20} />
                ) : (
                  <EmptyState title="Konfigurasi Ranking Tidak Memiliki Baris" message="Tidak ada baris ranking untuk kombinasi skenario, model, dan score_type yang dipilih pada Top-K ini." />
                )}
             </div>
          </ChartCard>
        </div>

        <div className="space-y-8">
           <ChartCard title="Rank Correlation Statistics" subtitle="Kemiripan statistik antar konfigurasi ranking terpilih.">
             <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-500 uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="p-3">Reference Pair</th>
                      <th className="p-3 text-right">Jaccard</th>
                      <th className="p-3 text-right">Spearman ρ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {similarities.map((sim, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-700 text-xs">{sim.pair}</td>
                        <td className="p-3 text-right font-mono text-slate-600 font-bold text-xs">{fmt(sim.jaccard, 3)}</td>
                        <td className="p-3 text-right font-mono text-blue-700 font-black text-xs">{fmt(sim.spearman, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </ChartCard>

           <ChartCard title="Dispersion Overlay (A vs B)" subtitle="Sebaran perpindahan rank antar dua konfigurasi ranking (A vs B).">
             {scatterData.length > 0 ? (
               <div className="pt-4 pr-4">
                 <ResponsiveContainer width="100%" height={280}>
                   <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                     <XAxis type="number" dataKey="x" name="Rank A" domain={['dataMin', 'dataMax']} reversed tick={{fontSize: 10, fill: '#94a3b8'}} label={{ value: 'Rank A (Primary)', position: 'bottom', offset: 5, fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                     <YAxis type="number" dataKey="y" name="Rank B" domain={['dataMin', 'dataMax']} reversed tick={{fontSize: 10, fill: '#94a3b8'}} label={{ value: 'Rank B', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                     <ZAxis type="number" dataKey="z" range={[20, 150]} />
                     <RTooltip 
                        cursor={{strokeDasharray: '3 3'}}
                        contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any) => [val, 'Rank']}
                     />
                     <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.6} />
                   </ScatterChart>
                 </ResponsiveContainer>
               </div>
             ) : (
               <div className="h-[200px] flex items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-400 italic">Insufficient overlap for dispersion mapping.</p>
               </div>
             )}
           </ChartCard>
        </div>
      </div>
    </div>
  );
}

