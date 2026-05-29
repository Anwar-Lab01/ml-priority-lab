import type { ManualASBOverride } from '../../../../lib/treatmentTypes';
import { ASB_TYPE_GUIDE } from '../../../../lib/treatmentEngine';

interface ASBOverrideFormProps {
  overrideForm: Partial<ManualASBOverride>;
  onChange: (form: Partial<ManualASBOverride>) => void;
  onSave: () => void;
  onCancel: () => void;
  onOpenGuide: () => void;
}

export function ASBOverrideForm({
  overrideForm,
  onChange,
  onSave,
  onCancel,
  onOpenGuide,
}: ASBOverrideFormProps) {
  return (
    <div className="border border-indigo-200 bg-white rounded p-2 text-xs">
      <p className="font-bold text-indigo-700 mb-2">Manual Override Configuration</p>
      <div className="space-y-2">
        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase">Reason</label>
          <select
            value={overrideForm.manual_reason_code || ''}
            onChange={(e) => onChange({ ...overrideForm, manual_reason_code: e.target.value })}
            className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white"
          >
            <option value="Preventive maintenance">Preventive maintenance</option>
            <option value="Surface preservation">Surface preservation</option>
            <option value="Policy / Strategic planning">Policy / Strategic planning</option>
            <option value="Field verification result">Field verification result</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {overrideForm.manual_reason_code === 'Other' && (
          <div>
            <input
              type="text"
              placeholder="Detail reason..."
              value={overrideForm.manual_reason_text || ''}
              onChange={(e) => onChange({ ...overrideForm, manual_reason_text: e.target.value })}
              className="w-full border border-slate-200 rounded p-1 text-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
        <div>
          <div className="flex justify-between items-end">
            <label className="block text-[9px] font-bold text-slate-500 uppercase">ASB Type</label>
            <button
              type="button"
              onClick={onOpenGuide}
              className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Panduan Tipe ASB
            </button>
          </div>
          <select
            value={overrideForm.selected_asb_type || 'A'}
            onChange={(e) => {
              // Map default structural profile when ASB type is selected manually to keep metadata valid
              let structural_profile = overrideForm.structural_profile || 'surface_only';
              const type = e.target.value;
              if (type === 'A') structural_profile = 'surface_only';
              else if (type === 'B') structural_profile = 'surface_lpa';
              else if (type === 'C') structural_profile = 'surface_lpa_lpb';
              else if (type === 'D') structural_profile = 'heavy_rehab';
              else if (type === 'E') structural_profile = 'shoulder_rehab';
              else if (type === 'F') structural_profile = 'full_reconstruct';
              else if (type === 'G') structural_profile = 'rigid_reconstruct';
              else if (type === 'NONE') structural_profile = 'no_major_asb_package';

              onChange({
                ...overrideForm,
                selected_asb_type: type,
                structural_profile,
              });
            }}
            className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white"
          >
            {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t) => (
              <option key={t} value={t}>
                {ASB_TYPE_GUIDE[t]?.label || `Tipe ${t}`}
              </option>
            ))}
            <option value="NONE">None — Tidak Ada Paket Mayor</option>
          </select>
          {overrideForm.selected_asb_type && ASB_TYPE_GUIDE[overrideForm.selected_asb_type] && (
            <div className="mt-1.5 p-2 bg-indigo-50/50 border border-indigo-100 rounded text-[10px] text-indigo-900 space-y-1">
              <p>
                <span className="font-semibold">Komposisi:</span>{' '}
                {ASB_TYPE_GUIDE[overrideForm.selected_asb_type].composition}
              </p>
              <p>
                <span className="font-semibold">Kegunaan:</span>{' '}
                {ASB_TYPE_GUIDE[overrideForm.selected_asb_type].use}
              </p>
            </div>
          )}
        </div>
        
        {overrideForm.selected_asb_type !== 'NONE' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Width Match</label>
                <select
                  value={overrideForm.width_matching || 'auto_round_up'}
                  onChange={(e) =>
                    onChange({ ...overrideForm, width_matching: e.target.value as any })
                  }
                  className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white"
                >
                  <option value="auto_round_up">Auto</option>
                  <option value="manual_variant">Manual</option>
                </select>
              </div>
              {overrideForm.width_matching === 'manual_variant' && (
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">
                    Manual Width (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={overrideForm.manual_width_m || ''}
                    onChange={(e) =>
                      onChange({ ...overrideForm, manual_width_m: parseFloat(e.target.value) })
                    }
                    className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Costing Mode</label>
                <select
                  value={overrideForm.costing_mode || 'full_segment_mode'}
                  onChange={(e) =>
                    onChange({ ...overrideForm, costing_mode: e.target.value as any })
                  }
                  className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white"
                >
                  <option value="full_segment_mode">Full</option>
                  <option value="effective_length_mode">Effective Length</option>
                </select>
              </div>
              {overrideForm.costing_mode === 'effective_length_mode' && (
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">
                    Ratio (0-1)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={overrideForm.effective_length_ratio || ''}
                    onChange={(e) =>
                      onChange({ ...overrideForm, effective_length_ratio: parseFloat(e.target.value) })
                    }
                    className="w-full mt-0.5 border border-slate-200 rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </>
        )}
        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
          <button
            onClick={onSave}
            className="flex-1 bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-indigo-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-bold py-1.5 rounded hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
