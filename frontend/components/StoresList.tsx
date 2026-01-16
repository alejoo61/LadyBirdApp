'use client';

import { useState, useEffect } from 'react';
import { storesApi } from '@/services/api/storesApi'; // Ajusta la ruta si es necesario
import type { Store, StoresParams } from '@/services/api/storesApi';
import { Search, Plus, MapPin, Power, Trash2, Edit3, Store as StoreIcon } from 'lucide-react';

export default function StoreList() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filtros locales
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadStores();
  }, [activeFilter]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const params: StoresParams = {};
      if (activeFilter === 'active') params.active = true;
      if (activeFilter === 'inactive') params.active = false;

      const res = await storesApi.getAll(params);
      setStores(res.data.data);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (store: Store) => {
    try {
      await storesApi.update(store.id, { isActive: !store.isActive });
      await loadStores();
    } catch (error) {
      alert('Error updating store status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await storesApi.delete(id);
      await loadStores();
    } catch (error) {
      alert('Error deleting store');
    }
  };

  // Filtrado por búsqueda en el cliente para inmediatez
  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Store Management</h2>
          <p className="text-sm text-gray-500">Manage your business locations and timezones</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-100">
          <Plus size={18} />
          <span>Add Store</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
          />
        </div>
        
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full md:w-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setActiveFilter(opt.id)}
              className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === opt.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-400 font-medium animate-pulse">Fetching stores...</p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-20 text-center">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="text-gray-300" size={32} />
          </div>
          <p className="text-gray-500 font-medium">No stores found matching your criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div 
              key={store.id}
              className="group bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${store.isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                  <StoreIcon size={24} />
                </div>
                <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full ${
                  store.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {store.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {store.name}
                </h3>
                <p className="text-sm font-mono text-gray-400 mt-1 uppercase tracking-wider">
                  {store.code}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
                  <MapPin size={14} className="mr-2 text-blue-400" />
                  <span className="font-medium">{store.timezone}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleStatus(store)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    store.isActive 
                    ? 'bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-orange-600' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={store.isActive ? 'Deactivate Store' : 'Activate Store'}
                >
                  <Power size={14} />
                  <span>{store.isActive ? 'OFF' : 'ON'}</span>
                </button>
                
                <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all">
                  <Edit3 size={16} />
                </button>

                <button 
                  onClick={() => handleDelete(store.id)}
                  className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}