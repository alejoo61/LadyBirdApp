'use client';

import { useState, useEffect } from 'react';
import { storesApi } from '@/services/api/storesApi';
import type { Store, StoresParams, StoreCreateData, StoreUpdateData } from '@/services/api/storesApi';
import { 
  Search, Plus, MapPin, Power, Trash2, Edit3, 
  Store as StoreIcon, X, AlertTriangle, CheckCircle, Mail 
} from 'lucide-react';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function StoreList() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<StoreCreateData>({
    code: '',
    name: '',
    timezone: 'America/New_York',
    isActive: true,
    emails: ''
  });

  useEffect(() => {
    loadStores();
  }, [activeFilter]);

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  const loadStores = async () => {
    setLoading(true);
    try {
      const params: StoresParams = {};
      if (activeFilter === 'active') params.active = true;
      if (activeFilter === 'inactive') params.active = false;
      const res = await storesApi.getAll(params);
      setStores(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (editingStoreId) {
        await storesApi.update(editingStoreId, formData);
        triggerToast('Store updated');
      } else {
        await storesApi.create(formData);
        triggerToast('Store created');
      }
      setIsModalOpen(false);
      await loadStores();
    } catch (err: unknown) {
      const error = err as ApiError;
      setErrorMessage(error.response?.data?.error || 'Error saving store');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setIdToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    setIsSubmitting(true);
    try {
      await storesApi.delete(idToDelete);
      triggerToast('Store deleted');
      setIsDeleteModalOpen(false);
      await loadStores();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
      setIdToDelete(null);
    }
  };

  const toggleStatus = async (store: Store) => {
    try {
      await storesApi.update(store.id, { isActive: !store.isActive });
      await loadStores();
      triggerToast(`Status updated`);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-black text-xs uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Store Management</h2>
          <p className="text-sm text-night/50 font-medium">Business Locations & Contacts</p>
        </div>
        <button 
          onClick={() => { 
            setEditingStoreId(null); 
            setFormData({code:'', name:'', timezone:'America/New_York', isActive:true, emails: ''}); 
            setErrorMessage('');
            setIsModalOpen(true); 
          }}
          className="bg-night text-bone hover:bg-night/90 transition-all duration-200 px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>New Store</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30" size={18} />
          <input
            type="text"
            placeholder="Search stores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night transition-all text-sm font-bold text-night"
          />
        </div>
        
        <div className="flex bg-bone p-1.5 rounded-2xl border border-tumbleweed w-full md:w-auto">
          {['all', 'active', 'inactive'].map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeFilter === opt ? 'bg-white text-night shadow-sm' : 'text-night/40 hover:text-night'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div key={store.id} className={`bg-white border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full ${store.isActive ? 'border-tumbleweed' : 'border-rose/20 opacity-80'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${store.isActive ? 'bg-bone text-night/40' : 'bg-rose/10 text-rose'}`}>
                  <StoreIcon size={24} />
                </div>
                {/* CORRECCIÓN AQUÍ: Usamos isActive en lugar de status para evitar el error TS */}
                <span className={`text-[10px] font-black tracking-[0.15em] px-4 py-1.5 rounded-full uppercase ${
                  store.isActive ? 'bg-sky text-night shadow-sm' : 'bg-bone text-night/30'
                }`}>
                  {store.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-black text-night uppercase tracking-tight leading-tight">{store.name}</h3>
                <p className="text-[11px] font-mono font-bold text-night/30 mt-1 uppercase tracking-widest">{store.code}</p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                <div className="flex items-center text-[10px] text-night/50 bg-bone p-3 rounded-2xl font-black uppercase tracking-widest">
                  <MapPin size={14} className="mr-2 text-rose" />
                  <span className="truncate">{store.timezone}</span>
                </div>
                
                <div className="bg-bone p-4 rounded-2xl border border-tumbleweed/20">
                  <div className="flex items-center text-[9px] font-black text-night/30 mb-3 uppercase tracking-[0.2em]">
                    <Mail size={12} className="mr-2" /> Notification Contacts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {store.emails && store.emails.length > 0 ? (
                      store.emails.map((email, idx) => (
                        <span key={idx} className="text-[9px] font-bold bg-white border border-tumbleweed text-night/60 px-2.5 py-1 rounded-lg truncate max-w-full">
                          {email}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] font-black text-night/20 italic uppercase tracking-widest">No contacts set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleStatus(store)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                    store.isActive 
                    ? 'bg-bone text-night/40 hover:bg-rose hover:text-night' 
                    : 'bg-night text-bone hover:bg-night/90'
                  }`}
                >
                  <Power size={14} />
                  <span>{store.isActive ? 'OFF' : 'ON'}</span>
                </button>
                
                <button 
                  onClick={() => {
                    setEditingStoreId(store.id);
                    setFormData({
                      code: store.code, 
                      name: store.name, 
                      timezone: store.timezone, 
                      isActive: store.isActive,
                      emails: store.emails ? store.emails.join(', ') : ''
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-4 bg-bone text-night/40 rounded-xl hover:bg-night hover:text-bone transition-all duration-200"
                >
                  <Edit3 size={18} />
                </button>

                <button 
                  onClick={() => openDeleteConfirm(store.id)}
                  className="p-4 bg-bone text-night/40 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-200"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-night/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bone rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200 border border-tumbleweed">
            <div className="p-8 border-b border-tumbleweed flex justify-between items-center bg-white/50">
              <h3 className="text-2xl font-black text-night uppercase italic tracking-tighter">
                {editingStoreId ? 'Edit Store' : 'New Store'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-night/30 hover:text-rose transition-colors p-2">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Store Code"
                  className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Store Name"
                  className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
                <select 
                  className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night appearance-none"
                  value={formData.timezone}
                  onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                >
                  <option value="America/New_York">New York (EST)</option>
                  <option value="America/Chicago">Chicago (CST)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST)</option>
                  <option value="UTC">Universal Time (UTC)</option>
                </select>
                <textarea
                  placeholder="Emails (comma separated)"
                  rows={2}
                  className="w-full p-4 bg-white border border-tumbleweed rounded-2xl outline-none focus:ring-2 focus:ring-rose font-bold text-night text-sm"
                  value={formData.emails}
                  onChange={(e) => setFormData({...formData, emails: e.target.value})}
                />
              </div>

              {errorMessage && <p className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-2xl">{errorMessage}</p>}

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-white text-night/40 rounded-2xl font-black uppercase hover:bg-tumbleweed transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-night text-bone rounded-2xl font-black uppercase shadow-xl hover:bg-night/90 transition-all active:scale-95 disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-night/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 animate-in zoom-in duration-200 text-center border border-tumbleweed">
            <div className="w-24 h-24 bg-rose/20 text-rose rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><AlertTriangle size={48} /></div>
            <h3 className="text-2xl font-black text-night mb-2 uppercase italic">Are you sure?</h3>
            <p className="text-night/50 text-sm font-medium mb-10 leading-relaxed uppercase">This action is permanent.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-bone text-night/40 rounded-2xl font-black uppercase hover:bg-tumbleweed transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isSubmitting} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase hover:bg-red-600 transition-all">{isSubmitting ? '...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}