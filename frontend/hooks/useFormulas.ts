'use client';

import { useState, useEffect, useCallback } from 'react';
import { formulasApi } from '@/services/api/formulasApi';
import type { Formula, FormulaAlias, FormulaCreateData, FormulaUpdateData } from '@/services/api/formulasApi';

export function useFormulas() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [aliases, setAliases]   = useState<FormulaAlias[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const loadFormulas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await formulasApi.getAll();
      setFormulas(res.data.data);
    } catch (err) {
      console.error('useFormulas error:', err);
      setError('Failed to load formulas');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAliases = useCallback(async () => {
    try {
      const res = await formulasApi.getAliases();
      setAliases(res.data.data);
    } catch (err) {
      console.error('useFormulas aliases error:', err);
    }
  }, []);

  useEffect(() => {
    loadFormulas();
    loadAliases();
  }, [loadFormulas, loadAliases]);

  const create = useCallback(async (data: FormulaCreateData) => {
    const res = await formulasApi.create(data);
    await loadFormulas();
    return res.data;
  }, [loadFormulas]);

  const update = useCallback(async (id: string, data: FormulaUpdateData) => {
    const res = await formulasApi.update(id, data);
    await loadFormulas();
    return res.data;
  }, [loadFormulas]);

  const remove = useCallback(async (id: string) => {
    await formulasApi.delete(id);
    await loadFormulas();
  }, [loadFormulas]);

  // createAlias recibe 2 argumentos separados según la API
  const createAlias = useCallback(async (canonicalName: string, alias: string) => {
    await formulasApi.createAlias(canonicalName, alias);
    await loadAliases();
  }, [loadAliases]);

  const removeAlias = useCallback(async (id: string) => {
    await formulasApi.deleteAlias(id);
    await loadAliases();
  }, [loadAliases]);

  return {
    formulas, aliases, loading, error,
    reload:      loadFormulas,
    create,      update,      remove,
    createAlias, removeAlias,
  };
}