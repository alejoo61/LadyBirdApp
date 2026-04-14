'use client';

import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import DateRangePicker from '@/components/DateRangePicker';
import { cateringApi } from '@/services/api/cateringApi';
import type { CateringOrder, CateringOrdersParams } from '@/services/api/cateringApi';
import { storesApi } from '@/services/api/storesApi';
import type { Store } from '@/services/api/storesApi';
import CreateOrderModal from '@/components/CreateOrderModal';
import {
  Search, ChevronDown, ChevronUp, Clock, User,
  Phone, Mail, Package, CheckCircle, AlertTriangle, X,
  Calendar, Truck, ShoppingBag, Filter, FileText, LockKeyhole,
  Receipt, CalendarDays, EyeOff, Pencil, Plus, RefreshCw,
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

const EVENT_TYPES     = ['TACO_BAR', 'BIRD_BOX', 'PERSONAL_BOX', 'FOODA', 'NEEDS_REVIEW'];
const DELIVERY_METHODS = ['PICKUP', 'DELIVERY'];
const STATUSES        = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['OPEN', 'PAID', 'CLOSED'];

const EMPTY_ORDER_FORM = {
  storeId:                  '',
  eventType:                'TACO_BAR',
  status:                   'pending',
  paymentStatus:            'CLOSED',
  clientName:               '',
  clientEmail:              '',
  clientPhone:              '',
  estimatedFulfillmentDate: '',
  deliveryMethod:           'PICKUP',
  deliveryAddress:          '',
  deliveryNotes:            '',
  guestCount:               0,
  totalAmount:              0,
  overrideNotes:            '',
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

function isToday(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function formatDatetimeLocal(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── EDIT ORDER MODAL ──────────────────────────────────────────────────────
function EditOrderModal({
  order,
  stores,
  onClose,
  onSave,
}: {
  order: CateringOrder;
  stores: Store[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    storeId:                  order.storeId || '',
    eventType:                order.eventType || 'TACO_BAR',
    status:                   order.status || 'pending',
    paymentStatus:            order.paymentStatus || 'OPEN',
    clientName:               order.clientName || '',
    clientEmail:              order.clientEmail || '',
    clientPhone:              order.clientPhone || '',
    estimatedFulfillmentDate: formatDatetimeLocal(order.estimatedFulfillmentDate),
    deliveryMethod:           order.deliveryMethod || 'PICKUP',
    deliveryAddress:          order.deliveryAddress || '',
    deliveryNotes:            order.deliveryNotes || '',
    guestCount:               order.guestCount || 0,
    totalAmount:              parseFloat(String(order.totalAmount)) || 0,
    overrideNotes:            order.overrideNotes || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.clientName || !form.eventType || !form.estimatedFulfillmentDate) {
      setError('Client name, event type and event date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await cateringApi.updateManual(order.id, {
        ...form,
        estimatedFulfillmentDate: new Date(form.estimatedFulfillmentDate).toISOString(),
        guestCount:  Number(form.guestCount),
        totalAmount: String(form.totalAmount),
      } as never);
      onSave();
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Error saving order');
    } finally {
      setSaving(false);
    }
  };

  const inputCls  = 'w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night';
  const selectCls = inputCls + ' cursor-pointer';
  const labelCls  = 'text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-8 pb-4 shrink-0">
          <h3 className="text-xl font-black text-night uppercase italic tracking-tight">Edit Order</h3>
          <button onClick={onClose} className="p-2 text-night/30 hover:text-rose transition-colors rounded-xl hover:bg-rose/10">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-8 pb-4 space-y-5 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Store *</label>
              <select value={form.storeId} onChange={e => set('storeId', e.target.value)} className={selectCls}>
                <option value="">Select store...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Event Type *</label>
              <select value={form.eventType} onChange={e => set('eventType', e.target.value)} className={selectCls}>
                {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Client Name *</label>
            <input type="text" value={form.clientName} onChange={e => set('clientName', e.target.value)}
              className={inputCls} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)}
                className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                className={inputCls} placeholder="(000) 000-0000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Event Date & Time *</label>
              <input type="datetime-local" value={form.estimatedFulfillmentDate}
                onChange={e => set('estimatedFulfillmentDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Guest Count</label>
              <input type="number" value={form.guestCount} onChange={e => set('guestCount', e.target.value)}
                className={inputCls} min={0} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Delivery Method</label>
              <select value={form.deliveryMethod} onChange={e => set('deliveryMethod', e.target.value)} className={selectCls}>
                {DELIVERY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Total Amount ($)</label>
              <input type="number" step="0.01" value={form.totalAmount}
                onChange={e => set('totalAmount', e.target.value)} className={inputCls} min={0} />
            </div>
          </div>

          {form.deliveryMethod === 'DELIVERY' && (
            <div>
              <label className={labelCls}>Delivery Address</label>
              <input type="text" value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)}
                className={inputCls} placeholder="Full address" />
            </div>
          )}

          <div>
            <label className={labelCls}>Delivery Notes</label>
            <textarea value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)}
              className={inputCls + ' resize-none'} rows={2} placeholder="Special instructions..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={selectCls}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Status</label>
              <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)} className={selectCls}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.overrideNotes} onChange={e => set('overrideNotes', e.target.value)}
              className={inputCls + ' resize-none'} rows={2} placeholder="Notes for the team..." />
          </div>

          {error && (
            <p className="p-3 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-red-100">
              {error}
            </p>
          )}
        </div>

        <div className="p-8 pt-4 flex gap-3 justify-end shrink-0 border-t border-tumbleweed/20">
          <button onClick={onClose}
            className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-bone text-night/40 hover:text-night transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-night text-bone hover:bg-rose hover:text-white transition-all disabled:opacity-40">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function CateringOrdersList() {
  const [orders, setOrders]             = useState<CateringOrder[]>([]);
  const [loading, setLoading]           = useState<boolean>(true);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [showToast, setShowToast]       = useState<string | null>(null);
  const [isUpdating, setIsUpdating]     = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [stores, setStores]             = useState<Store[]>([]);
  const [editingOrder, setEditingOrder] = useState<CateringOrder | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

  const [searchTerm, setSearchTerm]           = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterStatus, setFilterStatus]       = useState('');
  const [filterMethod, setFilterMethod]       = useState('');
  const [filterUpcoming, setFilterUpcoming]   = useState(false);
  const [filterPayment, setFilterPayment]     = useState('');
  const [filterToday, setFilterToday]         = useState(false);
  const [hideUnpaid, setHideUnpaid]           = useState(false);
  const [filterStoreId, setFilterStoreId]     = useState('');
  const [dateRange, setDateRange]             = useState<DateRange | undefined>(undefined);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadOrders(); }, [filterEventType, filterStatus, filterMethod, filterStoreId, dateRange, filterPayment]);

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

  const handleGeneratePdf = async (id: string, order: CateringOrder) => {
    setGeneratingPdf(id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/catering/orders/${id}/fulfillment-sheet`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob       = await response.blob();
      const url        = window.URL.createObjectURL(blob);
      const a          = document.createElement('a');
      a.href           = url;
      const eventCode  = ({ TACO_BAR: 'TB', BIRD_BOX: 'BB', PERSONAL_BOX: 'PB', FOODA: 'FD', NEEDS_REVIEW: 'NR' } as Record<string,string>)[order.eventType] || 'XX';
      const clientSlug = (order.clientName || 'unknown').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
      const storeCode  = (order.storeCode || 'LB').replace(/\s/g, '');
      a.download       = `LB-${storeCode}-${clientSlug}-${eventCode}-v1.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      triggerToast('PDF downloaded successfully');
    } catch {
      triggerToast('❌ Error generating PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const hasFilters = !!(filterStoreId || filterEventType || filterStatus || filterMethod ||
    dateRange || filterUpcoming || filterPayment || filterToday || hideUnpaid);

  const filteredOrders = orders.filter(o => {
    const matchSearch     = !searchTerm ||
      o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.displayNumber?.includes(searchTerm) ||
      o.deliveryAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUpcoming   = !filterUpcoming || o.isUpcoming;
    const matchToday      = !filterToday || isToday(o.estimatedFulfillmentDate);
    const matchHideUnpaid = !hideUnpaid || o.paymentStatus !== 'OPEN';
    return matchSearch && matchUpcoming && matchToday && matchHideUnpaid;
  });

  const unpaidCount       = orders.filter(o => o.paymentStatus === 'OPEN').length;
  const houseAccountCount = orders.filter(o => o.isHouseAccount && o.paymentStatus === 'OPEN').length;
  const todayCount        = orders.filter(o => isToday(o.estimatedFulfillmentDate)).length;

  return (
    <div className="space-y-6 relative">

      {/* Toast */}
      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-black text-xs uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          stores={stores}
          onClose={() => setEditingOrder(null)}
          onSave={async () => {
            setEditingOrder(null);
            triggerToast('Order updated successfully');
            await loadOrders();
          }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateOrderModal
          stores={stores}
          onClose={() => setShowCreate(false)}
          onSave={async () => {
            setShowCreate(false);
            triggerToast('Order created successfully');
            await loadOrders();
          }}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">Catering Orders</h2>
          <p className="text-sm text-night/50 font-medium flex items-center gap-2 flex-wrap">
            <span>{filteredOrders.length} orders · {filteredOrders.filter(o => o.isUpcoming).length} upcoming</span>
            {todayCount > 0 && <span className="text-sky font-black">· {todayCount} today</span>}
            {unpaidCount > 0 && (
              <span className="text-orange-500 font-black">
                · {unpaidCount} awaiting payment
                {houseAccountCount > 0 && ` (${houseAccountCount} house account)`}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-3 bg-night text-bone rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose hover:text-white transition-all">
          <Plus size={16} />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30" size={18} />
          <input type="text" placeholder="Search by client, order #, address..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night transition-all text-sm font-bold text-night" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-night/30 ml-1" />

          <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Types</option>
            <option value="TACO_BAR">Taco Bar</option>
            <option value="BIRD_BOX">&apos;Bird Box</option>
            <option value="PERSONAL_BOX">Personal Box</option>
            <option value="FOODA">Fooda</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
            <option value="">All Methods</option>
            <option value="DELIVERY">Delivery</option>
            <option value="PICKUP">Pickup</option>
          </select>

          <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-none outline-none cursor-pointer ${
              filterPayment === 'OPEN' ? 'bg-orange-100 text-orange-600' : 'bg-bone text-night/60'
            }`}>
            <option value="">All Payments</option>
            <option value="OPEN">Awaiting Payment</option>
            <option value="PAID">Paid</option>
            <option value="CLOSED">Paid & Closed</option>
          </select>

          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Date Range" />

          <button onClick={() => { setFilterToday(!filterToday); setDateRange(undefined); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              filterToday ? 'bg-sky text-white shadow-sm' : 'bg-bone text-night/40 hover:text-night'
            }`}>
            <CalendarDays size={12} />
            Today
            {todayCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${filterToday ? 'bg-white/20' : 'bg-sky/20 text-sky'}`}>
                {todayCount}
              </span>
            )}
          </button>

          <button onClick={() => setHideUnpaid(!hideUnpaid)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              hideUnpaid ? 'bg-night text-bone shadow-sm' : 'bg-bone text-night/40 hover:text-night'
            }`}>
            <EyeOff size={12} />
            Hide Unpaid
            {unpaidCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${hideUnpaid ? 'bg-white/20' : 'bg-orange-100 text-orange-500'}`}>
                {unpaidCount}
              </span>
            )}
          </button>

          <button onClick={() => setFilterUpcoming(!filterUpcoming)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              filterUpcoming ? 'bg-night text-bone shadow-sm' : 'bg-bone text-night/40 hover:text-night'
            }`}>
            Upcoming Only
          </button>

          {hasFilters && (
            <button onClick={() => {
              setFilterStoreId(''); setFilterEventType(''); setFilterStatus('');
              setFilterMethod(''); setFilterPayment(''); setDateRange(undefined);
              setFilterUpcoming(false); setFilterToday(false); setHideUnpaid(false);
            }} className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-night transition-all">
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">Loading...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-night/30">
          <Package size={48} className="mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const isUnpaid       = order.paymentStatus === 'OPEN';
            const isHouseAccount = order.isHouseAccount;
            const isTodayOrder   = isToday(order.estimatedFulfillmentDate);
            const isEdited       = order.isManuallyEdited;

            return (
              <div key={order.id}
                className={`bg-white rounded-[2rem] border shadow-sm transition-all duration-300 overflow-hidden ${
                  isUnpaid ? 'border-orange-200 opacity-75'
                  : isTodayOrder ? 'border-sky ring-1 ring-sky/30'
                  : order.isUpcoming ? 'border-tumbleweed'
                  : 'border-tumbleweed/30 opacity-80'
                }`}>

                {isTodayOrder && !isUnpaid && (
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
                    isHouseAccount ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'
                  }`}>
                    {isHouseAccount
                      ? <Receipt size={12} className="text-purple-500 shrink-0" />
                      : <LockKeyhole size={12} className="text-orange-500 shrink-0" />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isHouseAccount ? 'text-purple-500' : 'text-orange-500'}`}>
                      {isHouseAccount
                        ? 'House Account — Invoice pending. Override when client payment is confirmed.'
                        : 'Awaiting Payment — PDF and Calendar locked until payment is confirmed'}
                    </span>
                  </div>
                )}

                <div className="p-6 flex items-center gap-4 cursor-pointer hover:bg-bone/40 transition-colors"
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>

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
                      {isTodayOrder && !isUnpaid && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky/20 text-sky shrink-0">
                          Today
                        </span>
                      )}
                      {isEdited && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 shrink-0">
                          Edited
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

                  <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${
                    isUnpaid && isHouseAccount
                      ? 'bg-purple-100 text-purple-600 border border-purple-200'
                      : PAYMENT_STATUS_STYLES[order.paymentStatus] || PAYMENT_STATUS_STYLES.OPEN
                  }`}>
                    {isHouseAccount && isUnpaid ? 'House Account' : order.paymentStatusLabel}
                  </span>

                  {!isUnpaid && (
                    <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                      {order.statusLabel}
                    </span>
                  )}

                  <div className="text-night/30 shrink-0">
                    {expandedId === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="border-t border-tumbleweed/20 bg-bone/30 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <p className="text-[10px] text-night/50 font-medium italic leading-relaxed">
                              {order.deliveryNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {order.items.length > 0 && (
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
                                    .filter(m => m.displayName && !m.displayName.startsWith('NO,'))
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
                          <span className="font-black text-night text-lg">${parseFloat(String(order.totalAmount)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {order.overrideNotes && (
                      <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
                        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-1">Internal Notes</p>
                        <p className="text-[11px] text-night/70 font-medium">{order.overrideNotes}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 justify-between items-center">
                      {isUnpaid ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                            isHouseAccount ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'
                          }`}>
                            {isHouseAccount
                              ? <Receipt size={13} className="text-purple-500" />
                              : <LockKeyhole size={13} className="text-orange-500" />}
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isHouseAccount ? 'text-purple-500' : 'text-orange-500'}`}>
                              {isHouseAccount ? 'House Account — Invoice Pending' : 'Locked — Awaiting Payment'}
                            </span>
                          </div>
                          <button onClick={() => handleOverridePayment(order.id)} disabled={isUpdating}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 ${
                              isHouseAccount ? 'bg-purple-500 hover:bg-purple-600' : 'bg-orange-500 hover:bg-orange-600'
                            }`}>
                            {isHouseAccount ? 'Confirm Invoice Paid' : 'Override — Mark as Paid'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap items-center">
                          {['pending', 'confirmed', 'completed', 'cancelled'].map(status => (
                            <button key={status}
                              onClick={() => handleStatusUpdate(order.id, status)}
                              disabled={isUpdating || order.status === status}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 ${
                                order.status === status
                                  ? 'bg-night text-bone cursor-default'
                                  : 'bg-bone text-night/40 hover:bg-night hover:text-bone'
                              }`}>
                              {status}
                            </button>
                          ))}
                          <button onClick={() => handleGeneratePdf(order.id, order)}
                            disabled={generatingPdf === order.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all active:scale-95 disabled:opacity-50">
                            <FileText size={13} />
                            {generatingPdf === order.id ? 'Generating...' : 'Fulfillment PDF'}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); setEditingOrder(order); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-bone text-night/40 hover:bg-night hover:text-bone transition-all">
                          <Pencil size={13} />
                          Edit
                        </button>
                        <button onClick={() => setExpandedId(null)}
                          className="p-2 text-night/30 hover:text-rose transition-colors">
                          <X size={18} />
                        </button>
                      </div>
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