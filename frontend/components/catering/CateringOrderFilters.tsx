'use client';

import { DateRange } from 'react-day-picker';
import DateRangePicker from '@/components/DateRangePicker';
import type { Store } from '@/services/api/storesApi';
import type { OrderTabType } from './orderUtils';
import { Filter, CalendarDays, EyeOff } from 'lucide-react';
import { SearchInput } from '@/components/ui';

interface CateringOrderFiltersProps {
  stores:           Store[];
  activeTab:        OrderTabType;
  searchTerm:       string;
  filterStoreId:    string;
  filterEventType:  string;
  filterStatus:     string;
  filterMethod:     string;
  filterPayment:    string;
  filterUpcoming:   boolean;
  filterToday:      boolean;
  hideUnpaid:       boolean;
  dateRange:        DateRange | undefined;
  hasFilters:       boolean;
  unpaidCount:      number;
  todayCount:       number;
  onSearchChange:        (v: string) => void;
  onStoreChange:         (v: string) => void;
  onEventTypeChange:     (v: string) => void;
  onStatusChange:        (v: string) => void;
  onMethodChange:        (v: string) => void;
  onPaymentChange:       (v: string) => void;
  onUpcomingToggle:      () => void;
  onTodayToggle:         () => void;
  onHideUnpaidToggle:    () => void;
  onDateRangeChange:     (range: DateRange | undefined) => void;
  onClearFilters:        () => void;
}

const selectCls = 'px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer';

export default function CateringOrderFilters({
  stores, activeTab,
  searchTerm, filterStoreId, filterEventType, filterStatus,
  filterMethod, filterPayment, filterUpcoming, filterToday,
  hideUnpaid, dateRange, hasFilters, unpaidCount, todayCount,
  onSearchChange, onStoreChange, onEventTypeChange, onStatusChange,
  onMethodChange, onPaymentChange, onUpcomingToggle, onTodayToggle,
  onHideUnpaidToggle, onDateRangeChange, onClearFilters,
}: CateringOrderFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed space-y-3">
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        placeholder="Search by client, order #, address..."
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-night/30 ml-1" />

        <select value={filterStoreId} onChange={e => onStoreChange(e.target.value)} className={selectCls}>
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {activeTab === 'catering' && (
          <select value={filterEventType} onChange={e => onEventTypeChange(e.target.value)} className={selectCls}>
            <option value="">All Types</option>
            <option value="TACO_BAR">Taco Bar</option>
            <option value="BIRD_BOX">&apos;Bird Box</option>
            <option value="PERSONAL_BOX">Personal Box</option>
            <option value="FOODA">Fooda</option>
          </select>
        )}

        <select value={filterStatus} onChange={e => onStatusChange(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select value={filterMethod} onChange={e => onMethodChange(e.target.value)} className={selectCls}>
          <option value="">All Methods</option>
          <option value="DELIVERY">Delivery</option>
          <option value="PICKUP">Pickup</option>
        </select>

        <select
          value={filterPayment}
          onChange={e => onPaymentChange(e.target.value)}
          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-none outline-none cursor-pointer ${
            filterPayment === 'OPEN' ? 'bg-orange-100 text-orange-600' : 'bg-bone text-night/60'
          }`}>
          <option value="">All Payments</option>
          <option value="OPEN">Awaiting Payment</option>
          <option value="PAID">Paid</option>
          <option value="CLOSED">Paid & Closed</option>
        </select>

        <DateRangePicker value={dateRange} onChange={onDateRangeChange} placeholder="Date Range" />

        <button
          onClick={() => { onTodayToggle(); onDateRangeChange(undefined); }}
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

        <button
          onClick={onHideUnpaidToggle}
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

        <button
          onClick={onUpcomingToggle}
          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            filterUpcoming ? 'bg-night text-bone shadow-sm' : 'bg-bone text-night/40 hover:text-night'
          }`}>
          Upcoming Only
        </button>

        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-night transition-all">
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}