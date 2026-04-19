import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import type { ColumnDef } from '@tanstack/react-table';

import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';
import { ChartCard } from '../components/ui/ChartCard';
import { DataTable } from '../components/tables/DataTable';
import { ScenarioBadge } from '../components/ui/ScenarioBadge';
import { fmt } from '../../lib/utils';
import { AlertCircle, CheckCircle2, ChevronRight, Info } from 'lucide-react';

export function DashboardPage() {
  const { data, status, error } = useAppData();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');

  // Auto-init selected scenario
  useMemo(() => {
    if (data && !selectedScenarioId && data.detectedScenarios.length > 0) {
      setSelectedScenarioId(data.detectedScenarios[0]);
    }
  }, [data, selectedScenarioId]);

  const summary = useMemo(() => {
    if (!data) return { roads: 0, scenarios: 0, rankings: 0, shapLocal: 0 };
    return {
      roads: data.indexes.rankingsByRoadKey.size,
      scenarios: data.detectedScenarios.length,
      rankings: data.rankings.length,
      shapLocal: data.shapLocal.length,
    };
  }, [data]);

  const overviewData = useMemo(() => {
    if (!data) return [];
    
    // Build a quick set for SHAP local checks
    const scenariosWithLocalShap = new Set<string>();
    data.shapLocal.forEach(r => scenariosWithLocalShap.add(r.scenario_id));

    return data.detectedScenarios.map(id => {
      const sDef = data.scenarios.find(s => s.scenario_id === id);
      const family = sDef?.family || 'unknown';
      const label = sDef?.scenario_label || id;
      
      const ranks = data.indexes.rankingsByScenario.get(id) || [];
      const models = Array.from(new Set(ranks.map(r => r.model)));
      
      const hasShapGlobal = (data.indexes.shapGlobalByScenario.get(id) || []).length > 0;
      const hasShapLocal = scenariosWithLocalShap.has(id);
      const hasTargetCapture = (data.indexes.targetCaptureByScenario.get(id) || []).length > 0;

      return {
        id, label, family, models, hasShapGlobal, hasShapLocal, hasTargetCapture
      };
    });
  }, [data]);

  const bestModelsData = useMemo(() => {
    if (!data) return [];
    return data.detectedScenarios.map(id => {
      const sDef = data.scenarios.find(s => s.scenario_id === id);
      const label = sDef?.scenario_label || id;
      const metrics = data.indexes.metricsByScenario.get(id) || [];
      
      if (metrics.length === 0) return null;

      const best = metrics.reduce((prev, curr) => {
        const prevPR = prev.pr_auc ?? 0;
        const currPR = curr.pr_auc ?? 0;
        if (currPR > prevPR) return curr;
        if (currPR === prevPR) {
          const prevMCC = prev.top30_mcc ?? prev.mcc ?? 0;
          const currMCC = curr.top30_mcc ?? curr.mcc ?? 0;
          return currMCC > prevMCC ? curr : prev;
        }
        return prev;
      });

      return {
        id, 
        label, 
        family: sDef?.family || 'unknown',
        model: best.model, 
        pr_auc: best.pr_auc, 
        mcc: best.top30_mcc ?? best.mcc, 
        threshold: best.top30_mcc != null ? 'Top 30' : 'Global'
      };
    }).filter(Boolean) as any[];
  }, [data]);

  const topShapFeatures = useMemo(() => {
    if (!data || !selectedScenarioId) return [];
    const globals = data.indexes.shapGlobalByScenario.get(selectedScenarioId) || [];
    
    const byFeature = new Map<string, number>();
    globals.forEach(row => {
      const current = byFeature.get(row.feature) || 0;
      byFeature.set(row.feature, Math.max(current, row.mean_abs_shap));
    });

    return Array.from(byFeature.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([feature, value]) => ({
        feature: feature.replace(/^Norm01_/, ''),
        value,
      }));
  }, [data, selectedScenarioId]);

  const completenessAlerts = useMemo(() => {
    const alerts: { type: 'warn' | 'info'; message: string }[] = [];
    overviewData.forEach(row => {
      if (row.models.length === 0) {
        alerts.push({ type: 'warn', message: `Scenario '${row.label}' has no model ranking data.` });
      }
      if (!row.hasShapGlobal && !row.hasShapLocal) {
         alerts.push({ type: 'info', message: `Scenario '${row.label}': SHAP importance values not found.` });
      } else if (!row.hasShapLocal) {
         alerts.push({ type: 'info', message: `Scenario '${row.label}': Segment-level SHAP vectors not found.` });
      }
      if (!row.hasTargetCapture && row.family === 'historis') {
         alerts.push({ type: 'warn', message: `Historical Scenario '${row.label}': Target capture evaluation not found.` });
      }
    });
    return alerts;
  }, [overviewData]);

  // Columns Definitions
  const overviewColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'label',
      header: 'Scenario',
      cell: info => <span className="font-semibold text-slate-800 break-words">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'family',
      header: 'Family',
      cell: info => <ScenarioBadge family={info.getValue() as any} />
    },
    {
      accessorKey: 'models',
      header: 'Available Models',
      cell: info => {
        const m = info.getValue() as string[];
        return <span className="text-xs text-slate-600 italic break-words">{m.length > 0 ? m.join(', ') : '—'}</span>;
      }
    },
    {
      accessorKey: 'hasShapGlobal',
      header: 'Global SHAP',
      cell: info => info.getValue() ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 text-center block">—</span>
    },
    {
      accessorKey: 'hasShapLocal',
      header: 'Local SHAP',
      cell: info => info.getValue() ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 text-center block">—</span>
    },
    {
      accessorKey: 'hasTargetCapture',
      header: 'Target Capture',
      cell: info => info.getValue() ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 text-center block">—</span>
    }
  ];

  const bestModelColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'label',
      header: 'Scenario',
      cell: info => <span className="font-semibold text-slate-800 break-words">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'model',
      header: 'Model Name',
      cell: info => <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'pr_auc',
      header: 'PR-AUC',
      cell: info => {
        const val = info.getValue() as number | null | undefined;
        return <span className="font-mono text-sm tracking-tight text-blue-700 font-bold">{val != null ? fmt(val, 4) : '—'}</span>;
      }
    },
    {
      accessorKey: 'mcc',
      header: 'MCC',
      cell: info => {
        const val = info.getValue() as number | null | undefined;
        return <span className="font-mono text-sm tracking-tight text-slate-600">{val != null ? fmt(val, 4) : '—'}</span>;
      }
    }
  ];

  if (status === 'loading') return <LoadingState message="Processing scenario datasets..." />;
  if (status === 'error') return <EmptyState title="Error" message={error || "Failed to load dashboard data."} />;
  if (!data) return <EmptyState />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 overflow-x-hidden">
      
      {/* 1. Summary Metrics */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Workspace Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Roads" value={summary.roads.toLocaleString()} subtitle="Unique segment identifiers" />
          <MetricCard label="Scenarios" value={summary.scenarios} subtitle="Normative & historical variants" />
          <MetricCard label="Ranking Records" value={summary.rankings.toLocaleString()} subtitle="Model predictions" />
          <MetricCard label="SHAP Records" value={summary.shapLocal.toLocaleString()} subtitle="Segment-level explanations" />
        </div>
      </section>

      {/* 2. Data Availability Alerts */}
      {completenessAlerts.length > 0 && (
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
             <Info className="w-4 h-4 text-slate-500" />
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Data Availability Alerts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completenessAlerts.map((alert, idx) => (
              <div key={idx} className="flex flex-col gap-1 bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className={`w-3.5 h-3.5 ${alert.type === 'warn' ? 'text-amber-500' : 'text-blue-500'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-wide ${alert.type === 'warn' ? 'text-amber-700' : 'text-blue-700'}`}>
                    {alert.type === 'warn' ? 'Component Missing' : 'Notice'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{alert.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3 & 4. Comparative Overviews */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <section>
           <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
             <ChevronRight className="w-4 h-4 text-blue-500" /> Scenario Data Inventory
           </h2>
           <ChartCard title="Inventory Analysis" subtitle="Cross-reference of scenario families and data coverage.">
             <div className="overflow-x-auto overflow-y-auto max-h-[440px] scrollbar-thin">
               <DataTable columns={overviewColumns} data={overviewData} pageSize={10} />
             </div>
           </ChartCard>
        </section>

        <section>
           <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
             <ChevronRight className="w-4 h-4 text-blue-500" /> Best Model Summary
           </h2>
           <ChartCard title="Top Performing Models" subtitle="Preferred models based on PR-AUC and MCC evaluation.">
             <div className="overflow-x-auto overflow-y-auto max-h-[440px] scrollbar-thin">
               {bestModelsData.length > 0 ? (
                 <DataTable columns={bestModelColumns} data={bestModelsData} pageSize={10} />
               ) : (
                 <EmptyState message="No model performance metrics detected in the registry." />
               )}
             </div>
           </ChartCard>
        </section>
      </div>

      {/* 5. Feature Contribution Preview */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-blue-500" /> Global Feature Contribution
          </h2>
          <div className="flex items-center gap-3">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Scenario:</label>
             <select 
               value={selectedScenarioId} 
               onChange={e => setSelectedScenarioId(e.target.value)}
               className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-[220px]"
             >
               {overviewData.map(s => (
                 <option key={s.id} value={s.id}>{s.label}</option>
               ))}
             </select>
          </div>
        </div>
        
        <ChartCard title="Global Importance Analysis" subtitle="Mean absolute SHAP impact across the segment inventory.">
          {topShapFeatures.length > 0 ? (
             <ResponsiveContainer width="100%" height={380}>
               <BarChart data={topShapFeatures} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                 <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => fmt(val, 3)} />
                 <YAxis type="category" dataKey="feature" width={180} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                 <RechartsTooltip
                   contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                   formatter={(value: any) => [fmt(value as number, 5), 'Mean |SHAP|']}
                 />
                 <Bar dataKey="value" name="Mean |SHAP|" fill="#475569" radius={[0, 4, 4, 0]} barSize={16} />
               </BarChart>
             </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
               <p className="text-sm text-slate-400 italic">No global importance data available for this scenario ID.</p>
            </div>
          )}
        </ChartCard>
      </section>

    </div>
  );
}
