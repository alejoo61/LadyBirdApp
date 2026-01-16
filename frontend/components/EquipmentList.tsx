// components/EquipmentList.tsx
'use client';

import { useState, useEffect } from 'react';
import { equipmentApi, storesApi } from '@/services/api';
import type { Equipment, Store } from '@/services/api';

// Definimos la interfaz para los parámetros de búsqueda para evitar el error 'any'
interface EquipmentFilters {
  storeId?: string;
  type?: string;
  isDown?: boolean;
}

export default function EquipmentList() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showOnlyDown, setShowOnlyDown] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, selectedType, showOnlyDown]);

  const loadInitialData = async () => {
    try {
      const [storesRes, typesRes] = await Promise.all([
        storesApi.getAll({ active: true }),
        equipmentApi.getTypes()
      ]);
      setStores(storesRes.data.data);
      setTypes(typesRes.data.data);
    } catch (error) { 
      console.error('Error loading initial data:', error); 
    }
  };

  const loadEquipment = async () => {
    setLoading(true);
    try {
      // Usamos la interfaz en lugar de 'any'
      const params: EquipmentFilters = {};
      
      if (selectedStore) params.storeId = selectedStore;
      if (selectedType) params.type = selectedType;
      if (showOnlyDown) params.isDown = true;

      const res = await equipmentApi.getAll(params);
      setEquipment(res.data.data);
    } catch (error) { 
      console.error('Error loading equipment:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await equipmentApi.delete(id);
      await loadEquipment();
    } catch (error) { 
      alert('Error deleting equipment'); 
      console.error(error);
    }
  };

  const toggleStatus = async (id: string, isDown: boolean) => {
    try {
      if (isDown) {
        await equipmentApi.markAsOperational(id);
      } else {
        await equipmentApi.markAsDown(id);
      }
      await loadEquipment();
    } catch (error) { 
      alert('Error updating equipment status'); 
      console.error(error);
    }
  };

  const clearFilters = () => {
    setSelectedStore('');
    setSelectedType('');
    setShowOnlyDown(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Equipment Management</h2>
        <span className="bg-purple-100 text-purple-800 px-4 py-1 rounded-full text-sm font-bold">
          {equipment.length} Units
        </span>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <select 
          value={selectedStore} 
          onChange={(e) => setSelectedStore(e.target.value)} 
          className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        >
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select 
          value={selectedType} 
          onChange={(e) => setSelectedType(e.target.value)} 
          className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="flex items-center space-x-2 cursor-pointer px-2">
          <input 
            type="checkbox" 
            checked={showOnlyDown} 
            onChange={(e) => setShowOnlyDown(e.target.checked)} 
            className="w-4 h-4 accent-purple-600 rounded" 
          />
          <span className="text-sm font-medium text-gray-700">Only Down</span>
        </label>

        <button 
          onClick={clearFilters} 
          className="text-sm text-purple-600 font-semibold hover:text-purple-800 transition-colors text-right md:text-center"
        >
          Clear Filters
        </button>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="text-gray-500 animate-pulse">Loading equipment list...</p>
        </div>
      ) : equipment.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg">No equipment found matching the filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {equipment.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
                item.isDown ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
              }`}
            >
               <div className="flex justify-between items-start mb-3">
                 <div>
                   <h3 className="font-bold text-gray-800 text-lg leading-tight">{item.name}</h3>
                   <p className="text-xs text-gray-400 font-mono mt-1">{item.equipmentCode}</p>
                 </div>
                 <span className={`text-[10px] uppercase px-2.5 py-1 rounded-lg font-black tracking-wider ${
                   item.isDown ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                 }`}>
                   {item.status}
                 </span>
               </div>

               <div className="space-y-1.5 mb-6">
                 <div className="flex items-center text-sm">
                   <span className="text-gray-400 w-16">Type:</span>
                   <span className="text-gray-700 font-medium">{item.type}</span>
                 </div>
                 <div className="flex items-center text-sm">
                   <span className="text-gray-400 w-16">Store:</span>
                   <span className="text-gray-700 font-medium truncate">{item.store?.name || 'N/A'}</span>
                 </div>
               </div>

               <div className="flex gap-3">
                 <button 
                   onClick={() => toggleStatus(item.id, !!item.isDown)} 
                   className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                     item.isDown 
                     ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100' 
                     : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100'
                   }`}
                 >
                   {item.isDown ? 'MARK OPERATIONAL' : 'MARK AS DOWN'}
                 </button>
                 <button 
                   onClick={() => handleDelete(item.id)} 
                   className="px-4 py-2.5 bg-gray-50 text-gray-400 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                 >
                   DELETE
                 </button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}