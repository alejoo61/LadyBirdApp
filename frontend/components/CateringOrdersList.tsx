'use client';

import { useState } from 'react';
import type { Store } from '@/services/api/storesApi';
import EditOrderModal from '@/components/EditOrderModal';
import CateringOrderCard from '@/components/catering/CateringOrderCard';
import CateringOrderFilters from '@/components/catering/CateringOrderFilters';
import ManualFulfillmentWizard from '@/components/catering/ManualFulfillmentWizard';
import { useCateringOrders } from '@/components/catering/useCateringOrders';
import { StandaloneToast, TabGroup, PageHeader, EmptyState, LoadingSpinner } from '@/components/ui';
import { Building2, Plus, ClipboardList } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function CateringOrdersList({
  onNewOrder,
}: {
  onNewOrder?: (stores: Store[]) => void;
}) {
  const c = useCateringOrders();
  const [showManualWizard, setShowManualWizard] = useState(false);

  return (
    <div className="space-y-6 relative">

      <StandaloneToast message={c.toast} />

      {c.editingOrder && !c.editingOrder.isManualSheet && (
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

      {/* Manual sheets use the wizard in edit mode */}
      {(showManualWizard || (c.editingOrder?.isManualSheet)) && (
        <ManualFulfillmentWizard
          stores={c.stores}
          editingOrder={c.editingOrder?.isManualSheet ? c.editingOrder : undefined}
          onClose={() => {
            setShowManualWizard(false);
            c.setEditingOrder(null);
          }}
          onSuccess={() => {
            c.setEditingOrder(null);
            c.loadOrders();
          }}
        />
      )}

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
          <div className="flex gap-2">
            <Button
              icon={<ClipboardList size={16} />}
              variant="secondary"
              onClick={() => setShowManualWizard(true)}>
              Manual Sheet
            </Button>
            <Button
              icon={<Plus size={16} />}
              onClick={() => onNewOrder?.(c.stores)}>
              New Order
            </Button>
          </div>
        }
      />

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
        filterManualSheet={c.filterManualSheet}
        hideUnpaid={c.hideUnpaid}
        dateRange={c.dateRange}
        hasFilters={c.hasFilters}
        unpaidCount={c.unpaidCount}
        todayCount={c.todayCount}
        manualSheetCount={c.manualSheetCount}
        onSearchChange={c.setSearchTerm}
        onStoreChange={c.setFilterStoreId}
        onEventTypeChange={c.setFilterEventType}
        onStatusChange={c.setFilterStatus}
        onMethodChange={c.setFilterMethod}
        onPaymentChange={c.setFilterPayment}
        onUpcomingToggle={() => c.setFilterUpcoming(!c.filterUpcoming)}
        onTodayToggle={() => c.setFilterToday(!c.filterToday)}
        onManualSheetToggle={() => c.setFilterManualSheet(!c.filterManualSheet)}
        onHideUnpaidToggle={() => c.setHideUnpaid(!c.hideUnpaid)}
        onDateRangeChange={c.setDateRange}
        onClearFilters={c.clearFilters}
      />

      {c.loading ? (
        <LoadingSpinner fullPage label="Loading orders..." />
      ) : c.filteredOrders.length === 0 ? (
        <EmptyState
          title={
            c.activeTab === 'catering'         ? 'No catering orders found'
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
              generatingLabels={c.generatingLabels}
              syncingCalendar={c.syncingCalendar}
              onToggle={() => c.setExpandedId(c.expandedId === order.id ? null : order.id)}
              onStatusUpdate={c.handleStatusUpdate}
              onOverridePayment={c.handleOverridePayment}
              onGeneratePdf={c.handleGeneratePdf}
              onGenerateLabels={c.handleGenerateLabels}
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