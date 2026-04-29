"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import DateRangePicker from "@/components/DateRangePicker";
import { cateringApi } from "@/services/api/cateringApi";
import type { CateringOrder, CateringOrdersParams } from "@/services/api/cateringApi";
import { storesApi } from "@/services/api/storesApi";
import type { Store } from "@/services/api/storesApi";
import EditOrderModal from "@/components/EditOrderModal";
import {
  Search, ChevronDown, ChevronUp, Clock, User, Phone, Mail, Package,
  CheckCircle, AlertTriangle, X, Calendar, Truck, ShoppingBag, Filter,
  FileText, LockKeyhole, Receipt, CalendarDays, EyeOff, Pencil, Plus,
  RefreshCw, FlaskConical, Building2,
} from "lucide-react";

interface ApiError {
  response?: { data?: { error?: string } };
}

type TabType = "catering" | "house_accounts" | "space_rentals" | "needs_review";

const EVENT_TYPE_COLORS: Record<string, string> = {
  TACO_BAR:     "bg-rose/20 text-rose border-rose/30",
  BIRD_BOX:     "bg-sky/20 text-sky border-sky/30",
  PERSONAL_BOX: "bg-tumbleweed/30 text-night/70 border-tumbleweed",
  FOODA:        "bg-night/10 text-night border-night/20",
  NEEDS_REVIEW: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-500",
  completed: "bg-sky/20 text-sky",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  OPEN:   "bg-orange-100 text-orange-600 border border-orange-200",
  PAID:   "bg-emerald-50 text-emerald-600 border border-emerald-200",
  CLOSED: "bg-emerald-50 text-emerald-600 border border-emerald-200",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function formatPhone(phone: string) {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
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

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function CateringOrdersList({
  onNewOrder,
}: {
  onNewOrder?: (stores: Store[]) => void;
}) {
  const [orders, setOrders]               = useState<CateringOrder[]>([]);
  const [loading, setLoading]             = useState<boolean>(true);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showToast, setShowToast]         = useState<string | null>(null);
  const [isUpdating, setIsUpdating]       = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [stores, setStores]               = useState<Store[]>([]);
  const [editingOrder, setEditingOrder]   = useState<CateringOrder | null>(null);
  const [activeTab, setActiveTab]         = useState<TabType>("catering");
  const [syncingCalendar, setSyncingCalendar] = useState<string | null>(null);

  const [searchTerm, setSearchTerm]           = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterStatus, setFilterStatus]       = useState("");
  const [filterMethod, setFilterMethod]       = useState("");
  const [filterUpcoming, setFilterUpcoming]   = useState(false);
  const [filterPayment, setFilterPayment]     = useState("");
  const [filterToday, setFilterToday]         = useState(false);
  const [hideUnpaid, setHideUnpaid]           = useState(false);
  const [filterStoreId, setFilterStoreId]     = useState("");
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
      if (dateRange?.from) params.dateFrom       = format(dateRange.from, "yyyy-MM-dd");
      if (dateRange?.to)   params.dateTo         = format(dateRange.to, "yyyy-MM-dd") + "T23:59:59";
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
      triggerToast(`❌ ${error.response?.data?.error || "Error updating status"}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOverridePayment = async (id: string) => {
    setIsUpdating(true);
    try {
      await cateringApi.overridePaymentStatus(id, "CLOSED");
      triggerToast("Payment override applied — order is now active");
      await loadOrders();
    } catch (err: unknown) {
      const error = err as ApiError;
      triggerToast(`❌ ${error.response?.data?.error || "Error overriding payment"}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGeneratePdf = async (id: string, order: CateringOrder) => {
    setGeneratingPdf(id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/catering/orders/${id}/fulfillment-sheet`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob      = await response.blob();
      const url       = window.URL.createObjectURL(blob);
      const a         = document.createElement("a");
      a.href          = url;
      const eventTypeLabel = ({
        TACO_BAR: "TacoBar", BIRD_BOX: "BirdBox",
        PERSONAL_BOX: "PersonalBox", FOODA: "Fooda", NEEDS_REVIEW: "NeedsReview",
      } as Record<string, string>)[order.eventType] || order.eventType;
      const clientSlug = (order.clientName || "unknown")
        .replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
      const storeCode  = (order.storeCode || "LB").replace(/\s/g, "");
      const version    = order.pdfVersion || 1;
      a.download       = `${storeCode}_${clientSlug}_${eventTypeLabel}_V${version}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      triggerToast("PDF downloaded successfully");
      await loadOrders();
    } catch {
      triggerToast("❌ Error generating PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSyncCalendar = async (id: string) => {
    setSyncingCalendar(id);
    try {
      await cateringApi.syncCalendar(id);
      triggerToast("Calendar sync started — refreshing in a moment...");
      setTimeout(() => loadOrders(), 4000);
    } catch {
      triggerToast("❌ Error syncing calendar");
    } finally {
      setSyncingCalendar(null);
    }
  };

  // ─── TAB FILTERING ────────────────────────────────────────────────────────

  const cateringOrders      = orders.filter(o => !o.isHouseAccount && !o.isSpaceRental && o.eventType !== "NEEDS_REVIEW");
  const houseAccountOrders  = orders.filter(o => o.isHouseAccount);
  const spaceRentalOrders   = orders.filter(o => o.isSpaceRental && !o.isHouseAccount);
  const needsReviewOrders   = orders.filter(o => o.eventType === "NEEDS_REVIEW");

  const tabOrders = activeTab === "catering"       ? cateringOrders
                  : activeTab === "house_accounts" ? houseAccountOrders
                  : activeTab === "space_rentals"  ? spaceRentalOrders
                  : needsReviewOrders;

  const hasFilters = !!(filterStoreId || filterEventType || filterStatus || filterMethod ||
    dateRange || filterUpcoming || filterPayment || filterToday || hideUnpaid);

  const filteredOrders = tabOrders.filter(o => {
    const matchSearch     = !searchTerm ||
      o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.displayNumber?.includes(searchTerm) ||
      o.deliveryAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUpcoming   = !filterUpcoming || o.isUpcoming;
    const matchToday      = !filterToday || isToday(o.estimatedFulfillmentDate);
    const matchHideUnpaid = !hideUnpaid || o.paymentStatus !== "OPEN";
    return matchSearch && matchUpcoming && matchToday && matchHideUnpaid;
  });

  const unpaidCount         = tabOrders.filter(o => o.paymentStatus === "OPEN").length;
  const houseAccountCount   = orders.filter(o => o.isHouseAccount && o.paymentStatus === "OPEN").length;
  const spaceRentalUnpaid   = spaceRentalOrders.filter(o => o.paymentStatus === "OPEN").length;
  const todayCount          = tabOrders.filter(o => isToday(o.estimatedFulfillmentDate)).length;

  const tabs: { key: TabType; label: string; count: number; dotColor?: string }[] = [
    { key: "catering",       label: "Catering Events", count: cateringOrders.length    },
    { key: "house_accounts", label: "House Accounts",  count: houseAccountOrders.length, dotColor: houseAccountOrders.filter(o => o.paymentStatus === "OPEN").length > 0 ? "bg-purple-400" : undefined },
    { key: "space_rentals",  label: "Space Rentals",   count: spaceRentalOrders.length,  dotColor: spaceRentalUnpaid > 0 ? "bg-indigo-400" : undefined },
    { key: "needs_review",   label: "Needs Review",    count: needsReviewOrders.length,  dotColor: needsReviewOrders.length > 0 ? "bg-yellow-400" : undefined },
  ];

  // ─── ORDER CARD ───────────────────────────────────────────────────────────
  const renderOrder = (order: CateringOrder) => {
    const isUnpaid       = order.paymentStatus === "OPEN";
    const isHouseAccount = order.isHouseAccount;
    const isSpaceRental  = order.isSpaceRental;
    const isTodayOrder   = isToday(order.estimatedFulfillmentDate);
    const isTestOrder    = order.toastOrderGuid?.startsWith("MANUAL-");
    const isEdited       = order.isManuallyEdited && !isTestOrder;

    // Extraer info del Space Rental del primer line item que lo contenga
    const spaceRentalItem = isSpaceRental
      ? order.items.find(i => (i.displayName || "").toLowerCase().includes("space rental"))
      : null;

    return (
      <div key={order.id}
        className={`bg-white rounded-[2rem] border shadow-sm transition-all duration-300 overflow-hidden ${
          isTestOrder     ? "border-fuchsia-300 ring-1 ring-fuchsia-200"
          : isSpaceRental ? "border-indigo-300 ring-1 ring-indigo-100"
          : isUnpaid      ? "border-orange-200 opacity-75"
          : isTodayOrder  ? "border-sky ring-1 ring-sky/30"
          : order.isUpcoming ? "border-tumbleweed"
          : "border-tumbleweed/30 opacity-80"
        }`}>

        {/* Space Rental banner */}
        {isSpaceRental && (
          <div className="bg-indigo-600 px-6 py-2 flex items-center gap-2">
            <Building2 size={13} className="text-white shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
              Space Rental
              {spaceRentalItem && ` — ${spaceRentalItem.displayName}`}
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
            isHouseAccount  ? "bg-purple-50 border-purple-200"
            : isSpaceRental ? "bg-indigo-50 border-indigo-200"
            : "bg-orange-50 border-orange-200"
          }`}>
            {isHouseAccount
              ? <Receipt size={12} className="text-purple-500 shrink-0" />
              : isSpaceRental
              ? <Building2 size={12} className="text-indigo-500 shrink-0" />
              : <LockKeyhole size={12} className="text-orange-500 shrink-0" />}
            <span className={`text-[10px] font-black uppercase tracking-widest ${
              isHouseAccount ? "text-purple-500" : isSpaceRental ? "text-indigo-500" : "text-orange-500"
            }`}>
              {isHouseAccount
                ? "House Account — Invoice pending. Override when client payment is confirmed."
                : isSpaceRental
                ? "Space Rental — Awaiting payment confirmation."
                : "Awaiting Payment — PDF and Calendar locked until payment is confirmed"}
            </span>
          </div>
        )}

        <div className="p-6 flex items-center gap-4 cursor-pointer hover:bg-bone/40 transition-colors"
          onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>

          <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase border shrink-0 ${EVENT_TYPE_COLORS[order.eventType] || EVENT_TYPE_COLORS.NEEDS_REVIEW}`}>
            {order.eventTypeLabel}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-night/30">#{order.displayNumber}</span>
              <span className="font-black text-night text-sm truncate">{order.clientName}</span>
              {isTestOrder && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-fuchsia-500 text-white shrink-0 animate-pulse">TEST</span>
              )}
              {isHouseAccount && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-100 text-purple-500 shrink-0">House Acct</span>
              )}
              {isSpaceRental && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 shrink-0">Space Rental</span>
              )}
              {isTodayOrder && !isUnpaid && !isTestOrder && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky/20 text-sky shrink-0">Today</span>
              )}
              {isEdited && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 shrink-0">Edited</span>
              )}
            </div>
            <p className="text-[11px] text-night/40 font-medium truncate mt-0.5">
              {order.storeName} · {order.guestCount} guests
            </p>
          </div>

          <div className="text-right shrink-0 hidden md:block">
            <p className="text-[11px] font-black text-night/60">{formatDate(order.estimatedFulfillmentDate)}</p>
            <p className="text-[10px] text-night/30 font-medium mt-0.5">
              {order.deliveryMethod === "DELIVERY" ? "🚗 Delivery" : "🏪 Pickup"}
            </p>
          </div>

          <span className={`text-[9px] font-black tracking-[0.15em] px-3 py-1.5 rounded-full uppercase shrink-0 ${
            isUnpaid && isHouseAccount
              ? "bg-purple-100 text-purple-600 border border-purple-200"
              : isUnpaid && isSpaceRental
              ? "bg-indigo-100 text-indigo-600 border border-indigo-200"
              : PAYMENT_STATUS_STYLES[order.paymentStatus] || PAYMENT_STATUS_STYLES.OPEN
          }`}>
            {isHouseAccount && isUnpaid ? "House Account"
             : isSpaceRental && isUnpaid ? "Space Rental"
             : order.paymentStatusLabel}
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
                  {order.deliveryMethod === "DELIVERY" ? "Delivery" : "Pickup"}
                </p>
                <div className="flex items-start gap-2">
                  {order.deliveryMethod === "DELIVERY"
                    ? <Truck size={14} className="text-rose shrink-0 mt-0.5" />
                    : <ShoppingBag size={14} className="text-rose shrink-0 mt-0.5" />}
                  <p className="text-[11px] text-night/70 font-medium leading-relaxed">
                    {order.deliveryAddress || "Customer Pickup"}
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

            {order.items.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-tumbleweed/20">
                <p className="text-[9px] font-black text-night/30 uppercase tracking-widest mb-3">Order Items</p>
                <div className="space-y-3">
                  {order.items.map((item, idx) => {
                    const isRentalItem = (item.displayName || "").toLowerCase().includes("space rental");
                    return (
                      <div key={idx} className={`border-b border-tumbleweed/10 last:border-0 pb-3 last:pb-0 ${isRentalItem ? "bg-indigo-50 -mx-1 px-1 rounded-xl" : ""}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-black text-night/30 bg-bone px-2 py-0.5 rounded-lg shrink-0">×{item.quantity}</span>
                            <div>
                              <span className={`font-black text-sm ${isRentalItem ? "text-indigo-700" : "text-night"}`}>
                                {item.displayName}
                                {isRentalItem && <Building2 size={11} className="inline ml-1.5 text-indigo-500" />}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-night/40 shrink-0 ml-2">${item.price.toFixed(2)}</span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <div className="ml-8 mt-1.5 flex flex-wrap gap-1.5">
                            {item.modifiers
                              .filter(m => m.displayName && !m.displayName.startsWith("NO,"))
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

            {(order.pdfNeedsUpdate || order.calendarNeedsUpdate) && (
              <div className="flex flex-wrap gap-2 pb-2 border-b border-tumbleweed/20">
                {order.pdfNeedsUpdate && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 border border-amber-200">
                    <AlertTriangle size={11} />
                    PDF Outdated — Regenerating...
                  </span>
                )}
                {order.calendarNeedsUpdate && (
                  <button onClick={() => handleSyncCalendar(order.id)} disabled={syncingCalendar === order.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
                    <CalendarDays size={11} />
                    {syncingCalendar === order.id ? "Syncing..." : "Sync Calendar"}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-between items-center">
              {isUnpaid ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                    isHouseAccount  ? "bg-purple-50 border-purple-200"
                    : isSpaceRental ? "bg-indigo-50 border-indigo-200"
                    : "bg-orange-50 border-orange-200"
                  }`}>
                    {isHouseAccount
                      ? <Receipt size={13} className="text-purple-500" />
                      : isSpaceRental
                      ? <Building2 size={13} className="text-indigo-500" />
                      : <LockKeyhole size={13} className="text-orange-500" />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isHouseAccount ? "text-purple-500" : isSpaceRental ? "text-indigo-500" : "text-orange-500"
                    }`}>
                      {isHouseAccount ? "House Account — Invoice Pending"
                       : isSpaceRental ? "Space Rental — Awaiting Payment"
                       : "Locked — Awaiting Payment"}
                    </span>
                  </div>
                  <button onClick={() => handleOverridePayment(order.id)} disabled={isUpdating}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 ${
                      isHouseAccount  ? "bg-purple-500 hover:bg-purple-600"
                      : isSpaceRental ? "bg-indigo-500 hover:bg-indigo-600"
                      : "bg-orange-500 hover:bg-orange-600"
                    }`}>
                    {isHouseAccount ? "Confirm Invoice Paid"
                     : isSpaceRental ? "Confirm Space Rental Paid"
                     : "Override — Mark as Paid"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap items-center">
                  {["pending", "confirmed", "completed", "cancelled"].map(status => (
                    <button key={status} onClick={() => handleStatusUpdate(order.id, status)}
                      disabled={isUpdating || order.status === status}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 ${
                        order.status === status
                          ? "bg-night text-bone cursor-default"
                          : "bg-bone text-night/40 hover:bg-night hover:text-bone"
                      }`}>
                      {status}
                    </button>
                  ))}
                  <button onClick={() => handleGeneratePdf(order.id, order)} disabled={generatingPdf === order.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all active:scale-95 disabled:opacity-50">
                    <FileText size={13} />
                    {generatingPdf === order.id ? "Generating..." : "Fulfillment PDF"}
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
  };

  return (
    <div className="space-y-6 relative">

      {showToast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-black text-xs uppercase tracking-widest">{showToast}</span>
        </div>
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          stores={stores}
          onClose={() => setEditingOrder(null)}
          onSave={async () => {
            setEditingOrder(null);
            triggerToast("Order updated — regenerating PDF & Calendar...");
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
                {activeTab === "catering" && houseAccountCount > 0 && ` (${houseAccountCount} house account)`}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => onNewOrder?.(stores)}
          className="flex items-center gap-2 px-5 py-3 bg-night text-bone rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose hover:text-white transition-all">
          <Plus size={16} />
          New Order
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-bone p-1.5 rounded-2xl w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setExpandedId(null); }}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key ? "bg-white shadow-sm text-night" : "text-night/40 hover:text-night"
            }`}>
            {tab.key === "space_rentals" && <Building2 size={12} className={activeTab === tab.key ? "text-indigo-600" : "text-night/30"} />}
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                activeTab === tab.key ? "bg-night/10 text-night" : "bg-night/5 text-night/40"
              }`}>
                {tab.count}
              </span>
            )}
            {tab.dotColor && (
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${tab.dotColor}`} />
            )}
          </button>
        ))}
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
          {activeTab === "catering" && (
            <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)}
              className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer">
              <option value="">All Types</option>
              <option value="TACO_BAR">Taco Bar</option>
              <option value="BIRD_BOX">&apos;Bird Box</option>
              <option value="PERSONAL_BOX">Personal Box</option>
              <option value="FOODA">Fooda</option>
            </select>
          )}
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
              filterPayment === "OPEN" ? "bg-orange-100 text-orange-600" : "bg-bone text-night/60"
            }`}>
            <option value="">All Payments</option>
            <option value="OPEN">Awaiting Payment</option>
            <option value="PAID">Paid</option>
            <option value="CLOSED">Paid & Closed</option>
          </select>
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Date Range" />
          <button onClick={() => { setFilterToday(!filterToday); setDateRange(undefined); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              filterToday ? "bg-sky text-white shadow-sm" : "bg-bone text-night/40 hover:text-night"
            }`}>
            <CalendarDays size={12} />
            Today
            {todayCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${filterToday ? "bg-white/20" : "bg-sky/20 text-sky"}`}>
                {todayCount}
              </span>
            )}
          </button>
          <button onClick={() => setHideUnpaid(!hideUnpaid)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              hideUnpaid ? "bg-night text-bone shadow-sm" : "bg-bone text-night/40 hover:text-night"
            }`}>
            <EyeOff size={12} />
            Hide Unpaid
            {unpaidCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${hideUnpaid ? "bg-white/20" : "bg-orange-100 text-orange-500"}`}>
                {unpaidCount}
              </span>
            )}
          </button>
          <button onClick={() => setFilterUpcoming(!filterUpcoming)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              filterUpcoming ? "bg-night text-bone shadow-sm" : "bg-bone text-night/40 hover:text-night"
            }`}>
            Upcoming Only
          </button>
          {hasFilters && (
            <button onClick={() => {
              setFilterStoreId(""); setFilterEventType(""); setFilterStatus("");
              setFilterMethod(""); setFilterPayment(""); setDateRange(undefined);
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
          <p className="font-black uppercase tracking-widest text-sm">
            {activeTab === "catering"       ? "No catering orders found"
           : activeTab === "house_accounts" ? "No house accounts found"
           : activeTab === "space_rentals"  ? "No space rental orders found"
           : "No orders needing review"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => renderOrder(order))}
        </div>
      )}
    </div>
  );
}