import { cn } from '../../../lib/utils';
import type { Scenario } from '../../../types/contracts';
import { MODEL_CONFIG, TOP_K_OPTIONS } from '../../../config/scenarios';

export interface FilterState {
  scenarioId: string;
  model: string;
  topK: number;
  search: string;
}

interface FilterBarProps {
  scenarios: Scenario[];
  filters: FilterState;
  onChange: (update: Partial<FilterState>) => void;
  className?: string;
  showTopK?: boolean;
  showSearch?: boolean;
  showModel?: boolean;
}

export function FilterBar({
  scenarios,
  filters,
  onChange,
  className,
  showTopK = true,
  showSearch = true,
  showModel = true,
}: FilterBarProps) {
  // Derive available models from the selected scenario family
  const availableModels = Object.keys(MODEL_CONFIG);

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm',
      className,
    )}>
      {/* Scenario selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-scenario" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Scenario
        </label>
        <select
          id="filter-scenario"
          value={filters.scenarioId}
          onChange={(e) => onChange({ scenarioId: e.target.value })}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        >
          <option value="">All Scenarios</option>
          {scenarios.map((s) => (
            <option key={s.scenario_id} value={s.scenario_id}>
              {s.scenario_label}
            </option>
          ))}
        </select>
      </div>

      {/* Model selector */}
      {showModel && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-model" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Model
          </label>
          <select
            id="filter-model"
            value={filters.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          >
            <option value="">All Models</option>
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {MODEL_CONFIG[m]?.label ?? m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Top-K selector */}
      {showTopK && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-topk" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Top-K
          </label>
          <select
            id="filter-topk"
            value={filters.topK}
            onChange={(e) => onChange({ topK: Number(e.target.value) })}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          >
            {TOP_K_OPTIONS.map((k) => (
              <option key={k} value={k}>
                K = {k}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search keyword */}
      {showSearch && (
        <div className="flex flex-col gap-1 ml-auto">
          <label htmlFor="filter-search" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Search Road
          </label>
          <input
            id="filter-search"
            type="text"
            placeholder="Road name…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="h-8 w-52 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
      )}
    </div>
  );
}
