import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppData } from '../../hooks/useAppData';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { isTargetPositive, isTargetKnown } from '../../lib/utils';
import {
  buildMapExplorerRankingLookup,
  matchMapExplorerRoad,
  type MapExplorerDiagnosticsRow,
  type MapExplorerMatchMethod,
} from '../../lib/mapExplorerMatching';

// Setup basic map interfaces
interface Coordinate {
  0: number; // lat
  1: number; // lng
}
interface MapGeo {
  legacy_ref: string | null;
  road_id: number | null;
  road_name: string;
  matched_name: string | null;
  score: number | null;
  geometry_type: string;
  coordinates: Coordinate[];
}
interface BgRoad {
  id: string;
  name: string;
  coordinates: Coordinate[];
}
interface MapExplorerFeature {
  geo: MapGeo;
  rank: number | null;
  score: number | null;
  planned: number | null;
  isMatched: boolean;
  matchMethod: MapExplorerMatchMethod;
  matchedRankingName: string | null;
  matchedRankingKey: string | null;
  diagnostics: MapExplorerDiagnosticsRow;
  layerKey: string;
}
interface MapConfig {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  showZoomControl?: boolean;
}

// Custom hook to fetch map static data
function useMapData() {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [geos, setGeos] = useState<MapGeo[]>([]);
  const [bgs, setBgs] = useState<BgRoad[]>([]);
  const [basemapConfig, setBasemapConfig] = useState<{ enableEsri?: boolean; [key: string]: any } | null>(null);
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');

  useEffect(() => {
    async function load() {
      setStatus('loading');
      try {
        const [resCfg, resGeo, resBg, resBasemap] = await Promise.all([
          fetch('/data/maps/map-config.json'),
          fetch('/data/maps/road-geometries.json'),
          fetch('/data/maps/background-roads.json'),
          fetch('/data/maps/basemap-config.json').catch(() => null) // Optional
        ]);
        if (!resCfg.ok || !resGeo.ok || !resBg.ok) throw new Error('Failed to load map data');
        
        setConfig(await resCfg.json());
        setGeos(await resGeo.json());
        setBgs(await resBg.json());
        
        if (resBasemap && resBasemap.ok) {
          try { setBasemapConfig(await resBasemap.json()); } catch (e) {}
        }
        
        setStatus('done');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }
    load();
  }, []);

  return { config, geos, bgs, basemapConfig, status };
}

// Map Controls component (children of MapContainer for useMap access)
function MapDynamicControls({ 
  mapFeatures, 
  defaultCenter, 
  defaultZoom 
}: { 
  mapFeatures: any[], 
  defaultCenter: [number, number], 
  defaultZoom: number 
}) {
  const map = useMap();

  const handleReset = () => {
    map.setView(defaultCenter, defaultZoom, { animate: true });
  };

  const handleFitVisible = () => {
    if (mapFeatures.length > 0) {
      const allCoords = mapFeatures.flatMap(f => f.geo.coordinates);
      if (allCoords.length > 0) {
        map.fitBounds(allCoords as any, { padding: [20, 20], maxZoom: 15, animate: true });
      }
    }
  };

  return (
    <div className="absolute top-4 left-14 z-[1000] flex gap-2">
      <button 
        onClick={handleReset}
        className="bg-white/95 backdrop-blur shadow-md px-3 py-1.5 rounded text-[11px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
      >
        Reset View
      </button>
      <button 
        onClick={handleFitVisible}
        className="bg-white/95 backdrop-blur shadow-md px-3 py-1.5 rounded text-[11px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
      >
        Fit Visible Roads
      </button>
    </div>
  );
}

export function MapExplorerPage() {
  const { data: appData, status: appStatus } = useAppData();
  const { config, geos, bgs, basemapConfig, status: mapStatus } = useMapData();

  // State: Basemap
  const [activeBasemap, setActiveBasemap] = useState<'osm'|'satellite'|'esri-streets'|'esri-imagery'>('osm');

  // State: Controls
  const [scenario, setScenario] = useState<string>('');
  const [model, setModel] = useState<string>('');
  
  // State: Filters
  const [showMatchedOnly, setShowMatchedOnly] = useState(false);
  const [showTop30, setShowTop30] = useState(false);
  const [showTop10, setShowTop10] = useState(false);
  const [highlightPlanned, setHighlightPlanned] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // State: Interaction
  const [selectedRoad, setSelectedRoad] = useState<string | null>(null);

  // Initialize scenario/model
  useEffect(() => {
    if (appData && !scenario && appData.detectedScenarios.length > 0) {
      setScenario(appData.detectedScenarios[0]);
      setModel(appData.detectedModels[0] ?? 'XGBoost');
    }
  }, [appData, scenario]);

  // Combine geometries with ranking data
  const { mapFeatures, counters, diagnosticsRows } = useMemo(() => {
    if (!appData || !scenario || !model || !geos.length) {
      return {
        mapFeatures: [] as MapExplorerFeature[],
        counters: {
          total: 0,
          matched: 0,
          unmatched: 0,
          ambiguous: 0,
          direct: 0,
          alias: 0,
          manualAlias: 0,
          manualRefAlias: 0,
          matchedName: 0,
          top30: 0,
          top10: 0,
        },
        diagnosticsRows: [] as MapExplorerDiagnosticsRow[],
      };
    }
    
    const ranks = (appData.indexes.rankingsByScenario.get(scenario) || []).filter(r => r.model === model);
    const rankingLookup = buildMapExplorerRankingLookup(ranks);

    let features = geos.map((geo, index) => {
      const match = matchMapExplorerRoad(geo.legacy_ref, geo.road_name, geo.matched_name, rankingLookup);
      const rankingRow = match.rankingRow;

      return {
        geo,
        rank: rankingRow?.rank ?? null,
        score: rankingRow?.score ?? null,
        planned: rankingRow?.planned_any_2026 ?? null,
        isMatched: !!rankingRow,
        matchMethod: match.matchMethod,
        matchedRankingName: match.diagnostics.matchedRankingName,
        matchedRankingKey: match.diagnostics.matchedRankingKey,
        diagnostics: match.diagnostics,
        layerKey: `road-${geo.legacy_ref || geo.road_id || index}`
      };
    });

    // Apply filters
    if (showMatchedOnly) features = features.filter(f => f.isMatched);
    if (showTop30) features = features.filter(f => f.rank !== null && f.rank <= 30);
    if (showTop10) features = features.filter(f => f.rank !== null && f.rank <= 10);
    if (highlightPlanned) features = features.filter(f => isTargetPositive(f.planned));
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      features = features.filter(f => f.geo.road_name.toLowerCase().includes(q) || (f.geo.matched_name && f.geo.matched_name.toLowerCase().includes(q)));
    }
    
    // Calculate counters for currently visible features
    let matchedCount = 0;
    let unmatchedCount = 0;
    let ambiguousCount = 0;
    let directCount = 0;
    let aliasCount = 0;
    let manualAliasCount = 0;
    let manualRefAliasCount = 0;
    let matchedNameCount = 0;
    let top30Count = 0;
    let top10Count = 0;
    
    features.forEach(f => {
      if (f.matchMethod === 'ambiguous') ambiguousCount++;
      else if (f.isMatched) matchedCount++;
      else unmatchedCount++;

      if (f.matchMethod === 'direct') directCount++;
      if (f.matchMethod === 'alias') aliasCount++;
      if (f.matchMethod === 'manual_alias') manualAliasCount++;
      if (f.matchMethod === 'manual_ref_alias') manualRefAliasCount++;
      if (f.matchMethod === 'matched_name') matchedNameCount++;
      
      if (f.rank !== null) {
        if (f.rank <= 30) top30Count++;
        if (f.rank <= 10) top10Count++;
      }
    });

    return { 
      mapFeatures: features, 
      diagnosticsRows: features.map(f => f.diagnostics),
      counters: { 
        total: features.length, 
        matched: matchedCount, 
        unmatched: unmatchedCount, 
        ambiguous: ambiguousCount,
        direct: directCount,
        alias: aliasCount,
        manualAlias: manualAliasCount,
        manualRefAlias: manualRefAliasCount,
        matchedName: matchedNameCount,
        top30: top30Count,
        top10: top10Count
      } 
    };
  }, [appData, scenario, model, geos, showMatchedOnly, showTop30, showTop10, highlightPlanned, searchTerm]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as any).__MAP_EXPLORER_DIAGNOSTICS__ = {
      scenario,
      model,
      summary: counters,
      rows: diagnosticsRows,
      unmatched: diagnosticsRows.filter((row) => row.matchMethod === 'unmatched'),
      ambiguous: diagnosticsRows.filter((row) => row.matchMethod === 'ambiguous'),
    };
  }, [scenario, model, counters, diagnosticsRows]);

  // Styling logic
  const getStyle = (f: MapExplorerFeature, isSelected: boolean) => {
    // Selected highlights
    if (isSelected) return { color: '#f59e0b', weight: 8, opacity: 1, zIndexOffset: 2000 };

    if (f.matchMethod === 'ambiguous') {
      return { color: '#f59e0b', weight: 3.5, opacity: 0.8, dashArray: '6 4' };
    }
    
    // Unmatched geometry
    if (!f.isMatched) return { color: '#94a3b8', weight: 2.5, opacity: 0.4, dashArray: '4 4' };
    
    // Top 10 -> Thick vibrant red
    if (f.rank && f.rank <= 10) return { color: '#dc2626', weight: 6, opacity: 0.95 };
    
    // Top 30 -> Medium prominent blue
    if (f.rank && f.rank <= 30) return { color: '#2563eb', weight: 4.5, opacity: 0.85 };
    
    // Standard matched (outside Top 30)
    return { color: '#475569', weight: 3, opacity: 0.6 };
  };

  if (appStatus === 'loading' || mapStatus === 'loading') return <LoadingState message="Loading spatial data..." />;
  if (appStatus === 'error') return <EmptyState title="App Error" message="Failed to load app data." />;
  if (mapStatus === 'error') return <EmptyState title="Map Error" message="Failed to load map data." />;
  if (!config) return <EmptyState />;

  const scenariosList = appData?.detectedScenarios.map(id => {
    const s = appData.scenarios.find(x => x.scenario_id === id);
    return { id, label: s ? s.scenario_label : id };
  }) || [];
  
  const selectedFeature = mapFeatures.find(f => f.layerKey === selectedRoad);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full -mx-8 -my-6">
      {/* Left Panel: Controls & Filters */}
      <div className="w-[340px] bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0 shadow-sm z-10">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800">Map Explorer</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Spatial Diagnostics</p>
        </div>
        
        {/* Statistics Counters */}
        <div className="p-4 space-y-2 border-b border-slate-100 bg-white">
           <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center">
                 <span className="block text-[9px] font-black uppercase text-slate-400">Total Visible</span>
                 <span className="text-sm font-bold text-slate-800">{counters.total}</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded p-2 text-center">
                 <span className="block text-[9px] font-black uppercase text-blue-400">Matched Base</span>
                 <span className="text-sm font-bold text-blue-800">{counters.matched}</span>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded p-2 text-center">
                 <span className="block text-[9px] font-black uppercase text-slate-400 opacity-80">Unmatched</span>
                 <span className="text-sm font-bold text-slate-600">{counters.unmatched}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded p-2 text-center">
                 <span className="block text-[9px] font-black uppercase text-amber-500">Ambiguous</span>
                 <span className="text-sm font-bold text-amber-700">{counters.ambiguous}</span>
              </div>
           </div>
           <div className="grid grid-cols-6 gap-1">
              <div className="bg-emerald-50 border border-emerald-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-emerald-500 leading-tight">Direct</span>
                <span className="text-xs font-bold text-emerald-800">{counters.direct}</span>
              </div>
              <div className="bg-cyan-50 border border-cyan-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-cyan-500 leading-tight">Alias</span>
                <span className="text-xs font-bold text-cyan-800">{counters.alias}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-amber-500 leading-tight">Manual</span>
                <span className="text-xs font-bold text-amber-800">{counters.manualAlias}</span>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-orange-500 leading-tight">Ref Manual</span>
                <span className="text-xs font-bold text-orange-800">{counters.manualRefAlias}</span>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-violet-500 leading-tight">Matched Name</span>
                <span className="text-xs font-bold text-violet-800">{counters.matchedName}</span>
              </div>
              <div className="bg-red-50 border border-red-100 rounded p-1 text-center flex flex-col justify-center">
                <span className="block text-[8px] font-black uppercase text-red-400 leading-tight">Top 10</span>
                <span className="text-xs font-bold text-red-800">{counters.top10}</span>
              </div>
           </div>
           <div className="bg-blue-50 border border-blue-100 rounded p-1 text-center flex flex-col justify-center">
              <span className="block text-[8px] font-black uppercase text-blue-500 leading-tight">Top 30</span>
              <span className="text-xs font-bold text-blue-800">{counters.top30}</span>
           </div>
        </div>

        <div className="p-5 space-y-5">
           <div className="space-y-3">
             <div>
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Analytical Scenario Overlay</label>
               <select value={scenario} onChange={e => setScenario(e.target.value)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-white p-2 outline-none">
                 {scenariosList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
               </select>
             </div>
             <div>
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Inference Model</label>
               <select value={model} onChange={e => setModel(e.target.value)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-white p-2 outline-none">
                 {appData?.detectedModels.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
             </div>
           </div>

           <div className="pt-4 border-t border-slate-100 space-y-3">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Basemap Preferences</label>
             <select value={activeBasemap} onChange={e => setActiveBasemap(e.target.value as any)} className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-white p-2 outline-none">
               <option value="osm">Terrain / Light (Default)</option>
               <option value="satellite">Satellite (Esri Imagery)</option>
               {basemapConfig?.enableEsri && <option value="esri-streets">Esri World Streets</option>}
               {basemapConfig?.enableEsri && <option value="esri-imagery">Esri World Imagery</option>}
             </select>
           </div>

           <div className="pt-4 border-t border-slate-100 space-y-3">
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Display Filters</label>
             <input type="text" placeholder="Search structures by name..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-slate-50" />
             
             <div className="space-y-2 mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showMatchedOnly} onChange={e=>setShowMatchedOnly(e.target.checked)} className="rounded text-blue-600 w-3.5 h-3.5" />
                  <span className="text-xs font-medium text-slate-600">Exclude Unmatched Geometries</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showTop30} onChange={e=>setShowTop30(e.target.checked)} className="rounded text-blue-600 w-3.5 h-3.5" />
                  <span className="text-xs font-medium text-slate-600">Isolate Top-30 Ranking Set</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showTop10} onChange={e=>setShowTop10(e.target.checked)} className="rounded text-blue-600 w-3.5 h-3.5" />
                  <span className="text-xs font-medium text-slate-600">Isolate Top-10 Ranking Set</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={highlightPlanned} onChange={e=>setHighlightPlanned(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5" />
                  <span className="text-xs font-medium text-slate-600">Overlay 2026 Targeted Plan</span>
                </label>
             </div>
           </div>
        </div>
        
        {/* Refined Legend */}
        <div className="mt-auto p-5 border-t border-slate-100 bg-white space-y-2.5 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
           <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Symbology</p>
           
           <div className="flex items-center gap-3">
              <div className="w-6 h-1.5 bg-red-600 rounded"></div>
              <span className="text-[10px] font-semibold text-slate-700">Top-10 Rank (High Priority)</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-6 h-1.5 bg-blue-600 rounded opacity-85"></div>
              <span className="text-[10px] font-semibold text-slate-700">Top-30 Rank (Medium Priority)</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-6 h-1 bg-slate-600 rounded opacity-60"></div>
              <span className="text-[10px] font-semibold text-slate-700">Matched Rank (Base Geometry)</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-6 h-1 bg-amber-500 rounded border-y border-amber-600 py-1" style={{ height: '6px' }}></div>
              <span className="text-[10px] font-semibold text-slate-700">Currently Selected Geometry</span>
           </div>
           <div className="flex items-center gap-3 opacity-60">
              <div className="w-6 h-[2px] border-t-2 border-dashed border-slate-400"></div>
              <span className="text-[10px] font-semibold text-slate-700">Unmatched / Orphaned Geometry</span>
           </div>
           <div className="flex items-center gap-3 opacity-80">
              <div className="w-6 h-[2px] border-t-2 border-dashed border-amber-500"></div>
              <span className="text-[10px] font-semibold text-slate-700">Ambiguous Candidate Match</span>
           </div>
           <div className="flex items-center gap-3 opacity-40">
              <div className="w-6 h-0.5 bg-slate-400 rounded"></div>
              <span className="text-[10px] font-semibold text-slate-700">Background Reference Context</span>
           </div>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative bg-slate-100 z-0">
         <MapContainer 
           center={config.center as any} 
           zoom={config.zoom} 
           minZoom={config.minZoom} 
           maxZoom={config.maxZoom} 
           zoomControl={config.showZoomControl ?? true}
           className="w-full h-full"
         >
           <MapDynamicControls 
              mapFeatures={mapFeatures} 
              defaultCenter={config.center} 
              defaultZoom={config.zoom} 
           />

           {activeBasemap === 'osm' && (
             <TileLayer
               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
             />
           )}
           {activeBasemap === 'satellite' && (
             <TileLayer
               attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
               url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
               maxZoom={18}
             />
           )}
           {activeBasemap === 'esri-streets' && (
             <TileLayer
               attribution='Tiles &copy; Esri'
               url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
             />
           )}
           {activeBasemap === 'esri-imagery' && (
             <TileLayer
               attribution='Tiles &copy; Esri'
               url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
             />
           )}
           
           {/* Background Reference Roads (Lowest Z-Index visually via ordering & styling) */}
           {bgs.map(bg => (
             <Polyline 
               key={bg.id} 
               positions={bg.coordinates as any} 
               pathOptions={{ color: '#94a3b8', weight: 1.5, opacity: 0.25 }}
             />
           ))}

           {/* Interactive Feature Roads */}
           {mapFeatures.map(f => {
              const isSelected = selectedRoad === f.layerKey;
              const style = getStyle(f, isSelected);
              
              return (
                 <Polyline 
                   key={f.layerKey}
                   positions={f.geo.coordinates as any}
                   pathOptions={style}
                   eventHandlers={{ click: () => setSelectedRoad(f.layerKey) }}
                 >
                   <Tooltip sticky>
                     <div className="text-xs font-mono font-bold leading-tight text-slate-700">
                        {f.geo.road_name} <br/>
                        <span className={f.isMatched ? "text-blue-600" : "text-slate-400 italic"}>
                           {f.isMatched
                             ? `${f.matchMethod.replace('_', ' ')} match • Rank ${f.rank || '>30'}`
                             : f.matchMethod === 'ambiguous'
                               ? 'Ambiguous geometry match'
                               : 'Unmatched Geometry'}
                        </span>
                     </div>
                   </Tooltip>
                 </Polyline>
              )
           })}
         </MapContainer>

         {/* Overlay Detail Panel */}
         {selectedFeature && (
           <div className="absolute top-4 right-4 w-80 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-slate-200 z-[1000] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
             <div className="flex justify-between items-start p-4 border-b border-slate-100">
               <div className="pr-2">
                 <h3 className="text-sm font-black text-slate-800 leading-snug">{selectedFeature.geo.road_name}</h3>
                 <div className="flex items-center gap-2 mt-1">
                   {selectedFeature.geo.legacy_ref && (
                     <span className="text-[9px] font-mono font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                       REF: {selectedFeature.geo.legacy_ref}
                     </span>
                   )}
                 </div>
               </div>
               <button onClick={() => setSelectedRoad(null)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 bg-slate-50 rounded hover:bg-slate-100 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>
             
             <div className="p-4 space-y-4">
                {selectedFeature.isMatched ? (
                  <>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Computed Rank</span>
                           <span className="text-2xl font-black text-blue-600">{selectedFeature.rank || '—'}</span>
                        </div>
                        <div>
                           <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Evaluated Score</span>
                           <span className="text-lg font-mono font-bold text-slate-700">
                             {selectedFeature.score !== null ? selectedFeature.score.toFixed(4) : 'N/A'}
                           </span>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                           <span className="block mb-1">Match Method</span>
                           <span className="text-[11px] font-bold normal-case tracking-normal text-slate-700">
                              {selectedFeature.matchMethod.replace('_', ' ')}
                           </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                           <span className="block mb-1">Matched Ranking</span>
                           <span className="text-[11px] font-bold normal-case tracking-normal text-slate-700">
                              {selectedFeature.matchedRankingName || '—'}
                           </span>
                        </div>
                     </div>
                     
                     <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed font-medium">
                        Geometry spatial alignment verified explicitly against priority records within the active analytical scenario constraints.
                     </div>

                     {isTargetPositive(selectedFeature.planned) && (
                        <div className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-2 rounded-lg border border-emerald-200 flex items-center gap-2">
                           <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                           Verified as Priority Target (2026 Plan)
                        </div>
                     )}
                     {!isTargetKnown(selectedFeature.planned) && (
                        <div className="bg-amber-50 text-amber-800 text-[11px] font-bold px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-2 mt-2">
                           <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           Target plan data unavailable for this scenario
                        </div>
                     )}
                  </>
                ) : selectedFeature.matchMethod === 'ambiguous' ? (
                  <div className="py-2 space-y-3">
                     <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="text-[11px] font-bold">Conservative match withheld</span>
                     </div>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        More than one ranking candidate is plausible for this geometry under the current conservative rules, so the road remains excluded until the naming conflict is resolved explicitly.
                     </p>
                  </div>
                ) : (
                  <div className="py-2 space-y-3">
                     <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="text-[11px] font-bold">No academic ranking match found</span>
                     </div>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        This road segment geometry lacks verifiable priority assessment data under the currently selected scenario configuration. This indicates data sparsity or structural isolation without baseline evaluation records.
                     </p>
                  </div>
                )}
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
