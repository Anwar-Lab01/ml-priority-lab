import { AlertTriangle, X, Search } from 'lucide-react';
import type { DD2RoadFeatureWithRule, DD2DataWithRules } from '../../../../lib/treatmentTypes';

interface TreatmentRoadTableProps {
  dd2Data: DD2DataWithRules | null;
  filteredTableData: DD2RoadFeatureWithRule[];
  paginatedTableData: DD2RoadFeatureWithRule[];
  selectedDd2Feature: DD2RoadFeatureWithRule | null;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  roadKeyToGeoKeyMap: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  isSelectedRoadFilteredOut: boolean;
}

export function TreatmentRoadTable({
  dd2Data,
  filteredTableData,
  paginatedTableData,
  selectedDd2Feature,
  selectedKey,
  setSelectedKey,
  roadKeyToGeoKeyMap,
  searchTerm,
  setSearchTerm,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  isSelectedRoadFilteredOut,
}: TreatmentRoadTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-wrap gap-y-3">
        <h3 className="text-sm font-semibold text-slate-800">DD2 Features (Read-Only)</h3>

        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          {isSelectedRoadFilteredOut && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              Target hidden by search filter
            </div>
          )}

          {selectedKey && (
            <button
              onClick={() => setSelectedKey(null)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors shadow-sm"
            >
              <X className="h-3 w-3" />
              Clear Selection
            </button>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search roads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-56 md:w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Canonical Name</th>
              <th className="px-5 py-3 font-medium">Raw DD2 Name</th>
              <th className="px-5 py-3 font-medium text-right">Length (km)</th>
              <th className="px-5 py-3 font-medium text-right">Non-Mantap %</th>
              <th className="px-5 py-3 font-medium">ASB Package</th>
              <th className="px-5 py-3 font-medium text-right">Pagu Indikatif</th>
              <th className="px-5 py-3 font-medium">Match Method</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedTableData.length > 0 ? (
              paginatedTableData.map((road) => (
                <tr
                  key={`${road.road_key}-${road.dd2_row_index}`}
                  className={`cursor-pointer transition-all duration-150 border-l-4 group ${
                    selectedDd2Feature?.road_key === road.road_key
                      ? 'bg-indigo-50/70 border-indigo-500 shadow-sm z-10'
                      : 'border-transparent hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    const targetGeoKey = roadKeyToGeoKeyMap.get(road.road_key);
                    if (targetGeoKey) {
                      setSelectedKey(targetGeoKey);
                    }
                  }}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{road.canonical_road_name}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">{road.dd2_road_name_raw}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-600">{road.panjang_ruas_km ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-mono text-[10px] font-medium ${
                        road.non_mantap_pct === null
                          ? 'bg-slate-100 text-slate-500'
                          : road.non_mantap_pct > 40
                          ? 'bg-rose-100 text-rose-700'
                          : road.non_mantap_pct > 20
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {road.non_mantap_pct !== null ? `${road.non_mantap_pct}%` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-0.5">
                      {road.final_asb_budget?.status === 'estimated' ||
                      road.final_asb_budget?.status === 'manual_estimated' ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-indigo-700 text-[11px]">
                              Tipe {road.final_asb_budget.final_asb_type}
                            </span>
                            {road.final_asb_budget.manual_override_used ? (
                              <span
                                className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700"
                                title={`Manual Override: ${road.final_asb_budget.reason}`}
                              >
                                🛠️ Manual
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center rounded bg-emerald-100 px-1 py-0.5 text-[8px] font-bold text-emerald-700"
                                title="Auto Recommendation"
                              >
                                Auto
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500">{road.final_asb_budget.rule_id}</span>
                        </>
                      ) : road.final_asb_budget?.status === 'no_major_asb_package' ? (
                        road.final_asb_budget.manual_override_used ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-600 text-[11px]">No Major Package</span>
                            <span
                              className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700"
                              title={`Manual Override: ${road.final_asb_budget.reason}`}
                            >
                              🛠️ Manual
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Tidak ada paket mayor otomatis</span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No package</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {road.final_asb_budget?.status === 'estimated' ||
                      road.final_asb_budget?.status === 'manual_estimated'
                        ? `Rp ${(road.final_asb_budget.final_pagu_indikatif_rp || 0).toLocaleString('id-ID')}`
                        : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                      {road.identity_match_method}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                  {dd2Data ? 'No matching roads found.' : 'Loading DD2 data...'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={350}>350</option>
            </select>
            <span>records</span>
          </div>

          <div>
            Showing {filteredTableData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredTableData.length)} of {filteredTableData.length} records
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium"
            >
              Prev
            </button>
            <span className="px-3 py-1.5 font-medium text-slate-700">
              Page {currentPage} of {Math.ceil(filteredTableData.length / pageSize) || 1}
            </span>
            <button
              disabled={currentPage >= Math.ceil(filteredTableData.length / pageSize)}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
