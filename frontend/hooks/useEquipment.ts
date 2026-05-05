'use client';

import { useState, useEffect, useCallback } from 'react';
import { equipmentApi } from '@/services/api/equipmentApi';
import type { Equipment, EquipmentCreateData } from '@/services/api/equipmentApi';

interface UseEquipmentOptions {
  storeId?:  string;
  autoLoad?: boolean;
}

export function useEquipment({ storeId, autoLoad = true }: UseEquipmentOptions = {}) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [types, setTypes]         = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // equipmentApi.getAll acepta params opcionales — filtramos por storeId si viene
      const res = await equipmentApi.getAll(storeId ? { storeId } : undefined);
      setEquipment(res.data.data);
    } catch (err) {
      console.error('useEquipment error:', err);
      setError('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadTypes = useCallback(async () => {
    try {
      const res = await equipmentApi.getTypes();
      setTypes(res.data.data);
    } catch (err) {
      console.error('useEquipment types error:', err);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      load();
      loadTypes();
    }
  }, [autoLoad, load, loadTypes]);

  const create = useCallback(async (data: EquipmentCreateData) => {
    const res = await equipmentApi.create(data);
    await load();
    return res.data;
  }, [load]);

  const update = useCallback(async (id: string, data: Partial<EquipmentCreateData>) => {
    const res = await equipmentApi.update(id, data);
    await load();
    return res.data;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await equipmentApi.delete(id);
    await load();
  }, [load]);

  const markDown = useCallback(async (id: string) => {
    await equipmentApi.markAsDown(id);
    await load();
  }, [load]);

  const markOperational = useCallback(async (id: string) => {
    await equipmentApi.markAsOperational(id);
    await load();
  }, [load]);

  return {
    equipment, types, loading, error,
    reload: load,
    create, update, remove,
    markDown, markOperational,
  };
}