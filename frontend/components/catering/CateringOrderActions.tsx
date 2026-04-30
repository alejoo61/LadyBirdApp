'use client';

import type { CateringOrder } from '@/services/api/cateringApi';
import {
  FileText, LockKeyhole, Receipt, CalendarDays,
  AlertTriangle, Pencil, X, Building2,
} from 'lucide-react';

interface CateringOrderActionsProps {
  order:            CateringOrder;
  isUpdating:       boolean;
  generatingPdf:    string | null;
  syncingCalendar:  string | null;
  onStatusUpdate:   (id: string, status: string) => void;
  onOverridePayment:(id: string) => void;
  onGeneratePdf:    (id: string, order: CateringOrder) => void;
  onSyncCalendar:   (id: string) => void;
  onEdit:           () => void;
  onCollapse:       () => void;
}

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

export default function CateringOrderActions({
  order, isUpdating, generatingPdf, syncingCalendar,
  onStatusUpdate, onOverridePayment, onGeneratePdf,
  onSyncCalendar, onEdit, onCollapse,
}: CateringOrderActionsProps) {
  const isUnpaid       = order.paymentStatus === 'OPEN';
  const isHouseAccount = order.isHouseAccount;
  const isSpaceRental  = order.isSpaceRental;

  return (
    <div className="space-y-4">
      {/* PDF outdated / Calendar out of sync badges */}
      {(order.pdfNeedsUpdate || order.calendarNeedsUpdate) && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-tumbleweed/20">
          {order.pdfNeedsUpdate && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 border border-amber-200">
              <AlertTriangle size={11} />
              PDF Outdated — Regenerating...
            </span>
          )}
          {order.calendarNeedsUpdate && (
            <button
              onClick={() => onSyncCalendar(order.id)}
              disabled={syncingCalendar === order.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
              <CalendarDays size={11} />
              {syncingCalendar === order.id ? 'Syncing...' : 'Sync Calendar'}
            </button>
          )}
        </div>
      )}

      {/* Main actions */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        {isUnpaid ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
              isHouseAccount  ? 'bg-purple-50 border-purple-200'
              : isSpaceRental ? 'bg-indigo-50 border-indigo-200'
              : 'bg-orange-50 border-orange-200'
            }`}>
              {isHouseAccount
                ? <Receipt size={13} className="text-purple-500" />
                : isSpaceRental
                ? <Building2 size={13} className="text-indigo-500" />
                : <LockKeyhole size={13} className="text-orange-500" />}
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isHouseAccount ? 'text-purple-500' : isSpaceRental ? 'text-indigo-500' : 'text-orange-500'
              }`}>
                {isHouseAccount ? 'House Account — Invoice Pending'
                 : isSpaceRental ? 'Space Rental — Awaiting Payment'
                 : 'Locked — Awaiting Payment'}
              </span>
            </div>
            <button
              onClick={() => onOverridePayment(order.id)}
              disabled={isUpdating}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 ${
                isHouseAccount  ? 'bg-purple-500 hover:bg-purple-600'
                : isSpaceRental ? 'bg-indigo-500 hover:bg-indigo-600'
                : 'bg-orange-500 hover:bg-orange-600'
              }`}>
              {isHouseAccount ? 'Confirm Invoice Paid'
               : isSpaceRental ? 'Confirm Space Rental Paid'
               : 'Override — Mark as Paid'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap items-center">
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => onStatusUpdate(order.id, status)}
                disabled={isUpdating || order.status === status}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 ${
                  order.status === status
                    ? 'bg-night text-bone cursor-default'
                    : 'bg-bone text-night/40 hover:bg-night hover:text-bone'
                }`}>
                {status}
              </button>
            ))}
            <button
              onClick={() => onGeneratePdf(order.id, order)}
              disabled={generatingPdf === order.id}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all active:scale-95 disabled:opacity-50">
              <FileText size={13} />
              {generatingPdf === order.id ? 'Generating...' : 'Fulfillment PDF'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-bone text-night/40 hover:bg-night hover:text-bone transition-all">
            <Pencil size={13} />
            Edit
          </button>
          <button
            onClick={onCollapse}
            className="p-2 text-night/30 hover:text-rose transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}