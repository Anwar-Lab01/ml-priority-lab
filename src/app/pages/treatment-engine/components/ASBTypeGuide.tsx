import { X, AlertTriangle } from 'lucide-react';
import { ASB_TYPE_GUIDE } from '../../../../lib/treatmentEngine';

interface ASBTypeGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ASBTypeGuide({ isOpen, onClose }: ASBTypeGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Panduan Tipe ASB</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Daftar referensi paket standar dan pendukung berdasarkan ASB BM 2027.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2 pb-1 border-b border-indigo-100">Paket Utama (Jalan)</h4>
              <div className="space-y-2">
                {Object.keys(ASB_TYPE_GUIDE).filter(k => !ASB_TYPE_GUIDE[k].isSupport).map(key => (
                  <div key={key} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 font-black text-xs">
                        {key}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{ASB_TYPE_GUIDE[key].label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[10px]">
                          <div>
                            <p className="font-semibold text-slate-500 uppercase text-[8px] tracking-wider">Komposisi</p>
                            <p className="text-slate-700 mt-0.5">{ASB_TYPE_GUIDE[key].composition}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-500 uppercase text-[8px] tracking-wider">Kegunaan Indikatif</p>
                            <p className="text-slate-700 mt-0.5">{ASB_TYPE_GUIDE[key].use}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2 pb-1 border-b border-amber-100 flex items-center gap-2">
                Paket Pendukung / Manual Only
                <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">Special</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(ASB_TYPE_GUIDE).filter(k => ASB_TYPE_GUIDE[k].isSupport).map(key => (
                  <div key={key} className="bg-amber-50/30 border border-amber-100/60 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">
                        {key}
                      </span>
                      <p className="font-bold text-slate-800 text-[11px] leading-tight">{ASB_TYPE_GUIDE[key].label.replace(/^[A-Z] — /, '')}</p>
                    </div>
                    <p className="text-[9px] text-slate-600 pl-7">{ASB_TYPE_GUIDE[key].use}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-center">
          <p className="text-[10px] text-slate-500 italic">
            <AlertTriangle className="inline h-3 w-3 mr-1 text-amber-500 relative -top-0.5" />
            Estimasi kewajaran anggaran indikatif berdasarkan ASB BM 2027. Bukan RAB final atau DED teknis.
          </p>
        </div>
      </div>
    </div>
  );
}
