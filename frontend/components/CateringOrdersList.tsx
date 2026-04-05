'use client';

import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import DateRangePicker from '@/components/DateRangePicker';
import { cateringApi } from '@/services/api/cateringApi';
import type { CateringOrder, CateringOrdersParams } from '@/services/api/cateringApi';
import { storesApi } from '@/services/api/storesApi';
import type { Store } from '@/services/api/storesApi';
import {
  Search, ChevronDown, ChevronUp, Clock, User,
  Phone, Mail, Package, CheckCircle, AlertTriangle, X,
  Calendar, Truck, ShoppingBag, Filter, FileText, LockKeyhole, Receipt,
} from 'lucide-react';

interface ApiError {
  response?: { data?: { error?: string } };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  TACO_BAR:     'bg-rose/20 text-rose border-rose/30',
  BIRD_BOX:     'bg-sky/20 text-sky border-sky/30',
  PERSONAL_BOX: 'bg-tumbleweed/30 text-night/70 border-tumbleweed',
  FOODA:        'bg-night/10 text-night border-night/20',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-500',
  completed: 'bg-sky/20 text-sky',
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  OPEN:   'bg-orange-100 text-orange-600 border border-orange-200',
  PAID:   'bg-emerald-50 text-emerald-600 border border-emerald-200',
  CLOSED: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago',
  });
}

function formatPhone(phone: string) {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10)
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return phone;
}

