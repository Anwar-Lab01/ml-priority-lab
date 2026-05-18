import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Info, CheckCircle2 } from 'lucide-react';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ChartCard } from '../components/ui/ChartCard';
import { DataTable } from '../components/tables/DataTable';
import { FilterBar, type FilterState } from '../components/filters/FilterBar';
import { fmt, exportToCsv, getRoadKey, getShapKey, isTargetPositive, isTargetKnown } from '../../lib/utils';
import { DEFAULT_TOP_K } from '../../config/scenarios';

export function ShapExplorerPage() {
  const { data: appData, status } = useAppData();

  const [filters, setFilters] = useState<FilterState>({
    scenarioId: '',
    model: '',
    topK: 35,
    search: '',
  });

  const [selectedRoadKey, setSelectedRoadKey] = useState<string | null>(null);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('');

  useEffect(() => {
    if (appData && !filters.scenarioId && appData.detectedScenarios.length > 0) {
      setFilters(prev => ({
        ...prev,
        scenarioId: appData.detectedScenarios[0],
        model: appData.detectedModels[0] ?? 'XGBoost',
      }));
    }
  }, [appData, filters.scenarioId]);

  const availableScoreTypes = useMemo(() => {
    if (!appData || !filters.scenarioId || !filters.model) return [] as string[];
    const rows = (appData.indexes.rankingsByScenario.get(filters.scenarioId) || []).filter(r => r.model === filters.model);
    return Array.from(new Set(rows.map(r => r.score_type || ''))).sort();
  }, [appData, filters.scenarioId, filters.model]);

  useEffect(() => {
    if (availableScoreTypes.length === 0) {
      setSelectedScoreType('');
      return;
    }
    if (!availableScoreTypes.includes(selectedScoreType)) {
      const preferred = ['pred_prob', 'base_ml', 'rerank'].find(v => availableScoreTypes.includes(v)) || availableScoreTypes[0];
      setSelectedScoreType(preferred);
    }
  }, [availableScoreTypes, selectedScoreType]);

  // 1. Global Importance Logic
  const { globalShapData, hasGlobalShap } = useMemo(() => {
    if (!appData || !filters.scenarioId) return { globalShapData: [], hasGlobalShap: false };
    
    const allForScenario = appData.indexes.shapGlobalByScenario.get(filters.scenarioId) || [];
    const filteredGlobal = allForScenario.filter(s => s.model === filters.model);
    
    if (filteredGlobal.length === 0) return { globalShapData: [], hasGlobalShap: false };

    const sorted = [...filteredGlobal].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);
    
    const data = sorted.map((r, i) => ({
      feature: r.feature.replace(/^Norm01_/, ''),
      mean_abs_shap: r.mean_abs_shap,
      rank: i + 1
    }));

    return { globalShapData: data, hasGlobalShap: true };
  }, [appData, filters.scenarioId, filters.model]);

  const globalChartData = useMemo(() => globalShapData.slice(0, 15), [globalShapData]);

  const rankingContextRows = useMemo(() => {
    if (!appData || !filters.scenarioId || !filters.model) return [];
    return (appData.indexes.rankingsByScenario.get(filters.scenarioId) || [])
      .filter(r => r.model === filters.model && (r.score_type || '') === selectedScoreType);
  }, [appData, filters.scenarioId, filters.model, selectedScoreType]);

  // 2. Local Segment Pool
  const { availableRoads, hasLocalShap } = useMemo(() => {
    if (!appData || !filters.scenarioId) return { availableRoads: [], hasLocalShap: false };
    
    let hasLocal = false;
    const roadsMap = new Map<string, string>();
    
    appData.shapLocal.forEach(r => {
      if (r.scenario_id === filters.scenarioId && r.model === filters.model) {
        hasLocal = true;
        roadsMap.set(getRoadKey(r), r.road_name);
      }
    });

    const list = Array.from(roadsMap.entries()).map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
    
    return { availableRoads: list, hasLocalShap: hasLocal };
  }, [appData, filters.scenarioId, filters.model]);

  useEffect(() => {
    if (availableRoads.length > 0 && (!selectedRoadKey || !availableRoads.some(r => r.key === selectedRoadKey))) {
      setSelectedRoadKey(availableRoads[0].key);
    }
  }, [availableRoads, selectedRoadKey]);

  const filteredRoadsList = useMemo(() => {
    if (!filters.search) return availableRoads;
    const q = (filters.search || '').toLowerCase();
    return availableRoads.filter(r => (r.name || '').toLowerCase().includes(q) || (r.key || '').includes(q));
  }, [availableRoads, filters.search]);

  // 3. Local Contribution Data
  const localShapChartData = useMemo(() => {
    if (!appData || !selectedRoadKey || !filters.scenarioId || !hasLocalShap) return [];

    const shapKey = getShapKey(filters.scenarioId, filters.model, selectedRoadKey);
    const roadRows = appData.indexes.shapLocalByKey.get(shapKey) || [];

    if (roadRows.length === 0) {
      if (import.meta.env.DEV) console.warn(`[ShapExplorer] No local SHAP data found for key: "${shapKey}"`);
      return [];
    }

    let filtered = roadRows.filter(r => Math.abs(r.shap_value) > 0.001);
    filtered.sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));

    return filtered.slice(0, 15).map(r => ({
      feature: r.feature.replace(/^Norm01_/, ''),
      contribution: r.shap_value,
      isPositive: r.shap_value > 0
    }));
  }, [appData, selectedRoadKey, filters.scenarioId, filters.model, hasLocalShap]);

  // 4. Segment Context
  const roadContext = useMemo(() => {
    if (!appData || !selectedRoadKey || !filters.scenarioId) return null;
    const ranks = appData.indexes.rankingsByScenario.get(filters.scenarioId) || [];
    const rr = ranks.find(
      r =>
        getRoadKey(r) === selectedRoadKey &&
        r.model === filters.model &&
        (r.score_type || '') === selectedScoreType
    );
    if (!rr) return null;

    return {
      road_name: rr.road_name,
      road_key: getRoadKey(rr),
      rank: rr.rank,
      score: rr.score,
      inTopK: rr.rank <= DEFAULT_TOP_K,
      planned_any_2026: rr.planned_any_2026 ?? null
    };
  }, [appData, selectedRoadKey, filters.scenarioId, filters.model, selectedScoreType]);

  const handleGlobalExport = () => {
    exportToCsv(`global_importance_${filters.scenarioId}_${filters.model}`, globalShapData, ['Rank', 'Feature', 'Mean_Abs_SHAP'], ['rank', 'feature', 'mean_abs_shap']);
  };

  const globalColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: (info) => <div className="font-mono text-slate-500 font-bold">{info.getValue() as number}</div>
    },
    {
      accessorKey: 'feature',
      header: 'Indicator / Feature',
      cell: (info) => <div className="font-semibold text-slate-800 break-words max-w-[240px]">{info.getValue() as string}</div>
    },
    {
      accessorKey: 'mean_abs_shap',
      header: 'Impact (|SHAP|)',
      cell: (info) => <div className="font-mono text-blue-700 font-black">{fmt(info.getValue() as number, 5)}</div>
    }
  ];

  if (status === 'loading') return <LoadingState message="Aggregating SHAP importance vectors..." />;
  if (!appData) return <EmptyState />;

  const scenariosList = appData.detectedScenarios.map(id => {
    const s = appData.scenarios.find(x => x.scenario_id === id);
    return s || { scenario_id: id, scenario_label: id, family: 'unknown' } as any;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 overflow-x-hidden">
      
      <FilterBar 
        scenarios={scenariosList} 
        filters={filters} 
        onChange={(update) => setFilters(prev => ({ ...prev, ...update }))} 
        showTopK={false} 
        showSearch={false}
      />

      {/* 1. Global View (Macro) */}
      <section>
        <div className="bg-slate-50 border-l-4 border-blue-500 rounded-r-xl p-5 mb-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-2.5 rounded-lg"><Info className="h-5 w-5 text-blue-600" /></div>
              <div>
                 <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 leading-none">Macro Diagnostics: Global Importance</h2>
                 <p className="text-xs text-slate-500 mt-1.5 font-medium italic">Aggregated feature contribution across the selection universe.</p>
              </div>
           </div>
           {hasGlobalShap && (
             <button onClick={handleGlobalExport} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition">
               <Download className="w-3.5 h-3.5" /> Export
             </button>
           )}
        </div>

        {!hasGlobalShap ? (
           <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Info className="h-10 w-10 text-slate-300 mb-3" />
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Global Explanations Unavailable</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 italic leading-relaxed">
                Importance vectors were not detected for <b>{filters.scenarioId} / {filters.model} / {selectedScoreType || 'N/A'}</b>.
                SHAP dapat tidak tersedia untuk konfigurasi ranking ini.
              </p>
           </div>
        ) : (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
             <ChartCard title="Impact Distribution" subtitle="Top 15 indicators by mean absolute SHAP influence.">
               <div className="pt-2">
                 <ResponsiveContainer width="100%" height={420}>
                   <BarChart data={globalChartData} layout="vertical" margin={{ left: 5, right: 30, top: 10, bottom: 10 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                     <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => fmt(val, 3)} />
                     <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                     <RTooltip 
                       formatter={(value: any) => [fmt(value as number, 5), 'Impact']}
                       contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                     />
                     <Bar dataKey="mean_abs_shap" fill="#475569" radius={[0, 4, 4, 0]} barSize={16}>
                        {globalChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#1e293b' : '#64748b'} />
                        ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </ChartCard>

             <ChartCard title="Complete Metric Array" subtitle="Ordered inventory of mean absolute feature impacts.">
               <div className="overflow-auto max-h-[440px] scrollbar-thin">
                 <DataTable columns={globalColumns} data={globalShapData} pageSize={20} />
               </div>
             </ChartCard>
           </div>
        )}
      </section>

      {/* 2. Local View (Micro) */}
      <section className="mt-16">
        <div className="bg-slate-50 border-l-4 border-emerald-500 rounded-r-xl p-5 mb-6">
           <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-2.5 rounded-lg"><Info className="h-5 w-5 text-emerald-600" /></div>
              <div>
                 <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 leading-none">Micro Diagnostics: Segment Explanation</h2>
                 <p className="text-xs text-slate-500 mt-1.5 font-medium italic">Granular analysis of individual segment score drivers.</p>
              </div>
           </div>
        </div>

        {!hasLocalShap ? (
           <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Info className="h-10 w-10 text-slate-300 mb-3" />
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Local Explanations Unavailable</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 italic leading-relaxed">
                Segment-level SHAP belum tersedia untuk konfigurasi ranking ini.
              </p>
           </div>
        ) : (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Context Panel */}
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                   <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 pb-2">Segment Selector</h3>
                   
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-500">Registry Search</label>
                     <input 
                       type="text" 
                       placeholder="Name or Local ID..." 
                       value={filters.search} 
                       onChange={e => setFilters(prev => ({...prev, search: e.target.value}))} 
                       className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-50 bg-slate-50" 
                     />
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-500">Score Type Context</label>
                     <select
                       value={selectedScoreType}
                       onChange={(e) => setSelectedScoreType(e.target.value)}
                       className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-white outline-none p-2.5 transition focus:ring-2 focus:ring-blue-100"
                     >
                       {availableScoreTypes.map(s => <option key={s || 'blank'} value={s}>{s || 'N/A'}</option>)}
                     </select>
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-500">Target Selection</label>
                     <select
                       value={selectedRoadKey ?? ''}
                       onChange={(e) => setSelectedRoadKey(e.target.value)}
                       className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-white outline-none p-2.5 transition focus:ring-2 focus:ring-blue-100"
                     >
                       {filteredRoadsList.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
                       {filteredRoadsList.length === 0 && <option value="" disabled>No matches...</option>}
                     </select>
                   </div>
                </div>

                {roadContext && (
                   <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5">
                      <div>
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Segment Context</h3>
                        <div className="text-sm font-black text-slate-800 leading-tight break-words">{roadContext.road_name}</div>
                        <div className="text-[9px] font-black font-mono text-slate-400 mt-1 uppercase">Local ID: {roadContext.road_key.slice(0, 30)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 font-mono">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                           <div className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Rank Position</div>
                           <div className="text-xl font-black text-slate-900">{roadContext.rank}</div>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                           <div className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Prob. Score</div>
                           <div className="text-lg font-black text-blue-700">{roadContext.score != null ? fmt(roadContext.score, 4) : '—'}</div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-slate-500 uppercase tracking-tight">Top 35 Cohort</span>
                            {roadContext.inTopK ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-slate-300">—</span>}
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-slate-500 uppercase tracking-tight">Observed Target</span>
                            {!isTargetKnown(roadContext.planned_any_2026) ? <span className="text-amber-400 text-[9px] font-bold italic" title="Target data unavailable">N/A</span> : isTargetPositive(roadContext.planned_any_2026) ? <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded tracking-widest">HIT</span> : <span className="text-slate-300">—</span>}
                         </div>
                      </div>
                   </div>
                )}

                {!roadContext && rankingContextRows.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] text-amber-700 font-semibold">
                    Tidak ada baris ranking untuk kombinasi skenario, model, dan score_type terpilih.
                  </div>
                )}
              </div>

              {/* Local Chart Area */}
              <div className="lg:col-span-2">
                 <ChartCard 
                   title="Local Feature Contribution Analysis" 
                   subtitle="Top 15 indicators driving the score for this specific segment record."
                 >
                   {localShapChartData.length > 0 ? (
                     <div className="pt-2">
                       <ResponsiveContainer width="100%" height={480}>
                         <BarChart data={localShapChartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }} stackOffset="sign">
                           <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                           <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => fmt(val, 3)} />
                           <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                           <RTooltip 
                             formatter={(value: any) => [fmt(value as number, 5), 'Contribution']}
                             contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                           />
                           <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={2} />
                           <Bar dataKey="contribution" radius={4} barSize={16}>
                             {localShapChartData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.isPositive ? '#ef4444' : '#10b981'} />
                             ))}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                   ) : (
                     <div className="h-[300px] flex items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-sm text-slate-400 italic">No local feature drivers detected for this segment record.</p>
                     </div>
                   )}
                 </ChartCard>
              </div>
           </div>
        )}
      </section>

    </div>
  );
}
