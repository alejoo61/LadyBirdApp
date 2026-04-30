'use client';

import type { CateringOrder } from '@/services/api/cateringApi';
import CateringOrderDetail from './CateringOrderDetail';
import {
  EVENT_TYPE_COLORS, STATUS_COLORS, PAYMENT_STATUS_STYLES,
  formatDate, isToday,
} from './orderUtils';
import {
  ChevronDown, ChevronUp, CalendarDays, RefreshCw,
  FlaskConical, Building2, Receipt, LockKeyhole,
} from 'lucide-react';

interface CateringOrderCardProps {
  order:            CateringOrder;
  isExpanded:       boolean;
  isUpdating:       boolean;
  generatingPdf:    string | null;
  syncingCalendar:  string | null;
  onToggle:         () => void;
  onStatusUpdate:   (id: string, status: string) => void;
  onOverridePayment:(id: string) => void;
  onGeneratePdf:    (id: string, order: CateringOrder) => void;
  onSyncCalendar:   (id: string) => void;
  onEdit:           () => void;
  onCollapse:       () => void;
}

export default function CateringOrderCard({
  order, isExpanded,
  isUpdating, generatingPdf, syncingCalendar,
  onToggle, onStatusUpdate, onOverridePayment,
  onGeneratePdf, onSyncCalendar, onEdit, onCollapse,
}: CateringOrderCardProps) {
  const isUnpaid       = order.paymentStatus === 'OPEN';
  const isHouseAccount = order.isHouseAccount;
  const isSpaceRental  = order.isSpaceRental;
  const isTodayOrder   = isToday(order.estimatedFulfillmentDate);
  const isTestOrder    = order.toastOrderGuid?.startsWith('MANUAL-');
  const isEdited       = order.isManuallyEdited && !isTestOrder;

  const spaceRentalItem = isSpaceRental
    ? order.items.find(i => (i.displayName || '').toLowerCase().includes('space rental'))
    : null;

  // Card border variant
  const borderCls = isTestOrder     ? 'border-fuchsia-300 ring-1 ring-fuchsia-200'
                  : isSpaceRental   ? 'border-indigo-300 ring-1 ring-indigo-100'
                  : isUnpaid        ? 'border-orange-200 opacity-75'
                  : isTodayOrder    ? 'border-sky ring-1 ring-sky/30'
                  : order.isUpcoming ? 'border-tumbleweed'
                  : 'border-tumbleweed/30 opacity-80';

  return (
    <div className={`bg-white rounded-[2rem] border shadow-sm transition-all duration-300 overflow-hidden ${borderCls}`}>

      {/* ── Banners ── */}
      {isSpaceRental && (
        <div className="bg-indigo-600 px-6 py-2 flex items-center gap-2">
          <Building2 size={13} className="text-white shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
            Space Rental{spaceRentalItem && ` — ${spaceRentalItem.displayName}`}
          </span>
        </div>
      )}

      {isTestOrder && (
        <div className="bg-fuchsia-500 px-6 py-2 flex items-center gap-2">
          <FlaskConical size={13} className="text-white shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
            ⚠ TEST ORDER — Manual Entry — Not synced with Toast
          </span>
        </div>
      )}

      {isTodayOrder && !isUnpaid && !isTestOrder && (
        <div className="bg-sky/10 border-b border-sky/20 px-6 py-1.5 flex items-center gap-2">
          <CalendarDays size={11} className="text-sky shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-sky">Today&apos;s Order</span>
        </div>
      )}

      {isEdited && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-1.5 flex items-center gap-2">
          <RefreshCw size={11} className="text-yellow-600 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600">
            Manually Edited — Not synced with Toast
          </span>
        </div>
      )}

      {isUnpaid && (
        <div className={`border-b px-6 py-2 flex items-center gap-2 ${
          isHouseAccount  ? 'bg-purple-50 border-purple-200'
          : isSpaceRental ? 'bg-indigo-50 border-indigo-200'
          : 'bg-orange-50 border-orange-200'
        }`}>
          {isHouseAccount
            ? <Receipt size={12} className="text-purple-500 shrink-0" />
            : isSpaceRental
            ? <Building2 size={12} className="text-indigo-500 shrink-0" />
            : <LockKeyhole size={12} className="text-orange-500 shrink-0" />}
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            isHouseAccount ? 'text-purple-500' : isSpaceRental ? 'text-indigo-500' : 'text-orange-500'
          }`}>
            {isHouseAccount
              ? 'House Account — Invoice pending. Override when client payment is confirmed.'
              : isSpaceRental
              ? 'Space Rental — Awaiting payment confirmation.'
              : 'Awaiting Payment — PDF and Calendar locked until payment is confirmed'}
          </span>
        </div>
      )}

      {/* ── Clickable row ── */}
      <div
        className="p-6 flex items-center gap-4 cursor-pointer hover:bg-bone/40 transition-colors"
        onClick={onToggle}>

        <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase border shrink-0 ${
          EVENT_TYPE_COLORS[order.eventType] || EVENT_TYPE_COLORS.NEEDS_REVIEW
        }`}>
          {order.eventTypeLabel}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-night/30">#{order.displayNumber}</span>
            <span className="font-black text-night text-sm truncate">{order.clientName}</span>
            {isTestOrder    && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-fuchsia-500 text-white shrink-0 animate-pulse">TEST</span>}
            {isHouseAccount && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-100 text-purple-500 shrink-0">House Acct</span>}
            {isSpaceRental  && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 shrink-0">Space Rental</span>}
            {isTodayOrder && !isUnpaid && !isTestOrder && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky/20 text-sky shrink-0">Today</span>}
            {isEdited && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 shrink-0">Edited</span>}
          </div>
          <p className="text-[11px] text-night/40 font-medium truncate mt-0.5">
            {order.storeName} · {order.guestCount} guests
          </p>
        </div>

        <div className="text-right shrink-0 hidden md:block">
          <p className="text-[11px] font-black text-night/60">{formatDate(order.estimatedFulfillmentDate)}</p>
          <p className="text-[10px] text-night/30 font-medium mt-0.5">
            {order.deliveryMethod === 'DELIVERY' ? '🚗 Delivery' : '🏪 Pickup'}
          </p>
        </div>

        <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${
          isUnpaid && isHouseAccount  ? 'bg-purple-100 text-purple-600 border border-purple-200'
          : isUnpaid && isSpaceRental ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
          : PAYMENT_STATUS_STYLES[order.paymentStatus] || PAYMENT_STATUS_STYLES.OPEN
        }`}>
          {isHouseAccount && isUnpaid ? 'House Account'
           : isSpaceRental && isUnpaid ? 'Space Rental'
           : order.paymentStatusLabel}
        </span>

        {!isUnpaid && (
          <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${
            STATUS_COLORS[order.status] || STATUS_COLORS.pending
          }`}>
            {order.statusLabel}
          </span>
        )}

        <div className="text-night/30 shrink-0">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <CateringOrderDetail
          order={order}
          isUpdating={isUpdating}
          generatingPdf={generatingPdf}
          syncingCalendar={syncingCalendar}
          onStatusUpdate={onStatusUpdate}
          onOverridePayment={onOverridePayment}
          onGeneratePdf={onGeneratePdf}
          onSyncCalendar={onSyncCalendar}
          onEdit={onEdit}
          onCollapse={onCollapse}
        />
      )}
    </div>
  );
}