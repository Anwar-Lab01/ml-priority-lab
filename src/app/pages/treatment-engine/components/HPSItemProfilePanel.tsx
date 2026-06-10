import React, { useState, useEffect } from 'react';
import type { 
  DD2RoadFeatureWithRule, 
  HPSProfileRule, 
  HPSCatalogItem,
  HPSManualOverride,
  SelectedHPSItem,
  HPSComparisonStatus
} from '../../../../lib/treatmentTypes';
import { HPSCatalogEditor } from './HPSCatalogEditor';

interface HPSItemProfilePanelProps {
  road: DD2RoadFeatureWithRule;
  override?: HPSManualOverride;
  onClearOverride?: () => void;
  onSaveOverride?: (override: HPSManualOverride) => void;
}

export const HPSItemProfilePanel: React.FC<HPSItemProfilePanelProps> = ({ road, override, onClearOverride, onSaveOverride }) => {
  const [hpsRules, setHpsRules] = useState<HPSProfileRule[]>([]);
  const [hpsItems, setHpsItems] = useState<HPSCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  // Determine ASB Type and Pagu
  const finalAsbBudget = road.final_asb_budget || road.asb_budget;
  const asbType = finalAsbBudget?.final_asb_type || finalAsbBudget?.asb_type;
  const asbPagu = finalAsbBudget?.final_pagu_indikatif_rp || finalAsbBudget?.pagu_indikatif_rp || null;
  
  useEffect(() => {
    const loadHPSData = async () => {
      try {
        const [rulesRes, itemsRes] = await Promise.all([
          fetch('/data/hps_item_profile_rules.json'),
          fetch('/data/hps_unit_prices.json')
        ]);
        
        if (rulesRes.ok && itemsRes.ok) {
          const rulesData = await rulesRes.json();
          const itemsData = await itemsRes.json();
          setHpsRules(rulesData.profiles || []);
          setHpsItems(itemsData.items || []);
        }
      } catch (err) {
        console.error('Failed to load HPS data', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadHPSData();
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Memuat profil HPS/AHSP untuk comparison/detail...</div>;
  }

  // Handle No Major Package
  if (!asbType || asbType === 'NONE' || asbType === 'no_major_asb_package') {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mt-4">
        <h3 className="font-semibold text-slate-800 mb-2">HPS/AHSP Item Profile</h3>
        <p className="text-sm text-slate-600">
          Tidak ada paket ASB mayor otomatis. HPS/AHSP tetap hanya pembanding/detail; ASB pagu indikatif tetap menjadi sumber budget.
        </p>
      </div>
    );
  }

  // Find matching profile based on asb_type
  const matchedProfile = hpsRules.find(p => p.asb_type === asbType);

  if (!matchedProfile) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mt-4">
        <h3 className="font-semibold text-slate-800 mb-2">HPS/AHSP Item Profile</h3>
        <p className="text-sm text-slate-600">
          Profil HPS/AHSP untuk ASB Tipe {asbType} belum tersedia sebagai layer comparison/detail.
        </p>
      </div>
    );
  }

  // Helper to match items for a rule
  const getMatchesForRule = (rule: any) => {
    return hpsItems.filter(item => {
      if (item.division_code !== rule.division_code) return false;
      if (item.item_family !== rule.item_family) return false;
      const uraianLower = item.uraian.toLowerCase();
      return rule.keywords_in_uraian.some((kw: string) => uraianLower.includes(kw.toLowerCase()));
    }).slice(0, 3);
  };

  const handleSaveEditor = (items: SelectedHPSItem[]) => {
    if (onSaveOverride) {
      let total_hps_estimate_rp: number | null = null;
      let hasValidSubtotal = false;
      let sum = 0;
      
      items.forEach(item => {
        if (item.subtotal_rp !== null && item.quantity !== null && item.quantity > 0) {
          sum += item.subtotal_rp;
          hasValidSubtotal = true;
        }
      });
      
      if (hasValidSubtotal) {
        total_hps_estimate_rp = sum;
      }

      onSaveOverride({
        road_key: road.road_key,
        is_active: true,
        final_hps_profile: matchedProfile?.profile_id || '',
        items,
        total_hps_estimate_rp,
        budget_source_preference: 'ASB_PAGU',
        hps_can_replace_asb: false,
        justification: '',
        updated_at: new Date().toISOString()
      });
    }
    setShowEditor(false);
  };

  let comparisonStatus: HPSComparisonStatus = 'profile_only';
  let ratioToAsb: number | null = null;

  if (override?.is_active) {
    if (override.total_hps_estimate_rp === null) {
      comparisonStatus = 'selected_no_quantity';
    } else {
      if (!asbPagu || asbPagu <= 0) {
        comparisonStatus = 'needs_review';
      } else {
        ratioToAsb = override.total_hps_estimate_rp / asbPagu;
        if (ratioToAsb >= 0.8 && ratioToAsb <= 1.15) comparisonStatus = 'within_reference';
        else if (ratioToAsb > 1.15) comparisonStatus = 'above_reference';
        else comparisonStatus = 'below_reference';
      }
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  const formatRatio = (val: number) => (val * 100).toFixed(1) + '%';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-4 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
            HPS/AHSP Item Profile
            {override?.is_active ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 tracking-wide uppercase">
                HPS Manual Override Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700 tracking-wide uppercase">
                Auto HPS Profile
              </span>
            )}
            {comparisonStatus === 'within_reference' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 tracking-wide uppercase">Within ASB Reference</span>}
            {comparisonStatus === 'above_reference' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 tracking-wide uppercase">Above ASB Reference</span>}
            {comparisonStatus === 'below_reference' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 tracking-wide uppercase">Below ASB Reference ⚠</span>}
            {comparisonStatus === 'selected_no_quantity' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 tracking-wide uppercase">Selected items — no quantity</span>}
            {comparisonStatus === 'needs_review' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 tracking-wide uppercase">Needs Review</span>}
          </h3>
          <p className="text-sm text-slate-500">
            ASB Tipe {asbType} • {matchedProfile.structural_profile}
          </p>
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
        <p className="text-sm text-slate-700 mb-3 font-medium">
          {matchedProfile.purpose}
        </p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-800 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Profil item HPS/AHSP bersifat indikatif, hanya untuk perbandingan/detail, dan tidak menggantikan ASB pagu indikatif, DED, atau RAB final.
          </p>
        </div>
        
        <div className="flex gap-2 mb-4">
          <button onClick={() => setShowEditor(true)} className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded font-bold hover:bg-indigo-700 uppercase tracking-wider">
            Edit HPS Items
          </button>
          {override?.is_active && (
            <button onClick={onClearOverride} className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded font-bold hover:bg-slate-200 uppercase tracking-wider">
              Clear HPS Override
            </button>
          )}
        </div>
        
        {showEditor && (
          <HPSCatalogEditor 
            hpsItems={hpsItems}
            initialDraftItems={override?.items || []}
            onSave={handleSaveEditor}
            onCancel={() => setShowEditor(false)}
          />
        )}
        
        {override?.is_active && (!override.items || override.items.length === 0) && (
          <div className="bg-slate-100 text-slate-600 text-xs p-2 rounded mb-4 font-medium border border-slate-200 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            HPS Manual Override Active — belum ada item yang dipilih.
          </div>
        )}

        {override?.is_active && override.items && override.items.length > 0 && comparisonStatus === 'selected_no_quantity' && (
          <div className="bg-amber-50 text-amber-800 text-xs p-2 rounded mb-4 font-medium border border-amber-200 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Item HPS telah dipilih, volume/quantity belum diisi (selected_no_quantity).
          </div>
        )}

        {comparisonStatus === 'below_reference' && (
          <div className="bg-amber-50 text-amber-800 text-xs p-2 rounded mb-4 font-medium border border-amber-200 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            Estimasi HPS di bawah referensi ASB. Item dan/atau volume mungkin belum lengkap.
          </div>
        )}

        {override?.is_active && override.items && override.items.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">Selected Override Items</h4>
            <div className="space-y-2 mb-3">
              {override.items.map(item => (
                <div key={item.id} className="bg-indigo-50/50 border border-indigo-100 rounded p-2 text-xs flex justify-between items-center">
                  <div className="flex-1 truncate pr-3" title={item.uraian}>
                    <span className="px-1.5 py-0.5 rounded bg-white border border-indigo-100 text-[9px] text-indigo-600 mr-2 uppercase tracking-wide">{item.role}</span>
                    <span className="text-slate-400 mr-2">{item.payment_code || '-'}</span>
                    <span className="font-medium text-slate-800">{item.uraian}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right w-32">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{formatCurrency(item.harga_rp)} / {item.satuan}</span>
                      <span className="font-medium text-slate-700">Qty: {item.quantity ?? '-'}</span>
                    </div>
                    <div className="text-right w-24">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Subtotal</span>
                      <span className="font-bold text-slate-800">{item.subtotal_rp !== null ? formatCurrency(item.subtotal_rp) : '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {override.total_hps_estimate_rp !== null && asbPagu !== null && (
              <div className="bg-white border border-indigo-200 rounded-lg p-3 flex justify-between items-center mt-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">ASB Pagu Indikatif</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(asbPagu)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Ratio to ASB</p>
                  <p className={`text-sm font-bold ${ratioToAsb && ratioToAsb > 1.15 ? 'text-rose-600' : ratioToAsb && ratioToAsb < 0.8 ? 'text-amber-600' : 'text-green-600'}`}>
                    {ratioToAsb !== null ? formatRatio(ratioToAsb) : '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider mb-1">Total HPS Estimate</p>
                  <p className="text-sm font-bold text-indigo-700">{formatCurrency(override.total_hps_estimate_rp)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suggested Items</h4>
          
          {matchedProfile.suggested_item_rules.map((rule, idx) => {
            const matches = getMatchesForRule(rule);
            
            return (
              <div key={idx} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="text-sm font-medium text-slate-800">{rule.description}</h5>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    rule.role === 'primary' ? 'bg-blue-100 text-blue-700' : 
                    rule.role === 'support' ? 'bg-indigo-100 text-indigo-700' : 
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {rule.role}
                  </span>
                </div>
                
                <div className="flex gap-2 text-[10px] text-slate-500 mb-3">
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">Basis: {rule.quantity_basis}</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">Div: {rule.division_code}</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">Family: {rule.item_family}</span>
                </div>
                
                {matches.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Katalog Matches</p>
                    {matches.map(m => (
                      <div key={m.hps_id} className="flex justify-between items-center bg-white border border-slate-100 rounded p-2 text-xs">
                        <div className="flex-1 truncate pr-3" title={m.uraian}>
                          <span className="text-slate-400 mr-2">{m.payment_code || '-'}</span>
                          <span className="text-slate-700">{m.uraian}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-medium text-slate-800">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(m.harga_rp)}
                          </span>
                          <span className="text-slate-400 text-[10px] ml-1">/ {m.satuan || 'Unit'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic mt-2">Belum tersedia pada katalog HPS saat ini</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
