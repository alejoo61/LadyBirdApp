'use client';

import type { CateringOrder } from '@/services/api/cateringApi';
import OrderAuditLog from '@/components/OrderAuditLog';
import CateringOrderActions from './CateringOrderActions';
import { formatDate, formatPhone } from './orderUtils';
import {
  User, Mail, Phone, Calendar, Clock,
  Truck, ShoppingBag, AlertTriangle, Building2,
} from 'lucide-react';

interface CateringOrderDetailProps {
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

export default function CateringOrderDetail({
  order,
  isUpdating, generatingPdf, syncingCalendar,
  onStatusUpdate, onOverridePayment, onGeneratePdf,
  onSyncCalendar, onEdit, onCollapse,
}: CateringOrderDetailProps) {
  return (
    <div className="border-t border-tumbleweed/20 bg-bone/30 p-6 space-y-6">

      {/* Client / Timing / Delivery info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client */}
        <div className="bg-white rounded-2xl p-4 space-y-2 border border-tumbleweed/20">
          <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">Client</p>
          <div className="flex items-center gap-2">
            <User size={14} className="text-rose shrink-0" />
            <span className="font-black text-night text-sm">{order.clientName}</span>
          </div>
          {order.clientEmail && (
            <div className="flex items-center gap-2">
              <Mail size={12} className="text-night/30 shrink-0" />
              <span className="text-[11px] text-night/60 truncate">{order.clientEmail}</span>
            </div>
          )}
          {order.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-night/30 shrink-0" />
              <span className="text-[11px] text-night/60">{formatPhone(order.clientPhone)}</span>
            </div>
          )}
        </div>

        {/* Timing */}
        <div className="bg-white rounded-2xl p-4 space-y-2 border border-tumbleweed/20">
          <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">Timing</p>
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-rose shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-night/40 font-black uppercase">Event Time</p>
              <p className="font-black text-night text-sm">{formatDate(order.estimatedFulfillmentDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-night/30 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-night/40 font-black uppercase">Kitchen Finish</p>
              <p className="text-sm font-bold text-night/70">{formatDate(order.kitchenFinishTime)}</p>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-2xl p-4 space-y-2 border border-tumbleweed/20">
          <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">
            {order.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
          </p>
          <div className="flex items-start gap-2">
            {order.deliveryMethod === 'DELIVERY'
              ? <Truck size={14} className="text-rose shrink-0 mt-0.5" />
              : <ShoppingBag size={14} className="text-rose shrink-0 mt-0.5" />}
            <p className="text-[11px] text-night/70 font-medium leading-relaxed">
              {order.deliveryAddress || 'Customer Pickup'}
            </p>
          </div>
          {order.deliveryNotes && (
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-night/50 font-medium italic leading-relaxed">{order.deliveryNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order items */}
      {order.items.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-tumbleweed/20">
          <p className="text-[9px] font-black text-night/30 uppercase tracking-widest mb-3">Order Items</p>
          <div className="space-y-3">
            {order.items.map((item, idx) => {
              const isRentalItem = (item.displayName || '').toLowerCase().includes('space rental');
              return (
                <div key={idx}
                  className={`border-b border-tumbleweed/10 last:border-0 pb-3 last:pb-0 ${
                    isRentalItem ? 'bg-indigo-50 -mx-1 px-1 rounded-xl' : ''
                  }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-black text-night/30 bg-bone px-2 py-0.5 rounded-lg shrink-0">
                        ×{item.quantity}
                      </span>
                      <span className={`font-black text-sm ${isRentalItem ? 'text-indigo-700' : 'text-night'}`}>
                        {item.displayName}
                        {isRentalItem && <Building2 size={11} className="inline ml-1.5 text-indigo-500" />}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-night/40 shrink-0 ml-2">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="ml-8 mt-1.5 flex flex-wrap gap-1.5">
                      {item.modifiers
                        .filter(m => m.displayName && !m.displayName.startsWith('NO,'))
                        .map((mod, mIdx) => (
                          <span key={mIdx} className="text-[9px] font-bold bg-bone text-night/50 px-2 py-0.5 rounded-lg">
                            {mod.displayName}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-tumbleweed/20 flex justify-between items-center">
            <span className="text-[10px] font-black text-night/30 uppercase tracking-widest">Total</span>
            <span className="font-black text-night text-lg">
              ${parseFloat(String(order.totalAmount)).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Internal notes */}
      {order.overrideNotes && (
        <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
          <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-1">Internal Notes</p>
          <p className="text-[11px] text-night/70 font-medium">{order.overrideNotes}</p>
        </div>
      )}

      {/* Actions */}
      <CateringOrderActions
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

      {/* Audit log */}
      <OrderAuditLog orderId={order.id} />
    </div>
  );
}