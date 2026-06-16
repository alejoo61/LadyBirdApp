// components/MaintenancePage.tsx
'use client';

import { useState, useEffect } from 'react';
import { Wrench, AlertTriangle, CheckCircle, Clock, Search, Filter } from 'lucide-react';
import { storesApi } from '@/services/api';
import type { Store } from '@/services/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://16.59.148.109:3001/api';

interface MaintenanceRequest {
  id:               string;
  equipmentId:      string;
  storeId:          string;
  urgency:          'low' | 'medium' | 'high' | 'critical';
  status:           'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  description:      string;
  requestedByEmail: string;
  assignedGmEmail:  string | null;
  createdAt:        string;
  updatedAt:        string;
  equipment?: { equipmentCode: string; name: string; type: string; };
  store?:     { name: string; code: string; };
}

const URGENCY_STYLES: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600',
  assigned:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export default function MaintenancePage() {
  const [requests, setRequests]         = useState<MaintenanceRequest[]>([]);
  const [stores, setStores]             = useState<Store[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('');
  const [search, setSearch]             = useState('');
  const [showToast, setShowToast]       = useState<string | null>(null);

  useEffect(() => {
    storesApi.getAll({ active: true }).then(res => setStores(res.data.data)).catch(console.error);
    loadRequests();
  }, []);

  const toast = (msg: string) => { setShowToast(msg); setTimeout(() => setShowToast(null), 3000); };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/maintenance`);
      const data = await res.json();
      if (data.success) setRequests(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res  = await fetch(`${API_BASE}/maintenance/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { toast('Status updated'); loadRequests(); }
    } catch (e) { console.error(e); }
  };

  const filtered = requests.filter(r => {
    if (selectedStore  && r.storeId !== selectedStore)      return false;
    if (selectedStatus && r.status  !== selectedStatus)     return false;
    if (selectedUrgency && r.urgency !== selectedUrgency)   return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.equipment?.equipmentCode?.toLowerCase().includes(q) ||
        r.equipment?.name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.requestedByEmail?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    pending:     requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    critical:    requests.filter(r => r.urgency === 'critical').length,
    completed:   requests.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="space-y-6 relative">
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-bold text-sm uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Maintenance</h2>
        <p className="text-sm text-night/50 font-medium">{requests.length} total requests</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending',     count: counts.pending,     color: 'bg-gray-100',   text: 'text-gray-700',   icon: Clock        },
          { label: 'In Progress', count: counts.in_progress, color: 'bg-yellow-100', text: 'text-yellow-700', icon: Wrench       },
          { label: 'Critical',    count: counts.critical,    color: 'bg-red-100',    text: 'text-red-700',    icon: AlertTriangle},
          { label: 'Completed',   count: counts.completed,   color: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle  },
        ].map(({ label, count, color, text, icon: Icon }) => (
          <div key={label} className={`${color} rounded-2xl p-5 flex items-center gap-4`}>
            <Icon size={24} className={text} />
            <div>
              <div className={`text-2xl font-black ${text}`}>{count}</div>
              <div className={`text-[10px] font-black uppercase tracking-widest ${text} opacity-70`}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed flex flex-col md:flex-row gap-3 items-center">
        <div className="flex-1 flex items-center gap-2 bg-bone rounded-xl px-3">
          <Search size={16} className="text-night/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment, description..."
            className="flex-1 p-3 bg-transparent outline-none text-sm font-bold text-night" />
        </div>
        <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night appearance-none">
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night appearance-none">
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={selectedUrgency} onChange={e => setSelectedUrgency(e.target.value)} className="p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night appearance-none">
          <option value="">All Urgency</option>
          {['low','medium','high','critical'].map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
        </select>
        <button onClick={() => { setSelectedStore(''); setSelectedStatus(''); setSelectedUrgency(''); setSearch(''); }}
          className="flex items-center gap-2 px-4 py-3 bg-bone rounded-xl text-xs font-black text-night/50 uppercase tracking-widest hover:text-night transition-colors">
          <Filter size={14} /> Clear
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-night/30">
          <Wrench size={48} className="mb-4 opacity-30" />
          <p className="font-black uppercase tracking-widest text-sm">No maintenance requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white border border-tumbleweed rounded-[2rem] p-6 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`p-3 rounded-2xl shrink-0 ${r.urgency === 'critical' ? 'bg-red-100' : r.urgency === 'high' ? 'bg-orange-100' : 'bg-bone'}`}>
                    <Wrench size={20} className={r.urgency === 'critical' ? 'text-red-600' : r.urgency === 'high' ? 'text-orange-500' : 'text-night/40'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-black text-night text-sm">{r.equipment?.equipmentCode || '—'}</span>
                      <span className="text-night/40 text-xs">·</span>
                      <span className="text-night/60 text-sm font-semibold">{r.equipment?.name || '—'}</span>
                    </div>
                    <p className="text-sm text-night/70 mb-2 line-clamp-2">{r.description}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-night/40 font-bold uppercase tracking-widest">
                      <span>{r.store?.name}</span>
                      <span>·</span>
                      <span>{r.requestedByEmail}</span>
                      <span>·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${URGENCY_STYLES[r.urgency]}`}>
                    {r.urgency}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>

                  {/* Status actions */}
                  {r.status === 'pending' && (
                    <button onClick={() => updateStatus(r.id, 'in_progress')}
                      className="px-3 py-1.5 bg-night text-bone rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-night/80 transition-all">
                      Start
                    </button>
                  )}
                  {r.status === 'in_progress' && (
                    <button onClick={() => updateStatus(r.id, 'completed')}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all">
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}