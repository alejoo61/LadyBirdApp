'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cateringApi } from '@/services/api/cateringApi';
import type { CateringOrder, CateringOrdersParams } from '@/services/api/cateringApi';
import { storesApi } from '@/services/api/storesApi';
import type { Store } from '@/services/api/storesApi';
import { isToday, type OrderTabType } from './orderUtils';

interface ApiError {
  response?: { data?: { error?: string } };
}

export function useCateringOrders() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [orders, setOrders]   = useState<CateringOrder[]>([]);
  const [stores, setStores]   = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<CateringOrder | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<OrderTabType>('catering');

  // ── Loading states ────────────────────────────────────────────────────────
  const [isUpdating, setIsUpdating]         = useState(false);
  const [generatingPdf, setGeneratingPdf]   = useState<string | null>(null);
  const [syncingCalendar, setSyncingCalendar] = useState<string | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]           = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterStatus, setFilterStatus]       = useState('');
  const [filterMethod, setFilterMethod]       = useState('');
  const [filterPayment, setFilterPayment]     = useState('');
  const [filterStoreId, setFilterStoreId]     = useState('');
  const [filterUpcoming, setFilterUpcoming]   = useState(false);
  const [filterToday, setFilterToday]         = useState(false);
  const [hideUnpaid, setHideUnpaid]           = useState(false);
  const [dateRange, setDateRange]             = useState<DateRange | undefined>(undefined);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const triggerToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Load stores ───────────────────────────────────────────────────────────
  const loadStores = useCallback(async () => {
    try {
      const res = await storesApi.getAll({ active: true });
      setStores(res.data.data);
    } catch (err) { console.error(err); }
  }, []);

  // ── Load orders ───────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
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
  }, [filterEventType, filterStatus, filterMethod, filterStoreId, filterPayment, dateRange]);

  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStatusUpdate = useCallback(async (id: string, status: string) => {
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
  }, [loadOrders, triggerToast]);

  const handleOverridePayment = useCallback(async (id: string) => {
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
  }, [loadOrders, triggerToast]);

  const handleGeneratePdf = useCallback(async (id: string, order: CateringOrder) => {
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
      const eventTypeLabel = ({
        TACO_BAR: 'TacoBar', BIRD_BOX: 'BirdBox',
        PERSONAL_BOX: 'PersonalBox', FOODA: 'Fooda', NEEDS_REVIEW: 'NeedsReview',
      } as Record<string, string>)[order.eventType] || order.eventType;
      const clientSlug = (order.clientName || 'unknown')
        .replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
      const storeCode  = (order.storeCode || 'LB').replace(/\s/g, '');
      a.download       = `${storeCode}_${clientSlug}_${eventTypeLabel}_V${order.pdfVersion || 1}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      triggerToast('PDF downloaded successfully');
      await loadOrders();
    } catch {
      triggerToast('❌ Error generating PDF');
    } finally {
      setGeneratingPdf(null);
    }
  }, [loadOrders, triggerToast]);

  const handleSyncCalendar = useCallback(async (id: string) => {
    setSyncingCalendar(id);
    try {
      await cateringApi.syncCalendar(id);
      triggerToast('Calendar sync started — refreshing in a moment...');
      setTimeout(() => loadOrders(), 4000);
    } catch {
      triggerToast('❌ Error syncing calendar');
    } finally {
      setSyncingCalendar(null);
    }
  }, [loadOrders, triggerToast]);

  const clearFilters = useCallback(() => {
    setFilterStoreId('');
    setFilterEventType('');
    setFilterStatus('');
    setFilterMethod('');
    setFilterPayment('');
    setDateRange(undefined);
    setFilterUpcoming(false);
    setFilterToday(false);
    setHideUnpaid(false);
  }, []);

  // ── Tab filtering ─────────────────────────────────────────────────────────
  const cateringOrders     = orders.filter(o => !o.isHouseAccount && !o.isSpaceRental && o.eventType !== 'NEEDS_REVIEW');
  const houseAccountOrders = orders.filter(o => o.isHouseAccount);
  const spaceRentalOrders  = orders.filter(o => o.isSpaceRental && !o.isHouseAccount);
  const needsReviewOrders  = orders.filter(o => o.eventType === 'NEEDS_REVIEW');

  const tabOrders = activeTab === 'catering'       ? cateringOrders
                  : activeTab === 'house_accounts' ? houseAccountOrders
                  : activeTab === 'space_rentals'  ? spaceRentalOrders
                  : needsReviewOrders;

  const filteredOrders = tabOrders.filter(o => {
    const matchSearch     = !searchTerm ||
      o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.displayNumber?.includes(searchTerm) ||
      o.deliveryAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUpcoming   = !filterUpcoming || o.isUpcoming;
    const matchToday      = !filterToday    || isToday(o.estimatedFulfillmentDate);
    const matchHideUnpaid = !hideUnpaid     || o.paymentStatus !== 'OPEN';
    return matchSearch && matchUpcoming && matchToday && matchHideUnpaid;
  });

  const hasFilters = !!(filterStoreId || filterEventType || filterStatus || filterMethod ||
    dateRange || filterUpcoming || filterPayment || filterToday || hideUnpaid);

  // ── Counts ────────────────────────────────────────────────────────────────
  const unpaidCount       = tabOrders.filter(o => o.paymentStatus === 'OPEN').length;
  const houseAccountCount = orders.filter(o => o.isHouseAccount && o.paymentStatus === 'OPEN').length;
  const spaceRentalUnpaid = spaceRentalOrders.filter(o => o.paymentStatus === 'OPEN').length;
  const todayCount        = tabOrders.filter(o => isToday(o.estimatedFulfillmentDate)).length;

  const tabs = [
    { key: 'catering'       as OrderTabType, label: 'Catering Events', count: cateringOrders.length     },
    { key: 'house_accounts' as OrderTabType, label: 'House Accounts',  count: houseAccountOrders.length, dotColor: houseAccountOrders.filter(o => o.paymentStatus === 'OPEN').length > 0 ? 'bg-purple-400' : undefined },
    { key: 'space_rentals'  as OrderTabType, label: 'Space Rentals',   count: spaceRentalOrders.length,  dotColor: spaceRentalUnpaid > 0 ? 'bg-indigo-400' : undefined },
    { key: 'needs_review'   as OrderTabType, label: 'Needs Review',    count: needsReviewOrders.length,  dotColor: needsReviewOrders.length > 0 ? 'bg-yellow-400' : undefined },
  ];

  return {
    // Data
    orders, stores, loading, filteredOrders,
    // UI state
    expandedId, setExpandedId,
    editingOrder, setEditingOrder,
    toast, activeTab,
    setActiveTab: (tab: OrderTabType) => { setActiveTab(tab); setExpandedId(null); },
    // Loading states
    isUpdating, generatingPdf, syncingCalendar,
    // Filters
    searchTerm, setSearchTerm,
    filterEventType, setFilterEventType,
    filterStatus, setFilterStatus,
    filterMethod, setFilterMethod,
    filterPayment, setFilterPayment,
    filterStoreId, setFilterStoreId,
    filterUpcoming, setFilterUpcoming,
    filterToday, setFilterToday,
    hideUnpaid, setHideUnpaid,
    dateRange, setDateRange,
    hasFilters, clearFilters,
    // Counts
    unpaidCount, houseAccountCount, todayCount,
    // Tabs
    tabs,
    // Actions
    handleStatusUpdate,
    handleOverridePayment,
    handleGeneratePdf,
    handleSyncCalendar,
    loadOrders,
  };
}