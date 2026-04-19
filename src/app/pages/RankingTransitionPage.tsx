import { useState, useMemo, useEffect, useRef } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, AlertCircle } from 'lucide-react';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ChartCard } from '../components/ui/ChartCard';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/tables/DataTable';
import { exportToCsv, getRoadKey } from '../../lib/utils';

// ============================================
// Types
// ============================================

type MovementCategory =
  | 'Stabil'
  | 'Naik'
  | 'Turun'
  | 'Naik signifikan'
  | 'Turun signifikan'
  | 'Naik sangat jauh'
  | 'Turun sangat jauh'
  | 'Masuk baru ke Top-K'
  | 'Keluar dari Top-K'
  | 'Tidak ada data detail';

interface TransitionRow {
  road_key: string;
  road_name: string;
  rank_a: number | null;
  rank_b: number | null;
  delta_rank: number | null;
  abs_delta_rank: number | null;
  in_top_k_a: boolean;
  in_top_k_b: boolean;
  movement_category: MovementCategory;
}

const CATEGORY_COLORS: Record<MovementCategory, string> = {
  'Stabil': '#94a3b8',
  'Naik': '#34d399',
  'Turun': '#f87171',
  'Naik signifikan': '#059669',
  'Turun signifikan': '#dc2626',
  'Naik sangat jauh': '#064e3b',
  'Turun sangat jauh': '#7f1d1d',
  'Masuk baru ke Top-K': '#8b5cf6',
  'Keluar dari Top-K': '#f59e0b',
  'Tidak ada data detail': '#e2e8f0',
};

// ============================================
// Helper functions
// ============================================

function getMovementCategory(
  rankA: number | null,
  rankB: number | null,
  inA: boolean,
  inB: boolean
): MovementCategory {
  if (!inA && inB) return 'Masuk baru ke Top-K';
  if (inA && !inB) return 'Keluar dari Top-K';
  if (!inA && !inB) return 'Tidak ada data detail';

  const delta = rankB! - rankA!;
  const absD = Math.abs(delta);

  if (absD < 2) return 'Stabil';
  if (delta < 0 && absD >= 2 && absD <= 4) return 'Naik';
  if (delta > 0 && absD >= 2 && absD <= 4) return 'Turun';
  if (delta < 0 && absD >= 5 && absD <= 9) return 'Naik signifikan';
  if (delta > 0 && absD >= 5 && absD <= 9) return 'Turun signifikan';
  if (delta < 0 && absD >= 10) return 'Naik sangat jauh';
  if (delta > 0 && absD >= 10) return 'Turun sangat jauh';

  return 'Tidak ada data detail';
}

// ============================================
// Main Page Component
// ============================================

