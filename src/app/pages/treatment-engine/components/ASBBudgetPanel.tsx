import { DollarSign, AlertTriangle } from 'lucide-react';
import type { DD2RoadFeatureWithRule, ManualASBOverride } from '../../../../lib/treatmentTypes';

interface ASBBudgetPanelProps {
  selectedDd2Feature: DD2RoadFeatureWithRule;
  manualOverrides: Record<string, ManualASBOverride>;
  onEditClick: () => void;
  onClearClick: () => void;
}

export function ASBBudgetPanel({
  selectedDd2Feature,
  manualOverrides,
  onEditClick,
  onClearClick,
}: ASBBudgetPanelProps) {
  const finalBudget = selectedDd2Feature.final_asb_budget;
  const autoBudget = selectedDd2Feature.asb_budget;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Pagu Indikatif ASB
          </p>
        </div>
        {finalBudget?.status === 'estimated' || finalBudget?.status === 'manual_estimated' ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-100 text-indigo-700">
            {finalBudget.final_costing_mode === 'full_segment_mode' ? 'Full Ruas' : 'Effective Length'}
          </span>
        ) : null}
      </div>
      <p className="text-[9px] text-slate-500 leading-tight">
        ASB pagu indikatif remains the canonical budget source. HPS/AHSP is comparison/detail only.
      </p>

      {/* Auto Recommendation Box */}
      <div className="rounded border border-slate-200 bg-slate-100/50 p-2 text-xs">
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Auto Recommendation</p>
        {autoBudget?.status === 'estimated' ? (
          <div className="flex justify-between text-slate-600">
            <span>Tipe {autoBudget.asb_type}</span>
            <span className="font-mono">Rp {(autoBudget.pagu_indikatif_rp || 0).toLocaleString('id-ID')}</span>
          </div>
        ) : autoBudget?.status === 'no_major_asb_package' ? (
          <p className="text-slate-500 italic text-[10px]">NONE auto-selected</p>
        ) : (
          <p className="text-slate-500 italic text-[10px]">{autoBudget?.reason || 'No package'}</p>
        )}
      </div>

      {/* Final Selected Package Box */}
      {finalBudget?.status === 'estimated' || finalBudget?.status === 'manual_estimated' ? (
        <div className="space-y-2 text-xs mt-1 border-t border-slate-200 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Final Selected Package</p>
            {finalBudget.manual_override_used && (
              <span className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700">
                🛠️ Manual Override
              </span>
            )}
          </div>
          <div className="bg-white rounded border border-slate-200 p-2 shadow-sm text-center">
            <p className="text-lg font-black text-indigo-700">
              Rp {(finalBudget.final_pagu_indikatif_rp || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">Paket Anggaran:</span>
              <span className="font-semibold text-slate-800">
                Tipe {finalBudget.final_asb_type} ({finalBudget.structural_profile})
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">Dasar Pemilihan:</span>
              <span className="font-medium text-slate-700 truncate max-w-[150px]" title={finalBudget.reason}>
                {finalBudget.manual_override_used ? finalBudget.reason : finalBudget.rule_id}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">Volume (m):</span>
              <span className="font-mono text-slate-700">{finalBudget.panjang_m?.toLocaleString()} m</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">Harga ASB / m:</span>
              <span className="font-mono text-slate-700">
                Rp {finalBudget.harga_satuan_rp?.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">Match Params:</span>
              <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 rounded">
                {finalBudget.width_matched_m}m | {finalBudget.surface_matched}
              </span>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 mt-1 leading-tight font-mono">
            {finalBudget.asb_uraian} — {finalBudget.asb_spesifikasi}
          </p>

          {finalBudget.flags && finalBudget.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {finalBudget.flags.map(flag => (
                <span
                  key={flag}
                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {flag}
                </span>
              ))}
            </div>
          )}
          <p className="text-[8px] text-slate-400 italic leading-tight mt-1 pt-1 border-t border-slate-200">
            {finalBudget.disclaimer}
          </p>
        </div>
      ) : finalBudget?.status === 'no_major_asb_package' ? (
        <div className="text-center py-2 text-slate-500 text-[11px] italic mt-2 border-t border-slate-200">
          Tidak ada paket mayor otomatis
        </div>
      ) : null}

      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200">
        <button
          onClick={onEditClick}
          className="flex-1 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 rounded hover:bg-indigo-50 transition-colors"
        >
          Edit / Override Package
        </button>
        {manualOverrides[selectedDd2Feature.road_key] && (
          <button
            onClick={onClearClick}
            className="bg-white border border-red-200 text-red-600 px-2 py-1.5 rounded text-[10px] font-bold hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
