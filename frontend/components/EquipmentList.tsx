// components/EquipmentList.tsx
'use client';

import { useState, useEffect } from 'react';
import { equipmentApi, storesApi } from '@/services/api';
import type { Equipment } from '@/services/api/equipmentApi';
import type { Store } from '@/services/api';
import { Plus, Package, CheckCircle, AlertTriangle, X } from 'lucide-react';
import EquipmentCard from './equipment/EquipmentCard';
import BatchModal    from './equipment/BatchModal';
import TransferModal from './equipment/TransferModal';
import HistoryModal  from './equipment/HistoryModal';

interface ApiError { response?: { data?: { error?: string } } }
interface EquipmentType { id: string; name: string; code: string; }

export default function EquipmentList() {
  const [equipment, setEquipment]       = useState<Equipment[]>([]);
  const [stores, setStores]             = useState<Store[]>([]);
  const [types, setTypes]               = useState<string[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showToast, setShowToast]     = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedType, setSelectedType]   = useState('');
  const [showOnlyDown, setShowOnlyDown]   = useState(false);

  // Modals
  const [editModal, setEditModal]         = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [batchModal, setBatchModal]       = useState(false);
  const [transferTarget, setTransferTarget] = useState<Equipment | null>(null);
  const [historyTarget, setHistoryTarget]   = useState<Equipment | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);
  const [errorMessage, setErrorMessage]   = useState('');

  const [formData, setFormData] = useState({ storeId: '', name: '', type: '', typeCode: '', yearCode: new Date().getFullYear().toString() });

  useEffect(() => {
    Promise.all([
      storesApi.getAll({ active: true }),
      equipmentApi.getTypes(),
      equipmentApi.getTypeCatalog(),
    ]).then(([sRes, tRes, catRes]) => {
      setStores(sRes.data.data);
      setTypes(tRes.data.data);
      setEquipmentTypes(catRes.data.data);
    }).catch(console.error);
  }, []);

  useEffect(() => { loadEquipment(); }, [selectedStore, selectedType, showOnlyDown]);

  const toast = (msg: string) => { setShowToast(msg); setTimeout(() => setShowToast(null), 3000); };

  const loadEquipment = async () => {
    setLoading(true);
    try {
      const params: { storeId?: string; type?: string; isDown?: boolean } = {};
      if (selectedStore) params.storeId = selectedStore;
      if (selectedType)  params.type    = selectedType;
      if (showOnlyDown)  params.isDown  = true;
      const res = await equipmentApi.getAll(params);
      setEquipment(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (editingId) { await equipmentApi.update(editingId, formData); toast('Asset updated'); }
      else           { await equipmentApi.create(formData);            toast('Asset created'); }
      setEditModal(false);
      loadEquipment();
    } catch (err: unknown) {
      const e = err as ApiError;
      setErrorMessage(e.response?.data?.error || 'Error processing request');
    } finally { setIsSubmitting(false); }
  };

  const handleBatch = async (data: { storeId: string; name: string; type: string; yearCode: string; quantity: number }) => {
    const res = await equipmentApi.createBatch(data);
    toast(`${res.data.count} assets created`);
    loadEquipment();
  };

  const handleTransfer = async (data: { toStoreId: string; isTemporary: boolean; returnDate?: string; reason?: string; transferredBy?: string }) => {
    if (!transferTarget) return;
    await equipmentApi.transfer(transferTarget.id, data);
    toast(data.isTemporary ? 'Equipment loaned' : 'Equipment transferred');
    loadEquipment();
  };

  const handleToggleStatus = async (id: string, isDown: boolean) => {
    try {
      isDown ? await equipmentApi.markAsOperational(id) : await equipmentApi.markAsDown(id);
      loadEquipment();
      toast('Status updated');
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      await equipmentApi.delete(deleteId);
      toast('Asset removed');
      setDeleteId(null);
      loadEquipment();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const handlePrint = (item: Equipment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrSvg = document.getElementById(`qr-${item.id}`)?.innerHTML || '';
    printWindow.document.write(`
      <html><head><title>Label ${item.equipmentCode}</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
      .label{border:2px solid #3E4850;padding:20px;width:300px;text-align:center;border-radius:15px;}
      .code{font-size:22px;font-weight:900;margin:10px 0;color:#3E4850;}.name{font-size:14px;font-weight:bold;color:#3E4850;}</style></head>
      <body><div class="label"><div>LADYBIRD ASSET</div><div class="code">${item.equipmentCode}</div>
      <div class="name">${item.name}</div><div>${qrSvg}</div></div>
      <script>setTimeout(()=>{window.print();window.close();},500);</script></body></html>
    `);
    printWindow.document.close();
  };

  const inputCls = 'w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night';

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-bold text-sm uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Equipment</h2>
          <p className="text-sm text-night/50 font-medium">{equipment.length} assets registered</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setBatchModal(true)}
            className="flex items-center gap-2 bg-white border-2 border-tumbleweed text-night hover:border-night transition-all px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-sm">
            <Package size={18} /> Batch
          </button>
          <button onClick={() => { setEditingId(null); setFormData({ storeId: '', name: '', type: '', typeCode: '', yearCode: new Date().getFullYear().toString() }); setErrorMessage(''); setEditModal(true); }}
            className="flex items-center gap-2 bg-night text-bone hover:bg-night/90 transition-all px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl">
            <Plus size={18} /> New Asset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed flex flex-col md:flex-row gap-4 items-center">
        <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="flex-1 p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night appearance-none">
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="flex-1 p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night appearance-none">
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 px-4 cursor-pointer">
          <input type="checkbox" checked={showOnlyDown} onChange={e => setShowOnlyDown(e.target.checked)} className="w-5 h-5 accent-rose rounded" />
          <span className="text-xs font-black text-night/60 uppercase tracking-widest">Only Down</span>
        </label>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">Loading assets...</div>
      ) : equipment.length === 0 ? (
        <div className="flex justify-center py-20 text-night/30 font-black uppercase tracking-widest">No assets found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipment.map(item => (
            <EquipmentCard
              key={item.id}
              item={item}
              onEdit={i => { setEditingId(i.id); setFormData({ storeId: i.storeId, name: i.name, type: i.type, typeCode: '', yearCode: i.yearCode }); setErrorMessage(''); setEditModal(true); }}
              onDelete={id => setDeleteId(id)}
              onToggleStatus={handleToggleStatus}
              onTransfer={i => setTransferTarget(i)}
              onHistory={i => setHistoryTarget(i)}
              onPrint={handlePrint}
            />
          ))}
        </div>
      )}

      {/* EDIT/CREATE MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bone rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border border-tumbleweed">
            <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50">
              <h3 className="text-2xl font-black text-night uppercase italic tracking-tighter">{editingId ? 'Edit Asset' : 'New Equipment'}</h3>
              <button onClick={() => setEditModal(false)} className="text-night/30 hover:text-rose transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-8 space-y-5">
              <select className={inputCls} value={formData.storeId} onChange={e => setFormData({ ...formData, storeId: e.target.value })} required>
                <option value="">Select Store...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div>
                <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">Equipment Type</label>
                <select className={inputCls}
                  value={formData.typeCode}
                  onChange={e => {
                    const t = equipmentTypes.find(x => x.code === e.target.value);
                    setFormData({ ...formData, typeCode: e.target.value, type: t?.name || '', name: t?.name || '' });
                  }} required>
                  <option value="">Select type...</option>
                  {equipmentTypes.map(t => <option key={t.id} value={t.code}>{t.name} ({t.code})</option>)}
                </select>
              </div>
              <input className={inputCls} placeholder="Year (e.g. 2026)" value={formData.yearCode} onChange={e => setFormData({ ...formData, yearCode: e.target.value })} required />
              {editingId && <p className="text-[10px] text-rose font-black uppercase tracking-wider ml-1">⚠ Changing store will regenerate the equipment code</p>}
              {errorMessage && <p className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-2xl border border-red-100">{errorMessage}</p>}
              <button disabled={isSubmitting} className="w-full py-5 bg-night text-bone rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all disabled:opacity-50">
                {isSubmitting ? 'Saving...' : editingId ? 'Update Asset' : 'Create Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteId && (
        <div className="fixed inset-0 bg-night/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 text-center border border-tumbleweed">
            <div className="w-20 h-20 bg-rose/20 text-rose rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black text-night mb-2 uppercase italic">Delete Asset?</h3>
            <p className="text-night/50 text-sm mb-8">This will permanently remove the asset and its QR code.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-4 bg-bone text-night/40 rounded-2xl font-black uppercase tracking-widest">Cancel</button>
              <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest disabled:opacity-50">
                {isSubmitting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH MODAL */}
      {batchModal && <BatchModal stores={stores} onClose={() => setBatchModal(false)} onSubmit={handleBatch} />}

      {/* TRANSFER MODAL */}
      {transferTarget && <TransferModal equipment={transferTarget} stores={stores} onClose={() => setTransferTarget(null)} onSubmit={handleTransfer} />}

      {/* HISTORY MODAL */}
      {historyTarget && <HistoryModal equipment={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}