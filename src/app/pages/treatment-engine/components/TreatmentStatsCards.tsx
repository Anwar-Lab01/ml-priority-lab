import { Calculator, Info, DollarSign, Database } from 'lucide-react';
import type { DD2DataWithRules } from '../../../../lib/treatmentTypes';

interface TreatmentStatsCardsProps {
  dd2Data: DD2DataWithRules | null;
  onExportOverrides: () => void;
}

export function TreatmentStatsCards({ dd2Data, onExportOverrides }: TreatmentStatsCardsProps) {
  return (
    <>
      {/* ── Rule v0.1 Indicative Classification ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Rule v0.1 Indicative Classification</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
            Read-Only Preview
          </span>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            Rule v0.1 bersifat indikatif berbasis agregasi kondisi jalan DD1 / FormDD1 per ruas. ML Priority Score masih berada di modul/page lain dan belum terintegrasi ke Treatment Engine.
          </p>
        </div>
        {dd2Data?.ruleStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-slate-100">
            <div className="p-4 text-center bg-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evaluated</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{dd2Data.ruleStats.totalEvaluated}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Rutin</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{dd2Data.ruleStats.rutin}</p>
              <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(dd2Data.ruleStats.rutin / dd2Data.ruleStats.totalEvaluated) * 100}%` }}
                />
              </div>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Berkala</p>
              <p className="mt-1 text-2xl font-black text-blue-700">{dd2Data.ruleStats.berkala}</p>
              <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(dd2Data.ruleStats.berkala / dd2Data.ruleStats.totalEvaluated) * 100}%` }}
                />
              </div>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Rehabilitasi / Rekonstruksi
              </p>
              <p className="mt-1 text-2xl font-black text-orange-700">
                {(dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0)}
              </p>
              <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{
                    width: `${
                      (((dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0)) /
                        dd2Data.ruleStats.totalEvaluated) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                Peningkatan Permukaan
              </p>
              <p className="mt-1 text-2xl font-black text-purple-700">{dd2Data.ruleStats.peningkatan}</p>
              <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${(dd2Data.ruleStats.peningkatan / dd2Data.ruleStats.totalEvaluated) * 100}%` }}
                />
              </div>
            </div>
            <div className="p-4 text-center bg-rose-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Tidak Cukup</p>
              <p className="mt-1 text-2xl font-black text-rose-600">{dd2Data.ruleStats.insufficientData}</p>
              <div className="mt-2 h-1 w-16 mx-auto rounded-full bg-rose-100/50 overflow-hidden">
                <div
                  className="h-full bg-rose-500"
                  style={{
                    width: `${(dd2Data.ruleStats.insufficientData / dd2Data.ruleStats.totalEvaluated) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ASB Budget Estimator Overview ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <DollarSign className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Estimasi Kewajaran Anggaran (ASB)</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
            Read-Only Preview
          </span>
        </div>
        <div className="px-5 pt-2 text-[10px] text-slate-500">
          ASB pagu indikatif remains the canonical budget source for this engine. HPS/AHSP is only a comparison/detail layer.
        </div>
        {dd2Data?.asbStats && (
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-slate-100">
            <div className="p-4 text-center bg-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Roads Estimated</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{dd2Data.asbStats.estimatedRoads}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mantap (No Major Pkg)</p>
              <p className="mt-1 text-2xl font-black text-slate-600">{dd2Data.asbStats.noMajorPackage}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Flags / Manual Review</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{dd2Data.asbStats.manualReviewRequired}</p>
            </div>
            <div className="p-4 text-center bg-indigo-50/50">
              <div className="flex justify-between px-2 items-center mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Manual Overrides</p>
                <button
                  onClick={onExportOverrides}
                  title="Export Overrides JSON"
                  className="text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Database className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-2xl font-black text-indigo-700">{dd2Data.asbStats.manualOverridesActive}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">ASB Items Loaded</p>
              <p className="mt-1 text-xl font-bold text-indigo-600">{dd2Data.asbStats.totalItemsLoaded}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Rules Loaded</p>
              <p className="mt-1 text-xl font-bold text-indigo-600">{dd2Data.asbStats.totalRulesLoaded}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
