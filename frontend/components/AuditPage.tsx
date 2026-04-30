'use client';

import { useState, useEffect, useCallback } from 'react';
import { auditApi } from '@/services/api/auditApi';
import type { AuditLog } from '@/services/api/auditApi';
import {
  Clock, User, FileText, Calendar, RefreshCw,
  Plus, DollarSign, ChevronDown, ChevronUp,
  AlertCircle, Filter, Search,
} from 'lucide-react';

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  ORDER_CREATED:   { label: 'Order Created',     icon: <Plus size={12} />,        color: 'text-emerald-600', bg: 'bg-emerald-100' },
  STATUS_CHANGE:   { label: 'Status Changed',    icon: <RefreshCw size={12} />,   color: 'text-blue-600',    bg: 'bg-blue-100'    },
  PAYMENT_CHANGE:  { label: 'Payment Updated',   icon: <DollarSign size={12} />,  color: 'text-purple-600',  bg: 'bg-purple-100'  },
  MANUAL_EDIT:     { label: 'Manually Edited',   icon: <AlertCircle size={12} />, color: 'text-amber-600',   bg: 'bg-amber-100'   },
  PDF_GENERATED:   { label: 'PDF Generated',     icon: <FileText size={12} />,    color: 'text-rose-600',    bg: 'bg-rose-100'    },
  CALENDAR_SYNCED: { label: 'Calendar Synced',   icon: <Calendar size={12} />,    color: 'text-sky-600',     bg: 'bg-sky-100'     },
  TOAST_SYNC:      { label: 'Synced from Toast', icon: <RefreshCw size={12} />,   color: 'text-stone-500',   bg: 'bg-stone-100'   },
};

const ACTION_OPTIONS = [
  { value: '',                label: 'All Actions'      },
  { value: 'ORDER_CREATED',   label: 'Order Created'    },
  { value: 'STATUS_CHANGE',   label: 'Status Changed'   },
  { value: 'PAYMENT_CHANGE',  label: 'Payment Updated'  },
  { value: 'MANUAL_EDIT',     label: 'Manually Edited'  },
  { value: 'PDF_GENERATED',   label: 'PDF Generated'    },
  { value: 'CALENDAR_SYNCED', label: 'Calendar Synced'  },
  { value: 'TOAST_SYNC',      label: 'Synced from Toast'},
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Chicago',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const str = String(value);
  if (str.includes('T') && str.includes('Z')) {
    try {
      return new Date(str).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago',
      });
    } catch { return str; }
  }
  return str;
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const config     = ACTION_CONFIG[log.action] || ACTION_CONFIG.TOAST_SYNC;
  const hasDetails = !!(log.changes || (log.metadata && Object.keys(log.metadata).length > 0));

  return (
    <div className={`bg-white rounded-2xl border border-tumbleweed/20 overflow-hidden transition-all ${
      expanded ? 'shadow-md' : 'shadow-sm'
    }`}>
      <div className="flex items-center gap-4 p-4">
        {/* Action badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
          {config.icon}
        </div>

        {/* Action + actor */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
              {config.label}
            </span>
            {log.displayNumber && (
              <span className="text-[10px] font-mono text-night/30">#{log.displayNumber}</span>
            )}
            {log.clientName && (
              <span className="text-[10px] font-bold text-night/60 truncate">{log.clientName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-1">
              <User size={10} className="text-night/30" />
              <span className="text-[10px] text-night/50 font-semibold">{log.actor}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={10} className="text-night/30" />
              <span className="text-[10px] text-night/40">{formatDate(log.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Expand button */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[9px] font-black uppercase tracking-widest text-night/30 hover:text-night transition-colors flex items-center gap-1 shrink-0">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-tumbleweed/10 bg-bone/30 px-4 py-3 space-y-3">
          {log.changes && Object.entries(log.changes).map(([field, { before, after }]) => (
            <div key={field} className="flex items-start gap-3 text-[10px]">
              <span className="font-black text-night/40 uppercase tracking-widest min-w-[120px] shrink-0 mt-0.5">
                {field}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-red-50 text-red-500 rounded-lg line-through">
                  {formatValue(before)}
                </span>
                <span className="text-night/30">→</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold">
                  {formatValue(after)}
                </span>
              </div>
            </div>
          ))}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(log.metadata)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([key, value]) => (
                  <span key={key} className="text-[10px] bg-white border border-tumbleweed/20 px-2 py-0.5 rounded-lg text-night/50">
                    <span className="font-black text-night/40 uppercase">{key}:</span>{' '}
                    {String(value)}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor]   = useState('');
  const [search, setSearch]             = useState('');
  const [autoRefresh, setAutoRefresh]   = useState(true);
  const [lastRefresh, setLastRefresh]   = useState<Date>(new Date());

  const loadLogs = useCallback(async () => {
    try {
      const res = await auditApi.getAll({
        action: filterAction || undefined,
        actor:  filterActor  || undefined,
        limit:  200,
      });
      setLogs(res.data.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterActor]);

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [loadLogs]);

  // Auto refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);

  // Filtro client-side por search
  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.actor?.toLowerCase().includes(q) ||
      log.clientName?.toLowerCase().includes(q) ||
      log.displayNumber?.includes(q) ||
      log.actionLabel?.toLowerCase().includes(q)
    );
  });

  // Actores únicos para el filtro
  const actors = [...new Set(logs.map(l => l.actor))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Audit Log</h2>
          <p className="text-sm text-night/50 font-medium">
            {filtered.length} events
            {lastRefresh && (
              <span className="ml-2 text-night/30">
                · Last updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              autoRefresh ? 'bg-emerald-100 text-emerald-600' : 'bg-bone text-night/40'
            }`}>
            <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => { setLoading(true); loadLogs(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-night text-bone hover:bg-rose transition-all">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30" size={16} />
          <input
            type="text"
            placeholder="Search by client, order #, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night transition-all text-sm font-bold text-night"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-night/30 ml-1" />
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            {ACTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterActor}
            onChange={e => setFilterActor(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Users</option>
            {actors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(filterAction || filterActor || search) && (
            <button
              onClick={() => { setFilterAction(''); setFilterActor(''); setSearch(''); }}
              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-night/30 gap-3">
          <div className="w-5 h-5 border-2 border-night/20 border-t-transparent rounded-full animate-spin" />
          <span className="font-black uppercase tracking-widest text-sm">Loading...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-night/30">
          <ClipboardListIcon size={48} className="mb-4 opacity-30" />
          <p className="font-black uppercase tracking-widest text-sm">No activity yet</p>
          <p className="text-xs text-night/20 mt-1">Actions will appear here as they happen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <AuditLogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline icon para el empty state
function ClipboardListIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  );
}