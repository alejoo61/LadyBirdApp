// components/equipment/HistoryModal.tsx
'use client';

import { X, History, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import type { Equipment, TransferHistory } from '@/services/api/equipmentApi';
import { useEffect, useState } from 'react';
import equipmentApi from '@/services/api/equipmentApi';

interface Props {
  equipment: Equipment;
  onClose:   () => void;
}

export default function HistoryModal({ equipment, onClose }: Props) {
  const [history, setHistory] = useState<TransferHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    equipmentApi.getHistory(equipment.id)
      .then(res => setHistory(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [equipment.id]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bone rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden border border-tumbleweed max-h-[80vh] flex flex-col">
        <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50 shrink-0">
          <div className="flex items-center gap-3">
            <History size={22} className="text-rose" />
            <div>
              <h3 className="text-xl font-black text-night uppercase italic tracking-tighter">Transfer History</h3>
              <p className="text-[11px] text-night/40 font-bold">{equipment.equipmentCode} — {equipment.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-night/30 hover:text-rose transition-colors"><X size={28} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="text-center text-night/40 font-black uppercase tracking-widest text-xs py-10 animate-pulse">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-night/40 font-black uppercase tracking-widest text-xs py-10">No transfer history</div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => (
                <div key={h.id} className="bg-white border border-tumbleweed/50 rounded-2xl p-5">
                  {/* From → To */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 text-center">
                      <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">From</p>
                      <p className="font-bold text-night text-sm">{h.fromStore?.name || '—'}</p>
                      <p className="text-[10px] text-night/40">{h.fromStore?.code}</p>
                    </div>
                    <ArrowRight size={18} className="text-rose shrink-0" />
                    <div className="flex-1 text-center">
                      <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">To</p>
                      <p className="font-bold text-night text-sm">{h.toStore?.name || '—'}</p>
                      <p className="text-[10px] text-night/40">{h.toStore?.code}</p>
                    </div>
                  </div>

                  {/* Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      h.isTemporary ? 'bg-yellow-100 text-yellow-700' : 'bg-sky text-night'
                    }`}>
                      {h.isTemporary ? '⏱ Temporary Loan' : '✓ Permanent Transfer'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-[11px] text-night/50">
                    <div className="flex items-center gap-2">
                      <Clock size={11} />
                      <span>{formatDate(h.transferredAt)}</span>
                    </div>
                    {h.isTemporary && h.returnDate && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={11} />
                        <span>Return by: {formatDate(h.returnDate)}</span>
                      </div>
                    )}
                    {h.transferredBy && <div className="font-bold text-night/70">By: {h.transferredBy}</div>}
                    {h.reason && <div className="italic">{h.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}