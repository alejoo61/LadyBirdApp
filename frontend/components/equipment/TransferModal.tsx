// components/equipment/TransferModal.tsx
'use client';

import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import type { Equipment } from '@/services/api/equipmentApi';
import type { Store } from '@/services/api';

interface Props {
  equipment: Equipment;
  stores:    Store[];
  onClose:   () => void;
  onSubmit:  (data: { toStoreId: string; isTemporary: boolean; returnDate?: string; reason?: string; transferredBy?: string }) => Promise<void>;
}

export default function TransferModal({ equipment, stores, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    toStoreId:     '',
    isTemporary:   false,
    returnDate:    '',
    reason:        '',
    transferredBy: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ ...form, returnDate: form.returnDate || undefined });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night text-sm';
  const otherStores = stores.filter(s => s.id !== equipment.storeId);

  return (
    <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bone rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border border-tumbleweed">
        <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-3">
            <ArrowRightLeft size={22} className="text-rose" />
            <div>
              <h3 className="text-xl font-black text-night uppercase italic tracking-tighter">Transfer / Loan</h3>
              <p className="text-[11px] text-night/40 font-bold">{equipment.equipmentCode} — {equipment.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-night/30 hover:text-rose transition-colors"><X size={28} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {/* Current store */}
          <div className="bg-white border border-tumbleweed/50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-night/40 uppercase tracking-widest mb-1">Current Location</p>
            <p className="font-bold text-night">{equipment.store?.name || '—'}</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">Destination Store *</label>
            <select className={inputCls} value={form.toStoreId} onChange={e => setForm({ ...form, toStoreId: e.target.value })} required>
              <option value="">Select store...</option>
              {otherStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <input className={inputCls} placeholder="Your name" value={form.transferredBy} onChange={e => setForm({ ...form, transferredBy: e.target.value })} />

          <div className="flex items-center gap-3 px-1">
            <input type="checkbox" id="temp" checked={form.isTemporary} onChange={e => setForm({ ...form, isTemporary: e.target.checked })} className="w-5 h-5 rounded accent-rose" />
            <label htmlFor="temp" className="font-black text-sm text-night uppercase tracking-widest">Temporary Loan</label>
          </div>

          {form.isTemporary && (
            <div>
              <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">Return Date</label>
              <input type="date" className={inputCls} value={form.returnDate} onChange={e => setForm({ ...form, returnDate: e.target.value })} />
            </div>
          )}

          <input className={inputCls} placeholder="Reason (optional)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />

          {!form.isTemporary && (
            <p className="text-[10px] text-rose font-black uppercase tracking-widest px-1">
              ⚠ Permanent transfer — equipment code will be regenerated
            </p>
          )}

          {error && <p className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-2xl border border-red-100">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-tumbleweed text-night/50 rounded-2xl font-black uppercase tracking-widest text-sm">Cancel</button>
            <button disabled={!form.toStoreId || submitting}
              className="flex-1 py-4 bg-night text-bone rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 hover:bg-night/90 transition-all">
              {submitting ? 'Processing...' : form.isTemporary ? 'Loan' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}