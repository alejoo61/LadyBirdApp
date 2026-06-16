// components/equipment/BatchModal.tsx
'use client';

import { useState } from 'react';
import { X, Package } from 'lucide-react';
import type { Store } from '@/services/api';

interface Props {
  stores:      Store[];
  onClose:     () => void;
  onSubmit:    (data: { storeId: string; name: string; type: string; yearCode: string; quantity: number }) => Promise<void>;
}

export default function BatchModal({ stores, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    storeId:  '',
    name:     '',
    type:     '',
    yearCode: new Date().getFullYear().toString(),
    quantity: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ ...form, quantity: Number(form.quantity) });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Error creating batch');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night';

  return (
    <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bone rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border border-tumbleweed">
        <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-3">
            <Package size={22} className="text-rose" />
            <h3 className="text-2xl font-black text-night uppercase italic tracking-tighter">Batch Creation</h3>
          </div>
          <button onClick={onClose} className="text-night/30 hover:text-rose transition-colors"><X size={28} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">Store</label>
            <select className={inputCls} value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} required>
              <option value="">Select store...</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <input className={inputCls} placeholder="Equipment name (e.g. Tortilla Press)" value={form.name}     onChange={e => setForm({ ...form, name: e.target.value })}     required />
          <input className={inputCls} placeholder="Type (e.g. Kitchen)"                  value={form.type}     onChange={e => setForm({ ...form, type: e.target.value })}     required />
          <input className={inputCls} placeholder="Year (e.g. 2026)"                     value={form.yearCode} onChange={e => setForm({ ...form, yearCode: e.target.value })} required />

          <div>
            <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">
              Quantity (1–50)
            </label>
            <input
              type="number" min={1} max={50}
              className={inputCls}
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
              required
            />
            <p className="text-[10px] text-night/40 font-bold mt-2 ml-1">
              Will create {form.quantity} unit{form.quantity !== 1 ? 's' : ''} with sequential codes
            </p>
          </div>

          {error && <p className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-2xl border border-red-100">{error}</p>}

          <button disabled={submitting}
            className="w-full py-5 bg-night text-bone rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all active:scale-95 disabled:opacity-50">
            {submitting ? `Creating ${form.quantity} items...` : `Create ${form.quantity} Asset${form.quantity !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
}