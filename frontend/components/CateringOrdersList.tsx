'use client';

import type { Store } from '@/services/api/storesApi';
import EditOrderModal from '@/components/EditOrderModal';
import CateringOrderCard from '@/components/catering/CateringOrderCard';
import CateringOrderFilters from '@/components/catering/CateringOrderFilters';
import { useCateringOrders } from '@/components/catering/useCateringOrders';
import { StandaloneToast, TabGroup, PageHeader, EmptyState, LoadingSpinner } from '@/components/ui';
import { Building2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function CateringOrdersList({
  onNewOrder,
}: {
  onNewOrder?: (stores: Store[]) => void;
}) {
  const c = useCateringOrders();

  return (
    <div className="space-y-6 relative">

      {/* Toast */}
      <StandaloneToast message={c.toast} />

      {/* Edit modal */}
      {c.editingOrder && (
        <EditOrderModal
          order={c.editingOrder}
          stores={c.stores}
          onClose={() => c.setEditingOrder(null)}
          onSave={async () => {
            c.setEditingOrder(null);
            await c.loadOrders();
          }}
        />
      )}

      {/* Header */}
      <PageHeader
        title="Catering Orders"
        subtitle={
          <>
            <span>{c.filteredOrders.length} orders · {c.filteredOrders.filter(o => o.isUpcoming).length} upcoming</span>
            {c.todayCount > 0 && <span className="text-sky font-black">· {c.todayCount} today</span>}
            {c.unpaidCount > 0 && (
              <span className="text-orange-500 font-black">
                · {c.unpaidCount} awaiting payment
              </span>
            )}
          </>
        }
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={() => onNewOrder?.(c.stores)}>
            New Order
          </Button>
        }
      />

      {/* Tabs */}
      <TabGroup
        tabs={c.tabs.map(t => ({
          ...t,
          icon: t.key === 'space_rentals'
            ? <Building2 size={12} />
            : undefined,
        }))}
        active={c.activeTab}
        onChange={c.setActiveTab}
      />

      {/* Filters */}
      <CateringOrderFilters
        stores={c.stores}
        activeTab={c.activeTab}
        searchTerm={c.searchTerm}
        filterStoreId={c.filterStoreId}
        filterEventType={c.filterEventType}
        filterStatus={c.filterStatus}
        filterMethod={c.filterMethod}
        filterPayment={c.filterPayment}
        filterUpcoming={c.filterUpcoming}
        filterToday={c.filterToday}
        hideUnpaid={c.hideUnpaid}
        dateRange={c.dateRange}
        hasFilters={c.hasFilters}
        unpaidCount={c.unpaidCount}
        todayCount={c.todayCount}
        onSearchChange={c.setSearchTerm}
        onStoreChange={c.setFilterStoreId}
        onEventTypeChange={c.setFilterEventType}
        onStatusChange={c.setFilterStatus}
        onMethodChange={c.setFilterMethod}
        onPaymentChange={c.setFilterPayment}
        onUpcomingToggle={() => c.setFilterUpcoming(!c.filterUpcoming)}
        onTodayToggle={() => c.setFilterToday(!c.filterToday)}
        onHideUnpaidToggle={() => c.setHideUnpaid(!c.hideUnpaid)}
        onDateRangeChange={c.setDateRange}
        onClearFilters={c.clearFilters}
      />

      {/* Orders list */}
      {c.loading ? (
        <LoadingSpinner fullPage label="Loading orders..." />
      ) : c.filteredOrders.length === 0 ? (
        <EmptyState
          title={
            c.activeTab === 'catering'       ? 'No catering orders found'
            : c.activeTab === 'house_accounts' ? 'No house accounts found'
            : c.activeTab === 'space_rentals'  ? 'No space rental orders found'
            : 'No orders needing review'
          }
        />
      ) : (
        <div className="space-y-3">
          {c.filteredOrders.map(order => (
            <CateringOrderCard
              key={order.id}
              order={order}
              isExpanded={c.expandedId === order.id}
              isUpdating={c.isUpdating}
              generatingPdf={c.generatingPdf}
              syncingCalendar={c.syncingCalendar}
              onToggle={() => c.setExpandedId(c.expandedId === order.id ? null : order.id)}
              onStatusUpdate={c.handleStatusUpdate}
              onOverridePayment={c.handleOverridePayment}
              onGeneratePdf={c.handleGeneratePdf}
              onSyncCalendar={c.handleSyncCalendar}
              onEdit={() => c.setEditingOrder(order)}
              onCollapse={() => c.setExpandedId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}