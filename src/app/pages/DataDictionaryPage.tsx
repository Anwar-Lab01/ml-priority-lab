import { useAppData } from '../../hooks/useAppData';
import { ChartCard } from '../components/ui/ChartCard';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { CheckCircle2, AlertCircle, Info, Database, FileCode, Search } from 'lucide-react';

const DATA_FIELDS: Record<string, { file: string; field: string; type: string; description: string }[]> = {
  'scenarios.json': [
    { file: 'scenarios.json', field: 'scenario_id', type: 'string', description: 'Unique scenario identifier (e.g. normatif_20, historis_original)' },
    { file: 'scenarios.json', field: 'scenario_label', type: 'string', description: 'Human-readable scenario name' },
    { file: 'scenarios.json', field: 'family', type: 'normatif | historis', description: 'Scenario family: normative (cross-sectional AHP) or historical (temporal)' },
    { file: 'scenarios.json', field: 'source', type: 'string', description: 'Original Excel workbook filename' },
    { file: 'scenarios.json', field: 'completeness', type: 'string', description: 'Data availability level: full or ranking+capture only' },
  ],
  'model_metrics.json': [
    { file: 'model_metrics.json', field: 'scenario_id', type: 'string', description: 'Which scenario this metric belongs to' },
    { file: 'model_metrics.json', field: 'model', type: 'string', description: 'ML model: XGBoost, RandomForest, or DecisionTree' },
    { file: 'model_metrics.json', field: 'roc_auc', type: 'number?', description: 'ROC AUC score (normatif scenarios only)' },
    { file: 'model_metrics.json', field: 'pr_auc', type: 'number', description: 'Precision-Recall AUC' },
    { file: 'model_metrics.json', field: 'mcc / top30_mcc', type: 'number', description: 'Matthews Correlation Coefficient' },
  ],
  'rankings.json': [
    { file: 'rankings.json', field: 'road_id', type: 'number', description: 'Numeric road segment identifier' },
    { file: 'rankings.json', field: 'road_name', type: 'string', description: 'Road segment name' },
    { file: 'rankings.json', field: 'nama_ruas_norm', type: 'string?', description: 'Future-proof normalized stable cross-scenario key' },
    { file: 'rankings.json', field: 'scenario_id', type: 'string', description: 'Scenario this ranking belongs to' },
    { file: 'rankings.json', field: 'model', type: 'string', description: 'Model that produced this ranking' },
    { file: 'rankings.json', field: 'score', type: 'number', description: 'Model prediction score or probability' },
    { file: 'rankings.json', field: 'rank', type: 'number', description: 'Priority rank position (1 = highest)' },
  ],
  'shap_global.json': [
    { file: 'shap_global.json', field: 'feature', type: 'string', description: 'Feature name' },
    { file: 'shap_global.json', field: 'mean_abs_shap', type: 'number', description: 'Mean absolute SHAP value across all samples' },
  ],
  'shap_local.json': [
    { file: 'shap_local.json', field: 'road_name / nama_ruas_norm', type: 'string', description: 'Segment key for composite local index lookup' },
    { file: 'shap_local.json', field: 'feature', type: 'string', description: 'Feature name' },
    { file: 'shap_local.json', field: 'shap_value', type: 'number', description: 'SHAP contribution for this road × feature' },
  ],
  'target_capture.json': [
    { file: 'target_capture.json', field: 'K', type: 'number', description: 'Top-K threshold for capture analysis' },
    { file: 'target_capture.json', field: 'overlap_top_k', type: 'number', description: 'Number of planned roads found in top K' },
    { file: 'target_capture.json', field: 'recall_at_k', type: 'number', description: 'Recall at K' },
    { file: 'target_capture.json', field: 'precision_at_k', type: 'number', description: 'Precision at K' },
  ],
};

export function DataDictionaryPage() {
  const { data, status, error } = useAppData();

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <EmptyState title="Fatal Load Error" message={error || 'Failed to initialize data layer.'} />;
  if (!data) return <EmptyState />;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500 overflow-x-hidden">
      
      {/* 1. System Inventory */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        <ChartCard title="Local Registry Status" subtitle="Verification of file integrity in public/data/">
          <div className="space-y-3">
            {Object.entries(data.status).map(([key, st]) => (
              <div key={key} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {st.loaded ? (
                    <div className="bg-emerald-50 p-1 rounded-full"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="bg-slate-100 p-1 rounded-full"><AlertCircle className="h-3.5 w-3.5 text-slate-400" /></div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase text-slate-700 leading-tight">
                      {st.file.replace('.json', '')}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">Source: public/data/{st.file}</span>
                  </div>
                </div>
                <div className="text-[10px] font-black font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded tracking-tighter">
                  {st.loaded ? `${st.rowCount} ENTRIES` : 'ABSENT'}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Domain Discovery" subtitle="Unique categorical values detected across indexes">
          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-2">
                <Database className="h-3 w-3" /> Scenarios Detected ({data.detectedScenarios.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.detectedScenarios.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded tracking-tight border border-slate-200">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-2">
                <FileCode className="h-3 w-3" /> Predictive Models ({data.detectedModels.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.detectedModels.map(m => (
                  <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-black uppercase rounded tracking-tight border border-blue-100">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Indexing Engine" subtitle="Runtime environment and cache statistics">
           <div className="space-y-4">
              <div className="bg-slate-50 border-l-4 border-slate-900 p-4 rounded-r-xl">
                 <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-slate-900" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Environment Diagnostic</span>
                 </div>
                 <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                    The lab is operating in <b>{import.meta.env.MODE}</b> mode. Aggregated indexes are cached in-memory using <code>Map&lt;K, V&gt;</code> structures for efficient cross-scenario lookups.
                 </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="text-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="text-[9px] font-black text-slate-400 uppercase">Cross-Map Records</div>
                    <div className="text-xl font-black text-slate-900">{data.rankings.length}</div>
                 </div>
                 <div className="text-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="text-[9px] font-black text-slate-400 uppercase">Feature Vectors</div>
                    <div className="text-xl font-black text-slate-900">{data.roadFeatures.length}</div>
                 </div>
              </div>
           </div>
        </ChartCard>

      </section>

      {/* 2. Schema Map */}
      <section className="pt-10 border-t border-slate-100">
        <div className="flex items-center gap-4 mb-8">
           <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg shadow-slate-200">
              <Search className="w-5 h-5" />
           </div>
           <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Registry Schema Documentation</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Standardized field definitions for analytical integrity.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {Object.entries(DATA_FIELDS).map(([fileName, fields]) => (
            <div key={fileName} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">{fileName}</h3>
                <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-tighter">READ ONLY</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-white text-[10px] font-black uppercase tracking-tighter text-slate-400 border-b border-slate-50">
                      <th className="px-6 py-4 text-left font-black">Field Registry</th>
                      <th className="px-4 py-4 text-left font-black">Type</th>
                      <th className="px-6 py-4 text-left font-black">Analytical Role / Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {fields.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 group transition-colors">
                        <td className="px-6 py-4 font-mono font-black text-blue-700 break-all">{f.field}</td>
                        <td className="px-4 py-4 text-slate-400 font-bold italic lowercase">{f.type}</td>
                        <td className="px-6 py-4 text-slate-600 leading-relaxed max-w-sm">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
