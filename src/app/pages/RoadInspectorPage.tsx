import { useState, useMemo, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { Search, Info, CheckCircle2, Target, Focus, Download, ChevronRight } from 'lucide-react';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/tables/DataTable';
import { ScenarioBadge } from '../components/ui/ScenarioBadge';
import { ModelBadge } from '../components/ui/ModelBadge';
import { fmt, cn, exportToCsv, getRoadKey, getShapKey, isTargetPositive, isTargetKnown } from '../../lib/utils';

export function RoadInspectorPage() {
  const { data, status, error } = useAppData();

  const [selectedRoadKey, setSelectedRoadKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [inspectScenario, setInspectScenario] = useState<string>('');
  const [inspectModel, setInspectModel] = useState<string>('');

  // 1. All roads
  const allRoads = useMemo(() => {
    if (!data) return [];
    return Array.from(data.indexes.rankingsByRoadKey.entries())
      .map(([key, rows]) => ({ key, name: rows[0]?.road_name || 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // 2. Filter for sidebar
  const filteredRoads = useMemo(() => {
    if (!searchTerm) return allRoads.slice(0, 80);
    const t = searchTerm.toLowerCase();
    return allRoads.filter(r => r.name.toLowerCase().includes(t) || r.key.includes(t)).slice(0, 80);
  }, [allRoads, searchTerm]);

  // 3. Selected Road Rankings
  const selectedRankings = useMemo(() => {
    if (!data || !selectedRoadKey) return [];
    const ranks = data.indexes.rankingsByRoadKey.get(selectedRoadKey) || [];
    return [...ranks].sort((a, b) => a.rank - b.rank);
  }, [data, selectedRoadKey]);

  useEffect(() => {
    if (selectedRankings.length > 0) {
      setInspectScenario(selectedRankings[0].scenario_id);
      setInspectModel(selectedRankings[0].model);
    } else {
      setInspectScenario('');
      setInspectModel('');
    }
  }, [selectedRoadKey, selectedRankings]);

  // 4. Inspect Data (Features + SHAP)
  const { selectedFeatures, localShapChartData } = useMemo(() => {
    if (!data || !selectedRoadKey || !inspectScenario || !inspectModel) return { selectedFeatures: null, localShapChartData: [] };

    const features = data.roadFeatures.find(f => getRoadKey(f) === selectedRoadKey && f.scenario_id === inspectScenario);
    
    let shapChart: any[] = [];
    const shapKey = getShapKey(inspectScenario, inspectModel, selectedRoadKey);
    const roadShap = data.indexes.shapLocalByKey.get(shapKey) || [];
    
    if (roadShap.length > 0) {
      let filtered = roadShap.filter(r => Math.abs(r.shap_value) > 0.001);
      filtered.sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));
      shapChart = filtered.slice(0, 15).map(r => ({
        feature: r.feature.replace(/^Norm01_/, ''),
        contribution: r.shap_value,
        isPositive: r.shap_value > 0
      }));
    } else {
      if (import.meta.env.DEV) console.warn(`[RoadInspector] No local SHAP data found for key: "${shapKey}"`);
    }

    return { selectedFeatures: features || null, localShapChartData: shapChart };
  }, [data, selectedRoadKey, inspectScenario, inspectModel]);

  const summary = useMemo(() => {
    if (selectedRankings.length === 0) return null;
    const ranks = selectedRankings.map(r => r.rank);
    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    const avg = ranks.reduce((a,b)=>a+b, 0) / ranks.length;
    
    return {
      min, max, spread: max - min,
      avg: avg,
      appearances: ranks.length,
      top10: ranks.some(r => r <= 10),
      top30: ranks.some(r => r <= 30)
    };
  }, [selectedRankings]);

  const handleExportRankings = () => {
    if (!selectedRoadKey) return;
    exportToCsv(`road_${selectedRoadKey.slice(0,20)}_rankings`, selectedRankings, 
      ['Scenario', 'Model', 'Rank', 'Score', 'Target'], 
      ['scenario_id', 'model', 'rank', 'score', 'planned_any_2026']
    );
  };

  const handleExportFeatures = () => {
    if (!selectedFeatures) return;
    const rows = Object.entries(selectedFeatures)
      .filter(([k]) => !['scenario_id', 'road_id', 'road_name', 'source_file', 'source_sheet', 'wsm_score', 'rank', 'nama_ruas_norm'].includes(k))
      .map(([k, v]) => ({ key: k.replace(/^Norm01_/, ''), value: v }));
    exportToCsv(`road_${selectedRoadKey?.slice(0,20)}_features_${inspectScenario}`, rows, ['Indicator', 'Value'], ['key', 'value']);
  };

  const rankingColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'scenario_id',
      header: 'Scenario',
      cell: (info) => {
        const sid = info.getValue() as string;
        const family = sid.toLowerCase().includes('normatif') ? 'normatif' : 'historis';
        return (
          <div className="flex items-center gap-2">
             <ScenarioBadge family={family as any} />
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{sid}</span>
          </div>
        );
      }
    },
    {
      accessorKey: 'model',
      header: 'Model',
      cell: (info) => <ModelBadge model={info.getValue() as string} />
    },
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: (info) => <div className="font-mono font-black text-slate-800 text-base">{info.getValue() as string}</div>
    },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: (info) => <div className="font-mono text-[10px] font-bold text-slate-400">{info.getValue() !== null ? fmt(info.getValue() as number, 5) : '—'}</div>
    },
    {
      accessorKey: 'planned_any_2026',
      header: 'Target',
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (!isTargetKnown(val)) return <span className="text-amber-400 mx-auto text-[9px] font-bold italic" title="Target data unavailable">N/A</span>;
        return isTargetPositive(val) ? <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto" /> : <span className="text-slate-200 mx-auto">—</span>;
      }
    },
    {
      id: 'actions',
      header: 'Diagnostic',
      cell: (info) => {
        const row = info.row.original;
        const isSelected = inspectScenario === row.scenario_id && inspectModel === row.model;
        if (isSelected) return <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1.5"><Focus className="w-3 h-3"/> Active</span>;
        
        return (
          <button 
             onClick={() => { setInspectScenario(row.scenario_id); setInspectModel(row.model); }}
             className="text-[10px] bg-slate-50 border border-slate-200 font-bold uppercase hover:bg-slate-900 hover:text-white transition px-2 py-1 rounded text-slate-500"
          >
            Select
          </button>
        );
      }
    }
  ];

  if (status === 'loading') return <LoadingState message="Processing road segment diagnostic indexes..." />;
  if (status === 'error') return <EmptyState title="Error" message={error || "Failed to load road data."} />;
  if (!data) return <EmptyState />;

  const roadName = allRoads.find(r => r.key === selectedRoadKey)?.name;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-8 animate-in fade-in duration-500">
      
      {/* Registry Panel */}
      <div className="flex w-80 flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Segment Registry</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name/id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
          {filteredRoads.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">No records found.</div>
          ) : (
            filteredRoads.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedRoadKey(r.key)}
                className={cn(
                  "w-full flex flex-col text-left px-4 py-3 rounded-xl transition-all border",
                  selectedRoadKey === r.key 
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                    : "bg-white border-transparent hover:bg-slate-50 text-slate-700 hover:border-slate-200"
                )}
              >
                <span className="text-[11px] font-bold leading-tight break-words h-8 line-clamp-2">{r.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Diagnostic Area */}
      <div className="flex-1 overflow-y-auto pr-4 pb-12 scrollbar-thin">
        {!selectedRoadKey ? (
          <div className="h-full flex items-center justify-center border-4 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
             <div className="text-center p-12">
                <Target className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Segment Diagnostic Workbench</h3>
                <p className="text-sm text-slate-500 mt-3 max-w-sm italic leading-relaxed">Select a segment from the registry to initiate cross-scenario inspection, feature audit, and contribution mapping.</p>
             </div>
          </div>
        ) : (
          <div className="space-y-8">
            
            <header className="flex flex-col gap-2 pb-6 border-b border-slate-100">
               <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{roadName}</h2>
               <div className="flex items-center gap-4">
                  <div className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-widest">Cross-Scenario Key</div>
                  {summary?.top10 && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1 rounded tracking-widest uppercase">Targeting Elite Cohort</span>}
                  {summary?.top30 && !summary?.top10 && <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-1 rounded tracking-widest uppercase">Targeting Priority Cohort</span>}
               </div>
            </header>

            {summary && (
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <MetricCard label="Scenario Reach" value={summary.appearances} subtitle="Total variant appearances" />
                 <MetricCard label="Peak Ranking" value={summary.min} trend="up" subtitle={`Average: ${Math.round(summary.avg)}`} />
                 <MetricCard label="Maximum Rank" value={summary.max} trend="down" subtitle="Lowest priority reached" />
                 <MetricCard label="Rank Volatility" value={summary.spread} subtitle="Subject variance across models" />
               </div>
             )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-500" /> Longitudinal Ranking Log
                </h3>
                <button onClick={handleExportRankings} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 hover:text-slate-900 p-2">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <DataTable columns={rankingColumns} data={selectedRankings} pageSize={5} />
              </div>
            </section>

            {/* Diagnostic Panel */}
            <div className="pt-10 border-t border-slate-200 mt-12 bg-slate-50/50 rounded-3xl p-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                     <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg shadow-slate-200">
                        <Focus className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Analytical Diagnostics</h3>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1">
                          Subject: <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{inspectScenario}</span> / <span className="text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{inspectModel}</span>
                        </p>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                 
                 {/* Feature Table */}
                 <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                       <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Indicator Matrix</h4>
                          <p className="text-[10px] text-slate-400 font-bold">Raw feature values for this specific intersection.</p>
                       </div>
                       <button onClick={handleExportFeatures} className="text-slate-400 hover:text-slate-900"><Download className="h-4 w-4"/></button>
                    </div>
                    <div className="max-h-[460px] overflow-y-auto p-2 scrollbar-thin">
                      {selectedFeatures ? (
                        <table className="w-full text-[11px] border-separate border-spacing-0">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="text-left font-black uppercase tracking-tighter text-slate-400">
                              <th className="px-3 py-3 border-b border-slate-100">Component</th>
                              <th className="px-3 py-3 border-b border-slate-100 text-right">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {Object.entries(Object.assign({}, selectedFeatures))
                              .filter(([k]) => !['scenario_id', 'road_id', 'road_name', 'source_file', 'source_sheet', 'wsm_score', 'rank', 'nama_ruas_norm'].includes(k))
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, val]) => (
                                <tr key={key} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-3 py-2.5 text-slate-600 font-bold group-hover:text-slate-900">{key.replace(/^Norm01_/, '')}</td>
                                  <td className="px-3 py-2.5 font-mono text-right font-black text-slate-800 group-hover:text-blue-700">{typeof val === 'number' ? fmt(val, 5) : String(val)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-12 text-center text-slate-400 italic">Indicator profile not extracted for this scenario.</div>
                      )}
                    </div>
                 </section>

                 {/* contribution Chart */}
                 <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                       <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Contribution profile (SHAP)</h4>
                       <p className="text-[10px] text-slate-400 font-bold">Positive/Negative score drivers for this record.</p>
                    </div>
                    <div className="p-5">
                      {localShapChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={460}>
                          <BarChart data={localShapChartData} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }} stackOffset="sign">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => fmt(val, 3)} />
                            <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }} />
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
                      ) : (
                        <div className="h-[460px] flex items-center justify-center p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <div className="max-w-xs">
                            <Info className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">Driver Array Unavailable</h4>
                            <p className="text-xs text-slate-500 mt-2 italic leading-relaxed">
                              Contribution vectors were not exported for <b>{inspectScenario}</b>. This often suggests a deterministic baseline model calculation.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                 </section>

               </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}

