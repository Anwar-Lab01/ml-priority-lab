import { FilterX } from 'lucide-react';

interface TreatmentFiltersPanelProps {
  filterAsbType: string;
  setFilterAsbType: (val: string) => void;
  filterRuleId: string;
  setFilterRuleId: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterNonMantap: string;
  setFilterNonMantap: (val: string) => void;
  onClearAll: () => void;
  isFiltered: boolean;
  totalFiltered: number;
  totalRoads: number;
}

export function TreatmentFiltersPanel({
  filterAsbType,
  setFilterAsbType,
  filterRuleId,
  setFilterRuleId,
  filterStatus,
  setFilterStatus,
  filterNonMantap,
  setFilterNonMantap,
  onClearAll,
  isFiltered,
  totalFiltered,
  totalRoads
}: TreatmentFiltersPanelProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          Category Filters
          {isFiltered && (
             <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
               {totalFiltered} of {totalRoads} roads
             </span>
          )}
        </h3>
        {isFiltered && (
          <button 
             onClick={onClearAll}
             className="text-[10px] flex items-center gap-1 font-semibold text-slate-500 hover:text-red-600 transition-colors"
          >
            <FilterX className="h-3 w-3" /> Clear Filters
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          ASB Type
          <select 
             value={filterAsbType} 
             onChange={(e) => setFilterAsbType(e.target.value)}
             className="border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 text-slate-800"
          >
            <option value="All">All Types</option>
            <option value="A">Type A</option>
            <option value="B">Type B</option>
            <option value="C">Type C</option>
            <option value="D">Type D</option>
            <option value="No Major Package">NONE</option>
            <option value="Manual Override">Manual Override</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          Rule ID
          <select 
             value={filterRuleId} 
             onChange={(e) => setFilterRuleId(e.target.value)}
             className="border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 text-slate-800"
          >
            <option value="All">All Rules</option>
            <option value="R01">R01</option>
            <option value="R02">R02</option>
            <option value="R03">R03</option>
            <option value="R04">R04</option>
            <option value="R05">R05</option>
            <option value="R06">R06</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          Status
          <select 
             value={filterStatus} 
             onChange={(e) => setFilterStatus(e.target.value)}
             className="border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 text-slate-800"
          >
            <option value="All">All Statuses</option>
            <option value="Manual Override">Manual Override</option>
            <option value="Review Flag">Review Flag</option>
            <option value="No Major Package">NONE</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          Non-Mantap Threshold
          <select 
             value={filterNonMantap} 
             onChange={(e) => setFilterNonMantap(e.target.value)}
             className="border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 text-slate-800"
          >
            <option value="All">Any</option>
            <option value=">=10%">&gt;= 10%</option>
            <option value=">=25%">&gt;= 25%</option>
            <option value=">=40%">&gt;= 40%</option>
          </select>
        </label>
      </div>
    </div>
  );
}
