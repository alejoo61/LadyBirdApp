'use client';

import { useState, useEffect } from 'react';
import { auditApi } from '@/services/api/auditApi';
import type { AuditLog } from '@/services/api/auditApi';
import {
  Clock, User, FileText, Calendar, RefreshCw,
  Plus, DollarSign, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';

const ACTION_CONFIG: Record<string, {
  label: string;
  icon:  React.ReactNode;
  color: string;
  bg:    string;
}> = {
  ORDER_CREATED:   { label: 'Order Created',     icon: <Plus size={12} />,        color: 'text-emerald-600', bg: 'bg-emerald-100' },
  STATUS_CHANGE:   { label: 'Status Changed',    icon: <RefreshCw size={12} />,   color: 'text-blue-600',    bg: 'bg-blue-100'    },
  PAYMENT_CHANGE:  { label: 'Payment Updated',   icon: <DollarSign size={12} />,  color: 'text-purple-600',  bg: 'bg-purple-100'  },
  MANUAL_EDIT:     { label: 'Manually Edited',   icon: <AlertCircle size={12} />, color: 'text-amber-600',   bg: 'bg-amber-100'   },
  PDF_GENERATED:   { label: 'PDF Generated',     icon: <FileText size={12} />,    color: 'text-rose-600',    bg: 'bg-rose-100'    },
  CALENDAR_SYNCED: { label: 'Calendar Synced',   icon: <Calendar size={12} />,    color: 'text-sky-600',     bg: 'bg-sky-100'     },
  TOAST_SYNC:      { label: 'Synced from Toast', icon: <RefreshCw size={12} />,   color: 'text-stone-500',   bg: 'bg-stone-100'   },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month:    'short',
    day:      'numeric',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
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

function ChangesDetail({ changes }: { changes: Record<string, { before: unknown; after: unknown }> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(changes).map(([field, { before, after }]) => (
        <div key={field} className="flex items-start gap-2 text-[10px]">
          <span className="font-black text-night/40 uppercase tracking-widest min-w-[110px] shrink-0">
            {field}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
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
    </div>
  );
}

function MetadataDetail({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="text-[10px] bg-bone px-2 py-0.5 rounded-lg text-night/50">
          <span className="font-black text-night/40 uppercase">{key}:</span>{' '}
          {String(value)}
        </span>
      ))}
    </div>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const config     = ACTION_CONFIG[log.action] || ACTION_CONFIG.TOAST_SYNC;
  const hasDetails = !!(log.changes || (log.metadata && Object.keys(log.metadata).length > 0));

  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${config.bg} ${config.color}`}>
          {config.icon}
        </div>
        <div className="w-px flex-1 bg-tumbleweed/20 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
              {config.label}
            </span>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <User size={10} className="text-night/30 shrink-0" />
              <span className="text-[10px] text-night/60 font-semibold">{log.actor}</span>
              <Clock size={10} className="text-night/30 shrink-0" />
              <span className="text-[10px] text-night/40">{formatDate(log.createdAt)}</span>
            </div>
          </div>
          {hasDetails && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[9px] font-black uppercase tracking-widest text-night/30 hover:text-night transition-colors flex items-center gap-1 shrink-0 mt-0.5">
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-2 bg-bone rounded-xl p-3 space-y-2">
            {log.changes  && <ChangesDetail  changes={log.changes}   />}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <MetadataDetail metadata={log.metadata} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderAuditLog({ orderId }: { orderId: string }) {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);   // ← true por defecto, no dentro del effect
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    auditApi.getByOrderId(orderId)
      .then(res => {
        if (!cancelled) {
          setLogs(res.data.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load audit log');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-night/30">
        <div className="w-4 h-4 border-2 border-night/20 border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading activity log...</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[10px] text-red-400 font-black uppercase tracking-widest py-2">{error}</p>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-[10px] text-night/30 font-black uppercase tracking-widest py-2">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-tumbleweed/20">
      <p className="text-[9px] font-black text-night/30 uppercase tracking-widest mb-4">
        Activity Log ({logs.length})
      </p>
      <div>
        {logs.map((log, idx) => (
          <div key={log.id} style={{ opacity: idx === logs.length - 1 ? 0.5 : 1 }}>
            <AuditLogItem log={log} />
          </div>
        ))}
      </div>
    </div>
  );
}