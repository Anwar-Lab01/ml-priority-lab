import { Database } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DD2DataWithRules } from '../../../../lib/treatmentTypes';

interface TreatmentStatsCardsProps {
  dd2Data: DD2DataWithRules | null;
  onExportOverrides: () => void;
}

function StatCell({
  label,
  value,
  action,
}: {
  label: string;
  value: number;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-t border-slate-100 px-3 py-1.5 text-center md:border-l md:first:border-l-0">
      <div className="flex items-center justify-center gap-1.5">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {action}
      </div>
      <p className="mt-0.5 text-base font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export function TreatmentStatsCards({ dd2Data, onExportOverrides }: TreatmentStatsCardsProps) {
  const rehabRekon =
    dd2Data?.ruleStats ? (dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0) : 0;

  return (
    <div className="space-y-2.5">
      <section className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm shadow-slate-100/60">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Rule v0.1 Indicative Classification</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Indicative DD1 / FormDD1 aggregation; ML Priority Score remains read-only context.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
            Read-Only Preview
          </span>
        </div>
        {dd2Data?.ruleStats && (
          <div className="grid grid-cols-2 md:grid-cols-6">
            <StatCell label="Evaluated" value={dd2Data.ruleStats.totalEvaluated} />
            <StatCell label="Rutin" value={dd2Data.ruleStats.rutin} />
            <StatCell label="Berkala" value={dd2Data.ruleStats.berkala} />
            <StatCell label="Rehab / Rekon" value={rehabRekon} />
            <StatCell label="Peningkatan" value={dd2Data.ruleStats.peningkatan} />
            <StatCell label="Tidak Cukup" value={dd2Data.ruleStats.insufficientData} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm shadow-slate-100/60">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Estimasi Kewajaran Anggaran (ASB)</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ASB remains canonical for indicative pagu; HPS/AHSP stays a comparison/detail layer.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
            Read-Only Preview
          </span>
        </div>
        {dd2Data?.asbStats && (
          <div className="grid grid-cols-2 md:grid-cols-6">
            <StatCell label="Roads Estimated" value={dd2Data.asbStats.estimatedRoads} />
            <StatCell label="No Major Pkg" value={dd2Data.asbStats.noMajorPackage} />
            <StatCell label="Manual Review" value={dd2Data.asbStats.manualReviewRequired} />
            <StatCell
              label="Overrides"
              value={dd2Data.asbStats.manualOverridesActive}
              action={
                <button
                  onClick={onExportOverrides}
                  title="Export Overrides JSON"
                  className="rounded text-slate-500 transition-colors hover:text-slate-800"
                >
                  <Database className="h-3 w-3" />
                </button>
              }
            />
            <StatCell label="ASB Items" value={dd2Data.asbStats.totalItemsLoaded} />
            <StatCell label="Rules" value={dd2Data.asbStats.totalRulesLoaded} />
          </div>
        )}
      </section>
    </div>
  );
}
