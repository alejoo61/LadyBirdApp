'use client';

import { useState, useEffect, useCallback } from 'react';
import { storesApi } from '@/services/api/storesApi';
import type { Store, StoreCreateData, StoreUpdateData } from '@/services/api/storesApi';

interface UseStoresOptions {
  activeOnly?: boolean;
  autoLoad?:  boolean;
}

export function useStores({ activeOnly = false, autoLoad = true }: UseStoresOptions = {}) {
  const [stores, setStores]   = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storesApi.getAll(activeOnly ? { active: true } : undefined);
      setStores(res.data.data);
    } catch (err) {
      console.error('useStores error:', err);
      setError('Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  const create = useCallback(async (data: StoreCreateData) => {
    const res = await storesApi.create(data);
    await load();
    return res.data;
  }, [load]);

  const update = useCallback(async (id: string, data: StoreUpdateData) => {
    const res = await storesApi.update(id, data);
    await load();
    return res.data;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await storesApi.delete(id);
    await load();
  }, [load]);

  return { stores, loading, error, reload: load, create, update, remove };
}