import { Info, CheckCircle, AlertTriangle } from 'lucide-react';
import type { DD2DamageSegment, DD2RoadFeatureWithRule } from '../../../../lib/treatmentTypes';

interface SegmentSummaryData {
  segments: DD2DamageSegment[];
  count: number;
  totalLenM: number;
  lenBaik: number;
  lenSedang: number;
  lenRingan: number;
  lenBerat: number;
  lenUnknown: number;
  nonMantapM: number;
  nonMantapPct: number;
  dominantCondition: string;
  topTreatment: string;
  topSurface: string;
}

interface SegmentStripCardProps {
  selectedSegmentSummary: SegmentSummaryData | null;
  selectedDd2Feature: DD2RoadFeatureWithRule;
}

export function SegmentStripCard({
  selectedSegmentSummary,
  selectedDd2Feature,
}: SegmentStripCardProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
      <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-100">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Segment Profile</p>
        {selectedSegmentSummary ? (
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
            {selectedSegmentSummary.count} Segments
          </span>
        ) : null}
      </div>

      <div className="p-3 space-y-3">
        {!selectedSegmentSummary ? (
          <div className="py-2 flex items-center gap-2 text-slate-400">
            <Info className="h-3.5 w-3.5" />
            <span className="text-[10px] italic font-medium">
              No segment-level DD2 data available for this road.
            </span>
          </div>
        ) : (
          <>
            {/* Proportional Strip */}
            <div className="flex h-4 w-full rounded-md overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
              {selectedSegmentSummary.segments.map((seg, idx) => {
                const wPct =
                  ((seg.panjang_m || seg.sta_end_m - seg.sta_start_m) /
                    selectedSegmentSummary.totalLenM) *
                  100;
                const cond = (seg.dominant_condition || '').toLowerCase();

                const baseColor = cond.includes('baik')
                  ? '#10b981'
                  : cond.includes('sedang')
                  ? '#3b82f6'
                  : cond.includes('ringan')
                  ? '#f59e0b'
                  : cond.includes('berat')
                  ? '#ef4444'
                  : '#94a3b8';

                return (
                  <div
                    key={idx}
                    style={{ width: `${wPct}%`, backgroundColor: baseColor }}
                    className="h-full border-r border-white/20 last:border-r-0 transition-opacity hover:opacity-80 cursor-help"
                    title={`STA ${seg.sta_start_m}-${seg.sta_end_m} | ${
                      seg.dominant_condition
                    } | ${seg.panjang_m}m | ${seg.jenis_penanganan_norm || ''}`}
                  />
                );
              })}
            </div>

            {/* Mini Legend Row */}
            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase px-0.5">
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" /> B
              </div>
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" /> S
              </div>
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> RR
              </div>
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /> RB
              </div>
            </div>

            {/* Comparison Statistics */}
            <div className="space-y-2 text-[10px] pt-1 border-t border-slate-100 mt-1">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Segmented Length:</span>
                <span className="text-slate-800 font-mono">
                  {(selectedSegmentSummary.totalLenM / 1000).toFixed(3)} km
                </span>
              </div>

              <div className="pt-1.5 border-t border-dashed border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Derived Non-Mantap:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {selectedSegmentSummary.nonMantapPct.toFixed(1)}%
                  </span>
                </div>

                {/* Comparison logic */}
                {selectedDd2Feature.non_mantap_pct !== null && (
                  <div className="mt-1 flex items-center justify-between rounded bg-slate-50 px-2 py-1 border border-slate-100/50">
                    <span className="text-[9px] text-slate-400">
                      vs Agg ({selectedDd2Feature.non_mantap_pct}%)
                    </span>
                    {(() => {
                      const diff = Math.abs(
                        selectedSegmentSummary.nonMantapPct - selectedDd2Feature.non_mantap_pct
                      );
                      const isAligned = diff <= 5;
                      return (
                        <span
                          className={`flex items-center gap-0.5 text-[9px] font-bold uppercase ${
                            isAligned ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {isAligned ? (
                            <CheckCircle className="h-2.5 w-2.5" />
                          ) : (
                            <AlertTriangle className="h-2.5 w-2.5" />
                          )}
                          {isAligned ? 'Aligned' : `Check ${diff.toFixed(1)}%`}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                <div>
                  <p className="text-slate-400">Top Surface</p>
                  <p
                    className="font-bold truncate text-slate-700 leading-tight"
                    title={selectedSegmentSummary.topSurface}
                  >
                    {selectedSegmentSummary.topSurface}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Primary Treatment</p>
                  <p
                    className="font-bold truncate text-slate-700 leading-tight"
                    title={selectedSegmentSummary.topTreatment}
                  >
                    {selectedSegmentSummary.topTreatment}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