export function RankingTransitionPage() {
  const { data: appData, status, error } = useAppData();

  // State: Selectors
  const [scenarioA, setScenarioA] = useState<string>('');
  const [modelA, setModelA] = useState<string>('');
  const [scenarioB, setScenarioB] = useState<string>('');
  const [modelB, setModelB] = useState<string>('');

  const [topK, setTopK] = useState<number>(30);
  
  // State: Filters & View Modes
  const [labelMode, setLabelMode] = useState<'all' | 'changed' | 'extreme' | 'hide'>('changed');
  const [movementFilter, setMovementFilter] = useState<string>('all');
  
  const [highlightToggle] = useState<boolean>(false);
  const [extremeThreshold, setExtremeThreshold] = useState<number>(5);
  
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    if (appData && !scenarioA && appData.detectedScenarios.length > 0) {
      const allScen = appData.detectedScenarios;
      setScenarioA(allScen[0]);
      setScenarioB(allScen[1] || allScen[0]);
      setModelA(appData.detectedModels[0] ?? 'XGBoost');
      setModelB(appData.detectedModels[0] ?? 'XGBoost');
    }
  }, [appData, scenarioA]);

  useEffect(() => {
    if (!chartWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(chartWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Data
  const { filteredRows, metrics } = useMemo(() => {
    if (!appData || !scenarioA || !scenarioB || !modelA || !modelB) {
      return { allRows: [], filteredRows: [], metrics: null };
    }

    const ranksA = (appData.indexes.rankingsByScenario.get(scenarioA) || []).filter(r => r.model === modelA);
    const ranksB = (appData.indexes.rankingsByScenario.get(scenarioB) || []).filter(r => r.model === modelB);

    const mapA = new Map(ranksA.map(r => [getRoadKey(r), r]));
    const mapB = new Map(ranksB.map(r => [getRoadKey(r), r]));
    const allIds = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

    const computed: TransitionRow[] = [];
    
    let cntStable = 0, cntNaik = 0, cntTurun = 0, cntMasuk = 0, cntKeluar = 0, cntExtreme = 0, cntOverlap = 0;

    for (const id of allIds) {
      const rA = mapA.get(id);
      const rB = mapB.get(id);
      
      const rankA = rA?.rank ?? null;
      const rankB = rB?.rank ?? null;
      
      const inA = rankA !== null && rankA <= topK;
      const inB = rankB !== null && rankB <= topK;

      if (!inA && !inB) continue; // Skip roads that are outside Top-K in both scenarios

      if (inA && inB) cntOverlap++;

      const cat = getMovementCategory(rankA, rankB, inA, inB);
      
      const isExtreme = (inA && inB) && Math.abs(rankB! - rankA!) >= extremeThreshold;
      
      if (cat === 'Stabil') cntStable++;
      else if (cat.startsWith('Naik')) cntNaik++;
      else if (cat.startsWith('Turun')) cntTurun++;
      else if (cat === 'Masuk baru ke Top-K') cntMasuk++;
      else if (cat === 'Keluar dari Top-K') cntKeluar++;
      
      if (isExtreme) cntExtreme++;

      computed.push({
        road_key: id,
        road_name: rA?.road_name || rB?.road_name || 'Unknown',
        rank_a: rankA,
        rank_b: rankB,
        delta_rank: (rankA && rankB) ? rankB - rankA : null,
        abs_delta_rank: (rankA && rankB) ? Math.abs(rankB - rankA) : null,
        in_top_k_a: inA,
        in_top_k_b: inB,
        movement_category: cat
      });
    }

    computed.sort((a, b) => (b.abs_delta_rank || 0) - (a.abs_delta_rank || 0));

    let fRows = computed;

    if (movementFilter !== 'all') {
      if (movementFilter === 'extreme') {
        fRows = fRows.filter(r => r.in_top_k_a && r.in_top_k_b && r.abs_delta_rank! >= extremeThreshold);
      } else {
        fRows = fRows.filter(r => {
          if (movementFilter === 'stable') return r.movement_category === 'Stabil';
          if (movementFilter === 'naik') return r.movement_category.startsWith('Naik');
          if (movementFilter === 'turun') return r.movement_category.startsWith('Turun');
          if (movementFilter === 'masuk') return r.movement_category === 'Masuk baru ke Top-K';
          if (movementFilter === 'keluar') return r.movement_category === 'Keluar dari Top-K';
          return true;
        });
      }
    }

    if (highlightToggle) {
      fRows = fRows.filter(r => r.in_top_k_a && r.in_top_k_b && r.abs_delta_rank! >= extremeThreshold);
    }

    return {
      allRows: computed,
      filteredRows: fRows,
      metrics: {
        stabil: cntStable,
        naik: cntNaik,
        turun: cntTurun,
        masuk: cntMasuk,
        keluar: cntKeluar,
        extreme: cntExtreme,
        overlap: cntOverlap
      }
    };
  }, [appData, scenarioA, modelA, scenarioB, modelB, topK, extremeThreshold, movementFilter, highlightToggle]);

  const handleExport = () => {
    const headers = ['road_name', 'rank_a', 'rank_b', 'delta_rank', 'abs_delta_rank', 'movement_category', 'in_top_k_a', 'in_top_k_b'];
    const keys = ['road_name', 'rank_a', 'rank_b', 'delta_rank', 'abs_delta_rank', 'movement_category', 'in_top_k_a', 'in_top_k_b'];
    exportToCsv(`ranking_transition_${new Date().getTime()}`, filteredRows, headers, keys);
  };

  const tableColumns: ColumnDef<TransitionRow>[] = [
    {
      accessorKey: 'road_name',
      header: 'Road Segment',
      cell: (info) => (
        <div className="flex flex-col min-w-[200px]">
          <span className="font-bold text-slate-800 leading-tight">{info.getValue() as string}</span>
          <span className="text-[10px] font-mono text-slate-400 mt-0.5">Local ID: {info.row.original.road_key.slice(0, 30)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'rank_a',
      header: 'Rank A',
      cell: (info) => <div className="font-mono font-black text-slate-900 text-xs">{info.getValue() as number || '> ' + topK}</div>
    },
    {
      accessorKey: 'rank_b',
      header: 'Rank B',
      cell: (info) => <div className="font-mono font-black text-slate-900 text-xs">{info.getValue() as number || '> ' + topK}</div>
    },
    {
      accessorKey: 'delta_rank',
      header: 'Δ Rank',
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (val === null) return <span className="text-slate-200">—</span>;
        if (val > 0) return <span className="text-rose-600 font-mono text-xs font-black">+{val} (Turun)</span>;
        if (val < 0) return <span className="text-emerald-600 font-mono text-xs font-black">{val} (Naik)</span>;
        return <span className="text-slate-400 font-mono text-xs">0</span>;
      },
    },
    {
      accessorKey: 'abs_delta_rank',
      header: '|Δ|',
      cell: (info) => <div className="text-slate-500 text-xs font-mono font-bold">{info.getValue() as number ?? '—'}</div>
    },
    {
      accessorKey: 'movement_category',
      header: 'Category',
      cell: (info) => {
        const cat = info.getValue() as MovementCategory;
        const color = CATEGORY_COLORS[cat] || '#cbd5e1';
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: color }}>
            {cat}
          </span>
        );
      }
    }
  ];

  if (status === 'loading') return <LoadingState message="Computing rank transitions..." />;
  if (status === 'error') return <EmptyState title="Error" message={error || 'Failed to load data.'} />;
  if (!appData) return <EmptyState />;

  const scenariosList = appData.detectedScenarios.map(id => {
    const s = appData.scenarios.find(x => x.scenario_id === id);
    return { id, label: s ? s.scenario_label : id };
  });

  const isSame = scenarioA === scenarioB && modelA === modelB;

  // Chart Rendering Logic
  const ROW_HEIGHT = 22;
  const HEADER_HEIGHT = 40;
  const CHART_HEIGHT = (topK + 1) * ROW_HEIGHT + HEADER_HEIGHT + 20;
  const MARGIN_X = 220; 

  const renderSlopeChartLines = () => {
    return filteredRows.map(row => {
      const isOutA = !row.in_top_k_a;
      const isOutB = !row.in_top_k_b;
      
      const yA = isOutA ? CHART_HEIGHT - 20 : HEADER_HEIGHT + (row.rank_a! * ROW_HEIGHT);
      const yB = isOutB ? CHART_HEIGHT - 20 : HEADER_HEIGHT + (row.rank_b! * ROW_HEIGHT);

      const color = CATEGORY_COLORS[row.movement_category];
      const showLabel = 
        labelMode === 'all' ||
        (labelMode === 'changed' && row.movement_category !== 'Stabil') ||
        (labelMode === 'extreme' && (row.abs_delta_rank! >= extremeThreshold || isOutA || isOutB)) ||
        row.rank_a! <= 5 || row.rank_b! <= 5;

      const pathData = `M ${MARGIN_X} ${yA} C ${MARGIN_X + 100} ${yA}, ${chartWidth - MARGIN_X - 100} ${yB}, ${chartWidth - MARGIN_X} ${yB}`;

      return (
        <g key={row.road_key}>
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={row.movement_category === 'Stabil' ? 1.5 : 2.5}
            strokeOpacity={0.8}
            className="transition-all hover:stroke-4 hover:stroke-black hover:z-10"
          />
          <circle cx={MARGIN_X} cy={yA} r={3} fill={isOutA ? 'transparent' : color} />
          <circle cx={chartWidth - MARGIN_X} cy={yB} r={3} fill={isOutB ? 'transparent' : color} />
          
          {showLabel && labelMode !== 'hide' && !isOutA && (
            <text x={MARGIN_X - 10} y={yA + 4} textAnchor="end" fontSize="10" fill="#475569" className="font-mono">
              {row.rank_a}. {row.road_name.length > 25 ? row.road_name.slice(0, 25) + '...' : row.road_name}
            </text>
          )}
          {showLabel && labelMode !== 'hide' && !isOutB && (
            <text x={chartWidth - MARGIN_X + 10} y={yB + 4} textAnchor="start" fontSize="10" fill="#475569" className="font-mono">
              {row.rank_b}. {row.road_name.length > 25 ? row.road_name.slice(0, 25) + '...' : row.road_name}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 overflow-x-hidden">
      {isSame && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl flex items-center gap-3 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm font-medium">Please select two different scenarios to analyze rank transitions.</p>
        </div>
      )}

      {/* Controls Container */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Scenario A (Left)</label>
          <div className="flex gap-2">
            <select value={scenarioA} onChange={e => setScenarioA(e.target.value)} className="flex-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
              {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <select value={modelA} onChange={e => setModelA(e.target.value)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
            {appData.detectedModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Scenario B (Right)</label>
          <div className="flex gap-2">
            <select value={scenarioB} onChange={e => setScenarioB(e.target.value)} className="flex-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
              {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <select value={modelB} onChange={e => setModelB(e.target.value)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2 outline-none">
            {appData.detectedModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Top-K Selection</label>
            <select value={topK} onChange={e => setTopK(Number(e.target.value))} className="text-xs font-black rounded border border-slate-200 p-1 outline-none">
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="30">Top 30</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
            </select>
          </div>
          
          <div className="flex justify-between items-center">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Extreme Threshold</label>
             <select value={extremeThreshold} onChange={e => setExtremeThreshold(Number(e.target.value))} className="text-xs font-black rounded border border-slate-200 p-1 outline-none">
               <option value="5">5 ranks</option>
               <option value="10">10 ranks</option>
               <option value="15">15 ranks</option>
             </select>
          </div>
          {metrics && !isSame && (
             <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-lg text-center shadow-sm">
                <span className="block text-[9px] font-black uppercase text-blue-500 tracking-widest mb-1">Top-K Retention</span>
                <span className="text-sm font-black text-blue-800">{metrics.overlap} / {topK}</span>
                <span className="text-[10px] text-blue-500 font-bold ml-1">roads stay in top {topK}</span>
             </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">View Mode</label>
            <select value={labelMode} onChange={e => setLabelMode(e.target.value as any)} className="text-xs font-bold rounded border border-slate-200 p-1 outline-none w-32">
              <option value="all">All Labels</option>
              <option value="changed">Changed only</option>
              <option value="extreme">Extreme only</option>
              <option value="hide">Hide Labels</option>
            </select>
          </div>

          <div className="flex justify-between items-center">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filter</label>
             <select value={movementFilter} onChange={e => setMovementFilter(e.target.value)} className="text-xs font-bold rounded border border-slate-200 p-1 outline-none w-32">
               <option value="all">Unfiltered</option>
               <option value="stable">Stabil</option>
               <option value="naik">Naik</option>
               <option value="turun">Turun</option>
               <option value="masuk">Masuk Baru</option>
               <option value="keluar">Keluar</option>
               <option value="extreme">Extreme</option>
             </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard label="Stable Roads" value={metrics.stabil} />
          <MetricCard label="Upward Mvmt" value={metrics.naik} />
          <MetricCard label="Downward Mvmt" value={metrics.turun} />
          <MetricCard label="New in Top-K" value={metrics.masuk} />
          <MetricCard label="Dropped from Top-K" value={metrics.keluar} />
          <MetricCard label="Extreme Movers" value={metrics.extreme} />
        </div>
      )}

      {/* Narrative Note */}
      {metrics && !isSame && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm">
          <strong>Analytical Summary:</strong> Within the Top-{topK} subset, <strong>{metrics.stabil}</strong> roads maintained stable positions, 
          while <strong>{metrics.masuk}</strong> newly entered and <strong>{metrics.keluar}</strong> dropped out of consideration. 
          There are <strong>{metrics.extreme}</strong> distinct road segments exhibiting extreme rank displacement (≥ {extremeThreshold} ranks), 
          suggesting notable impact from the refinement.
        </div>
      )}

      {/* Chart Section */}
      <ChartCard title="Rank Transition Map" subtitle={`Comparing Top-${topK} roads between references`}>
        <div className="flex gap-4 mb-4">
           {renderLegend()}
        </div>
        
        <div className="w-full overflow-hidden border border-slate-100 bg-zinc-50/50 rounded-xl" ref={chartWrapperRef}>
           <svg width={chartWidth} height={CHART_HEIGHT} className="bg-transparent text-slate-900">
              <g className="guides">
                 <line x1={MARGIN_X} y1={HEADER_HEIGHT} x2={MARGIN_X} y2={CHART_HEIGHT - 30} stroke="#cbd5e1" strokeDasharray="4 4" />
                 <line x1={chartWidth - MARGIN_X} y1={HEADER_HEIGHT} x2={chartWidth - MARGIN_X} y2={CHART_HEIGHT - 30} stroke="#cbd5e1" strokeDasharray="4 4" />
                 <text x={MARGIN_X} y={HEADER_HEIGHT - 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">Scenario A</text>
                 <text x={chartWidth - MARGIN_X} y={HEADER_HEIGHT - 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">Scenario B</text>
                 
                 {/* Exited/New Labels area */}
                 <text x={MARGIN_X/2} y={CHART_HEIGHT - 15} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#94a3b8">Out of Top-{topK}</text>
                 <text x={chartWidth - MARGIN_X/2} y={CHART_HEIGHT - 15} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#94a3b8">Out of Top-{topK}</text>
              </g>
              
              {chartWidth > 0 && renderSlopeChartLines()}
           </svg>
        </div>
      </ChartCard>

      {/* Detail Table */}
      <ChartCard 
        title="Detail Transitions" 
        actions={
          <button onClick={handleExport} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        }
      >
         <div className="overflow-auto max-h-[500px] scrollbar-thin">
            <DataTable columns={tableColumns} data={filteredRows} pageSize={15} />
         </div>
      </ChartCard>

    </div>
  );
}

function renderLegend() {
  const items: MovementCategory[] = [
    'Stabil', 'Naik', 'Turun', 'Naik signifikan', 'Turun signifikan', 
    'Naik sangat jauh', 'Turun sangat jauh', 'Masuk baru ke Top-K', 'Keluar dari Top-K'
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[10px] font-medium text-slate-600">
      {items.map(k => (
        <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded shadow-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[k] }}></div>
          <span>{k}</span>
        </div>
      ))}
    </div>
  );
}
