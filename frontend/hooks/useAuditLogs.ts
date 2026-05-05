'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { auditApi } from '@/services/api/auditApi';
import type { AuditLog } from '@/services/api/auditApi';

interface UseAuditLogsOptions {
  orderId?:      string;   // si viene, filtra por orden
  autoRefresh?:  boolean;  // polling cada 30s
  refreshInterval?: number; // ms, default 30000
}

interface AuditFilters {
  actor?:  string;
  action?: string;
  limit?:  number;
}

export function useAuditLogs({
  orderId,
  autoRefresh     = false,
  refreshInterval = 30_000,
}: UseAuditLogsOptions = {}) {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({ limit: 200 });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      let res;
      if (orderId) {
        res = await auditApi.getByOrderId(orderId);
      } else {
        res = await auditApi.getAll(filters);
      }
      setLogs(res.data.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('useAuditLogs error:', err);
      setError('Could not load audit logs');
    } finally {
      setLoading(false);
    }
  }, [orderId, filters]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    intervalRef.current = setInterval(load, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refreshInterval, load]);

  const updateFilters = useCallback((newFilters: AuditFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setLoading(true);
  }, []);

  // Actores únicos para filtros de UI
  const actors  = [...new Set(logs.map(l => l.actor))].sort();
  const actions = [...new Set(logs.map(l => l.action))].sort();

  return {
    logs,
    loading,
    error,
    lastRefresh,
    filters,
    actors,
    actions,
    reload:        load,
    updateFilters,
  };
}