export default function CateringOrdersList() {
  const [orders, setOrders]               = useState<CateringOrder[]>([]);
  const [loading, setLoading]             = useState<boolean>(true);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showToast, setShowToast]         = useState<string | null>(null);
  const [isUpdating, setIsUpdating]       = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm]           = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterStatus, setFilterStatus]       = useState<string>('');
  const [filterMethod, setFilterMethod]       = useState<string>('');
  const [filterUpcoming, setFilterUpcoming]   = useState<boolean>(false);
  const [filterPayment, setFilterPayment]     = useState<string>('');
  const [stores, setStores]                   = useState<Store[]>([]);
  const [filterStoreId, setFilterStoreId]     = useState<string>('');
  const [dateRange, setDateRange]             = useState<DateRange | undefined>(undefined);

  useEffect(() => { loadStores(); }, []);

  useEffect(() => {
    loadOrders();
  }, [filterEventType, filterStatus, filterMethod, filterStoreId, dateRange, filterPayment]);

  const loadStores = async () => {
    try {
      const res = await storesApi.getAll({ active: true });
      setStores(res.data.data);
    } catch (err) { console.error(err); }
  };

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: CateringOrdersParams = {};
      if (filterEventType) params.eventType      = filterEventType;
      if (filterStatus)    params.status         = filterStatus;
      if (filterMethod)    params.deliveryMethod = filterMethod;
      if (filterStoreId)   params.storeId        = filterStoreId;
      if (filterPayment)   params.paymentStatus  = filterPayment;
      if (dateRange?.from) params.dateFrom       = format(dateRange.from, 'yyyy-MM-dd');
      if (dateRange?.to)   params.dateTo         = format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59';
      const res = await cateringApi.getAll(params);
      setOrders(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setIsUpdating(true);
    try {
      await cateringApi.updateStatus(id, status);
      triggerToast(`Order marked as ${status}`);
      await loadOrders();
    } catch (err: unknown) {
      const error = err as ApiError;
      triggerToast(`❌ ${error.response?.data?.error || 'Error updating status'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOverridePayment = async (id: string) => {
    setIsUpdating(true);
    try {
      await cateringApi.overridePaymentStatus(id, 'CLOSED');
      triggerToast('Payment override applied — order is now active');
      await loadOrders();
    } catch (err: unknown) {
      const error = err as ApiError;
      triggerToast(`❌ ${error.response?.data?.error || 'Error overriding payment'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGeneratePdf = async (id: string, displayNumber: string) => {
    setGeneratingPdf(id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/catering/orders/${id}/fulfillment-sheet`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `fulfillment-${displayNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      triggerToast('PDF downloaded successfully');
    } catch {
      triggerToast('❌ Error generating PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const hasFilters = !!(filterStoreId || filterEventType || filterStatus || filterMethod || dateRange || filterUpcoming || filterPayment);

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      !searchTerm ||
      o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.displayNumber?.includes(searchTerm) ||
      o.deliveryAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUpcoming = !filterUpcoming || o.isUpcoming;
    return matchSearch && matchUpcoming;
  });

  const unpaidCount       = orders.filter(o => o.paymentStatus === 'OPEN').length;
  const houseAccountCount = orders.filter(o => o.isHouseAccount && o.paymentStatus === 'OPEN').length;

  return (
    <div className="space-y-6 relative">

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-black text-xs uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Catering Orders</h2>
          <p className="text-sm text-night/50 font-medium flex items-center gap-2 flex-wrap">
            <span>{filteredOrders.length} orders · {filteredOrders.filter(o => o.isUpcoming).length} upcoming</span>
            {unpaidCount > 0 && (
              <span className="text-orange-500 font-black">
                · {unpaidCount} awaiting payment
                {houseAccountCount > 0 && ` (${houseAccountCount} house account)`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30" size={18} />
          <input
            type="text"
            placeholder="Search by client, order #, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night transition-all text-sm font-bold text-night"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-night/30 ml-1" />

          <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Types</option>
            <option value="TACO_BAR">Taco Bar</option>
            <option value="BIRD_BOX">&apos;Bird Box</option>
            <option value="PERSONAL_BOX">Personal Box</option>
            <option value="FOODA">Fooda</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Methods</option>
            <option value="DELIVERY">Delivery</option>
            <option value="PICKUP">Pickup</option>
          </select>

          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-none outline-none cursor-pointer ${
              filterPayment === 'OPEN' ? 'bg-orange-100 text-orange-600' : 'bg-bone text-night/60'
            }`}
          >
            <option value="">All Payments</option>
            <option value="OPEN">Awaiting Payment</option>
            <option value="PAID">Paid</option>
            <option value="CLOSED">Paid & Closed</option>
          </select>

          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Date Range" />

          <button
            onClick={() => setFilterUpcoming(!filterUpcoming)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              filterUpcoming ? 'bg-night text-bone shadow-sm' : 'bg-bone text-night/40 hover:text-night'
            }`}
          >
            Upcoming Only
          </button>

          {hasFilters && (
            <button
              onClick={() => {
                setFilterStoreId('');
                setFilterEventType('');
                setFilterStatus('');
                setFilterMethod('');
                setFilterPayment('');
                setDateRange(undefined);
                setFilterUpcoming(false);
              }}
              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-night transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">
          Loading...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-night/30">
          <Package size={48} className="mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isUnpaid       = order.paymentStatus === 'OPEN';
            const isHouseAccount = order.isHouseAccount;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-[2rem] border shadow-sm transition-all duration-300 overflow-hidden ${
                  isUnpaid
                    ? 'border-orange-200 opacity-75'
                    : order.isUpcoming
                    ? 'border-tumbleweed'
                    : 'border-tumbleweed/30 opacity-80'
                }`}
              >
                {/* Banner — Awaiting Payment */}
                {isUnpaid && (
                  <div className={`border-b px-6 py-2 flex items-center gap-2 ${
                    isHouseAccount
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    {isHouseAccount
                      ? <Receipt size={12} className="text-purple-500 shrink-0" />
                      : <LockKeyhole size={12} className="text-orange-500 shrink-0" />
                    }
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isHouseAccount ? 'text-purple-500' : 'text-orange-500'
                    }`}>
                      {isHouseAccount
                        ? 'House Account — Invoice pending. Override when client payment is confirmed.'
                        : 'Awaiting Payment — PDF and Calendar locked until payment is confirmed'}
                    </span>
                  </div>
                )}

                {/* Row header */}
                <div
                  className="p-6 flex items-center gap-4 cursor-pointer hover:bg-bone/40 transition-colors"
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                >
                  <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase border shrink-0 ${EVENT_TYPE_COLORS[order.eventType] || EVENT_TYPE_COLORS.NEEDS_REVIEW}`}>
                    {order.eventTypeLabel}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-night/30">#{order.displayNumber}</span>
                      <span className="font-black text-night text-sm truncate">{order.clientName}</span>
                      {isHouseAccount && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-100 text-purple-500 shrink-0">
                          House Acct
                        </span>
                      )}
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

                  {/* Payment status badge */}
                  <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${
                    isUnpaid && isHouseAccount
                      ? 'bg-purple-100 text-purple-600 border border-purple-200'
                      : PAYMENT_STATUS_STYLES[order.paymentStatus] || PAYMENT_STATUS_STYLES.OPEN
                  }`}>
                    {isHouseAccount && isUnpaid ? 'House Account' : order.paymentStatusLabel}
                  </span>

                  {/* Order status badge — solo si está pagado */}
                  {!isUnpaid && (
                    <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                      {order.statusLabel}
                    </span>
                  )}

                  <div className="text-night/30 shrink-0">
                    {expandedId === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === order.id && (
                  <div className="border-t border-tumbleweed/20 bg-bone/30 p-6 space-y-6">

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
                            : <ShoppingBag size={14} className="text-rose shrink-0 mt-0.5" />
                          }
                          <p className="text-[11px] text-night/70 font-medium leading-relaxed">
                            {order.deliveryAddress || 'Customer Pickup'}
                          </p>
                        </div>
                        {order.deliveryNotes && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-night/50 font-medium italic leading-relaxed">
                              {order.deliveryNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white rounded-2xl p-4 border border-tumbleweed/20">
                      <p className="text-[9px] font-black text-night/30 uppercase tracking-widest mb-3">Order Items</p>
                      <div className="space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="border-b border-tumbleweed/10 last:border-0 pb-3 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-black text-night/30 bg-bone px-2 py-0.5 rounded-lg shrink-0">
                                  ×{item.quantity}
                                </span>
                                <span className="font-black text-night text-sm">{item.displayName}</span>
                              </div>
                              <span className="text-[11px] font-bold text-night/40 shrink-0 ml-2">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.modifiers.length > 0 && (
                              <div className="ml-8 mt-1.5 flex flex-wrap gap-1.5">
                                {item.modifiers
                                  .filter(m => m.displayName && !m.displayName.startsWith('NO,') && !m.displayName.startsWith('No,'))
                                  .map((mod, mIdx) => (
                                    <span key={mIdx} className="text-[9px] font-bold bg-bone text-night/50 px-2 py-0.5 rounded-lg">
                                      {mod.displayName}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t border-tumbleweed/20 flex justify-between items-center">
                        <span className="text-[10px] font-black text-night/30 uppercase tracking-widest">Total</span>
                        <span className="font-black text-night text-lg">${parseFloat(order.totalAmount).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 justify-between items-center">
                      {isUnpaid ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                            isHouseAccount
                              ? 'bg-purple-50 border-purple-200'
                              : 'bg-orange-50 border-orange-200'
                          }`}>
                            {isHouseAccount
                              ? <Receipt size={13} className="text-purple-500" />
                              : <LockKeyhole size={13} className="text-orange-500" />
                            }
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              isHouseAccount ? 'text-purple-500' : 'text-orange-500'
                            }`}>
                              {isHouseAccount ? 'House Account — Invoice Pending' : 'Locked — Awaiting Payment'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleOverridePayment(order.id)}
                            disabled={isUpdating}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 ${
                              isHouseAccount
                                ? 'bg-purple-500 hover:bg-purple-600'
                                : 'bg-orange-500 hover:bg-orange-600'
                            }`}
                          >
                            {isHouseAccount ? 'Confirm Invoice Paid' : 'Override — Mark as Paid'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap items-center">
                          {['pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
                            <button
                              key={status}
                              onClick={() => handleStatusUpdate(order.id, status)}
                              disabled={isUpdating || order.status === status}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 ${
                                order.status === status
                                  ? 'bg-night text-bone cursor-default'
                                  : 'bg-bone text-night/40 hover:bg-night hover:text-bone'
                              }`}
                            >
                              {status}
                            </button>
                          ))}

                          <button
                            onClick={() => handleGeneratePdf(order.id, order.displayNumber)}
                            disabled={generatingPdf === order.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all active:scale-95 disabled:opacity-50"
                          >
                            <FileText size={13} />
                            {generatingPdf === order.id ? 'Generating...' : 'Fulfillment PDF'}
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setExpandedId(null)}
                        className="p-2 text-night/30 hover:text-rose transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}