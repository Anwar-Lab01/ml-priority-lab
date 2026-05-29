import { useState, useMemo } from 'react';
import { Search, X, Plus, Trash2 } from 'lucide-react';
import type { 
  HPSCatalogItem, 
  SelectedHPSItem, 
  HPSItemRole 
} from '../../../../lib/treatmentTypes';

interface HPSCatalogEditorProps {
  hpsItems: HPSCatalogItem[];
  initialDraftItems: SelectedHPSItem[];
  onSave: (items: SelectedHPSItem[]) => void;
  onCancel: () => void;
}

export function HPSCatalogEditor({ hpsItems, initialDraftItems, onSave, onCancel }: HPSCatalogEditorProps) {
  const [draftItems, setDraftItems] = useState<SelectedHPSItem[]>(initialDraftItems);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterFamily, setFilterFamily] = useState('All');
  const [filterSatuan, setFilterSatuan] = useState('All');

  const divisions = useMemo(() => ['All', ...Array.from(new Set(hpsItems.map(i => String(i.division_code)).filter(Boolean)))].sort(), [hpsItems]);
  const families = useMemo(() => ['All', ...Array.from(new Set(hpsItems.map(i => i.item_family as string).filter(Boolean)))].sort(), [hpsItems]);
  const satuans = useMemo(() => ['All', ...Array.from(new Set(hpsItems.map(i => i.satuan as string).filter(Boolean)))].sort(), [hpsItems]);

  const filteredCatalog = useMemo(() => {
    return hpsItems.filter(item => {
      if (filterDivision !== 'All' && String(item.division_code) !== filterDivision) return false;
      if (filterFamily !== 'All' && item.item_family !== filterFamily) return false;
      if (filterSatuan !== 'All' && item.satuan !== filterSatuan) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesUraian = item.uraian.toLowerCase().includes(q);
        const matchesCode = (item.payment_code || '').toLowerCase().includes(q);
        return matchesUraian || matchesCode;
      }
      return true;
    }).slice(0, 50); // limit for performance
  }, [hpsItems, searchQuery, filterDivision, filterFamily, filterSatuan]);

  const handleAddItem = (item: HPSCatalogItem) => {
    const newItem: SelectedHPSItem = {
      id: Math.random().toString(36).substring(2, 9),
      source: 'catalog',
      hps_id: item.hps_id,
      payment_code: item.payment_code,
      uraian: item.uraian,
      satuan: item.satuan,
      harga_rp: item.harga_rp,
      quantity: null,
      subtotal_rp: null,
      role: 'primary',
      notes: ''
    };
    setDraftItems([...draftItems, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setDraftItems(draftItems.filter(item => item.id !== id));
  };

  const handleRoleChange = (id: string, role: HPSItemRole) => {
    setDraftItems(draftItems.map(item => item.id === id ? { ...item, role } : item));
  };

  const handleQuantityChange = (id: string, qtyStr: string) => {
    setDraftItems(draftItems.map(item => {
      if (item.id !== id) return item;
      
      const qty = qtyStr === '' ? null : parseFloat(qtyStr);
      let subtotal_rp = null;
      if (qty !== null && qty > 0 && !isNaN(qty)) {
        subtotal_rp = qty * item.harga_rp;
      }
      return { ...item, quantity: isNaN(qty as any) ? null : qty, subtotal_rp };
    }));
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-slate-800 text-sm">Manual HPS Item Editor</h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>

      {/* Selected Items */}
      <div className="bg-white border border-indigo-100 rounded p-3 shadow-sm">
        <h5 className="text-xs font-semibold text-indigo-800 mb-2 uppercase tracking-wide flex items-center gap-2">
          Selected Items <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[9px]">{draftItems.length}</span>
        </h5>
        {draftItems.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Belum ada item terpilih.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {draftItems.map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold text-slate-700 line-clamp-1">{item.payment_code} - {item.uraian}</p>
                  <p className="text-slate-500 mt-0.5">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.harga_rp)} / {item.satuan}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <input 
                      type="number" 
                      step="any"
                      min="0"
                      placeholder="Qty"
                      value={item.quantity ?? ''}
                      onChange={e => handleQuantityChange(item.id, e.target.value)}
                      className="w-16 text-xs border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div className="w-24 text-right font-medium text-slate-800 text-[11px] truncate" title={item.subtotal_rp !== null ? String(item.subtotal_rp) : ''}>
                    {item.subtotal_rp !== null 
                      ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.subtotal_rp)
                      : <span className="text-slate-400 italic font-normal">No Qty</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <select 
                    value={item.role} 
                    onChange={e => handleRoleChange(item.id, e.target.value as HPSItemRole)}
                    className="text-[10px] border border-slate-200 rounded p-1 bg-white"
                  >
                    <option value="primary">Primary</option>
                    <option value="support">Support</option>
                    <option value="optional">Optional</option>
                  </select>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog Selector */}
      <div className="bg-white border border-slate-200 rounded p-3 shadow-sm flex flex-col gap-3">
        <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Catalog Search</h5>
        
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search uraian or payment code..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white min-w-[100px]">
            <option value="All">All Divisions</option>
            {divisions.filter(d => d !== 'All').map(d => <option key={d} value={d}>Div {d}</option>)}
          </select>
          <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white min-w-[100px]">
            <option value="All">All Families</option>
            {families.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterSatuan} onChange={e => setFilterSatuan(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white min-w-[100px]">
            <option value="All">All Units</option>
            {satuans.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="max-h-64 overflow-y-auto border border-slate-100 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 shadow-sm">
              <tr>
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium">Uraian</th>
                <th className="p-2 font-medium">Div/Fam</th>
                <th className="p-2 font-medium text-right">Harga</th>
                <th className="p-2 font-medium w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCatalog.length > 0 ? filteredCatalog.map(item => (
                <tr key={item.hps_id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-slate-500">{item.payment_code || '-'}</td>
                  <td className="p-2 font-medium text-slate-800 line-clamp-2 max-w-[250px]" title={item.uraian}>{item.uraian}</td>
                  <td className="p-2 text-slate-500 text-[10px]">{item.division_code} • {item.item_family}</td>
                  <td className="p-2 text-right">
                    <span className="font-medium text-slate-700">
                      {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(item.harga_rp)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">/ {item.satuan}</span>
                  </td>
                  <td className="p-2 text-center">
                    <button 
                      onClick={() => handleAddItem(item)}
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-1.5 rounded"
                      title="Add Item"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">No items match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredCatalog.length === 50 && (
            <div className="p-2 text-center text-[10px] text-amber-600 bg-amber-50">
              Showing top 50 matches. Please refine your search.
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => onSave(draftItems)} className="px-4 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
          Save Override
        </button>
      </div>
    </div>
  );
}
