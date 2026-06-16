// app/equipment/[code]/page.tsx
// Página PÚBLICA — no requiere auth. Se abre al escanear el QR del equipo.

'use client';

import { useState, useEffect } from 'react';
import { useParams }           from 'next/navigation';
import { CheckCircle, AlertTriangle, Loader2, ArrowRightLeft, Wrench } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://16.59.148.109:3001/api';

interface EquipmentData {
  id:            string;
  equipmentCode: string;
  name:          string;
  type:          string;
  status:        string;
  isDown:        boolean;
  storeEmails:   string;
  store?: {
    id:   string;
    name: string;
    code: string;
  };
}

interface Store {
  id:   string;
  name: string;
  code: string;
}

type Mode = 'menu' | 'transfer' | 'maintenance' | 'success';

// Requerido para static export — los códigos se resuelven en el cliente
export function generateStaticParams() {
  return [];
}

export default function EquipmentQRPage() {
  const { code }                        = useParams<{ code: string }>();
  const [equipment, setEquipment]       = useState<EquipmentData | null>(null);
  const [stores, setStores]             = useState<Store[]>([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [mode, setMode]                 = useState<Mode>('menu');
  const [successMsg, setSuccessMsg]     = useState('');

  // Transfer form
  const [toStoreId, setToStoreId]       = useState('');
  const [isTemporary, setIsTemporary]   = useState(false);
  const [returnDate, setReturnDate]     = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferredBy, setTransferredBy]   = useState('');

  // Maintenance form
  const [reporterEmail, setReporterEmail]   = useState('');
  const [description, setDescription]       = useState('');
  const [urgency, setUrgency]               = useState<'low'|'medium'|'high'|'critical'>('medium');

  useEffect(() => {
    if (!code) return;
    Promise.all([
      fetch(`${API_BASE}/equipment/qr/${code}`).then(r => r.json()),
      fetch(`${API_BASE}/stores`).then(r => r.json()),
    ]).then(([eqRes, storesRes]) => {
      if (eqRes.success)     setEquipment(eqRes.data);
      else                   setError('Equipment not found');
      if (storesRes.success) setStores(storesRes.data);
    }).catch(() => setError('Failed to load equipment data'))
      .finally(() => setLoading(false));
  }, [code]);

  const handleTransfer = async () => {
    if (!toStoreId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/equipment/${equipment!.id}/transfer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toStoreId, isTemporary, returnDate: returnDate || null, reason: transferReason, transferredBy }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(isTemporary ? 'Equipment loaned successfully!' : 'Equipment transferred successfully!');
        setMode('success');
      } else {
        setError(data.error || 'Transfer failed');
      }
    } catch { setError('Transfer failed'); }
    finally  { setSubmitting(false); }
  };

  const handleMaintenanceReport = async () => {
    if (!reporterEmail || !description) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/maintenance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          equipmentId:       equipment!.id,
          storeId:           equipment!.store?.id,
          requestedByEmail:  reporterEmail,
          description,
          urgency,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Maintenance request submitted!');
        setMode('success');
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch { setError('Submission failed'); }
    finally  { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  if (error && !equipment) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Equipment not found</h2>
        <p className="text-gray-500 mt-2">Code: {code}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="bg-red-700 text-white rounded-xl p-5 mb-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest mb-1 opacity-75">Ladybird Taco</div>
          <div className="text-2xl font-black">{equipment?.equipmentCode}</div>
          <div className="text-lg mt-1">{equipment?.name}</div>
          <div className="text-sm opacity-75 mt-1">{equipment?.store?.name}</div>
          <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${equipment?.isDown ? 'bg-red-900 text-red-200' : 'bg-green-600 text-white'}`}>
            {equipment?.isDown ? '⚠ DOWN' : '✓ OPERATIONAL'}
          </div>
        </div>

        {/* SUCCESS */}
        {mode === 'success' && (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-800">{successMsg}</h2>
            <button onClick={() => setMode('menu')} className="mt-4 text-red-600 text-sm underline">Back</button>
          </div>
        )}

        {/* MENU */}
        {mode === 'menu' && (
          <div className="space-y-3">
            <button onClick={() => setMode('transfer')}
              className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:border-red-500 transition-colors">
              <div className="bg-red-100 p-3 rounded-lg"><ArrowRightLeft size={22} className="text-red-600" /></div>
              <div>
                <div className="font-bold text-gray-800">Transfer / Loan</div>
                <div className="text-sm text-gray-500">Move this equipment to another store</div>
              </div>
            </button>
            <button onClick={() => setMode('maintenance')}
              className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:border-yellow-500 transition-colors">
              <div className="bg-yellow-100 p-3 rounded-lg"><Wrench size={22} className="text-yellow-600" /></div>
              <div>
                <div className="font-bold text-gray-800">Report Issue</div>
                <div className="text-sm text-gray-500">Submit a maintenance request</div>
              </div>
            </button>
          </div>
        )}

        {/* TRANSFER FORM */}
        {mode === 'transfer' && (
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-red-600" /> Transfer / Loan
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your name</label>
              <input value={transferredBy} onChange={e => setTransferredBy(e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Destination store *</label>
              <select value={toStoreId} onChange={e => setToStoreId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
                <option value="">Select store...</option>
                {stores.filter(s => s.id !== equipment?.store?.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="temporary" checked={isTemporary} onChange={e => setIsTemporary(e.target.checked)}
                className="w-4 h-4 rounded text-red-600" />
              <label htmlFor="temporary" className="text-sm font-semibold text-gray-700">Temporary loan</label>
            </div>

            {isTemporary && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Return date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
              <input value={transferReason} onChange={e => setTransferReason(e.target.value)}
                placeholder="Why is this equipment being transferred?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setMode('menu'); setError(''); }}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button onClick={handleTransfer} disabled={!toStoreId || submitting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
                {submitting ? 'Submitting...' : isTemporary ? 'Loan Equipment' : 'Transfer Equipment'}
              </button>
            </div>
          </div>
        )}

        {/* MAINTENANCE FORM */}
        {mode === 'maintenance' && (
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Wrench size={20} className="text-yellow-600" /> Report Issue
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your email *</label>
              <input type="email" value={reporterEmail} onChange={e => setReporterEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Urgency</label>
              <div className="grid grid-cols-4 gap-2">
                {(['low','medium','high','critical'] as const).map(u => (
                  <button key={u} onClick={() => setUrgency(u)}
                    className={`py-2 rounded-lg text-xs font-bold capitalize border-2 transition-colors ${urgency === u
                      ? u === 'critical' ? 'bg-red-600 text-white border-red-600'
                        : u === 'high'   ? 'bg-orange-500 text-white border-orange-500'
                        : u === 'medium' ? 'bg-yellow-500 text-white border-yellow-500'
                        :                  'bg-green-500 text-white border-green-500'
                      : 'border-gray-200 text-gray-600'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description *</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 resize-none" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setMode('menu'); setError(''); }}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button onClick={handleMaintenanceReport} disabled={!reporterEmail || !description || submitting}
                className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}