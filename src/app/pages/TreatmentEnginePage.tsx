import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Wrench,
  Database,
  Route,
  FileJson,
  DollarSign,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Map as MapIcon,
  Info
} from 'lucide-react';
import {
  getMapExplorerRoadKey,
  getMapExplorerRefAliasCandidate,
  getMapExplorerAliasCandidate
} from '../../lib/mapExplorerMatching';

import type {
  MapConfig,
  GeoRoad,
  DD2DamageSegment,
  DD2DamageSegmentData,
  DD2RoadFeature,
  DD2RoadFeatureWithRule,
  ManualASBOverride,
  DD2DataWithRules,
  MapDisplayMode,
  DominantCondition,
  ASBItem,
  HPSManualOverride,
  PlanningNote,
  CandidateBasketItem,
  CandidateStatus,
} from '../../lib/treatmentTypes';

import {
  evaluateTreatmentRuleV1,
  estimatePaguIndikatif,
  applyManualOverride,
  getDominantCondition,
  getDisplayRuleCategory,
  DOMINANT_COLORS,
  RULE_CATEGORY_COLORS,
  SEGMENT_CONDITION_COLORS,
} from '../../lib/treatmentEngine';

import { projectSegment } from '../../lib/projectSegment';
import type { HistoricalTreatmentContext, OptimizationRoadInput } from '../../lib/treatmentOptimization';

// Import extracted Phase 2 components
import { ASBTypeGuide } from './treatment-engine/components/ASBTypeGuide';
import { TreatmentRoadTable } from './treatment-engine/components/TreatmentRoadTable';
import { TreatmentStatsCards } from './treatment-engine/components/TreatmentStatsCards';
import { RoadFocusPanel } from './treatment-engine/components/RoadFocusPanel';
import { TreatmentFiltersPanel } from './treatment-engine/components/TreatmentFiltersPanel';
import { ScenarioPanel } from './treatment-engine/components/ScenarioPanel';

type ScenarioKecamatanSummaryItem = {
  kecamatan: string;
  road_count: number;
  total_pagu_indikatif_rp: number;
  included_count: number;
  force_include_count: number;
  deferred_count: number;
  force_exclude_count: number;
};

type ScenarioKecamatanSummaryResult = {
  items: ScenarioKecamatanSummaryItem[];
  hasMultiKecamatanRoads: boolean;
};

type HistoricalTreatmentYearSummary = {
  any: number | null;
  pl: number | null;
  tender: number | null;
};

type HistoricalTreatmentRecord = {
  road_key: string;
  source_identity?: {
    nomor_ruas?: string | null;
    nama_ruas?: string | null;
    nama_ruas_norm?: string | null;
  };
  handled?: Record<string, HistoricalTreatmentYearSummary>;
  prior_history_pre2026?: {
    any?: number | null;
    count?: number | null;
    last_year?: number | null;
    years_since_last?: number | null;
  };
  planned_targets?: Record<string, HistoricalTreatmentYearSummary>;
  administrative_context?: {
    desa_yang_dilalui?: string | null;
    kecamatan_yang_dilalui?: string | null;
    jumlah_desa_yang_dilalui?: number | null;
    jumlah_kecamatan_yang_dilalui?: number | null;
    jumlah_penduduk_dilayani?: number | null;
  };
  road_condition_snapshot?: Record<string, number | null>;
};

type HistoricalTreatmentData = {
  roads: HistoricalTreatmentRecord[];
};

/* ──────────────────────────────────────────────
   Treatment Engine — Map Shell + Placeholder
   Rule-based treatment indication & indicative
   budgeting from DD1 / FormDD1 road-condition data and ASB.

   SAFETY NOTE:
   - Map data reuses existing /data/maps/ files.
   - Now loads verified public/data/dd2_road_features.json
   ────────────────────────────────────────────── */

// ── Data Loaders ──────────────────────────────────────────────────────────────

