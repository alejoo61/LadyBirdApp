// src/mappers/CateringOrderMapper.js
const CateringOrder = require('../entities/CateringOrder');

class CateringOrderMapper {
  static toDomain(row) {
    if (!row) return null;

    let parsedData   = row.parsed_data;
    let overrideData = row.override_data;

    if (typeof parsedData === 'string') {
      try { parsedData = JSON.parse(parsedData); } catch { parsedData = {}; }
    }
    if (typeof overrideData === 'string') {
      try { overrideData = JSON.parse(overrideData); } catch { overrideData = {}; }
    }

    const entity = new CateringOrder({
      id:                       row.id,
      storeId:                  row.store_id,
      toastOrderId:             row.toast_order_id,
      toastOrderGuid:           row.toast_order_guid,
      displayNumber:            row.display_number,
      eventType:                row.event_type,
      status:                   row.status,
      clientName:               row.client_name,
      clientEmail:              row.client_email,
      clientPhone:              row.client_phone,
      orderDate:                row.order_date,
      estimatedFulfillmentDate: row.estimated_fulfillment_date,
      businessDate:             row.business_date,
      deliveryMethod:           row.delivery_method,
      deliveryAddress:          row.delivery_address,
      deliveryNotes:            row.delivery_notes,
      driverName:               row.driver_name,
      parsedData,
      guestCount:               row.guest_count,
      totalAmount:              row.total_amount,
      overrideData,
      overrideNotes:            row.override_notes,
      createdAt:                row.created_at,
      updatedAt:                row.updated_at,
    });

    entity.paymentStatus     = row.payment_status    || 'OPEN';
    entity.isManuallyEdited  = row.is_manually_edited || false;

    return entity;
  }

  static toDTO(order) {
    if (!order) return null;
    const entity = order instanceof CateringOrder ? order : this.toDomain(order);

    return {
      id:                       entity.id,
      storeId:                  entity.storeId,
      storeName:                entity.storeName,
      storeCode:                entity.storeCode,
      toastOrderGuid:           entity.toastOrderGuid,
      displayNumber:            entity.displayNumber,
      eventType:                entity.eventType,
      eventTypeLabel:           entity.getEventTypeLabel(),
      status:                   entity.status,
      statusLabel:              entity.getStatusLabel(),
      paymentStatus:            entity.paymentStatus || 'OPEN',
      paymentStatusLabel:       this._getPaymentStatusLabel(entity.paymentStatus),
      isPaid:                   ['PAID', 'CLOSED'].includes(entity.paymentStatus),
      isHouseAccount:           entity.parsedData?.isHouseAccount || false,
      isManuallyEdited:         entity.isManuallyEdited || false,
      clientName:               entity.clientName,
      clientEmail:              entity.clientEmail,
      clientPhone:              entity.clientPhone,
      orderDate:                entity.orderDate,
      estimatedFulfillmentDate: entity.estimatedFulfillmentDate,
      kitchenFinishTime:        entity.getKitchenFinishTime(),
      businessDate:             entity.businessDate,
      deliveryMethod:           entity.deliveryMethod,
      deliveryAddress:          entity.deliveryAddress,
      deliveryNotes:            entity.deliveryNotes,
      driverName:               entity.driverName,
      items:                    entity.parsedData?.items || [],
      guestCount:               entity.guestCount,
      totalAmount:              entity.totalAmount,
      overrideData:             entity.overrideData,
      overrideNotes:            entity.overrideNotes,
      isUpcoming:               entity.isUpcoming(),
      createdAt:                entity.createdAt,
    };
  }

  static toDTOList(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.map(o => this.toDTO(o));
  }

  static _getPaymentStatusLabel(status) {
    const labels = {
      'OPEN':   'Awaiting Payment',
      'PAID':   'Paid',
      'CLOSED': 'Paid & Closed',
    };
    return labels[status] || status || 'Awaiting Payment';
  }
}

module.exports = CateringOrderMapper;