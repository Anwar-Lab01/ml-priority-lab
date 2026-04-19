import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Target, CheckCircle2, XCircle } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { EmptyState } from '../components/ui/EmptyState';
import { ChartCard } from '../components/ui/ChartCard';
import { fmt, exportToCsv, getRoadKey, isTargetPositive } from '../../lib/utils';
import { CHART_COLORS } from '../../config/scenarios';
import type { RankingRow } from '../../types/contracts';

type TargetType = 'planned_any_2026' | 'planned_tender_2026' | 'planned_teknokratis_2026' | 'planned_teknokratis_2027' | 'both';
type CompareUnit = 'model' | 'model_score';
type MetricType = 'hits' | 'recall' | 'precision';

interface SummaryRow {
  scenario: string;
  target: string;
  seriesKey: string;
  model: string;
  scoreType: string;
  k: number;
  totalPositive: number;
  capturedPositive: number;
  recallAtK: number;
  precisionAtK: number;
}

export function TargetHitComparePage() {
  const { data: appData } = useAppData();

  const [scenario, setScenario] = useState<string>('');
  const [targetType, setTargetType] = useState<TargetType>('planned_any_2026');
  const [compareUnit, setCompareUnit] = useState<CompareUnit>('model');
  const [metric, setMetric] = useState<MetricType>('hits');
  
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set());
  
  const [customK, setCustomK] = useState<number | ''>('');
  const [activeKOptions, setActiveKOptions] = useState<Set<number>>(new Set([35, 70, 105, 140]));

  // Drilldown state
  const [ddTarget, setDdTarget] = useState<'planned_any_2026' | 'planned_tender_2026' | 'planned_teknokratis_2026' | 'planned_teknokratis_2027'>('planned_any_2026');
  const [ddSeries, setDdSeries] = useState<string>('');
  const [ddK, setDdK] = useState<number>(35);

  useEffect(() => {
    if (appData && !scenario && appData.detectedScenarios.length > 0) {
      setScenario(appData.detectedScenarios[0]);
    }
  }, [appData, scenario]);

  const getSeriesKey = (r: RankingRow) => {
    if (compareUnit === 'model') return r.model;
    return r.score_type ? `${r.model} + ${r.score_type}` : r.model;
  };

  const getSeriesModel = (r: RankingRow) => r.model;
  const getSeriesScoreType = (r: RankingRow) => r.score_type || '-';

  const {
    availableSeries,
    rankedDataBySeries,
    totalPositives,
    scenariosList
  } = useMemo(() => {
    if (!appData) return { availableSeries: [], rankedDataBySeries: new Map(), totalPositives: { planned_any_2026: 0, planned_tender_2026: 0, planned_teknokratis_2026: 0, planned_teknokratis_2027: 0 }, scenariosList: [] };
    
    const scens = appData.detectedScenarios.map(id => {
      const s = appData.scenarios.find(x => x.scenario_id === id);
      return { id, label: s ? s.scenario_label : id };
    });

    if (!scenario) return { availableSeries: [], rankedDataBySeries: new Map(), totalPositives: { planned_any_2026: 0, planned_tender_2026: 0, planned_teknokratis_2026: 0, planned_teknokratis_2027: 0 }, scenariosList: scens };

    const ranks = appData.indexes.rankingsByScenario.get(scenario) || [];
    
    // Group ranks by seriesKey
    const seriesMap = new Map<string, RankingRow[]>();
    for (const r of ranks) {
      const k = getSeriesKey(r);
      if (!seriesMap.has(k)) seriesMap.set(k, []);
      seriesMap.get(k)!.push(r);
    }
    
    const sKeys = Array.from(seriesMap.keys()).sort();
    
    for (const arr of seriesMap.values()) {
      arr.sort((a, b) => a.rank - b.rank);
    }

    let totAny = 0;
    let totTender = 0;
    let totTek26 = 0;
    let totTek27 = 0;
    if (sKeys.length > 0) {
      const uniqueBase = seriesMap.get(sKeys[0])!;
      totAny = uniqueBase.filter(r => isTargetPositive(r.planned_any_2026)).length;
      totTender = uniqueBase.filter(r => isTargetPositive(r.planned_tender_2026)).length;
      totTek26 = uniqueBase.filter(r => isTargetPositive(r.planned_teknokratis_2026)).length;
      totTek27 = uniqueBase.filter(r => isTargetPositive(r.planned_teknokratis_2027)).length;
    }

    return {
      availableSeries: sKeys,
      rankedDataBySeries: seriesMap,
      totalPositives: {
        planned_any_2026: totAny,
        planned_tender_2026: totTender,
        planned_teknokratis_2026: totTek26,
        planned_teknokratis_2027: totTek27
      },
      scenariosList: scens
    };
  }, [appData, scenario, compareUnit]);

  useEffect(() => {
    // If unit changes or scenario changes, reset selection to all
    setSelectedSeries(new Set(availableSeries));
    if (availableSeries.length > 0) {
       setDdSeries(availableSeries[0]);
    }
  }, [availableSeries]);

  const toggleSeries = (s: string) => {
    setSelectedSeries(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleToggleK = (k: number) => {
    setActiveKOptions(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleAddCustomK = () => {
    let maxLen = 0;
    if (availableSeries.length > 0) {
       maxLen = rankedDataBySeries.get(availableSeries[0])?.length || 0;
    }
    
    if (typeof customK === 'number' && customK > 0) {
      const validK = maxLen > 0 ? Math.min(customK, maxLen) : customK;
      setActiveKOptions(prev => {
        const next = new Set(prev);
        next.add(validK);
        return next;
      });
      setCustomK('');
    }
  };

  const currentKs = Array.from(activeKOptions).sort((a,b) => a - b);
  const selSeriesList = availableSeries.filter(s => selectedSeries.has(s));

  // Compute stats
  const tableData = useMemo(() => {
    const records: SummaryRow[] = [];
    if (!scenario || selSeriesList.length === 0 || currentKs.length === 0) return records;

    const targetsToProcess = targetType === 'both' ? ['planned_any_2026', 'planned_tender_2026'] : [targetType];

    for (const tgt of targetsToProcess) {
      const totObj = totalPositives[tgt as keyof typeof totalPositives] || 0;
      for (const s of selSeriesList) {
        const arr = rankedDataBySeries.get(s)!;
        const rowSample = arr[0];
        
        for (const k of currentKs) {
          const slice = arr.slice(0, k);
          const hits = slice.filter((r: RankingRow) => isTargetPositive(r[tgt as keyof RankingRow] as number | null)).length;
          const rec = totObj > 0 ? hits / totObj : 0;
          const prec = k > 0 ? hits / k : 0;
          
          records.push({
            scenario,
            target: tgt,
            seriesKey: s,
            model: rowSample ? getSeriesModel(rowSample) : '',
            scoreType: rowSample ? getSeriesScoreType(rowSample) : '',
            k,
            totalPositive: totObj,
            capturedPositive: hits,
            recallAtK: rec,
            precisionAtK: prec
          });
        }
      }
    }
    return records;
  }, [scenario, targetType, selSeriesList, currentKs, rankedDataBySeries, totalPositives]);

  // Chart data formatting
  const renderChart = (tgt: string, title: string) => {
    const cData = currentKs.map(k => {
      const g: any = { name: `Top ${k}` };
      selSeriesList.forEach(s => {
        const summary = tableData.find(x => x.target === tgt && x.k === k && x.seriesKey === s);
        if (summary) {
           if (metric === 'hits') g[s] = summary.capturedPositive;
           else if (metric === 'recall') g[s] = summary.recallAtK;
           else if (metric === 'precision') g[s] = summary.precisionAtK;
        }
      });
      return g;
    });

    const metricNames = {
       'hits': 'Hits Count',
       'recall': 'Recall @ K',
       'precision': 'Precision @ K'
    };

    return (
      <ChartCard title={`${title} - ${metricNames[metric]}`}>
        <div className="h-80 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} axisLine={{stroke: '#cbd5e1'}} tickLine={false} />
              <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={val => metric === 'hits' ? val : fmt(val, 2)} axisLine={false} tickLine={false} />
              <RTooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => metric === 'hits' ? val : fmt(Number(val), 3)}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {selSeriesList.map((s, idx) => (
                <Bar key={s} dataKey={s} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  };

  // Drilldown formatting
  const ddData = useMemo(() => {
    if (!ddSeries || !rankedDataBySeries.has(ddSeries)) return { captured: [], missed: [], targetMiss: [] };
    const arr = rankedDataBySeries.get(ddSeries)!;
    
    const captured: RankingRow[] = [];
    const missed: RankingRow[] = [];     // Overprediction
    const targetMiss: RankingRow[] = []; // Missed Targets

    for (const r of arr) {
      const isTarget = isTargetPositive(r[ddTarget] as number | null);
      if (r.rank <= ddK) {
        if (isTarget) captured.push(r);
        else missed.push(r);
      } else {
        if (isTarget) targetMiss.push(r);
      }
    }
    return { captured, missed, targetMiss };
  }, [rankedDataBySeries, ddSeries, ddK, ddTarget]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 overflow-x-hidden">
      
      {/* Controls Container */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 xl:grid-cols-[1fr_2fr_1fr] gap-6">
        
        {/* Left Col: Core Identifiers */}
        <div className="space-y-5">
           <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Scenario</label>
             <select value={scenario} onChange={e => setScenario(e.target.value)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none focus:ring-2 focus:ring-blue-100">
               {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Target Def</label>
             <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto gap-1 hide-scrollbar">
                {(['planned_any_2026', 'planned_tender_2026', 'planned_teknokratis_2026', 'planned_teknokratis_2027', 'both'] as const).map(t => {
                  const lbl = t === 'planned_any_2026' ? 'Any 2026' : 
                              t === 'planned_tender_2026' ? 'Tender 2026' : 
                              t === 'planned_teknokratis_2026' ? 'Tekno 2026' : 
                              t === 'planned_teknokratis_2027' ? 'Tekno 2027' : 'Both (Any/Tender)';
                  return (
                    <button key={t} onClick={() => setTargetType(t)} className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-colors ${targetType === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                      {lbl}
                    </button>
                  );
                })}
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Group Unit</label>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCompareUnit('model')} className={`text-[11px] font-semibold py-1.5 rounded border transition-colors ${compareUnit === 'model' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  Model Only
                </button>
                <button onClick={() => setCompareUnit('model_score')} className={`text-[11px] font-semibold py-1.5 rounded border transition-colors ${compareUnit === 'model_score' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  Model + Score Type
                </button>
             </div>
           </div>
        </div>

        {/* Mid Col: Series Multi-Select */}
        <div className="space-y-2">
           <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
             Series Selection <span className="font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px]">{selSeriesList.length}/{availableSeries.length}</span>
           </label>
           <div className="h-44 border border-slate-200 rounded-lg overflow-y-auto bg-slate-50 p-2 space-y-1">
             {availableSeries.map(s => (
                <label key={s} className="flex items-center gap-2.5 p-2 bg-white rounded shadow-sm border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors">
                  <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" checked={selectedSeries.has(s)} onChange={() => toggleSeries(s)} />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">{s}</span>
                </label>
             ))}
             {availableSeries.length === 0 && <div className="text-center p-4 text-xs text-slate-400">No series found</div>}
           </div>
        </div>

        {/* Right Col: K Threshold & Metric */}
         <div className="space-y-5">
           <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Primary Metric</label>
             <select value={metric} onChange={(e) => setMetric(e.target.value as MetricType)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none focus:ring-2 focus:ring-blue-100">
               <option value="hits">Hits (Captured Total)</option>
               <option value="recall">Recall @ K</option>
               <option value="precision">Precision @ K</option>
             </select>
           </div>
            
           <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex justify-between items-center">
               Top K Array
             </label>
             <div className="flex flex-wrap gap-2">
                {[35, 70, 105, 140].map(k => (
                  <button key={k} onClick={() => handleToggleK(k)} className={`px-3 py-1.5 rounded border text-xs font-bold font-mono transition-colors ${activeKOptions.has(k) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {k}
                  </button>
                ))}
                {Array.from(activeKOptions).filter(k => ![35,70,105,140].includes(k)).map(k => (
                  <button key={`c-${k}`} onClick={() => handleToggleK(k)} className="px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                    {k} ✕
                  </button>
                ))}
             </div>
             <div className="flex gap-2 pt-1">
               <input type="number" placeholder="Custom K..." value={customK} onChange={e => setCustomK(e.target.value ? Number(e.target.value) : '')} onKeyDown={e => e.key === 'Enter' && handleAddCustomK()} className="flex-1 text-xs border border-slate-200 p-2 rounded-lg outline-none focus:border-blue-300" />
               <button onClick={handleAddCustomK} disabled={!customK} className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50 text-slate-600 hover:bg-slate-200">+</button>
             </div>
           </div>
         </div>
      </div>

      {/* Main Charts */}
      {selSeriesList.length > 0 && currentKs.length > 0 ? (
        <div className={`grid gap-6 ${targetType === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {(targetType === 'both' || targetType === 'planned_any_2026') && renderChart('planned_any_2026', 'Capture Target (Planned Any)')}
          {(targetType === 'both' || targetType === 'planned_tender_2026') && renderChart('planned_tender_2026', 'Capture Target (Planned Tender)')}
          {targetType === 'planned_teknokratis_2026' && renderChart('planned_teknokratis_2026', 'Capture Target (Teknokratis 2026)')}
          {targetType === 'planned_teknokratis_2027' && renderChart('planned_teknokratis_2027', 'Capture Target (Teknokratis 2027)')}
        </div>
      ) : (
        <EmptyState title="No Datapoints" message="Select at least one series and one K threshold to view charts." />
      )}

      {/* Analytics Table */}
      {tableData.length > 0 && (
         <ChartCard 
           title="Capture Summary Data" 
           actions={
             <button onClick={() => exportToCsv(`capture_summary_${Date.now()}`, tableData, ['Scenario', 'Target', 'Series', 'K', 'Hits', 'Recall', 'Precision'], ['scenario', 'target', 'seriesKey', 'k', 'capturedPositive', 'recallAtK', 'precisionAtK'])} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded shadow-sm hover:bg-slate-50 transition">
               <Download className="w-3 h-3" /> Export
             </button>
           }
         >
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[700px]">
                 <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-500 uppercase text-[10px] tracking-widest">
                   <tr>
                     <th className="p-3">Target</th>
                     <th className="p-3">Series Key</th>
                     <th className="p-3">K</th>
                     <th className="p-3 text-right">Universe Tgt</th>
                     <th className="p-3 text-right bg-blue-50/50">Hits</th>
                     <th className="p-3 text-right">Recall</th>
                     <th className="p-3 text-right">Precision</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {tableData.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                       <td className="p-3 text-xs font-semibold text-slate-500">{row.target.replace('planned_', '').replace('_2026', '').toUpperCase()}</td>
                       <td className="p-3 text-xs font-bold text-slate-800">{row.seriesKey}</td>
                       <td className="p-3 text-xs font-mono font-bold text-slate-600 bg-slate-50/30">Top {row.k}</td>
                       <td className="p-3 text-xs font-mono text-slate-500 text-right">{row.totalPositive}</td>
                       <td className="p-3 text-xs font-mono font-black text-blue-700 text-right bg-blue-50/30">{row.capturedPositive}</td>
                       <td className="p-3 text-xs font-mono font-bold text-emerald-600 text-right">{fmt(row.recallAtK * 100, 1)}%</td>
                       <td className="p-3 text-xs font-mono font-bold text-amber-600 text-right">{fmt(row.precisionAtK * 100, 1)}%</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         </ChartCard>
      )}

      {/* Drill-down Detail Panel */}
      {selSeriesList.length > 0 && currentKs.length > 0 && (
         <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden text-slate-200">
            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <h3 className="text-white font-bold text-sm tracking-wide flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> Drill-down Analysis</h3>
                 <p className="text-[11px] text-slate-400 mt-0.5">Inspect exactly which roads were captured or missed within a specific lens.</p>
               </div>
               
               <div className="flex flex-wrap items-center gap-3">
                  <select value={ddTarget} onChange={e => setDdTarget(e.target.value as any)} className="bg-slate-800 border-none text-slate-200 text-xs font-semibold rounded-md py-1.5 focus:ring-1 focus:ring-emerald-500/50 outline-none">
                     <option value="planned_any_2026">Target: Any</option>
                     <option value="planned_tender_2026">Target: Tender</option>
                     <option value="planned_teknokratis_2026">Target: Tekno 2026</option>
                     <option value="planned_teknokratis_2027">Target: Tekno 2027</option>
                  </select>
                  <select value={ddSeries} onChange={e => setDdSeries(e.target.value)} className="bg-slate-800 border-none text-slate-200 text-xs font-semibold rounded-md py-1.5 max-w-[150px] focus:ring-1 focus:ring-emerald-500/50 outline-none">
                     {selSeriesList.map(s => <option key={s} value={s}>{s}</option>)}
                     {!selSeriesList.includes(ddSeries) && selSeriesList.length > 0 && <option value={selSeriesList[0]}>{selSeriesList[0]}</option>}
                  </select>
                  <select value={ddK} onChange={e => setDdK(Number(e.target.value))} className="bg-slate-800 border-none text-slate-200 text-xs font-mono font-bold rounded-md py-1.5 focus:ring-1 focus:ring-emerald-500/50 outline-none">
                     {currentKs.map(k => <option key={k} value={k}>Top {k}</option>)}
                  </select>
               </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
               {/* Captured */}
               <div className="p-0">
                  <div className="bg-slate-800/50 px-5 py-3 border-b border-white/5 flex items-center justify-between">
                     <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Captured Hits</span>
                     <span className="bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded">{ddData.captured.length} Segments</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
                     {ddData.captured.length > 0 ? (
                        <ul className="space-y-1">
                           {ddData.captured.map(r => (
                             <li key={getRoadKey(r)} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/50 rounded-lg group transition-colors">
                                <div className="text-emerald-500 font-mono font-black text-[10px] bg-emerald-500/10 h-6 w-6 flex items-center justify-center rounded">{r.rank}</div>
                                <div className="flex-1 truncate">
                                   <div className="text-xs font-bold text-slate-200 truncate">{r.road_name}</div>
                                   <div className="text-[9px] text-slate-500 font-mono mt-0.5">Score: {fmt(r.score, 4)}</div>
                                </div>
                             </li>
                           ))}
                        </ul>
                     ) : <div className="p-5 text-center text-xs text-slate-500 font-semibold mt-10">0 Hits captured in this threshold.</div>}
                  </div>
               </div>

               {/* Missed */}
               <div className="p-0">
                  <div className="bg-slate-800/50 px-5 py-3 border-b border-white/5 flex items-center justify-between">
                     <span className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Overprediction (False Positives)</span>
                     <span className="bg-rose-500/10 text-rose-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded">{ddData.missed.length} Segments</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
                     {ddData.missed.length > 0 ? (
                        <ul className="space-y-1">
                           {ddData.missed.map(r => (
                             <li key={getRoadKey(r)} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/50 rounded-lg group transition-colors">
                                <div className="text-rose-400 font-mono font-black text-[10px] bg-rose-500/10 h-6 w-6 flex items-center justify-center rounded shrink-0">{r.rank}</div>
                                <div className="flex-1 truncate">
                                   <div className="text-xs font-bold text-slate-200 truncate">{r.road_name}</div>
                                   <div className="text-[9px] text-slate-500 font-mono mt-0.5">Score: {fmt(r.score, 4)}</div>
                                </div>
                             </li>
                           ))}
                        </ul>
                     ) : <div className="p-5 text-center text-xs text-slate-500 font-semibold mt-10">No overpredictions in this slice!</div>}
                  </div>
               </div>

               {/* Target Miss (False Negatives) */}
               <div className="p-0">
                  <div className="bg-slate-800/50 px-5 py-3 border-b border-white/5 flex items-center justify-between">
                     <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Target Miss (FN)</span>
                     <span className="bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded">{ddData.targetMiss.length} Segments</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
                     {ddData.targetMiss.length > 0 ? (
                        <ul className="space-y-1">
                           {ddData.targetMiss.map(r => (
                             <li key={getRoadKey(r)} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/50 rounded-lg group transition-colors">
                                <div className="text-amber-400 font-mono font-black text-[10px] bg-amber-500/10 h-6 w-6 flex items-center justify-center rounded shrink-0">{r.rank}</div>
                                <div className="flex-1 truncate">
                                   <div className="text-xs font-bold text-slate-200 truncate">{r.road_name}</div>
                                   <div className="text-[9px] text-slate-500 font-mono mt-0.5 flex gap-2">
                                      <span>Score: {fmt(r.score, 4)}</span>
                                      <span className="text-amber-600 font-black">&Delta; +{r.rank - ddK}</span>
                                   </div>
                                </div>
                             </li>
                           ))}
                        </ul>
                     ) : <div className="p-5 text-center text-xs text-slate-500 font-semibold mt-10">100% Target Capture!</div>}
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
