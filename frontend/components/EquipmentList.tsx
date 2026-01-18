'use client';

import { useState, useEffect } from 'react';
import { equipmentApi, storesApi } from '@/services/api';
import type { Equipment, Store } from '@/services/api';
import { 
  Plus, HardDrive, Printer, Trash2, Edit3,
  X, AlertTriangle, CheckCircle, MapPin, Search
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface EquipmentFilters {
  storeId?: string;
  type?: string;
  isDown?: boolean;
}

interface ApiError {
  response?: {
    data?: { error?: string };
  };
}

export default function EquipmentList() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showOnlyDown, setShowOnlyDown] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    storeId: '',
    name: '',
    type: '',
    yearCode: new Date().getFullYear().toString()
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadEquipment();
  }, [selectedStore, selectedType, showOnlyDown]);

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const loadInitialData = async () => {
    try {
      const [storesRes, typesRes] = await Promise.all([
        storesApi.getAll({ active: true }),
        equipmentApi.getTypes()
      ]);
      setStores(storesRes.data.data);
      setTypes(typesRes.data.data);
    } catch (error) { console.error(error); }
  };

  const loadEquipment = async () => {
    setLoading(true);
    try {
      const params: EquipmentFilters = {};
      if (selectedStore) params.storeId = selectedStore;
      if (selectedType) params.type = selectedType;
      if (showOnlyDown) params.isDown = true;
      const res = await equipmentApi.getAll(params);
      setEquipment(res.data.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({ storeId: '', name: '', type: '', yearCode: new Date().getFullYear().toString() });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleEditClick = (item: Equipment) => {
    setEditingId(item.id);
    setFormData({
      storeId: item.storeId,
      name: item.name,
      type: item.type,
      yearCode: item.yearCode
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (editingId) {
        await equipmentApi.update(editingId, formData);
        triggerToast('Asset updated');
      } else {
        await equipmentApi.create(formData);
        triggerToast('Asset registered');
      }
      setIsModalOpen(false);
      loadEquipment();
    } catch (err: unknown) {
      const error = err as ApiError;
      setErrorMessage(error.response?.data?.error || 'Error processing request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    setIsSubmitting(true);
    try {
      await equipmentApi.delete(idToDelete);
      triggerToast('Asset removed');
      setIsDeleteModalOpen(false);
      loadEquipment();
    } catch (error) { console.error(error); }
    finally { setIsSubmitting(false); setIdToDelete(null); }
  };

  const toggleStatus = async (id: string, isDown: boolean) => {
    try {
      isDown ? await equipmentApi.markAsOperational(id) : await equipmentApi.markAsDown(id);
      loadEquipment();
      triggerToast(`Status updated`);
    } catch (error) { console.error(error); }
  };

  const printLabel = (item: Equipment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrSvg = document.getElementById(`qr-${item.id}`)?.innerHTML || '';
    printWindow.document.write(`
      <html>
        <head><title>Label ${item.equipmentCode}</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.label{border:2px solid #3E4850;padding:20px;width:300px;text-align:center;border-radius:15px;}.code{font-size:22px;font-weight:900;margin:10px 0;color:#3E4850;}.name{font-size:14px;font-weight:bold;color:#3E4850;}</style></head>
        <body><div class="label"><div>LADYBIRD ASSET</div><div class="code">${item.equipmentCode}</div><div class="name">${item.name}</div><div>${qrSvg}</div></div>
        <script>setTimeout(()=>{window.print();window.close();},500);</script></body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 relative">
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-bold text-sm uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Equipment Management</h2>
          <p className="text-sm text-night/50 font-medium">Infrastructure Inventory</p>
        </div>
        <button 
          onClick={handleAddClick} 
          className="flex items-center space-x-2 bg-night text-bone hover:bg-night/90 transition-all duration-200 px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95"
        >
          <Plus size={20} />
          <span>New Asset</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed flex flex-col md:flex-row gap-4 items-center">
        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="flex-1 p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night w-full appearance-none">
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="flex-1 p-3 bg-bone rounded-xl outline-none text-sm font-bold text-night w-full appearance-none">
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center space-x-2 px-4 cursor-pointer group">
          <input type="checkbox" checked={showOnlyDown} onChange={e => setShowOnlyDown(e.target.checked)} className="w-5 h-5 accent-rose rounded border-tumbleweed" />
          <span className="text-xs font-black text-night/60 group-hover:text-night uppercase tracking-widest transition-colors">Only Down</span>
        </label>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">Loading assets...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipment.map((item) => (
            <div key={item.id} className={`bg-white border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-300 ${item.isDown ? 'border-rose/50 bg-rose/5' : 'border-tumbleweed'}`}>
               <div className="flex justify-between items-start mb-6">
                 <div className={`p-4 rounded-2xl ${item.isDown ? 'bg-rose text-night' : 'bg-bone text-night/40'}`}>
                    <HardDrive size={24} />
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${item.isDown ? 'bg-rose text-night shadow-sm' : 'bg-sky text-night'}`}>
                      {item.status}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-night/30 bg-bone px-3 py-1 rounded-lg">
                      {item.equipmentCode}
                    </span>
                 </div>
               </div>

               <h3 className="font-black text-night text-xl mb-1 uppercase tracking-tight leading-tight">{item.name}</h3>
               <div className="flex items-center text-[10px] text-night/40 mb-8 font-black uppercase tracking-widest">
                  <MapPin size={12} className="mr-1 text-rose" /> {item.store?.name}
               </div>

               <div className="flex justify-center mb-8 p-6 bg-bone rounded-3xl border border-tumbleweed/30">
                  <div id={`qr-${item.id}`} className="p-2 bg-white rounded-xl shadow-inner">
                    <QRCodeSVG value={item.qrCodeText || item.equipmentCode} size={120} level="H" />
                  </div>
               </div>

               <div className="flex gap-2">
                 <button 
                  onClick={() => toggleStatus(item.id, !!item.isDown)} 
                  className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                    item.isDown 
                    ? 'bg-sky text-night hover:bg-sky/80' 
                    : 'bg-rose text-night hover:bg-rose/80'
                  }`}
                 >
                   {item.isDown ? 'Mark Fixed' : 'Mark Down'}
                 </button>
                 
                 <div className="flex gap-1">
                    <button onClick={() => handleEditClick(item)} className="p-3 bg-bone text-night/40 rounded-xl hover:bg-night hover:text-bone transition-all duration-200">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => printLabel(item)} className="p-3 bg-bone text-night/40 rounded-xl hover:bg-night hover:text-bone transition-all duration-200">
                      <Printer size={18} />
                    </button>
                    <button onClick={() => { setIdToDelete(item.id); setIsDeleteModalOpen(true); }} className="p-3 bg-bone text-night/40 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-200">
                      <Trash2 size={18} />
                    </button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bone rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200 border border-tumbleweed">
            <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50">
              <h3 className="text-2xl font-black text-night uppercase italic tracking-tighter">{editingId ? 'Edit Asset' : 'New Equipment'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-night/30 hover:text-rose transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-night/40 uppercase tracking-[0.2em] mb-2 ml-1">Assigned Store</label>
                <select className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night" value={formData.storeId} onChange={e => setFormData({...formData, storeId: e.target.value})} required>
                  <option value="">Select Store...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {editingId && <p className="text-[10px] text-rose font-black uppercase mt-3 ml-1 tracking-wider">⚠️ Code will regenerate on store change</p>}
              </div>

              <div className="space-y-4">
                <input placeholder="Name (e.g. Tortilla Press)" className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                <input placeholder="Type (e.g. Kitchen)" className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required />
                <input placeholder="Year (e.g. 2025)" className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night" value={formData.yearCode} onChange={e => setFormData({...formData, yearCode: e.target.value})} required />
              </div>
              
              {errorMessage && <p className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-red-100">{errorMessage}</p>}
              
              <button disabled={isSubmitting} className="w-full py-5 bg-night text-bone rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all active:scale-95 disabled:opacity-50">
                {isSubmitting ? 'Syncing...' : editingId ? 'Update & Save' : 'Register Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-night/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 animate-in zoom-in duration-200 text-center border border-tumbleweed">
            <div className="w-24 h-24 bg-rose/20 text-rose rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <AlertTriangle size={48} />
            </div>
            <h3 className="text-2xl font-black text-night mb-2 uppercase italic">Are you sure?</h3>
            <p className="text-night/50 text-sm font-medium mb-10 leading-relaxed uppercase tracking-tighter">This action is permanent and will remove the QR code metadata.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-bone text-night/40 rounded-2xl font-black uppercase tracking-widest hover:bg-tumbleweed transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isSubmitting} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-600 transition-all">{isSubmitting ? '...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}