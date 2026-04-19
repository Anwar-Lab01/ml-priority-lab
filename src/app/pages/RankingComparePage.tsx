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
import { fmt, exportToCsv, getRoadKey, isTargetPositive, isTargetKnown } from '../../lib/utils';
import { computeSpearmanCorrelation, computeJaccardSimilarity, computeOverlapSet } from '../../lib/transforms';

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
}

export function RankingComparePage() {
  const { data: appData, status, error } = useAppData();

  const [scenarioA, setScenarioA] = useState<string>('');
  const [modelA, setModelA] = useState<string>('');
  const [scenarioB, setScenarioB] = useState<string>('');
  const [modelB, setModelB] = useState<string>('');
  const [scenarioC, setScenarioC] = useState<string>(''); 
  const [modelC, setModelC] = useState<string>('');
  
  const [topK, setTopK] = useState<number | 'all'>('all');
  const [search, setSearch] = useState<string>('');
  const [targetOnly, setTargetOnly] = useState<boolean>(false);

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

  const { rows, metrics, similarities } = useMemo(() => {
    if (!appData || !scenarioA || !scenarioB || !modelA || !modelB) {
      return { rows: [], metrics: null, similarities: [] };
    }

    const getAllFiltered = (s: string, m: string) => {
      let ranks = (appData.indexes.rankingsByScenario.get(s) || []).filter(r => r.model === m);
      ranks = ranks.sort((a,b) => a.rank - b.rank);
      if (topK !== 'all') {
        ranks = ranks.slice(0, Number(topK));
      }
      return ranks;
    };

    const dataA = getAllFiltered(scenarioA, modelA);
    const dataB = getAllFiltered(scenarioB, modelB);
    const dataC = scenarioC ? getAllFiltered(scenarioC, modelC) : [];

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

      if (search && !road_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (targetOnly && !isTargetPositive(pAny)) continue;

      if (isTargetPositive(pAny)) hitAny++;
      if (isTargetPositive(pTender)) hitTender++;
      if (isTargetPositive(pPl)) hitPl++;

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
        planned_pl: pPl
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
      metrics: { hitAny, hitTender, hitPl, overlapABC, uniqueA, uniqueB, unionCount: allIds.length },
      similarities: simMatrix
    };
  }, [appData, scenarioA, modelA, scenarioB, modelB, scenarioC, modelC, topK, search, targetOnly]);

  const handleExport = () => {
    const isC = !!scenarioC;
    const headers = ['road_name', 'target_any', 'target_tender', 'target_pl', 'rank_A', 'rank_B', 'abs_delta_AB'];
    const keys = ['road_name', 'planned_any', 'planned_tender', 'planned_pl', 'rankA', 'rankB', 'absDiffAB'];
    if (isC) {
      headers.push('rank_C');
      keys.push('rankC');
    }
    exportToCsv(`ranking_comparison_${new Date().getTime()}`, rows, headers, keys);
  };

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
      accessorKey: 'planned_any',
      header: 'TGT',
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
         </div>
         <div className="space-y-2 xl:pl-6 xl:border-l border-slate-100 flex flex-col justify-end">
            <div className="flex gap-3">
              <div className="flex-1">
                 <select value={topK} onChange={e => setTopK(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-full text-xs font-black rounded-lg border border-slate-300 bg-white p-2 outline-none uppercase tracking-tighter">
                   <option value="10">Top 10 Only</option>
                   <option value="20">Top 20 Only</option>
                   <option value="30">Top 30 Only</option>
                   <option value="50">Top 50 Only</option>
                   <option value="100">Top 100 Only</option>
                   <option value="all">View Complete Array</option>
                 </select>
              </div>
              <div className="flex items-center gap-2">
                 <input type="checkbox" id="tgt_chk" checked={targetOnly} onChange={e=>setTargetOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                 <label htmlFor="tgt_chk" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">Target Filter</label>
              </div>
            </div>
         </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
             label={scenarioC ? "Overlay Count (A∩B∩C)" : "Overlap Count (A∩B)"} 
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
             label="Target Capture Analysis" 
             value={metrics.hitAny} 
             subtitle={`${metrics.hitTender} Tender / ${metrics.hitPl} Penunjukan Langsung`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <ChartCard 
            title="Comparative Analysis Table" 
            subtitle={`Filtered view of ${rows.length} segments. Priority by Rank Δ.`}
            actions={
              <div className="flex items-center gap-3">
                <input type="text" placeholder="Search by segment name..." value={search} onChange={e=>setSearch(e.target.value)} className="text-xs font-semibold border border-slate-300 p-2 rounded-lg w-48 outline-none focus:ring-2 focus:ring-blue-50 bg-slate-50" />
                <button onClick={handleExport} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition transform active:scale-95">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            }
          >
             <div className="overflow-auto max-h-[600px] scrollbar-thin">
                <DataTable columns={columns} data={rows} pageSize={20} />
             </div>
          </ChartCard>
        </div>

        <div className="space-y-8">
           <ChartCard title="Rank Correlation Statistics" subtitle="Statistical similarity between selection subjects">
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

           <ChartCard title="Dispersion Overlay (A vs B)" subtitle="Scatter distribution of rank displacement">
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
