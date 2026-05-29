import { useState, useMemo } from 'react';
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
import type { CandidateBasketItem, CandidateStatus, PlanningNote } from '../../../../lib/treatmentTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScenarioPanelProps {
  candidateBasket: Record<string, CandidateBasketItem>;
  planningNotes: Record<string, PlanningNote>;
  removeFromCandidateBasket: (road_key: string) => void;
  setCandidateStatus: (road_key: string, status: CandidateStatus) => void;
  onSelectRoad?: (road_key: string) => void;
  onClearScenario?: () => void;
  onSyncScenario?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: CandidateStatus[] = ['force_include', 'included', 'deferred', 'force_exclude'];

const STATUS_META: Record<CandidateStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  force_include: { label: 'Force Include', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  included:      { label: 'Included',      color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  deferred:      { label: 'Deferred',      color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  force_exclude: { label: 'Force Exclude', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRp(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(2)} M`;
  if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
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
  onRemove: () => void;
  onSetStatus: (status: CandidateStatus) => void;
  onSelectRoad?: (road_key: string) => void;
}

function CandidateRow({ item, note, isFunded, isForceExcluded, onRemove, onSetStatus, onSelectRoad }: RowProps) {
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
  removeFromCandidateBasket,
  setCandidateStatus,
  onSelectRoad,
  onClearScenario,
  onSyncScenario,
}: ScenarioPanelProps) {
  const [budgetCapInput, setBudgetCapInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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
          <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
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
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title="Sync basket values with latest ASB pagu"
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

          {/* ── Force Include notice if total exceeds cap ──────────────────── */}
          {budgetCapRp != null && preview.totalForceIncludeRp > budgetCapRp && (
            <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-5 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Force-included roads alone ({formatRp(preview.totalForceIncludeRp)}) already exceed the budget cap.
                Review force-include assignments or raise the cap.
              </p>
            </div>
          )}

          {/* ── Candidate Road List ────────────────────────────────────────── */}
          <div className="p-4 space-y-2">
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
            <div className="border-t border-slate-100 px-5 py-3">
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
              Scenario ini berbasis Pagu Indikatif ASB. Estimasi HPS/AHSP tetap hanya sebagai pembanding.
              Nilai budget bersumber dari <code className="font-mono text-[9px] bg-slate-200 px-1 rounded">final_asb_budget.final_pagu_indikatif_rp</code>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
