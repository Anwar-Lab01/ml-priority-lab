import { X, Calculator, Info, Save, Trash2, Check } from 'lucide-react';
import type { GeoRoad, DD2RoadFeatureWithRule, ManualASBOverride, CandidateBasketItem, CandidateStatus, PlanningNote } from '../../../../lib/treatmentTypes';
import { getDominantCondition, getDisplayRuleCategory } from '../../../../lib/treatmentEngine';
import { SegmentStripCard } from './SegmentStripCard';
import { ASBBudgetPanel } from './ASBBudgetPanel';
import { ASBOverrideForm } from './ASBOverrideForm';
import { HPSItemProfilePanel } from './HPSItemProfilePanel';
import { DollarSign, ClipboardList, PlusCircle, MinusCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

// ── Planning Note Editor Sub-component ────────────────────────────────────────

function PlanningNoteEditor({ roadKey, initialNote, onSave }: { roadKey: string, initialNote: string, onSave: (note: string) => void }) {
  const [draft, setDraft] = useState(initialNote);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setDraft(initialNote);
    setIsSaved(false);
  }, [roadKey, initialNote]);

  const hasUnsavedChanges = draft !== initialNote;

  const handleSave = () => {
    onSave(draft);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClear = () => {
    setDraft('');
    onSave('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Planning Notes
        </label>
        {hasUnsavedChanges && !isSaved && (
          <span className="text-[9px] font-bold text-amber-500">Unsaved changes</span>
        )}
        {isSaved && (
          <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>
        )}
      </div>
      <textarea
        rows={3}
        maxLength={500}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          // Keep save-on-blur if there are unsaved changes
          if (hasUnsavedChanges) {
             onSave(e.target.value);
             setIsSaved(true);
             setTimeout(() => setIsSaved(false), 2000);
          }
        }}
        placeholder="Add planning notes for this road..."
        className="w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300 transition-colors"
      />
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-400">Max 500 chars</p>
        <div className="flex items-center gap-2">
          {initialNote && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-[9px] font-bold text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors ${
              hasUnsavedChanges 
                ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="h-3 w-3" /> Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

interface RoadFocusPanelProps {
  selectedGeo: GeoRoad | null;
  selectedDd2Feature: DD2RoadFeatureWithRule | null;
  selectedSegmentSummary: any;
  diagnosticKey: string;
  matchMethod: string;
  manualOverrides: Record<string, ManualASBOverride>;
  overrideForm: Partial<ManualASBOverride>;
  isEditingOverride: boolean;
  setOverrideForm: (form: Partial<ManualASBOverride>) => void;
  setIsEditingOverride: (editing: boolean) => void;
  handleSaveOverride: () => void;
  handleClearOverride: () => void;
  setIsGuideOpen: (open: boolean) => void;
  onClose: () => void;
  hpsOverrides: Record<string, any>;
  clearHPSOverrideForRoad: (road_key: string) => void;
  setHpsOverrideForRoad: (road_key: string, override: any) => void;
  // Phase 5: Planning Scenario
  candidateBasket: Record<string, CandidateBasketItem>;
  planningNotes: Record<string, PlanningNote>;
  addToCandidateBasket: (road: DD2RoadFeatureWithRule) => void;
  removeFromCandidateBasket: (road_key: string) => void;
  setCandidateStatus: (road_key: string, status: CandidateStatus) => void;
  savePlanningNoteForRoad: (road_key: string, note: string) => void;
}

export function RoadFocusPanel({
  selectedGeo,
  selectedDd2Feature,
  selectedSegmentSummary,
  diagnosticKey,
  matchMethod,
  manualOverrides,
  overrideForm,
  isEditingOverride,
  setOverrideForm,
  setIsEditingOverride,
  handleSaveOverride,
  handleClearOverride,
  setIsGuideOpen,
  onClose,
  hpsOverrides,
  clearHPSOverrideForRoad,
  setHpsOverrideForRoad,
  // Phase 5
  candidateBasket,
  planningNotes,
  addToCandidateBasket,
  removeFromCandidateBasket,
  setCandidateStatus,
  savePlanningNoteForRoad,
}: RoadFocusPanelProps) {
  if (!selectedGeo) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Info className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No Road Selected</p>
        <p className="mt-1 text-xs text-slate-500">
          Klik ruas pada peta atau tabel untuk melihat detail.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[480px] lg:h-[560px] flex-col overflow-y-auto bg-white border-l border-slate-200 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative z-20">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white p-4 shadow-sm">
        <div className="pr-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Road Focus Panel
          </p>
          <h4 className="mt-0.5 text-sm font-bold leading-snug text-slate-800">
            {selectedGeo.road_name}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Placeholder for future minimap */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center h-24">
          <p className="text-xs font-semibold text-slate-400">Mini Map Preview — Phase 3B</p>
        </div>

        {selectedDd2Feature ? (
          <>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                Canonical Match
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                {selectedDd2Feature.canonical_road_name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-emerald-600">
                Raw: {selectedDd2Feature.dd2_road_name_raw}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-emerald-600">
                Kecamatan: {selectedDd2Feature.kecamatan_dilalui || '—'}
              </p>
              <p className="mt-1 text-[9px] text-emerald-700/80">
                Kecamatan metadata is read-only here and remains a future roadmap item for linkage and analysis.
              </p>
            </div>

            {/* DD2 treatment status */}
            <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 text-indigo-500" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">
                  Rule v0.1 Category
                </p>
              </div>
              <p className="text-xs font-bold text-indigo-900">
                {getDisplayRuleCategory(selectedDd2Feature.rule_v1.treatment_category)}
              </p>
              <p className="text-[10px] leading-relaxed text-indigo-700/80 italic">
                "{selectedDd2Feature.rule_v1.rule_reason}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Length</p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                  {selectedDd2Feature.panjang_ruas_km !== null ? `${selectedDd2Feature.panjang_ruas_km * 1000} m` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Width</p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                  {selectedDd2Feature.lebar_ruas_m !== null ? `${selectedDd2Feature.lebar_ruas_m} m` : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Surface Condition</p>
                <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                  Dom: {getDominantCondition(selectedDd2Feature)}
                </span>
              </div>
              <div className="space-y-1 border-t border-slate-100 pt-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-600">Non-Mantap</span>
                  <span className="font-mono text-[11px] font-bold text-amber-600">
                    {selectedDd2Feature.non_mantap_pct !== null ? `${selectedDd2Feature.non_mantap_pct}%` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <SegmentStripCard
              selectedSegmentSummary={selectedSegmentSummary}
              selectedDd2Feature={selectedDd2Feature}
            />

            {/* Extracted ASBBudgetPanel / ASBOverrideForm Components */}
            {!isEditingOverride ? (
              <ASBBudgetPanel
                selectedDd2Feature={selectedDd2Feature}
                manualOverrides={manualOverrides}
                onEditClick={() => {
                  const existing = manualOverrides[selectedDd2Feature.road_key];
                  if (existing) {
                    setOverrideForm(existing);
                  } else {
                    setOverrideForm({
                      override_active: true,
                      selected_asb_type: 'A',
                      structural_profile: 'surface_only',
                      width_matching: 'auto_round_up',
                      surface_preference: 'auto',
                      costing_mode: 'full_segment_mode',
                      manual_reason_code: 'Preventive maintenance'
                    });
                  }
                  setIsEditingOverride(true);
                }}
                onClearClick={handleClearOverride}
              />
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Pagu Indikatif ASB
                    </p>
                  </div>
                  {selectedDd2Feature.final_asb_budget?.status === 'estimated' || selectedDd2Feature.final_asb_budget?.status === 'manual_estimated' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-100 text-indigo-700">
                      {selectedDd2Feature.final_asb_budget.final_costing_mode === 'full_segment_mode' ? 'Full Ruas' : 'Effective Length'}
                    </span>
                  ) : null}
                </div>
                <ASBOverrideForm
                  overrideForm={overrideForm}
                  onChange={setOverrideForm}
                  onSave={handleSaveOverride}
                  onCancel={() => setIsEditingOverride(false)}
                  onOpenGuide={() => setIsGuideOpen(true)}
                />
              </div>
            )}
            
            <HPSItemProfilePanel 
              road={selectedDd2Feature} 
              override={hpsOverrides[selectedDd2Feature.road_key]}
              onClearOverride={() => clearHPSOverrideForRoad(selectedDd2Feature.road_key)}
              onSaveOverride={(override) => setHpsOverrideForRoad(selectedDd2Feature.road_key, override)}
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              HPS/AHSP is a comparison/detail layer only. ASB pagu indikatif remains the canonical budget source.
            </p>

            {/* ── Phase 5: Planning Scenario Section ─────────────────────── */}
            {(() => {
              const rk = selectedDd2Feature.road_key;
              const inBasket = !!candidateBasket[rk];
              const item = candidateBasket[rk];
              const existingNote = planningNotes[rk]?.note ?? '';

              const STATUS_META: Record<CandidateStatus, { label: string; color: string; bg: string; border: string }> = {
                included:      { label: 'Included',      color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
                force_include: { label: 'Force Include', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                force_exclude: { label: 'Force Exclude', color: 'text-red-700',     bg: 'bg-red-50',    border: 'border-red-200' },
                deferred:      { label: 'Deferred',      color: 'text-slate-600',   bg: 'bg-slate-50',  border: 'border-slate-200' },
              };

              return (
                <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5 mt-2 space-y-2.5">
                  {/* Header */}
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-violet-500" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-violet-600">Planning Scenario</p>
                    {inBasket && item && (
                      <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${STATUS_META[item.status].border} ${STATUS_META[item.status].bg} ${STATUS_META[item.status].color}`}>
                        {STATUS_META[item.status].label}
                      </span>
                    )}
                  </div>

                  {/* Add / Remove */}
                  {!inBasket ? (
                    <button
                      id={`scenario-add-${rk}`}
                      onClick={() => addToCandidateBasket(selectedDd2Feature)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-200 bg-violet-100 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-200 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add to Scenario
                    </button>
                  ) : (
                    <button
                      id={`scenario-remove-${rk}`}
                      onClick={() => removeFromCandidateBasket(rk)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                      Remove from Scenario
                    </button>
                  )}

                  {/* Force Include / Force Exclude (only when in basket) */}
                  {inBasket && item && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        id={`scenario-force-include-${rk}`}
                        onClick={() => setCandidateStatus(rk, item.status === 'force_include' ? 'included' : 'force_include')}
                        className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[10px] font-semibold transition-colors ${
                          item.status === 'force_include'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Force Include
                      </button>
                      <button
                        id={`scenario-force-exclude-${rk}`}
                        onClick={() => setCandidateStatus(rk, item.status === 'force_exclude' ? 'included' : 'force_exclude')}
                        className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[10px] font-semibold transition-colors ${
                          item.status === 'force_exclude'
                            ? 'border-red-300 bg-red-100 text-red-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        <XCircle className="h-3 w-3" />
                        Force Exclude
                      </button>
                    </div>
                  )}

                  {/* Planning Notes Editor */}
                  <PlanningNoteEditor 
                    roadKey={rk}
                    initialNote={existingNote}
                    onSave={(note) => savePlanningNoteForRoad(rk, note)}
                  />
                </div>
              );
            })()}

            <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 mt-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Diagnostics</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Canonical Key:</span>
                  <span className="font-mono text-blue-600 truncate ml-2">{diagnosticKey}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Lookup Result:</span>
                  <span className={`font-mono font-bold ${selectedDd2Feature ? 'text-emerald-600' : 'text-amber-600'}`}>
                    FOUND
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Match Method:</span>
                  <span className="font-mono text-slate-700">{matchMethod}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-4 text-center">
            <p className="text-[11px] font-medium text-amber-700">No DD2 feature data matched</p>
            <p className="mt-1 text-[10px] text-amber-600">Check map identity rules</p>
            
            <div className="mt-4 rounded-lg border border-slate-100 bg-white px-3 py-2 text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Diagnostics</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Canonical Key:</span>
                  <span className="font-mono text-blue-600 truncate ml-2">{diagnosticKey}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Lookup Result:</span>
                  <span className="font-mono font-bold text-amber-600">
                    NOT FOUND
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
