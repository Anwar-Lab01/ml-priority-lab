import { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  StickyNote,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { CandidateBasketItem, CandidateStatus, PlanningNote, MLPriorityMetadata, MLPriorityScore, MLPriorityScoresByRoadKey } from '../../../../lib/treatmentTypes';
import {
  runScenarioOptimizationPreview,
  type HistoricalTreatmentContext,
  type OptimizationRoadInput,
  type ScenarioOptimizationCandidate,
  type ScenarioOptimizationPreviewResult,
} from '../../../../lib/treatmentOptimization';

type ScenarioKecamatanSummaryItem = {
  kecamatan: string;
  road_count: number;
  total_pagu_indikatif_rp: number;
  included_count: number;
  force_include_count: number;
  deferred_count: number;
  force_exclude_count: number;
};

type MLOptimizationComparisonLabel =
  | 'Aligned'
  | 'Condition/Budget Selected'
  | 'ML High, Budget Deferred'
  | 'Manually Deferred'
  | 'Force Included'
  | 'Force Excluded'
  | 'Not Selected';

type MLOptimizationComparison = {
  label: MLOptimizationComparisonLabel;
  detail: string;
  badgeClassName: string;
};

type ScenarioPanelTab = 'candidates' | 'budget' | 'optimization';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScenarioPanelProps {
  candidateBasket: Record<string, CandidateBasketItem>;
  planningNotes: Record<string, PlanningNote>;
  scenarioKecamatanSummary: ScenarioKecamatanSummaryItem[];
  scenarioKecamatanSummaryHasMultiKecamatanRoads: boolean;
  optimizationRoadLookup: Map<string, OptimizationRoadInput>;
  optimizationHistoryLookup: Map<string, HistoricalTreatmentContext>;
  mlPriorityScores: Record<string, MLPriorityScore> | null;
  mlPriorityMetadata: MLPriorityMetadata | null;
  mlPriorityConfigurations?: MLPriorityScoresByRoadKey['configurations'] | null;
  removeFromCandidateBasket: (road_key: string) => void;
  setCandidateStatus: (road_key: string, status: CandidateStatus) => void;
  onSelectRoad?: (road_key: string) => void;
  onClearScenario?: () => void;
  onSyncScenario?: () => void;
  onOptimizationPreviewChange?: (preview: ScenarioOptimizationPreviewResult) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: CandidateStatus[] = ['force_include', 'included', 'deferred', 'force_exclude'];

const STATUS_META: Record<CandidateStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  force_include: { label: 'Force Include', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  included:      { label: 'Included',      color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  deferred:      { label: 'Deferred',      color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  force_exclude: { label: 'Force Exclude', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500' },
};

const ML_COMPARISON_META: Record<MLOptimizationComparisonLabel, { badgeClassName: string; detail: string }> = {
  'Aligned': {
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    detail: 'Optimized selected and present in Top-35/70/105 ML context.',
  },
  'Condition/Budget Selected': {
    badgeClassName: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    detail: 'Optimized selected by condition/budget preview; outside Top-105 or no ML record.',
  },
  'ML High, Budget Deferred': {
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    detail: 'Top-35/70 ML context, but deferred by current optimization budget preview.',
  },
  'Manually Deferred': {
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-600',
    detail: 'Candidate status is manually deferred.',
  },
  'Force Included': {
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    detail: 'Candidate status is force_include.',
  },
  'Force Excluded': {
    badgeClassName: 'border-red-200 bg-red-50 text-red-700',
    detail: 'Candidate status is force_exclude.',
  },
  'Not Selected': {
    badgeClassName: 'border-slate-200 bg-white text-slate-500',
    detail: 'Not selected by the current optimization preview.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRp(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(2)} M`;
  if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
}

function getOptimizationReason(candidate: ScenarioOptimizationCandidate): string {
  return [
    `urgency ${candidate.score.condition_urgency_score.toFixed(2)}`,
    `gap ${candidate.score.historical_gap_score.toFixed(2)}`,
    `efficiency ${candidate.score.cost_efficiency_score.toFixed(2)}`,
  ].join(' / ');
}

// ── Funded/Deferred Budget Preview Logic ────────────────────────────────────

interface PreviewResult {
  funded: CandidateBasketItem[];
  deferred: CandidateBasketItem[];
  totalFundedRp: number;
  totalForceIncludeRp: number;
  forceExcluded: CandidateBasketItem[];
}

function computeBudgetPreview(
  items: CandidateBasketItem[],
  capRp: number | null,
): PreviewResult {
  const forceIncluded = items.filter(i => i.status === 'force_include');
  const normal        = items.filter(i => i.status === 'included').sort(
    (a, b) => (b.pagu_indikatif_rp ?? 0) - (a.pagu_indikatif_rp ?? 0),
  );
  const deferredFixed = items.filter(i => i.status === 'deferred');
  const forceExcluded = items.filter(i => i.status === 'force_exclude');

  const totalForceIncludeRp = forceIncluded.reduce((s, i) => s + (i.pagu_indikatif_rp ?? 0), 0);

  if (capRp == null) {
    return {
      funded:               [...forceIncluded, ...normal],
      deferred:             [...deferredFixed],
      forceExcluded,
      totalFundedRp:        totalForceIncludeRp + normal.reduce((s, i) => s + (i.pagu_indikatif_rp ?? 0), 0),
      totalForceIncludeRp,
    };
  }

  let remaining = capRp - totalForceIncludeRp;
  const funded: CandidateBasketItem[] = [...forceIncluded];
  const deferred: CandidateBasketItem[] = [...deferredFixed];
  let totalFundedRp = totalForceIncludeRp;

  for (const item of normal) {
    const cost = item.pagu_indikatif_rp ?? 0;
    if (cost <= remaining) {
      funded.push(item);
      remaining -= cost;
      totalFundedRp += cost;
    } else {
      deferred.push(item);
    }
  }

  return { funded, deferred, forceExcluded, totalFundedRp, totalForceIncludeRp };
}

// ── Row Component ─────────────────────────────────────────────────────────────

interface RowProps {
  item: CandidateBasketItem;
  note: PlanningNote | undefined;
  isFunded: boolean;
  isForceExcluded: boolean;
  comparison?: MLOptimizationComparison;
  mlScore?: MLPriorityScore | null;
  onRemove: () => void;
  onSetStatus: (status: CandidateStatus) => void;
  onSelectRoad?: (road_key: string) => void;
}

function CandidateRow({ item, note, isFunded, isForceExcluded, comparison, mlScore, onRemove, onSetStatus, onSelectRoad }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[item.status];

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      isForceExcluded ? 'opacity-50' : ''
    } ${meta.border} ${meta.bg}`}>
      {/* Main Row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Status dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />

        {/* Road name */}
        <div 
          className="flex-1 min-w-0 cursor-pointer group hover:bg-white/60 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
          onClick={() => onSelectRoad?.(item.road_key)}
          title="Focus map on this road"
        >
          <p className="text-[11px] font-semibold text-slate-800 leading-tight truncate group-hover:text-violet-700 transition-colors">
            {item.canonical_road_name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[9px] font-mono text-slate-400 truncate">{item.road_key}</p>
            <span className="text-[9px] font-semibold text-sky-600">
              ML {mlScore?.rank != null ? `#${mlScore.rank}` : '—'}
              {mlScore?.score != null ? ` / ${mlScore.score.toFixed(3)}` : ''}
            </span>
            <span className="text-[8px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest bg-violet-100 px-1 rounded">Focus Map</span>
          </div>
        </div>

        {/* Budget */}
        <div className="shrink-0 text-right">
          <p className={`text-[11px] font-bold ${isFunded && !isForceExcluded ? 'text-emerald-700' : 'text-slate-400'}`}>
            {formatRp(item.pagu_indikatif_rp)}
          </p>
          {item.asb_type && (
            <p className="text-[9px] text-slate-400">ASB {item.asb_type}</p>
          )}
        </div>

        {/* Status badge */}
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.border} ${meta.color}`}>
          {meta.label}
        </span>

        {comparison && (
          <span
            className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold md:inline-flex ${comparison.badgeClassName}`}
            title={comparison.detail}
          >
            {comparison.label}
          </span>
        )}

        {/* Note indicator */}
        {note && (
          <StickyNote className="shrink-0 h-3.5 w-3.5 text-amber-500" />
        )}

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white px-3 py-2 space-y-2">
          {/* Status toggle row */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_META) as CandidateStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onSetStatus(s)}
                className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold transition-colors ${
                  item.status === s
                    ? `${STATUS_META[s].border} ${STATUS_META[s].bg} ${STATUS_META[s].color} ring-1 ring-offset-1 ${STATUS_META[s].border}`
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          {/* Treatment category & ASB type */}
          {(item.treatment_category || item.asb_type) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
              {item.treatment_category && (
                <span>Category: <strong className="text-slate-700">{item.treatment_category}</strong></span>
              )}
              {item.asb_type && (
                <span>ASB: <strong className="text-slate-700">{item.asb_type}</strong></span>
              )}
            </div>
          )}

          {comparison && (
            <div className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${comparison.badgeClassName}`}>
              {comparison.label}: <span className="ml-1 font-medium">{comparison.detail}</span>
            </div>
          )}

          {/* Planning note */}
          {note && (
            <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-0.5">Note</p>
              <p className="text-[10px] text-amber-800 leading-relaxed">{note.note}</p>
            </div>
          )}

          {/* Remove */}
          <button
            onClick={onRemove}
            className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Remove from scenario
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ScenarioPanel ────────────────────────────────────────────────────────

export function ScenarioPanel({
  candidateBasket,
  planningNotes,
  scenarioKecamatanSummary,
  scenarioKecamatanSummaryHasMultiKecamatanRoads,
  optimizationRoadLookup,
  optimizationHistoryLookup,
  mlPriorityScores,
  mlPriorityMetadata,
  mlPriorityConfigurations,
  removeFromCandidateBasket,
  setCandidateStatus,
  onSelectRoad,
  onClearScenario,
  onSyncScenario,
  onOptimizationPreviewChange,
}: ScenarioPanelProps) {
  const [budgetCapInput, setBudgetCapInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<ScenarioPanelTab>('candidates');
  const [selectedMlScenario, setSelectedMlScenario] = useState('refined_recall_max_any2026');
  const [selectedMlModel, setSelectedMlModel] = useState('RandomForest');
  const [selectedMlScoreType, setSelectedMlScoreType] = useState('rerank_medium');

  // Budget validation
  const budgetCapNumber = parseFloat(budgetCapInput);
  const isBudgetWarning = !isNaN(budgetCapNumber) && budgetCapNumber > 1000;

  const items = useMemo(
    () => Object.values(candidateBasket).sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    ),
    [candidateBasket],
  );

  const budgetCapRp = useMemo(() => {
    return isNaN(budgetCapNumber) || budgetCapNumber <= 0 ? null : budgetCapNumber * 1_000_000_000;
  }, [budgetCapNumber]);

  const preview = useMemo(
    () => computeBudgetPreview(items, budgetCapRp),
    [items, budgetCapRp],
  );

  const availableMlScenarios = useMemo(
    () => Object.keys(mlPriorityConfigurations ?? {}).sort(),
    [mlPriorityConfigurations],
  );

  const availableMlModels = useMemo(
    () => Object.keys(mlPriorityConfigurations?.[selectedMlScenario] ?? {}).sort(),
    [mlPriorityConfigurations, selectedMlScenario],
  );

  const availableMlScoreTypes = useMemo(
    () => Object.keys(mlPriorityConfigurations?.[selectedMlScenario]?.[selectedMlModel] ?? {}).sort(),
    [mlPriorityConfigurations, selectedMlScenario, selectedMlModel],
  );

  useEffect(() => {
    if (availableMlScenarios.length > 0 && !availableMlScenarios.includes(selectedMlScenario)) {
      setSelectedMlScenario(availableMlScenarios[0]);
    }
  }, [availableMlScenarios, selectedMlScenario]);

  useEffect(() => {
    if (availableMlModels.length > 0 && !availableMlModels.includes(selectedMlModel)) {
      setSelectedMlModel(availableMlModels[0]);
    }
  }, [availableMlModels, selectedMlModel]);

  useEffect(() => {
    if (availableMlScoreTypes.length > 0 && !availableMlScoreTypes.includes(selectedMlScoreType)) {
      setSelectedMlScoreType(availableMlScoreTypes[0]);
    }
  }, [availableMlScoreTypes, selectedMlScoreType]);

  const selectedMlConfiguration = mlPriorityConfigurations?.[selectedMlScenario]?.[selectedMlModel]?.[selectedMlScoreType] ?? null;
  const selectedMlPriorityScores = selectedMlConfiguration?.scores ?? mlPriorityScores ?? {};
  const selectedMlPriorityMetadata = selectedMlConfiguration?.metadata ?? mlPriorityMetadata;

  const optimizationPreview = useMemo(
    () => runScenarioOptimizationPreview({
      candidates: items,
      roadsByKey: optimizationRoadLookup,
      historyByKey: optimizationHistoryLookup,
      budgetCapRp,
    }),
    [items, optimizationRoadLookup, optimizationHistoryLookup, budgetCapRp],
  );

  useEffect(() => {
    onOptimizationPreviewChange?.(optimizationPreview);
  }, [optimizationPreview, onOptimizationPreviewChange]);

  const missingHistoryCount = useMemo(
    () => items.filter(item => !optimizationHistoryLookup.get(item.road_key)).length,
    [items, optimizationHistoryLookup],
  );

  const mlScenarioSummary = useMemo(() => {
    const scores = selectedMlPriorityScores;
    const candidateScores = items
      .map(item => scores[item.road_key])
      .filter((score): score is MLPriorityScore => Boolean(score));
    const ranks = candidateScores
      .map(score => score.rank)
      .filter((rank): rank is number => typeof rank === 'number' && Number.isFinite(rank));

    return {
      hasRuntimeData: Object.keys(scores).length > 0,
      withData: candidateScores.length,
      top35: candidateScores.filter(score => score.top35 === true).length,
      top70: candidateScores.filter(score => score.top70 === true).length,
      top105: candidateScores.filter(score => score.top105 === true).length,
      averageRank: ranks.length > 0 ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : null,
    };
  }, [items, selectedMlPriorityScores]);

  const mlOptimizationComparison = useMemo(() => {
    const scores = selectedMlPriorityScores;
    const optimizedSelectedKeys = new Set(optimizationPreview.optimizedSelected.map(candidate => candidate.item.road_key));
    const optimizedDeferredKeys = new Set(optimizationPreview.optimizedDeferred.map(candidate => candidate.item.road_key));
    const byRoadKey = new Map<string, MLOptimizationComparison>();

    let aligned = 0;
    let mlHighBudgetDeferred = 0;
    let selectedOutsideTop105 = 0;
    let withoutMlData = 0;

    items.forEach(item => {
      const mlScore = scores[item.road_key];
      const hasMlData = Boolean(mlScore);
      const isMlTop35Or70 = mlScore?.top35 === true || mlScore?.top70 === true;
      const isMlTopAny = isMlTop35Or70 || mlScore?.top105 === true;
      const isOptimizedSelected = optimizedSelectedKeys.has(item.road_key);
      const isOptimizedDeferred = optimizedDeferredKeys.has(item.road_key);

      if (!hasMlData) withoutMlData++;

      let label: MLOptimizationComparisonLabel;

      if (item.status === 'force_include') {
        label = 'Force Included';
      } else if (item.status === 'force_exclude') {
        label = 'Force Excluded';
      } else if (item.status === 'deferred') {
        label = 'Manually Deferred';
      } else if (isOptimizedSelected && isMlTopAny) {
        label = 'Aligned';
        aligned++;
      } else if (isOptimizedSelected) {
        label = 'Condition/Budget Selected';
        selectedOutsideTop105++;
      } else if (isOptimizedDeferred && isMlTop35Or70) {
        label = 'ML High, Budget Deferred';
        mlHighBudgetDeferred++;
      } else {
        label = 'Not Selected';
      }

      const meta = ML_COMPARISON_META[label];
      byRoadKey.set(item.road_key, {
        label,
        detail: meta.detail,
        badgeClassName: meta.badgeClassName,
      });
    });

    return {
      byRoadKey,
      summary: {
        aligned,
        mlHighBudgetDeferred,
        selectedOutsideTop105,
        withoutMlData,
      },
    };
  }, [items, selectedMlPriorityScores, optimizationPreview.optimizedSelected, optimizationPreview.optimizedDeferred]);

  const optimizationWarnings = useMemo(() => {
    const warnings = [...optimizationPreview.warnings];
    if (budgetCapRp == null) warnings.unshift('No budget cap set.');
    if (missingHistoryCount > 0) warnings.push(`${missingHistoryCount} candidate road(s) have missing history data.`);
    return warnings;
  }, [optimizationPreview.warnings, budgetCapRp, missingHistoryCount]);

  const totalActivePagu = useMemo(
    () => items
      .filter(i => i.status === 'included' || i.status === 'force_include')
      .reduce((s, i) => s + (i.pagu_indikatif_rp ?? 0), 0),
    [items],
  );

  const notesCount = Object.keys(planningNotes).length;

  const handleExportJson = () => {
    const data = {
      exported_at: new Date().toISOString(),
      budget_cap_miliar: budgetCapNumber || null,
      total_pagu_indikatif_rp: totalActivePagu,
      funded_total_rp: preview.totalFundedRp,
      candidates: items,
      notes: planningNotes
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `treatment_scenario_export_${timestamp}.json`);
    dlAnchorElem.click();
  };

  const handleClear = () => {
    if (window.confirm("Hapus semua ruas dari scenario? Catatan planning tidak akan dihapus.")) {
      onClearScenario?.();
    }
  };

  const handleSync = () => {
    if (onSyncScenario) {
      setIsSyncing(true);
      onSyncScenario();
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div id="scenario-panel" className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-violet-300 mb-2" />
        <p className="text-sm font-semibold text-slate-600">No roads in Planning Scenario</p>
        <p className="mt-1 text-xs text-slate-500">
          Select a road on the map or table, then click <strong>Add to Scenario</strong> in the Road Focus Panel.
        </p>
      </div>
    );
  }

  return (
    <div id="scenario-panel" className="rounded-xl border border-violet-200 bg-white overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm shadow-violet-200">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Planning Scenario</h3>
            <p className="text-[10px] text-slate-500">
              {items.length} candidate road{items.length !== 1 ? 's' : ''} 
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-emerald-600 font-medium">{preview.funded.length} Included</span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-emerald-700 font-bold">{items.filter(i => i.status === 'force_include').length} Force Include</span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-slate-500 font-medium">{preview.deferred.length} Deferred</span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-red-500 font-medium">{preview.forceExcluded.length} Force Exclude</span>
              {notesCount > 0 && (
                <>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="text-amber-600 font-medium">{notesCount} Note{notesCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            {preview.funded.length} funded
          </span>
          {preview.deferred.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              {preview.deferred.length} deferred
            </span>
          )}
          {preview.forceExcluded.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">
              <XCircle className="h-3 w-3" />
              {preview.forceExcluded.length} excluded
            </span>
          )}
          <button
            onClick={() => setIsOpen(o => !o)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* ── Budget Summary Row ─────────────────────────────────────────── */}
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <div className="grid grid-cols-2 gap-2 text-[10px] md:grid-cols-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="font-black uppercase tracking-widest text-slate-400">Candidates</p>
                <p className="text-sm font-bold text-slate-800">{items.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="font-black uppercase tracking-widest text-slate-400">Funded / Deferred</p>
                <p className="text-sm font-bold text-slate-800">{preview.funded.length} / {preview.deferred.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="font-black uppercase tracking-widest text-slate-400">Excluded</p>
                <p className="text-sm font-bold text-slate-800">{preview.forceExcluded.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="font-black uppercase tracking-widest text-slate-400">Total ASB Pagu</p>
                <p className="text-sm font-bold text-slate-800">{formatRp(totalActivePagu)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="font-black uppercase tracking-widest text-slate-400">Budget Cap</p>
                <p className={`text-sm font-bold ${budgetCapRp == null ? 'text-slate-500' : preview.totalFundedRp <= budgetCapRp ? 'text-emerald-700' : 'text-red-600'}`}>
                  {budgetCapRp == null ? 'No cap' : preview.totalFundedRp <= budgetCapRp ? 'Within cap' : 'Over cap'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-white px-4 py-2">
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'candidates' as const, label: 'Candidates' },
                { id: 'budget' as const, label: 'Budget & Kecamatan' },
                { id: 'optimization' as const, label: 'Optimization & ML' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4 ${activeTab === 'budget' ? '' : 'hidden'}`}>
            {/* Total Pagu Indikatif ASB */}
            <div className="flex flex-col gap-0.5 bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Total Pagu Indikatif ASB
              </p>
              <p className="text-lg font-bold text-slate-800 leading-none mt-1">
                {formatRp(totalActivePagu)}
              </p>
              <p className="text-[9px] text-slate-400">
                force_include + included
              </p>
            </div>

            {/* Budget Cap */}
            <div className="flex flex-col gap-1 bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Budget Cap (Miliar Rp)
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <DollarSign className={`h-3.5 w-3.5 shrink-0 ${isBudgetWarning ? 'text-amber-500' : 'text-slate-400'}`} />
                <input
                  id="scenario-budget-cap"
                  type="number"
                  min="0"
                  step="0.5"
                  value={budgetCapInput}
                  onChange={e => {
                    const val = e.target.value;
                    if (parseFloat(val) < 0) return; // simple guardrail against negatives
                    setBudgetCapInput(val);
                  }}
                  placeholder="Contoh: 10"
                  className={`w-full rounded border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 transition-colors ${
                    isBudgetWarning 
                      ? 'border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-400'
                      : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-violet-400 focus:ring-violet-300'
                  }`}
                />
              </div>
              {isBudgetWarning ? (
                <p className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Angka terlalu besar. Pastikan input dalam miliar.
                </p>
              ) : (
                <p className="text-[9px] text-slate-400">Isi dalam miliar rupiah. Contoh: 10 = Rp 10 Miliar.</p>
              )}
            </div>

            {/* Total Funded */}
            <div className="flex flex-col gap-0.5 bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Est. Funded Total
              </p>
              <p className="text-lg font-bold text-emerald-700 leading-none mt-1">
                {formatRp(preview.totalFundedRp)}
              </p>
              <p className="text-[9px] text-emerald-600">
                {preview.funded.length} road{preview.funded.length !== 1 ? 's' : ''} funded
              </p>
            </div>

            {/* vs Cap indicator */}
            <div className="flex flex-col gap-0.5 bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                vs. Cap
              </p>
              {budgetCapRp != null ? (
                <>
                  <p className={`text-lg font-bold leading-none mt-1 ${
                    preview.totalFundedRp <= budgetCapRp ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    {preview.totalFundedRp <= budgetCapRp ? 'Within Cap' : 'Exceeds Cap'}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {formatRp(Math.abs(budgetCapRp - preview.totalFundedRp))}
                    {preview.totalFundedRp <= budgetCapRp ? ' remaining' : ' over'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-400 leading-none mt-1">No cap set</p>
                  <p className="text-[9px] text-slate-400">Enter cap to enable ranking</p>
                </>
              )}
            </div>
          </div>

          {/* ── Toolbar Actions ──────────────────────────────────────────────── */}
          <div className={`border-b border-slate-100 bg-white px-4 py-3 ${activeTab === 'budget' ? '' : 'hidden'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Scenario Kecamatan Summary
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Ringkasan metadata read-only berdasarkan kecamatan_dilalui. Ruas yang melintasi lebih dari satu kecamatan dapat tampil sebagai satu kelompok lintasan. Ini bukan input prioritas yang dapat diedit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                  {items.length} candidate road{items.length !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700">
                  {scenarioKecamatanSummary.length} kelompok kecamatan
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {scenarioKecamatanSummary.map(item => (
                <div key={item.kecamatan} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{item.kecamatan}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {item.road_count} road{item.road_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    ASB pagu: <span className="font-semibold text-slate-700">{formatRp(item.total_pagu_indikatif_rp)}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">
                      Included {item.included_count}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                      Force Include {item.force_include_count}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                      Deferred {item.deferred_count}
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                      Force Exclude {item.force_exclude_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {scenarioKecamatanSummaryHasMultiKecamatanRoads && (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Roads with multiple kecamatan values are counted in each matching kecamatan. Budget is not divided for this read-only summary.
              </p>
            )}
          </div>

          <div className={`border-b border-slate-100 bg-sky-50/40 px-4 py-3 ${activeTab === 'optimization' ? '' : 'hidden'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-sky-600">
                  ML Priority Context
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-sky-700/80">
                  ML context only — not used by Optimization Preview yet.
                </p>
              </div>
              <div className="grid w-full gap-2 md:grid-cols-3">
                <label className="text-[10px] font-semibold text-slate-600">
                  Scenario
                  <select
                    value={selectedMlScenario}
                    onChange={(event) => setSelectedMlScenario(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    disabled={availableMlScenarios.length === 0}
                  >
                    {availableMlScenarios.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-[10px] font-semibold text-slate-600">
                  Model
                  <select
                    value={selectedMlModel}
                    onChange={(event) => setSelectedMlModel(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    disabled={availableMlModels.length === 0}
                  >
                    {availableMlModels.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-[10px] font-semibold text-slate-600">
                  Score Type
                  <select
                    value={selectedMlScoreType}
                    onChange={(event) => setSelectedMlScoreType(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    disabled={availableMlScoreTypes.length === 0}
                  >
                    {availableMlScoreTypes.map(value => <option key={value} value={value}>{value || '(default)'}</option>)}
                  </select>
                </label>
              </div>
              <p className="w-full text-[10px] leading-relaxed text-sky-700/80">
                Selected ML ranking is comparison context only and is not used by Optimization Preview.
              </p>
              {mlScenarioSummary.hasRuntimeData ? (
                <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                  <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                    {mlScenarioSummary.withData}/{items.length} with ML data
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                    Top-35 {mlScenarioSummary.top35}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                    Top-70 {mlScenarioSummary.top70}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                    Top-105 {mlScenarioSummary.top105}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                    Avg rank {mlScenarioSummary.averageRank == null ? '—' : mlScenarioSummary.averageRank.toFixed(1)}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-slate-500">
                    {selectedMlPriorityMetadata?.scenario ?? selectedMlScenario}
                  </span>
                </div>
              ) : (
                <p className="rounded-md border border-slate-100 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-500">
                  ML Priority Score data is not loaded yet.
                </p>
              )}
            </div>
          </div>

          <div className={`border-b border-slate-100 bg-white px-4 py-3 ${activeTab === 'optimization' ? '' : 'hidden'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Optimization Preview
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Read-only preview using ASB budget, DD1/FormDD1 condition urgency, and 2021–2025 historical treatment context. This does not change the scenario.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">Condition urgency 60%</span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">Historical gap 25%</span>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Cost efficiency 15%</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  ML Priority Score: {mlScenarioSummary.hasRuntimeData ? 'Loaded as context, not used in optimization yet' : 'Not integrated yet'}
                </span>
              </div>
            </div>

            {budgetCapRp == null ? (
              <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">
                Enter Budget Cap to enable Optimization Preview.
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Optimized Selected</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{optimizationPreview.optimizedSelected.length} roads</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Optimized Deferred</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{optimizationPreview.optimizedDeferred.length} roads</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Optimized ASB Budget</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{formatRp(optimizationPreview.totalOptimizedBudget)}</p>
                  </div>
                </div>

                {optimizationPreview.optimizedSelected.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Recommended Funded Preview
                    </p>
                    {optimizationPreview.optimizedSelected.slice(0, 6).map(candidate => (
                      <div key={candidate.item.road_key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-800">{candidate.item.canonical_road_name}</p>
                          <p className="mt-0.5 text-[9px] text-slate-500">{getOptimizationReason(candidate)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-bold text-slate-700">{formatRp(candidate.item.pagu_indikatif_rp)}</p>
                          <p className="text-[9px] font-bold text-indigo-600">Score {candidate.score.weighted_score.toFixed(3)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {optimizationWarnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {optimizationWarnings.map(warning => (
                  <p key={warning} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            )}

            <p className="mt-3 border-t border-slate-100 pt-2 text-[9px] leading-relaxed text-slate-400">
              Optimization Preview is advisory only. Final planning remains manual and ASB pagu indikatif remains the canonical budget source.
            </p>
          </div>

          <div className={`border-b border-slate-100 bg-white px-4 py-3 ${activeTab === 'optimization' ? '' : 'hidden'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  ML–Optimization Comparison
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Read-only comparison between historical ML ranking and the current Optimization Preview. ML score is not used in optimization.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                  Aligned {mlOptimizationComparison.summary.aligned}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                  ML high but deferred {mlOptimizationComparison.summary.mlHighBudgetDeferred}
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                  Selected outside Top-105 {mlOptimizationComparison.summary.selectedOutsideTop105}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  Without ML data {mlOptimizationComparison.summary.withoutMlData}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">
              Roads outside the 160-row ML lookup remain valid Treatment Engine candidates and receive a no-ML-data comparison context.
            </p>
          </div>
          <details className="border-b border-slate-100 bg-slate-50 px-4 py-2">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Scenario Utilities
            </summary>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title="Utility feature: sync basket values with latest ASB pagu"
              >
                {isSyncing ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Synced!</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
                    Sync ASB Snapshot
                  </>
                )}
              </button>
              <span className="text-[9px] text-slate-400 hidden sm:inline">
                Gunakan setelah mengubah ASB override agar nilai basket mengikuti pagu ASB terbaru.
              </span>
            </div>
            <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                  title="Utility feature: export scenario JSON"
                >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                Export Scenario JSON
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Scenario
              </button>
            </div>
          </div>
          </details>

          {/* ── Force Include notice if total exceeds cap ──────────────────── */}
          {budgetCapRp != null && preview.totalForceIncludeRp > budgetCapRp && (
            <div className={`flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-5 py-2 ${activeTab === 'budget' ? '' : 'hidden'}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Force-included roads alone ({formatRp(preview.totalForceIncludeRp)}) already exceed the budget cap.
                Review force-include assignments or raise the cap.
              </p>
            </div>
          )}

          {/* ── Candidate Road List ────────────────────────────────────────── */}
          <div className={`p-4 space-y-2 ${activeTab === 'candidates' ? '' : 'hidden'}`}>
            {/* Funded section */}
            {preview.funded.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Funded ({preview.funded.length})
                </p>
                <div className="space-y-1.5">
                  {preview.funded.map(item => (
                    <CandidateRow
                      key={item.road_key}
                      item={item}
                      note={planningNotes[item.road_key]}
                      isFunded={true}
                      isForceExcluded={false}
                      comparison={mlOptimizationComparison.byRoadKey.get(item.road_key)}
                      mlScore={selectedMlPriorityScores[item.road_key] ?? null}
                      onRemove={() => removeFromCandidateBasket(item.road_key)}
                      onSetStatus={s => setCandidateStatus(item.road_key, s)}
                      onSelectRoad={onSelectRoad}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Deferred section */}
            {preview.deferred.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 mt-3">
                  Deferred ({preview.deferred.length})
                </p>
                <div className="space-y-1.5">
                  {preview.deferred.map(item => (
                    <CandidateRow
                      key={item.road_key}
                      item={item}
                      note={planningNotes[item.road_key]}
                      isFunded={false}
                      isForceExcluded={false}
                      comparison={mlOptimizationComparison.byRoadKey.get(item.road_key)}
                      mlScore={selectedMlPriorityScores[item.road_key] ?? null}
                      onRemove={() => removeFromCandidateBasket(item.road_key)}
                      onSetStatus={s => setCandidateStatus(item.road_key, s)}
                      onSelectRoad={onSelectRoad}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Force Excluded section */}
            {preview.forceExcluded.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1.5 mt-3 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Force Excluded ({preview.forceExcluded.length})
                </p>
                <div className="space-y-1.5">
                  {preview.forceExcluded.map(item => (
                    <CandidateRow
                      key={item.road_key}
                      item={item}
                      note={planningNotes[item.road_key]}
                      isFunded={false}
                      isForceExcluded={true}
                      comparison={mlOptimizationComparison.byRoadKey.get(item.road_key)}
                      mlScore={selectedMlPriorityScores[item.road_key] ?? null}
                      onRemove={() => removeFromCandidateBasket(item.road_key)}
                      onSetStatus={s => setCandidateStatus(item.road_key, s)}
                      onSelectRoad={onSelectRoad}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Planning Notes Summary ─────────────────────────────────────── */}
          {notesCount > 0 && (
            <div className={`border-t border-slate-100 px-5 py-3 ${activeTab === 'candidates' ? '' : 'hidden'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Planning Notes Summary ({notesCount})
              </p>
              <div className="space-y-2">
                {Object.values(planningNotes).map(n => {
                  const basketItem = candidateBasket[n.road_key];
                  return (
                    <div key={n.road_key} className="rounded border border-amber-100 bg-amber-50 px-3 py-2">
                      <p className="text-[10px] font-semibold text-slate-700 mb-0.5">
                        {basketItem?.canonical_road_name ?? n.road_key}
                      </p>
                      <p className="text-[10px] text-amber-800 leading-relaxed">{n.note}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Updated: {new Date(n.updated_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer disclaimer ──────────────────────────────────────────── */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Scenario ini berbasis Pagu Indikatif ASB. HPS/AHSP tetap hanya comparison/detail, dan utilitas Sync ASB Snapshot / Export Scenario JSON berada di luar flow akademik.
              Nilai budget bersumber dari <code className="font-mono text-[9px] bg-slate-200 px-1 rounded">final_asb_budget.final_pagu_indikatif_rp</code>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