function useTreatmentData() {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [geos, setGeos] = useState<GeoRoad[]>([]);
  const [rawData, setRawData] = useState<any>(null);
  const [asbItems, setAsbItems] = useState<ASBItem[]>([]);
  const [asbRules, setAsbRules] = useState<any>(null);
  const [segmentData, setSegmentData] = useState<DD2DamageSegmentData | null>(null);
  const [historicalTreatmentData, setHistoricalTreatmentData] = useState<HistoricalTreatmentData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const [manualOverrides, setManualOverridesState] = useState<Record<string, ManualASBOverride>>(() => {
    try {
      const stored = localStorage.getItem('ml_priority_lab_asb_overrides_v1');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return {};
  });

  const setManualOverrides = useCallback((newOverrides: Record<string, ManualASBOverride>) => {
    setManualOverridesState(newOverrides);
    localStorage.setItem('ml_priority_lab_asb_overrides_v1', JSON.stringify(newOverrides));
  }, []);

  const [hpsOverrides, setHpsOverridesState] = useState<Record<string, HPSManualOverride>>(() => {
    try {
      const stored = localStorage.getItem('ml_priority_lab_hps_overrides_v1');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return {};
  });

  const setHpsOverrides = useCallback((newOverrides: Record<string, HPSManualOverride>) => {
    setHpsOverridesState(newOverrides);
    localStorage.setItem('ml_priority_lab_hps_overrides_v1', JSON.stringify(newOverrides));
  }, []);

  const clearHPSOverrideForRoad = useCallback((road_key: string) => {
    setHpsOverridesState(prev => {
      const next = { ...prev };
      delete next[road_key];
      localStorage.setItem('ml_priority_lab_hps_overrides_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  const setHpsOverrideForRoad = useCallback((road_key: string, override: HPSManualOverride) => {
    setHpsOverridesState(prev => {
      const next = { ...prev, [road_key]: override };
      localStorage.setItem('ml_priority_lab_hps_overrides_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Phase 5: Planning Notes state ───────────────────────────────────────────
  const [planningNotes, setPlanningNotesState] = useState<Record<string, PlanningNote>>(() => {
    try {
      const stored = localStorage.getItem('ml_priority_lab_planning_notes_v1');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return {};
  });

  const savePlanningNoteForRoad = useCallback((road_key: string, note: string) => {
    setPlanningNotesState(prev => {
      const next = { ...prev };
      if (!note.trim()) {
        delete next[road_key];
      } else {
        next[road_key] = { road_key, note: note.trim(), updated_at: new Date().toISOString() };
      }
      localStorage.setItem('ml_priority_lab_planning_notes_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Phase 5: Candidate Basket state ─────────────────────────────────────────
  const [candidateBasket, setCandidateBasketState] = useState<Record<string, CandidateBasketItem>>(() => {
    try {
      const stored = localStorage.getItem('ml_priority_lab_candidate_basket_v1');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return {};
  });

  const addToCandidateBasket = useCallback((road: DD2RoadFeatureWithRule) => {
    setCandidateBasketState(prev => {
      if (prev[road.road_key]) return prev; // already in basket — no-op
      const now = new Date().toISOString();
      const next: Record<string, CandidateBasketItem> = {
        ...prev,
        [road.road_key]: {
          road_key: road.road_key,
          canonical_road_name: road.canonical_road_name,
          status: 'included',
          pagu_indikatif_rp: road.final_asb_budget?.final_pagu_indikatif_rp ?? null,
          asb_type: road.final_asb_budget?.final_asb_type ?? null,
          treatment_category: road.rule_v1.treatment_category,
          added_at: now,
          updated_at: now,
        },
      };
      localStorage.setItem('ml_priority_lab_candidate_basket_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromCandidateBasket = useCallback((road_key: string) => {
    setCandidateBasketState(prev => {
      const next = { ...prev };
      delete next[road_key];
      localStorage.setItem('ml_priority_lab_candidate_basket_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  const setCandidateStatus = useCallback((road_key: string, status: CandidateStatus) => {
    setCandidateBasketState(prev => {
      if (!prev[road_key]) return prev;
      const next = {
        ...prev,
        [road_key]: { ...prev[road_key], status, updated_at: new Date().toISOString() },
      };
      localStorage.setItem('ml_priority_lab_candidate_basket_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Phase 5C: Additional Helpers ─────────────────────────────────────────────
  
  const clearCandidateBasket = useCallback(() => {
    setCandidateBasketState({});
    localStorage.setItem('ml_priority_lab_candidate_basket_v1', JSON.stringify({}));
  }, []);

  const clearAllPlanningNotes = useCallback(() => {
    setPlanningNotesState({});
    localStorage.setItem('ml_priority_lab_planning_notes_v1', JSON.stringify({}));
  }, []);

  const syncCandidateBasketWithCurrentASB = useCallback((currentDd2Roads: DD2RoadFeatureWithRule[]) => {
    setCandidateBasketState(prev => {
      const next = { ...prev };
      let changed = false;
      const now = new Date().toISOString();

      const roadMap = new Map(currentDd2Roads.map(r => [r.road_key, r]));

      for (const [key, item] of Object.entries(next)) {
        const currentRoad = roadMap.get(key);
        if (currentRoad) {
          const pagu = currentRoad.final_asb_budget?.final_pagu_indikatif_rp ?? null;
          const asbType = currentRoad.final_asb_budget?.final_asb_type ?? null;
          const category = currentRoad.rule_v1?.treatment_category ?? null;

          if (item.pagu_indikatif_rp !== pagu || item.asb_type !== asbType || item.treatment_category !== category) {
            next[key] = {
              ...item,
              pagu_indikatif_rp: pagu,
              asb_type: asbType,
              treatment_category: category,
              updated_at: now
            };
            changed = true;
          }
        }
      }

      if (changed) {
        localStorage.setItem('ml_priority_lab_candidate_basket_v1', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    async function load() {
      setStatus('loading');
      try {
        const [resCfg, resGeo, resDd2, resSeg, resAsbItems, resAsbRules, resHistory] = await Promise.all([
          fetch('/data/maps/map-config.json'),
          fetch('/data/maps/road-geometries.json'),
          fetch('/data/dd2_road_features.json'),
          fetch('/data/dd2_damage_segments.json'),
          fetch('/data/asb_unit_prices.json'),
          fetch('/data/asb_budget_package_rules.json'),
          fetch('/data/treatment_history_by_road_key.json')
        ]);
        
        if (!resCfg.ok || !resGeo.ok) throw new Error('Failed to load map data');
        
        setConfig(await resCfg.json());
        setGeos(await resGeo.json());
        
        if (resAsbItems.ok) {
          const asbData = await resAsbItems.json();
          setAsbItems(asbData.items || []);
        }
        if (resAsbRules.ok) setAsbRules(await resAsbRules.json());
        if (resHistory.ok) setHistoricalTreatmentData(await resHistory.json());
        else setHistoricalTreatmentData(null);
        
        if (resDd2.ok) setRawData(await resDd2.json());
        if (resSeg && resSeg.ok) {
          const rawSegments = await resSeg.json();
          setSegmentData({
            metadata: rawSegments?.metadata ?? { total_segments: 0, unique_roads: 0, generated_at: '' },
            segments: Array.isArray(rawSegments?.segments) ? rawSegments.segments : []
          });
        }
        
        setStatus('done');
      } catch (err) {
        console.error('[TreatmentEngine] Data load error:', err);
        setStatus('error');
      }
    }
    load();
  }, []);

  const dd2Data = useMemo<DD2DataWithRules | null>(() => {
    if (!rawData) return null;
    let totalEvaluated = 0, insufficientData = 0, rutin = 0, berkala = 0, rehab = 0, rekon = 0, peningkatan = 0;
    let estimatedRoads = 0, noMajorPackage = 0, manualReviewRequired = 0;
    
    const sourceRoads = Array.isArray(rawData?.roads) ? rawData.roads : [];
    const roadsWithRules = sourceRoads.map((r: DD2RoadFeature) => {
      const rule = evaluateTreatmentRuleV1(r);
      totalEvaluated++;
      if (rule.treatment_category === 'Data Tidak Cukup') insufficientData++;
      else if (rule.treatment_category === 'Pemeliharaan Rutin') rutin++;
      else if (rule.treatment_category === 'Pemeliharaan Berkala') berkala++;
      else if (rule.treatment_category === 'Rehabilitasi') rehab++;
      else if (rule.treatment_category === 'Rehabilitasi / Rekonstruksi Indikatif') rekon++;
      else if (rule.treatment_category === 'Kandidat Peningkatan Permukaan') peningkatan++;
      
      let asb_budget;
      let final_asb_budget;
      if (asbItems.length > 0 && asbRules) {
         asb_budget = estimatePaguIndikatif(r, asbRules, asbItems);
         final_asb_budget = applyManualOverride(r, asb_budget, manualOverrides[r.road_key], asbItems);
         
         if (final_asb_budget.status === 'estimated' || final_asb_budget.status === 'manual_estimated') estimatedRoads++;
         else if (final_asb_budget.status === 'no_major_asb_package') noMajorPackage++;
         
         if (final_asb_budget.flags && final_asb_budget.flags.length > 0) manualReviewRequired++;
      }
      
      return { ...r, rule_v1: rule, asb_budget, final_asb_budget };
    });

    // DEV diagnostics global variable
    (window as any).__ASB_BUDGET_REASONABLENESS_DIAGNOSTICS__ = {
       rulesLoaded: asbRules?.selection_rules?.length || 0,
       asbItemsLoaded: asbItems.length,
       totalEvaluated,
       estimatedRoads,
       noMajorPackage,
       missingRules: !asbRules,
       missingItems: asbItems.length === 0,
       sampleEstimates: roadsWithRules.slice(0, 10).map((r: any) => ({
          road_name: r.canonical_road_name,
          non_mantap_pct: r.non_mantap_pct,
          final_asb_budget: r.final_asb_budget
       }))
    };
    
    return {
       ...rawData,
       _metadata: rawData?._metadata ?? { generated_at: '', total_records: sourceRoads.length, matched: 0, unmatched: 0, ambiguous: 0 },
       roads: roadsWithRules,
       ruleStats: { totalEvaluated, insufficientData, rutin, berkala, rehab, rekon, peningkatan },
       asbStats: {
          totalItemsLoaded: asbItems.length,
          totalRulesLoaded: asbRules?.selection_rules?.length || 0,
          estimatedRoads,
          noMajorPackage,
          manualReviewRequired,
          manualOverridesActive: Object.keys(manualOverrides).length
       }
    };
  }, [rawData, asbItems, asbRules, manualOverrides]);

  return { config, geos, dd2Data, segmentData, historicalTreatmentData, status, manualOverrides, setManualOverrides, asbItems, hpsOverrides, setHpsOverrides, clearHPSOverrideForRoad, setHpsOverrideForRoad, planningNotes, candidateBasket, savePlanningNoteForRoad, addToCandidateBasket, removeFromCandidateBasket, setCandidateStatus, clearCandidateBasket, clearAllPlanningNotes, syncCandidateBasketWithCurrentASB };
}

// ── Roadmap step data ─────────────────────────────────────────────────────────

const NEXT_STEPS = [
  {
    step: 1,
    label: 'Input DD1 / FormDD1 road-condition data',
    description: 'Bring in the road-condition source used for the academic consultation flow',
    icon: Database,
    status: 'done' as const,
  },
  {
    step: 2,
    label: 'Load and validate data',
    description: 'Check structural completeness and prepare the road-level records for treatment analysis',
    icon: Route,
    status: 'done' as const,
  },
  {
    step: 3,
    label: 'Analyze road condition per road',
    description: 'Use unpaved_pct, non_mantap_pct, and rusak_berat_pct as the active condition fields',
    icon: FileJson,
    status: 'done' as const,
  },
  {
    step: 4,
    label: 'Classify treatment package Type A/B/C/D/NONE',
    description: 'Apply the rule-based package classification for each road',
    icon: DollarSign,
    status: 'done' as const,
  },
  {
    step: 5,
    label: 'Select ASB package',
    description: 'Choose the matching ASB package for the classified treatment type',
    icon: Calculator,
    status: 'done' as const,
  },
  {
    step: 6,
    label: 'Calculate pagu indikatif',
    description: 'Derive the indicative budget using ASB unit prices as the canonical budget source',
    icon: Calculator,
    status: 'done' as const,
  },
  {
    step: 7,
    label: 'Compare/detail with HPS/AHSP',
    description: 'Use HPS/AHSP only as a comparison and detail layer, not as the budget source',
    icon: DollarSign,
    status: 'done' as const,
  },
  {
    step: 8,
    label: 'Add selected road to planning scenario',
    description: 'Move the road into the candidate basket for planning and notes',
    icon: Route,
    status: 'done' as const,
  },
  {
    step: 9,
    label: 'Preview funded/deferred based on budget cap',
    description: 'Review funded, deferred, and force-included roads against the cap preview',
    icon: Calculator,
    status: 'done' as const,
  },
];

const STATUS_STYLES = {
  pending:     { dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500',   label: 'Pending' },
  in_progress: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600',    label: 'In Progress' },
  done:        { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: 'Done' },
};

const TE_DD2_LOCAL_ALIASES: Record<string, string> = {
  'Taal Batang Kulur - SP.3 Muara Paring Agung': 'Taal Batang Kulur - Sp. 3 Muara Prg Agung',
  'Batulaki - Muara Pipii': 'Batu Laki - Muara Pipii',
  'SP.4 Baru/Tampang - SP. Biluy Pamujaan': 'Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan',
  'Jl. Brigjend. Katamso': 'Brigjen Katamso',
  'Kalumpang (Ds. Belanti) - Teratai': 'Kalumpang (Ds. Balanti) - Teratai',
  'Jl. Soeprapto - Jl. HM. Rusli': 'Soeprapto - H.M Rusli',
  'Jl. Papagaran/Pelangsatan': 'Papagaran/Palangsatan',
  'Tanayung - Simpang Ambarai': 'Tanayung - Simp. Ambarai',
  'Simpur - Simpang Bilui': 'Simpur - Simp. Bilui',
  'Sei. Mandala - Murung Raya': 'Sei. Mandala Murung Raya',
  'Jl. Cakingan Herman': 'Cangkingan Herman',
  'Pakan Dalam - Keminting Batu': 'Pakan Dalam - Kaminting Batu',
  'Jl. Keminting Batu': 'Kaminting Batu',
  'Banyu Barau - Sungai Kalang': 'Banyu Barau - Sei Kalang',
  'Paharuangan - Sungai Raya Selatan': 'Paharuangan - Sei. Raya Selatan',
  'Jl. Rahma Bahran': 'Rahmah Bahran',
  'Jl. Pasar Kandangan - Oprit Jembatan Loklua': 'Pasar Kandangan - Oprit Jembt. Loklua',
  'Jl. Kesehatan - Komp. Rumah Dokter': 'Kesehatan - Komp. Rmh Dokter',
  'Tibung Raya - Asam Cangkok': 'Tibung Raya - Asam Cangkuk',
  'Jl. Mesjid Kuba': 'Mesjid Quba',
  'Bamban Selatan - Tangang - Panggang Hijau': 'Bamban Selatan - Tanggang - Panggang Hijau',
  'Jl. Silaturahim': 'Silaturrahim',
  'Jl. Buluh Ds. Tebing Tinggi': 'Buluh - Ds. Tebing Tinggi',
  'Jl. HM. Thaib': 'H.M. Thaib',
  'Jl. Sakincung Ds. Hakurun Dalam': 'Sakincung - Ds. Hakurung Dalam',
  'Jl. Ds. Kapuh Tengah (Jl. Menuju Majelis Taklim)': 'Ds. Kapuh Tengah (Menuju Majelis Talim)',
  'Jl. Gerilya Ds. Simpur': 'Gerilya - Ds. Simpur',
  'Jl. Bubuih (Ds. Halunuk)': 'Bubuih - Ds. Halunuk',
  'Padang Batung - Batu Laki - Malilingin': 'Padang Batung - Batulaki - Malilingin',
  'Jl. Badaun - Ds. Bajayau Lama': 'Badaun - Ds. Bjayau Lama',
  'Simp. Bakarung Selatan - Sungai Kudung': 'Sp. Bakarung Selatan - Sungai Kudung',
  'Simpang Jadi Makmur Ds. Samuda': 'Simpang Jadi Makmur - Ds. Samuda'
};

// Helper component to adjust map viewport to selected geometry
function MapAutoFitter({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      map.fitBounds(coords as any, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [coords, map]);
  return null;
}

// ── Page component ────────────────────────────────────────────────────────────

export function TreatmentEnginePage() {
  const { config, geos, dd2Data, segmentData, historicalTreatmentData, status: mapStatus, manualOverrides, setManualOverrides, hpsOverrides, clearHPSOverrideForRoad, setHpsOverrideForRoad, planningNotes, candidateBasket, savePlanningNoteForRoad, addToCandidateBasket, removeFromCandidateBasket, setCandidateStatus, clearCandidateBasket, syncCandidateBasketWithCurrentASB } = useTreatmentData();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSegments, setShowSegments] = useState(false);
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState<Partial<ManualASBOverride>>({});
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Category Filters
  const [filterAsbType, setFilterAsbType] = useState('All');
  const [filterRuleId, setFilterRuleId] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterNonMantap, setFilterNonMantap] = useState('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Map Display Mode State
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>('threshold');

  const handleSaveOverride = () => {
    if (selectedKey && selectedDd2Feature) {
      const overrides = { ...manualOverrides };
      overrides[selectedDd2Feature.road_key] = {
        ...overrideForm,
        override_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ManualASBOverride;
      setManualOverrides(overrides);
      setIsEditingOverride(false);
      setOverrideForm({});
    }
  };

  const handleClearOverride = () => {
    if (selectedKey && selectedDd2Feature) {
      const overrides = { ...manualOverrides };
      delete overrides[selectedDd2Feature.road_key];
      setManualOverrides(overrides);
      setIsEditingOverride(false);
      setOverrideForm({});
    }
  };

  const handleExportOverrides = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(manualOverrides, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "asb_overrides_export.json");
    dlAnchorElem.click();
  };

  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  // Condition Highlighting State
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [highlightField, setHighlightField] = useState<keyof DD2RoadFeatureWithRule>('non_mantap_pct');
  const [highlightThreshold, setHighlightThreshold] = useState(30);
  const [highlightOperator, setHighlightOperator] = useState<'>=' | '<='>('>=');

  // Dominant Condition Counts
  const dominantCounts = useMemo(() => {
    const counts = { 'Baik': 0, 'Sedang': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0, 'N/A': 0 };
    if (!dd2Data) return counts;
    for (const r of dd2Data.roads) {
       const dom = getDominantCondition(r);
       counts[dom]++;
    }
    return counts;
  }, [dd2Data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Find map selection
  const selectedGeo = geos.find(
    (g) => `te-${g.legacy_ref ?? g.road_id ?? g.road_name}` === selectedKey,
  );

  // Build DD2 lookup map
  const dd2Map = useMemo(() => {
    const map = new Map<string, DD2RoadFeatureWithRule[]>();
    if (!dd2Data) return map;
    for (const r of dd2Data.roads) {
      const k = r.road_key;
      const bucket = map.get(k) || [];
      bucket.push(r);
      map.set(k, bucket);

      const mapKey = getMapExplorerRoadKey(r.canonical_road_name);
      if (mapKey && mapKey !== k) {
        const altBucket = map.get(mapKey) || [];
        altBucket.push(r);
        map.set(mapKey, altBucket);
      }

      const rawKey = getMapExplorerRoadKey(r.dd2_road_name_raw);
      if (rawKey && rawKey !== k && rawKey !== mapKey) {
        const rawBucket = map.get(rawKey) || [];
        rawBucket.push(r);
        map.set(rawKey, rawBucket);
      }
    }
    return map;
  }, [dd2Data]);

  // Central resolver for Geo -> DD2 Road mapping
  const resolveGeoToFeature = useCallback((geo: GeoRoad) => {
    if (!dd2Data) return null;
    const directKey = getMapExplorerRoadKey(geo.road_name);
    const refAliasCandidate = getMapExplorerRefAliasCandidate(geo.legacy_ref, geo.road_name);
    const aliasCandidate = getMapExplorerAliasCandidate(geo.road_name);
    const matchedNameKey = geo.matched_name ? getMapExplorerRoadKey(geo.matched_name) : null;

    const resolve = (key: string | null) => {
      if (!key) return null;
      const bucket = dd2Map.get(key) || [];
      return bucket.length === 1 ? bucket[0] : null;
    };

    let feature = null;
    if (refAliasCandidate?.key) {
      feature = resolve(refAliasCandidate.key);
      if (feature) return { feature, method: refAliasCandidate.method, diagKey: refAliasCandidate.key };
    }
    if (aliasCandidate?.key) {
      feature = resolve(aliasCandidate.key);
      if (feature) return { feature, method: aliasCandidate.method, diagKey: aliasCandidate.key };
    }
    feature = resolve(directKey);
    if (feature) return { feature, method: 'direct', diagKey: directKey };

    const teAliasTarget = TE_DD2_LOCAL_ALIASES[geo.road_name];
    if (teAliasTarget) {
      const teAliasKey = getMapExplorerRoadKey(teAliasTarget);
      feature = resolve(teAliasKey);
      if (feature) return { feature, method: 'te_local_alias', diagKey: teAliasKey };
    }
    if (matchedNameKey) {
      feature = resolve(matchedNameKey);
      if (feature) return { feature, method: 'matched_name', diagKey: matchedNameKey };
    }
    return { feature: null, method: 'unmatched', diagKey: directKey };
  }, [dd2Data, dd2Map]);

  // Find matching DD2 feature for selected map road
  const { selectedDd2Feature, matchMethod, diagnosticKey } = useMemo(() => {
    if (!selectedGeo) return { selectedDd2Feature: null, matchMethod: 'unmatched', diagnosticKey: '' };
    const res = resolveGeoToFeature(selectedGeo);
    return { 
      selectedDd2Feature: res?.feature ?? null, 
      matchMethod: res?.method ?? 'unmatched', 
      diagnosticKey: res?.diagKey ?? '' 
    };
  }, [selectedGeo, resolveGeoToFeature]);

  // Reverse Mapping for Table -> Map lookups
  const roadKeyToGeoKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!dd2Data || !geos.length) return map;
    geos.forEach(geo => {
       const res = resolveGeoToFeature(geo);
       if (res && res.feature) {
          const lookupKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}`;
          map.set(res.feature.road_key, lookupKey);
       }
    });
    return map;
  }, [dd2Data, geos, resolveGeoToFeature]);

  // Phase 5B: Select road from scenario panel
  const selectRoadFromScenario = useCallback((road_key: string) => {
    const geoKey = roadKeyToGeoKeyMap.get(road_key);
    if (geoKey) {
      setSelectedKey(geoKey);
      requestAnimationFrame(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
  }, [roadKeyToGeoKeyMap]);

  // Phase 5C: Bound sync function
  const handleSyncScenario = useCallback(() => {
    if (dd2Data?.roads) {
      syncCandidateBasketWithCurrentASB(dd2Data.roads);
    }
  }, [dd2Data, syncCandidateBasketWithCurrentASB]);

  // Lookup segments by key
  const segmentsByRoadKey = useMemo(() => {
     const m = new Map<string, DD2DamageSegment[]>();
     if (!segmentData) return m;
     segmentData.segments.forEach(s => {
        const list = m.get(s.road_key) || [];
        list.push(s);
        m.set(s.road_key, list);
     });
     return m;
  }, [segmentData]);

  // Compute summary metrics for currently selected road's segments
  const selectedSegmentSummary = useMemo(() => {
    if (!selectedDd2Feature) return null;
    const segments = segmentsByRoadKey.get(selectedDd2Feature.road_key) || [];
    if (segments.length === 0) return null;

    let totalLenM = 0;
    let lenBaik = 0, lenSedang = 0, lenRingan = 0, lenBerat = 0, lenUnknown = 0;
    const treatmentCounts = new Map<string, number>();
    const surfaceCounts = new Map<string, number>();

    const sortedSegments = [...segments].sort((a, b) => a.sta_start_m - b.sta_start_m);

    sortedSegments.forEach(seg => {
       const l = seg.panjang_m || (seg.sta_end_m - seg.sta_start_m);
       totalLenM += l;

       const cond = (seg.dominant_condition || '').toLowerCase();
       if (cond.includes('baik')) lenBaik += l;
       else if (cond.includes('sedang')) lenSedang += l;
       else if (cond.includes('ringan')) lenRingan += l;
       else if (cond.includes('berat')) lenBerat += l;
       else lenUnknown += l;

       const treat = seg.jenis_penanganan_norm || 'N/A';
       treatmentCounts.set(treat, (treatmentCounts.get(treat) || 0) + l);

       const surf = seg.surface_label || 'N/A';
       surfaceCounts.set(surf, (surfaceCounts.get(surf) || 0) + l);
    });

    const nonMantapM = lenRingan + lenBerat;
    const nonMantapPct = totalLenM > 0 ? (nonMantapM / totalLenM) * 100 : 0;

    const conditionPool = [
       { label: 'Baik', len: lenBaik },
       { label: 'Sedang', len: lenSedang },
       { label: 'Rusak Ringan', len: lenRingan },
       { label: 'Rusak Berat', len: lenBerat }
    ];
    conditionPool.sort((a,b) => b.len - a.len);
    const dominantCondition = conditionPool[0].len > 0 ? conditionPool[0].label : 'N/A';

    let topTreatment = 'N/A';
    let topTreatLen = 0;
    treatmentCounts.forEach((len, name) => {
       if (len > topTreatLen) {
          topTreatLen = len;
          topTreatment = name;
       }
    });

    let topSurface = 'N/A';
    let topSurfLen = 0;
    surfaceCounts.forEach((len, name) => {
       if (len > topSurfLen) {
          topSurfLen = len;
          topSurface = name;
       }
    });

    return {
       segments: sortedSegments,
       count: segments.length,
       totalLenM,
       lenBaik,
       lenSedang,
       lenRingan,
       lenBerat,
       lenUnknown,
       nonMantapM,
       nonMantapPct,
       dominantCondition,
       topTreatment,
       topSurface
    };
  }, [selectedDd2Feature, segmentsByRoadKey]);

  const historicalTreatmentByRoadKey = useMemo(() => {
    const map = new Map<string, HistoricalTreatmentRecord>();
    if (!historicalTreatmentData?.roads?.length) return map;

    historicalTreatmentData.roads.forEach((record) => {
      if (record?.road_key) map.set(record.road_key, record);
    });

    return map;
  }, [historicalTreatmentData]);

  const selectedHistoricalTreatmentRecord = useMemo(() => {
    if (!selectedDd2Feature) return null;
    return historicalTreatmentByRoadKey.get(selectedDd2Feature.road_key) ?? null;
  }, [selectedDd2Feature, historicalTreatmentByRoadKey]);

  const optimizationRoadLookup = useMemo(() => {
    const map = new Map<string, OptimizationRoadInput>();
    if (!dd2Data) return map;

    dd2Data.roads.forEach((road) => {
      map.set(road.road_key, {
        road_key: road.road_key,
        canonical_road_name: road.canonical_road_name,
        non_mantap_pct: road.non_mantap_pct,
        kondisi_rusak_berat_pct: road.kondisi_rusak_berat_pct,
        kecamatan_dilalui: road.kecamatan_dilalui,
        unpaved_pct: (road as DD2RoadFeature & { unpaved_pct?: number | null }).unpaved_pct ?? null,
      });
    });

    return map;
  }, [dd2Data]);

  const optimizationHistoryLookup = useMemo(() => {
    const map = new Map<string, HistoricalTreatmentContext>();
    historicalTreatmentByRoadKey.forEach((record, roadKey) => {
      map.set(roadKey, record);
    });
    return map;
  }, [historicalTreatmentByRoadKey]);

  const roadKeyToKecamatanMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!dd2Data) return map;

    dd2Data.roads.forEach(road => {
      map.set(road.road_key, road.kecamatan_dilalui ?? '');
    });

    return map;
  }, [dd2Data]);

  const scenarioKecamatanSummary = useMemo<ScenarioKecamatanSummaryResult>(() => {
    const aggregate = new Map<string, ScenarioKecamatanSummaryItem>();
    let hasMultiKecamatanRoads = false;

    Object.values(candidateBasket).forEach(item => {
      const rawKecamatan = roadKeyToKecamatanMap.get(item.road_key) ?? '';
      const resolvedKecamatan = rawKecamatan
        .split(/[,;]+/)
        .map(value => value.trim())
        .filter(Boolean);

      const kecamatanList = resolvedKecamatan.length > 0 ? resolvedKecamatan : ['Tidak Terdata'];
      if (kecamatanList.length > 1) hasMultiKecamatanRoads = true;

      kecamatanList.forEach(kecamatan => {
        const current = aggregate.get(kecamatan) ?? {
          kecamatan,
          road_count: 0,
          total_pagu_indikatif_rp: 0,
          included_count: 0,
          force_include_count: 0,
          deferred_count: 0,
          force_exclude_count: 0,
        };

        current.road_count += 1;
        current.total_pagu_indikatif_rp += item.pagu_indikatif_rp ?? 0;

        if (item.status === 'included') current.included_count += 1;
        else if (item.status === 'force_include') current.force_include_count += 1;
        else if (item.status === 'deferred') current.deferred_count += 1;
        else if (item.status === 'force_exclude') current.force_exclude_count += 1;

        aggregate.set(kecamatan, current);
      });
    });

    const items = [...aggregate.values()].sort((a, b) => {
      if (b.road_count !== a.road_count) return b.road_count - a.road_count;
      return a.kecamatan.localeCompare(b.kecamatan, 'id');
    });

    return { items, hasMultiKecamatanRoads };
  }, [candidateBasket, roadKeyToKecamatanMap]);

  // Verified Segment diagnostic telemetry
  const segmentDiagStats = useMemo(() => {
     if (!segmentData || !geos.length) return null;

     const roadGeometriesMap = new Map<string, [number, number][]>();
     const roadKeysWithGeo = new Set<string>();
     
     geos.forEach(geo => {
        const res = resolveGeoToFeature(geo);
        if (res && res.feature) {
           const key = res.feature.road_key;
           roadKeysWithGeo.add(key);
           roadGeometriesMap.set(key, geo.coordinates);
        }
     });

     let totalRowsLoaded = segmentData.segments.length;
     let segmentsLinkedToGeometry = 0;
     let segmentsProjectable = 0;
     let segmentsProjectionFailed = 0;
     
     const roadMaxSta = new Map<string, number>();
     segmentData.segments.forEach(s => {
        const cur = roadMaxSta.get(s.road_key) || 0;
        if (s.sta_end_m > cur) roadMaxSta.set(s.road_key, s.sta_end_m);
     });

     segmentData.segments.forEach(seg => {
        const coords = roadGeometriesMap.get(seg.road_key);
        if (!coords) return; 
        
        segmentsLinkedToGeometry++;
        
        const totalLen = roadMaxSta.get(seg.road_key) || seg.sta_end_m;
        const proj = projectSegment(coords, seg.sta_start_m, seg.sta_end_m, totalLen);
        
        if (proj.length >= 2) {
           segmentsProjectable++;
        } else {
           segmentsProjectionFailed++;
        }
     });

     return {
        totalRowsLoaded,
        uniqueRoadsRepresented: segmentData.metadata.unique_roads,
        roadsMatchedToGeometries: roadKeysWithGeo.size,
        segmentsLinkedToGeometry,
        segmentsProjectable,
        segmentsProjectionFailed,
        skippedDueToMissingGeo: totalRowsLoaded - segmentsLinkedToGeometry
     };
  }, [segmentData, geos, resolveGeoToFeature]);

  // Transparent secondary export hook to preserve console window visibility
  useEffect(() => {
     if (segmentDiagStats) {
        (window as any).__TREATMENT_SEGMENT_LAYER_DIAGNOSTICS__ = {
           ...segmentDiagStats,
           diagnosticTime: new Date().toISOString()
        };
     }
  }, [segmentDiagStats]);

  // Filtered table data
  const filteredTableData = useMemo(() => {
    if (!dd2Data) return [];
    let data = dd2Data.roads;

    if (filterAsbType !== 'All') {
       if (filterAsbType === 'No Major Package') {
          data = data.filter(r => r.final_asb_budget?.status === 'no_major_asb_package');
       } else if (filterAsbType === 'Manual Override') {
          data = data.filter(r => r.final_asb_budget?.manual_override_used);
       } else {
          data = data.filter(r => r.final_asb_budget?.final_asb_type === filterAsbType);
       }
    }

    if (filterRuleId !== 'All') {
       data = data.filter(r => r.rule_v1.treatment_category === filterRuleId);
    }

    if (filterStatus !== 'All') {
       if (filterStatus === 'Manual Override') {
          data = data.filter(r => r.final_asb_budget?.manual_override_used);
       } else if (filterStatus === 'Review Flag') {
          data = data.filter(r => r.final_asb_budget?.flags && r.final_asb_budget.flags.length > 0);
       } else if (filterStatus === 'No Major Package') {
          data = data.filter(r => r.final_asb_budget?.status === 'no_major_asb_package');
       }
    }

    if (filterNonMantap !== 'All') {
       const threshold = parseInt(filterNonMantap.replace(/[^0-9]/g, ''));
       if (!isNaN(threshold)) {
          data = data.filter(r => (r.non_mantap_pct ?? 0) >= threshold);
       }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(r => 
        (r.canonical_road_name || '').toLowerCase().includes(term) ||
        (r.dd2_road_name_raw || '').toLowerCase().includes(term) ||
        ((r.kecamatan_dilalui || '').toLowerCase().includes(term))
      );
    }
    
    return data;
  }, [dd2Data, searchTerm, filterAsbType, filterRuleId, filterStatus, filterNonMantap]);

  const filteredRoadKeys = useMemo(() => new Set(filteredTableData.map(r => r.road_key)), [filteredTableData]);

  // Paginated data
  const paginatedTableData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTableData.slice(start, start + pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  // Automatic Paging Sync
  useEffect(() => {
    if (!selectedDd2Feature || !filteredTableData.length) return;
    const idx = filteredTableData.findIndex(r => r.road_key === selectedDd2Feature.road_key);
    if (idx >= 0) {
       const targetPage = Math.floor(idx / pageSize) + 1;
       if (targetPage !== currentPage) {
         setCurrentPage(targetPage);
       }
    }
  }, [selectedDd2Feature, filteredTableData, pageSize]);

  const isSelectedRoadFilteredOut = useMemo(() => {
    if (!selectedDd2Feature || !searchTerm) return false;
    return !filteredTableData.some(r => r.road_key === selectedDd2Feature.road_key);
  }, [selectedDd2Feature, filteredTableData, searchTerm]);

  // Map Highlight Logic
  const highlightedRoadKeys = useMemo(() => {
    if (!highlightEnabled || !dd2Data) return new Set<string>();
    
    const highlighted = new Set<string>();
    for (const road of dd2Data.roads) {
      const val = road[highlightField] as number | null;
      if (val === null || val === undefined) continue;
      
      const passes = highlightOperator === '>=' ? val >= highlightThreshold : val <= highlightThreshold;
      if (passes) {
        highlighted.add(road.road_key);
      }
    }
    return highlighted;
  }, [highlightEnabled, dd2Data, highlightField, highlightThreshold, highlightOperator]);

  // Derived percentages
  const highlightStats = useMemo(() => {
    if (!dd2Data) return { count: 0, pct: 0 };
    const count = highlightedRoadKeys.size;
    const total = dd2Data.roads.length;
    return {
      count,
      pct: total > 0 ? (count / total) * 100 : 0
    };
  }, [highlightedRoadKeys, dd2Data]);

  return (
    <div id="treatment-engine-page" className="space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-100/40 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-violet-100/40 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">Treatment Engine</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Rule-based treatment indication and indicative budgeting from DD1&nbsp;/&nbsp;FormDD1 road-condition data and ASB.
              This module applies road-condition rules from DD1&nbsp;/&nbsp;FormDD1 to recommend treatment types and estimate budget allocations using ASB unit prices.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              ML Priority Score remains in the separate ranking module/page and is not integrated into Treatment Engine yet.
            </p>
          </div>
        </div>
      </div>

      {/* ── Data provenance & Identity Status ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-800">Data Provenance</h3>
          </div>
          <div className="grid gap-px bg-slate-100 grid-rows-3 flex-1">
            {[
              { label: 'DD1 / FormDD1 Source', value: 'FormDD1-2025.xlsx', sub: 'staging-source/dd2/raw/',       icon: Database,    color: 'text-blue-600 bg-blue-50' },
              { label: 'Processed Staging', value: '2 CSV files',       sub: 'staging-source/dd2/processed/', icon: FileJson,    color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Extraction Audit',  value: '350 rows confirmed', sub: 'staging-source/dd2/audit/',    icon: CheckCircle, color: 'text-violet-600 bg-violet-50' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 bg-white px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{item.value}</p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="border-b border-slate-100 px-5 py-3.5 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-800">Identity Audit Status</h3>
            {dd2Data && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle className="h-3 w-3" />
                Clean Audit
              </span>
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center">
            {dd2Data ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roads Loaded</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.total_records}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Identity Matched</p>
                  <p className="mt-1 text-3xl font-bold text-emerald-700">{dd2Data._metadata.matched}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unmatched</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.unmatched}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ambiguous</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{dd2Data._metadata.ambiguous}</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">Loading identity summary...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Extracted Stats Cards (Indicative Rule + Budget Estimator Overview) ── */}
      <TreatmentStatsCards 
        dd2Data={dd2Data}
        onExportOverrides={handleExportOverrides}
      />

      {/* ── Spatial Treatment Context ─────────────────────────────────────────── */}
      <div ref={mapSectionRef} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <MapIcon className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Spatial Treatment Context</h3>
          </div>
          {/* Status chip */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Verified Data Loaded
          </span>
        </div>

        {/* Map Control Toolbar — Primary Row */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap items-center gap-4">
           {/* Mode Selector */}
           <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">View Mode:</label>
              <select
                 value={displayMode}
                 onChange={(e) => setDisplayMode(e.target.value as MapDisplayMode)}
                 className="text-xs font-bold border border-slate-200 rounded-md bg-white py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 text-slate-700"
              >
                 <option value="threshold">Threshold Highlight</option>
                 <option value="dominant">Dominant Condition</option>
                 <option value="rule">Rule v0.1 Category</option>
              </select>
           </div>

           {/* Segment Layer Toggle */}
           <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={showSegments} 
                   onChange={(e) => setShowSegments(e.target.checked)}
                   className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                   disabled={!segmentData}
                 />
                 Show Segment Damage
              </label>
           </div>

           {displayMode !== 'threshold' && dd2Data && (
              <div className="ml-auto flex items-center gap-2 text-xs">
                 <span className="font-semibold text-slate-700">{dd2Data.roads.length}</span>
                 <span className="text-slate-500">roads classified</span>
              </div>
           )}
        </div>

        {/* Map Control Toolbar — Secondary Row (Conditional Context) */}
        {displayMode === 'threshold' && (
           <div className="border-b border-slate-100 bg-white px-5 py-2.5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                 <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={highlightEnabled} 
                      onChange={(e) => setHighlightEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Condition Highlight
                 </label>
              </div>
              
              <div className={`flex items-center gap-3 transition-opacity ${highlightEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <select 
                   value={highlightField} 
                   onChange={(e) => setHighlightField(e.target.value as any)}
                   className="text-xs border border-slate-200 rounded-md bg-white py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500"
                >
                   <option value="non_mantap_pct">Non-Mantap %</option>
                   <option value="kondisi_rusak_berat_pct">Rusak Berat %</option>
                   <option value="kondisi_rusak_ringan_pct">Rusak Ringan %</option>
                   <option value="kondisi_sedang_pct">Sedang %</option>
                   <option value="kondisi_baik_pct">Baik %</option>
                </select>
                
                <select
                   value={highlightOperator}
                   onChange={(e) => setHighlightOperator(e.target.value as any)}
                   className="text-xs border border-slate-200 rounded-md bg-white py-1 px-2 focus:ring-1 focus:ring-indigo-500"
                >
                   <option value=">=">&ge;</option>
                   <option value="<=">&le;</option>
                </select>

                <div className="flex items-center gap-1">
                   <input
                     type="number"
                     value={highlightThreshold}
                     onChange={(e) => setHighlightThreshold(Number(e.target.value))}
                     className="w-16 text-xs border border-slate-200 rounded-md bg-white py-1 px-2 text-center focus:ring-1 focus:ring-indigo-500"
                   />
                   <span className="text-xs text-slate-500">%</span>
                </div>
              </div>

              {highlightEnabled && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                   <span className="font-semibold text-red-500">{highlightStats.count}</span>
                   <span className="text-slate-500">roads highlighted</span>
                   <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                     {highlightStats.pct.toFixed(1)}%
                   </span>
                </div>
              )}
           </div>
        )}

         {/* Diagnostics summary for segments if enabled */}
         {showSegments && segmentDiagStats && (
            <div className="border-b border-slate-100 bg-indigo-50/30 px-5 py-2 flex flex-wrap items-center gap-y-1 gap-x-3.5 text-[10px]">
               <div className="flex items-center gap-1 font-medium text-slate-500">
                  <Database className="h-3 w-3 text-indigo-400" />
                  Loaded: <span className="text-slate-700 font-bold">{segmentDiagStats.totalRowsLoaded}</span>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Roads: <strong className="text-emerald-600">{segmentDiagStats.roadsMatchedToGeometries}/{segmentDiagStats.uniqueRoadsRepresented}</strong>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Linked: <strong className="text-indigo-600">{segmentDiagStats.segmentsLinkedToGeometry}</strong>
               </div>
               <div className="h-3 w-px bg-slate-200" />
               <div className="flex items-center gap-1 text-slate-600">
                  Projected: <strong className="text-indigo-700">{segmentDiagStats.segmentsProjectable}</strong>
               </div>
               {segmentDiagStats.segmentsProjectionFailed > 0 && (
                  <>
                     <div className="h-3 w-px bg-slate-200" />
                     <div className="flex items-center gap-1 text-red-600 font-medium">
                        Failed: {segmentDiagStats.segmentsProjectionFailed}
                     </div>
                  </>
               )}
               {segmentDiagStats.skippedDueToMissingGeo > 0 && (
                  <>
                     <div className="h-3 w-px bg-slate-200" />
                     <div className="flex items-center gap-1 text-amber-600">
                        No Geo: {segmentDiagStats.skippedDueToMissingGeo}
                     </div>
                  </>
               )}
            </div>
         )}

        {/* Explanatory note */}
        <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            {showSegments 
               ? "Segment damage view enabled. Road geometries are projected using fractional STA positions from source DD2 data."
               : "This map displays road geometries and their loaded runtime road-condition attributes. Treatment logic and ASB costing follow the current Treatment Engine flow, while ML Priority Score, Kecamatan linkage, spatial equity, and constrained optimization remain roadmap items."
            }
          </p>
        </div>

        {/* Map & Focus Panel Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
          <div className="relative h-[480px] lg:h-[560px] bg-slate-50">
          {/* Loading overlay */}
          {mapStatus === 'loading' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-xs font-medium text-slate-500">Loading map data...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {mapStatus === 'error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
                <p className="mt-2 text-xs font-medium text-slate-500">Failed to load map data</p>
              </div>
            </div>
          )}

          {/* Leaflet map — shown only when data is ready */}
          {mapStatus === 'done' && config && (
            <MapContainer
              center={config.center}
              zoom={config.zoom}
              minZoom={config.minZoom}
              maxZoom={config.maxZoom}
              zoomControl={config.showZoomControl ?? true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Sync view to selected object */}
              <MapAutoFitter coords={selectedGeo?.coordinates || null} />

              {/* 350 road geometries */}
              {geos.map((geo, idx) => {
                const layerKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}-${idx}`;
                const lookupKey = `te-${geo.legacy_ref ?? geo.road_id ?? geo.road_name}`;
                const isSelected = selectedKey === lookupKey;

                // Use DRY central resolver
                const resolution = resolveGeoToFeature(geo);
                const f = resolution?.feature ?? null;

                const isFilteredOut = f ? !filteredRoadKeys.has(f.road_key) : false;
                if (isFilteredOut && !isSelected) {
                   return null;
                }

                // Styling logic
                let color = '#6366f1';
                let weight = 3;
                let opacity = 0.65;

                if (isSelected) {
                   color = '#f59e0b';
                   weight = 7;
                   opacity = 1;
                } else if (displayMode === 'threshold') {
                   if (highlightEnabled && f && highlightedRoadKeys.has(f.road_key)) {
                      color = '#ef4444'; 
                      weight = 5;
                      opacity = 0.9;
                   } else if (highlightEnabled) {
                      color = '#cbd5e1'; 
                      weight = 2;
                      opacity = 0.3;
                   }
                } else if (displayMode === 'dominant') {
                   if (f) {
                      const dom = getDominantCondition(f);
                      color = DOMINANT_COLORS[dom];
                      weight = 3.5;
                      opacity = 0.85;
                   } else {
                      color = '#e2e8f0';
                      weight = 1.5;
                      opacity = 0.3;
                   }
                } else if (displayMode === 'rule') {
                   if (f) {
                      const cat = getDisplayRuleCategory(f.rule_v1.treatment_category);
                      color = RULE_CATEGORY_COLORS[cat] || '#cbd5e1';
                      weight = 3.5;
                      opacity = 0.85;
                   } else {
                      color = '#e2e8f0';
                      weight = 1.5;
                      opacity = 0.3;
                   }
                }

                const isHighlighted = highlightEnabled && f && highlightedRoadKeys.has(f.road_key);
                const roadSegments = showSegments && f ? (segmentsByRoadKey.get(f.road_key) || []) : [];
                const totalLenM = roadSegments.length > 0 
                   ? Math.max(...roadSegments.map(s => s.sta_end_m)) 
                   : (f ? (f.panjang_ruas_km || 0) * 1000 : 0);

                  return (
                    <Fragment key={layerKey}>
                      {/* Underlying Baseline */}
                      <Polyline
                        positions={geo.coordinates as any}
                        pathOptions={{ 
                           color: showSegments ? '#cbd5e1' : color, 
                           weight: showSegments ? 2 : weight, 
                           opacity: showSegments ? 0.35 : opacity 
                        }}
                        eventHandlers={{
                          click: () => setSelectedKey(isSelected ? null : lookupKey),
                        }}
                      >
                        {!showSegments && (
                           <Tooltip sticky>
                             <span className="font-mono text-[11px] font-bold text-slate-700 block">
                               {geo.road_name}
                               {geo.legacy_ref && (
                                 <span className="ml-1 font-normal text-slate-400">
                                   [{geo.legacy_ref}]
                                 </span>
                               )}
                             </span>
                             {f && (
                               <span className="block mt-1 text-[10px] font-medium text-indigo-600">
                                 {getDisplayRuleCategory(f.rule_v1.treatment_category)}
                               </span>
                             )}
                             {highlightEnabled && f && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                   <span className="block text-[9px] text-slate-500 mb-0.5">
                                     {highlightField}: <strong className="text-slate-700">{(f[highlightField] as number) ?? 'N/A'}%</strong>
                                   </span>
                                   <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${isHighlighted ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                     {isHighlighted ? 'PASSES THRESHOLD' : 'DOES NOT PASS'}
                                   </span>
                                </div>
                             )}
                           </Tooltip>
                        )}
                      </Polyline>

                      {/* Projected Overlay Segments */}
                      {showSegments && roadSegments.map((seg, sIdx) => {
                         const sCoords = projectSegment(geo.coordinates, seg.sta_start_m, seg.sta_end_m, totalLenM);
                         if (sCoords.length < 2) return null;

                         const normalized = (seg.dominant_condition || '').toLowerCase().replace(/\s+/g, '_');
                         const sColor = SEGMENT_CONDITION_COLORS[normalized] || SEGMENT_CONDITION_COLORS['default'];
                         
                         const sWeight = isSelected ? 7 : 4.5;
                         const sOpacity = isSelected ? 1 : 0.9;

                         return (
                            <Polyline
                               key={`${layerKey}-seg-${sIdx}`}
                               positions={sCoords as any}
                               pathOptions={{ color: sColor, weight: sWeight, opacity: sOpacity }}
                               eventHandlers={{
                                  click: () => setSelectedKey(isSelected ? null : lookupKey),
                               }}
                            >
                               <Tooltip sticky>
                                  <div className="flex flex-col gap-0.5 text-[10px]">
                                     <span className="font-bold text-slate-700">{geo.road_name}</span>
                                     <span className="text-[9px] text-slate-400 font-mono">STA {seg.sta_start_m} - {seg.sta_end_m}</span>
                                     <span className="mt-0.5 font-bold text-indigo-600 uppercase">{seg.dominant_condition}</span>
                                  </div>
                               </Tooltip>
                               <Popup>
                                  <div className="w-56 text-[11px]">
                                     <div className="mb-1.5 pb-1 border-b border-slate-100">
                                        <h5 className="font-black uppercase tracking-wider text-slate-400 text-[9px]">Segment Details</h5>
                                        <p className="font-bold leading-tight mt-0.5">{seg.canonical_road_name || geo.road_name}</p>
                                        <p className="text-[9px] font-mono text-slate-500">Raw: {seg.raw_road_name}</p>
                                     </div>
                                     <div className="space-y-1 text-slate-600">
                                        <div className="flex justify-between"><span className="font-medium">Stationing:</span> <span className="font-mono font-semibold">KM {seg.sta_start_m/1000} - {seg.sta_end_m/1000}</span></div>
                                        <div className="flex justify-between"><span>Panjang:</span> <strong>{seg.panjang_m} m</strong></div>
                                        <div className="flex justify-between"><span>Lebar:</span> <strong>{seg.lebar_m} m</strong></div>
                                        <div className="flex justify-between"><span>Kondisi:</span> <strong style={{ color: sColor }} className="uppercase">{seg.dominant_condition}</strong></div>
                                        <div className="flex justify-between"><span>Status:</span> <strong>{seg.segment_status}</strong></div>
                                        <div className="flex justify-between"><span>Treatment:</span> <strong>{seg.jenis_penanganan_norm}</strong></div>
                                        <div className="flex justify-between"><span>Surface:</span> <strong>{seg.surface_label}</strong></div>
                                        <div className="flex justify-between"><span>Thn Survei:</span> <strong>{seg.tahun_survei}</strong></div>
                                     </div>
                                     <div className="mt-2 pt-1 border-t border-slate-100 flex items-center gap-1 text-[8px] text-slate-400 italic leading-tight">
                                        <Info className="h-2.5 w-2.5 shrink-0" />
                                        Segment projected via STA proportion along road polyline.
                                     </div>
                                  </div>
                               </Popup>
                            </Polyline>
                         );
                      })}
                    </Fragment>
                  );
              })}
            </MapContainer>
          )}

          </div>

          <RoadFocusPanel
            selectedGeo={selectedGeo || null}
            selectedDd2Feature={selectedDd2Feature}
            selectedSegmentSummary={selectedSegmentSummary}
            selectedHistoricalTreatmentRecord={selectedHistoricalTreatmentRecord}
            diagnosticKey={diagnosticKey}
            matchMethod={matchMethod}
            manualOverrides={manualOverrides}
            overrideForm={overrideForm}
            isEditingOverride={isEditingOverride}
            setOverrideForm={setOverrideForm}
            setIsEditingOverride={setIsEditingOverride}
            handleSaveOverride={handleSaveOverride}
            handleClearOverride={handleClearOverride}
            setIsGuideOpen={setIsGuideOpen}
            onClose={() => setSelectedKey(null)}
            hpsOverrides={hpsOverrides}
            clearHPSOverrideForRoad={clearHPSOverrideForRoad}
            setHpsOverrideForRoad={setHpsOverrideForRoad}
            candidateBasket={candidateBasket}
            planningNotes={planningNotes}
            addToCandidateBasket={addToCandidateBasket}
            removeFromCandidateBasket={removeFromCandidateBasket}
            setCandidateStatus={setCandidateStatus}
            savePlanningNoteForRoad={savePlanningNoteForRoad}
          />
        </div>

        {/* Dynamic Map Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Symbology</p>
          
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-5 rounded bg-amber-400" />
            <span className="text-[10px] font-semibold text-slate-700">Selected</span>
          </div>

          {displayMode === 'threshold' ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 rounded bg-indigo-500 opacity-65" />
                <span className="text-[10px] font-medium text-slate-600">Road geometry</span>
              </div>
              {highlightEnabled && (
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-5 rounded bg-red-500" />
                  <span className="text-[10px] font-bold text-red-600">Threshold Met</span>
                </div>
              )}
            </>
          ) : displayMode === 'dominant' ? (
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l border-slate-200 pl-4 ml-1">
                {(Object.keys(DOMINANT_COLORS) as DominantCondition[]).map(cond => (
                   <div key={cond} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOMINANT_COLORS[cond] }} />
                      <span className="text-[10px] font-semibold text-slate-600">{cond}</span>
                      <span className="font-mono text-[9px] text-slate-400">({dominantCounts[cond]})</span>
                   </div>
                ))}
             </div>
          ) : (
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l border-slate-200 pl-4 ml-1">
                {Object.entries(RULE_CATEGORY_COLORS).map(([cat, color]) => {
                   let count = 0;
                   if (dd2Data?.ruleStats) {
                      if (cat === 'Pemeliharaan Rutin') count = dd2Data.ruleStats.rutin;
                      else if (cat === 'Pemeliharaan Berkala') count = dd2Data.ruleStats.berkala;
                      else if (cat === 'Rehabilitasi / Rekonstruksi Indikatif') count = (dd2Data.ruleStats.rehab || 0) + (dd2Data.ruleStats.rekon || 0);
                      else if (cat === 'Kandidat Peningkatan Permukaan') count = dd2Data.ruleStats.peningkatan;
                      else if (cat === 'Data Tidak Cukup') count = dd2Data.ruleStats.insufficientData;
                   }
                   return (
                     <div key={cat} className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-semibold text-slate-600">{cat}</span>
                        <span className="font-mono text-[9px] text-slate-400">({count})</span>
                     </div>
                   );
                })}
             </div>
          )}
          
          <span className="ml-auto text-[9px] text-slate-400">
            {geos.length > 0 ? `${geos.length} geometries loaded` : ''}
          </span>
        </div>
      </div>

      {/* ── Extracted Read-only DD2 Table ────────────────────────────────────── */}
      <div className="mb-4">
        <TreatmentFiltersPanel
          filterAsbType={filterAsbType}
          setFilterAsbType={setFilterAsbType}
          filterRuleId={filterRuleId}
          setFilterRuleId={setFilterRuleId}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterNonMantap={filterNonMantap}
          setFilterNonMantap={setFilterNonMantap}
          onClearAll={() => {
            setFilterAsbType('All');
            setFilterRuleId('All');
            setFilterStatus('All');
            setFilterNonMantap('All');
            setSearchTerm('');
          }}
          isFiltered={filterAsbType !== 'All' || filterRuleId !== 'All' || filterStatus !== 'All' || filterNonMantap !== 'All' || searchTerm !== ''}
          totalFiltered={filteredTableData.length}
          totalRoads={dd2Data?.roads.length || 0}
        />
      </div>

      {/* ── Phase 5: Scenario Panel ──────────────────────────────────────────── */}
      <ScenarioPanel
        candidateBasket={candidateBasket}
        planningNotes={planningNotes}
        scenarioKecamatanSummary={scenarioKecamatanSummary.items}
        scenarioKecamatanSummaryHasMultiKecamatanRoads={scenarioKecamatanSummary.hasMultiKecamatanRoads}
        optimizationRoadLookup={optimizationRoadLookup}
        optimizationHistoryLookup={optimizationHistoryLookup}
        removeFromCandidateBasket={removeFromCandidateBasket}
        setCandidateStatus={setCandidateStatus}
        onSelectRoad={selectRoadFromScenario}
        onClearScenario={clearCandidateBasket}
        onSyncScenario={handleSyncScenario}
      />

      <TreatmentRoadTable
        dd2Data={dd2Data}
        filteredTableData={filteredTableData}
        paginatedTableData={paginatedTableData}
        selectedDd2Feature={selectedDd2Feature}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        roadKeyToGeoKeyMap={roadKeyToGeoKeyMap}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        pageSize={pageSize}
        setPageSize={setPageSize}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isSelectedRoadFilteredOut={isSelectedRoadFilteredOut}
      />

      {/* ── Implementation roadmap ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Conceptual Flow</h3>
          <p className="mt-0.5 text-xs text-slate-500">Current academic consultation flow for the Treatment Engine</p>
        </div>
        <div className="divide-y divide-slate-50">
          {NEXT_STEPS.map((item, idx) => {
            const style = STATUS_STYLES[item.status];
            return (
              <div key={item.step} className="flex items-start gap-4 px-5 py-4">
                {/* Timeline */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className={`h-3 w-3 rounded-full ${style.dot} ring-4 ring-white`} />
                  {idx < NEXT_STEPS.length - 1 && (
                     <div className={`h-full w-px flex-1 ${item.status === 'done' ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                  )}
                </div>
                {/* Icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === 'done' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <item.icon className={`h-4 w-4 ${item.status === 'done' ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="mr-1.5 font-mono text-xs text-slate-400">{item.step}.</span>
                      {item.label}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
                      {item.status === 'done' ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Identity rules reminder ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Utility features: <span className="font-medium text-slate-700">Sync ASB Snapshot</span> and <span className="font-medium text-slate-700">Export Scenario JSON</span> are available in the scenario panel, but they are not part of the academic flowchart.
        <div className="mt-2">
          Future roadmap only: Kecamatan linkage, spatial equity/distribution analysis, and constrained multi-objective optimization.
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="text-xs leading-relaxed text-blue-700">
          <span className="font-semibold">Identity Rule Reminder:</span>{' '}
          All road matching must follow{' '}
          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[10px]">
            DATA_IDENTITY_RULES.md
          </code>
          . Logical road universe = <strong>350</strong>. Use canonical{' '}
          <code className="font-mono text-[10px]">nama_ruas_norm</code> /{' '}
          <code className="font-mono text-[10px]">road_key</code> identity. Do not use{' '}
          <code className="font-mono text-[10px]">road_id</code> as cross-scenario identity.
        </div>
      </div>
      
      {/* ── Extracted ASB Type Guide Modal Component ─────────────────────────── */}
      <ASBTypeGuide 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

    </div>
  );
}
