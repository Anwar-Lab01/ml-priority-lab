import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, AlertCircle, TrendingUp, Target, ListChecks, ChevronRight } from 'lucide-react';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ChartCard } from '../components/ui/ChartCard';
import { DataTable } from '../components/tables/DataTable';
import { ModelBadge } from '../components/ui/ModelBadge';
import { ScenarioBadge } from '../components/ui/ScenarioBadge';
import { fmt, pct, cn, exportToCsv } from '../../lib/utils';
import { CHART_COLORS } from '../../config/scenarios';

type Tab = 'metrics' | 'capture' | 'detailed_rows';

export function MetricsCapturePage() {
  const { data, status, error } = useAppData();
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  
  const [showOnlyBest, setShowOnlyBest] = useState(false);
  const [chartMetric, setChartMetric] = useState<'recall_at_k' | 'precision_at_k'>('recall_at_k');

  // Computed Best Models
  const bestModelsByScenario = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const sid of data.detectedScenarios) {
      const metrics = data.modelMetrics.filter(m => m.scenario_id === sid);
      if (metrics.length === 0) continue;
      metrics.sort((a, b) => {
        const pA = a.pr_auc ?? 0;
        const pB = b.pr_auc ?? 0;
        if (Math.abs(pA - pB) > 0.0001) return pB - pA;
        const mA = a.mcc ?? 0;
        const mB = b.mcc ?? 0;
        return mB - mA;
      });
      map.set(sid, metrics[0].model);
    }
    return map;
  }, [data]);

  const metricsData = useMemo(() => {
    if (!data) return [];
    let list = [...data.modelMetrics];
    if (showOnlyBest) {
      list = list.filter(m => bestModelsByScenario.get(m.scenario_id) === m.model);
    }
    return list;
  }, [data, showOnlyBest, bestModelsByScenario]);

  const captureData = useMemo(() => {
    if (!data) return [];
    return [...data.targetCapture].sort((a, b) => a.scenario_id.localeCompare(b.scenario_id) || a.K - b.K);
  }, [data]);

  const targetRowsData = useMemo(() => {
    if (!data) return [];
    return [...data.targetRows].sort((a,b) => a.scenario_id.localeCompare(b.scenario_id) || a.rank_prioritas - b.rank_prioritas);
  }, [data]);

  const captureChartData = useMemo(() => {
    if (!data) return [];
    const ks = Array.from(new Set(data.targetCapture.map(d => d.K))).sort((a,b) => a-b);
    
    return ks.map(k => {
      const point: any = { K: k };
      data.detectedScenarios.forEach(sid => {
        const row = data.targetCapture.find(c => c.scenario_id === sid && c.K === k);
        if (row) {
          point[sid] = row[chartMetric];
        }
      });
      return point;
    });
  }, [data, chartMetric]);

  const chartScenarios = useMemo(() => {
    if (!data) return [];
    return data.detectedScenarios.filter(sid => data.targetCapture.some(c => c.scenario_id === sid));
  }, [data]);

  const metricsColumns: ColumnDef<any>[] = [
    { 
      accessorKey: 'scenario_id', 
      header: 'Scenario', 
      cell: info => (
        <div className="flex items-center gap-2">
          <ScenarioBadge family={info.getValue() as string === 'normatif_20' ? 'normatif' : 'historis'} />
          <span className="font-mono text-[9px] font-black uppercase text-slate-500 tracking-tighter">{info.getValue() as string}</span>
        </div>
      )
    },
    { accessorKey: 'model', header: 'Model', cell: info => <ModelBadge model={info.getValue() as string} /> },
    { accessorKey: 'pr_auc', header: 'PR-AUC', cell: info => <div className="font-mono text-xs text-blue-700 font-black">{info.getValue() ? fmt(info.getValue() as number, 4) : '—'}</div> },
    { accessorKey: 'mcc', header: 'MCC', cell: info => <div className="font-mono text-xs font-black text-slate-800">{info.getValue() ? fmt(info.getValue() as number, 4) : '—'}</div> },
    { accessorKey: 'precision', header: 'Precision', cell: info => <div className="font-mono text-[10px] text-slate-400 font-bold">{info.getValue() ? fmt(info.getValue() as number, 4) : '—'}</div> },
    { accessorKey: 'recall', header: 'Recall', cell: info => <div className="font-mono text-[10px] text-slate-400 font-bold">{info.getValue() ? fmt(info.getValue() as number, 4) : '—'}</div> },
    { accessorKey: 'highest_score_threshold', header: 'Threshold', cell: info => <div className="font-mono text-[10px] text-slate-300 italic">{info.getValue() ? fmt(info.getValue() as number, 4) : '—'}</div> }
  ];

  const captureColumns: ColumnDef<any>[] = [
    { 
      accessorKey: 'scenario_id', 
      header: 'Scenario', 
      cell: info => <span className="font-mono text-[9px] font-black uppercase tracking-tighter text-slate-500">{info.getValue() as string}</span> 
    },
    { accessorKey: 'K', header: 'Limit (K)', cell: info => <div className="bg-slate-900 text-white px-2 py-0.5 rounded text-[9px] font-black inline-block tracking-widest">K={info.getValue() as number}</div> },
    { accessorKey: 'overlap_top_k', header: 'Capture Count', cell: info => <div className="font-mono text-xs font-black text-slate-800">{info.getValue() as number}</div> },
    { accessorKey: 'recall_at_k', header: 'Recall @ K', cell: info => <div className="font-mono text-xs text-blue-700 font-black">{pct(info.getValue() as number)}</div> },
    { accessorKey: 'precision_at_k', header: 'Precision @ K', cell: info => <div className="font-mono text-xs text-slate-400 font-bold">{pct(info.getValue() as number)}</div> },
    { accessorKey: 'hits_planned_tender', header: 'Tender Hits', cell: info => <div className="font-mono text-[10px] font-bold text-slate-500">{info.getValue() as number}</div> }
  ];

  const detailColumns: ColumnDef<any>[] = [
    { 
      accessorKey: 'scenario_id', 
      header: 'Scenario', 
      cell: info => <span className="font-mono text-[9px] font-black uppercase tracking-tighter text-slate-400">{info.getValue() as string}</span> 
    },
    { accessorKey: 'rank_prioritas', header: 'Rank', cell: info => <div className="font-mono font-black text-slate-900 text-base">{info.getValue() as number}</div> },
    { accessorKey: 'road_name', header: 'Target Segment', cell: info => <div className="text-[11px] font-black text-slate-800 break-words max-w-[200px] leading-tight line-clamp-2">{info.getValue() as string}</div> },
    { accessorKey: 'pred_prob', header: 'Score', cell: info => <div className="font-mono text-[10px] font-bold text-blue-700">{info.getValue() ? fmt(info.getValue() as number, 5) : '—'}</div> },
    { 
      accessorKey: 'planned_any_2026', 
      header: 'Targeted', 
      cell: info => (info.getValue() as number) > 0 ? <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded tracking-tighter uppercase">HIT</span> : <span className="text-slate-200">—</span> 
    },
    { 
      accessorKey: 'planned_tender_2026', 
      header: 'Method', 
      cell: info => (info.getValue() as number) > 0 ? <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">LELANG</span> : <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">PL/EMKAT</span> 
    }
  ];

  if (status === 'loading') return <LoadingState message="Aggregating performance and distribution metrics..." />;
  if (status === 'error') return <EmptyState title="Error" message={error || "Failed to load metrics registry."} />;
  if (!data) return <EmptyState />;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* Structural Navigation */}
      <nav className="flex gap-1 p-1 bg-slate-100/50 border border-slate-200 rounded-xl w-fit">
        <button onClick={() => setActiveTab('metrics')} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg", activeTab === 'metrics' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
           Model Diagnostics
        </button>
        <button onClick={() => setActiveTab('capture')} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg", activeTab === 'capture' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
           Capture Analytics
        </button>
        <button onClick={() => setActiveTab('detailed_rows')} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg", activeTab === 'detailed_rows' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
           Audit Log
        </button>
      </nav>

      {activeTab === 'metrics' && (
        <section className="space-y-10 animate-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.detectedScenarios.map(sid => {
              const bestModel = bestModelsByScenario.get(sid);
              const m = data.modelMetrics.find(x => x.scenario_id === sid && x.model === bestModel);
              
              return (
                <div key={sid} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm group hover:shadow-md transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase italic text-slate-400 tracking-tighter">Optimal Path</span>
                        <h4 className="text-[11px] font-black text-slate-900 font-mono">{sid}</h4>
                      </div>
                      {bestModel && <ModelBadge model={bestModel} />}
                   </div>
                   <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                      <div>
                         <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> PR-AUC</div>
                         <div className="text-xl font-black text-blue-700 font-mono leading-none">{m?.pr_auc ? fmt(m.pr_auc, 4) : '—'}</div>
                      </div>
                      <div>
                         <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> MCC</div>
                         <div className="text-xl font-black text-slate-800 font-mono leading-none">{m?.mcc ? fmt(m.mcc, 4) : '—'}</div>
                      </div>
                   </div>
                </div>
              );
            })}
          </div>

          <ChartCard 
            title="Classification Performance Master Array" 
            subtitle="Standardized model verification metrics across variants."
            actions={
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={showOnlyBest} onChange={e => setShowOnlyBest(e.target.checked)} className="rounded-md border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest group-hover:text-slate-900 transition-colors">Best Fit Only</span>
                </label>
                <button onClick={() => exportToCsv('diagnostic_array', metricsData, ['Scenario', 'Model', 'PR_AUC', 'MCC', 'Precision', 'Recall'], ['scenario_id', 'model', 'pr_auc', 'mcc', 'precision', 'recall'])} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition shadow-sm">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            }
          >
            <DataTable columns={metricsColumns} data={metricsData} pageSize={15} />
          </ChartCard>
        </section>
      )}

      {activeTab === 'capture' && (
        <section className="space-y-10 animate-in slide-in-from-bottom-2 duration-300">
          
          {chartScenarios.length > 0 ? (
            <ChartCard 
              title="Sensitivity Analysis: Target Capture Probability" 
              subtitle="Recall/Precision distribution mapping across rank thresholds (K)."
              actions={
                <select 
                  value={chartMetric} 
                  onChange={e => setChartMetric(e.target.value as any)} 
                  className="bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-lg px-4 py-2 outline-none focus:ring-4 focus:ring-slate-100 cursor-pointer"
                >
                  <option value="recall_at_k">Recall sensitivity</option>
                  <option value="precision_at_k">Precision sensitivity</option>
                </select>
              }
            >
               <div className="pt-6">
                 <ResponsiveContainer width="100%" height={380}>
                    <LineChart data={captureChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="K" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} tickFormatter={v => `K=${v}`} />
                      <YAxis domain={[0, 1]} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} tickFormatter={v => pct(v)} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 16, border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: 12 }} />
                      <Legend wrapperStyle={{fontSize: 10, paddingTop: 30, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em'}} iconType="rect" />
                      {chartScenarios.map((sid, i) => (
                        <Line key={sid} type="stepAfter" dataKey={sid} name={sid} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={4} dot={{r: 5, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 8}} />
                      ))}
                    </LineChart>
                 </ResponsiveContainer>
               </div>
            </ChartCard>
          ) : (
            <div className="bg-slate-50 border border-slate-100 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sensitivity Capture Array Missing</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-3 italic leading-relaxed">No longitudinal K-distribution data detected in <code>target_capture.json</code>.</p>
            </div>
          )}

          <ChartCard 
            title="Longitudinal Capture Array" 
            subtitle="Static intersections of observed recall/precision at discrete rank boundaries."
            actions={
              <button onClick={() => exportToCsv('capture_array', captureData, ['Scenario', 'K', 'Recall', 'Precision'], ['scenario_id', 'K', 'recall_at_k', 'precision_at_k'])} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition shadow-sm">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            }
          >
             {captureData.length > 0 ? (
               <DataTable columns={captureColumns} data={captureData} pageSize={15} />
             ) : (
               <EmptyState message="Target capture trace arrays are unpopulated." />
             )}
          </ChartCard>
        </section>
      )}

      {activeTab === 'detailed_rows' && (
        <section className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-4 mb-2">
             <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg shadow-slate-200">
                <ListChecks className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Diagnostic Audit Log</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Granular tracking of target hits for external validation.</p>
             </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2"><ChevronRight className="w-4 h-4 text-blue-500"/> Observed Distribution Detail</h4>
               <button onClick={() => exportToCsv('audit_log', targetRowsData, ['Scenario', 'Rank', 'Road', 'Hit'], ['scenario_id', 'rank_prioritas', 'road_name', 'planned_any_2026'])} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 px-3 py-1.5 transition">
                 <Download className="w-3.5 h-3.5" /> Export Log
               </button>
            </div>
            <div className="p-2">
               {targetRowsData.length > 0 ? (
                 <DataTable columns={detailColumns} data={targetRowsData} pageSize={20} />
               ) : (
                 <EmptyState message="Target audit tracking arrays are unpopulated." />
               )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

