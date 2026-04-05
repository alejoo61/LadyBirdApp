// src/entities/CateringOrder.js

class CateringOrder {
  constructor({
    id, storeId, toastOrderId, toastOrderGuid, displayNumber,
    eventType, status, clientName, clientEmail, clientPhone,
    orderDate, estimatedFulfillmentDate, businessDate,
    deliveryMethod, deliveryAddress, deliveryNotes, driverName,
    parsedData, guestCount, totalAmount,
    overrideData, overrideNotes,
    createdAt, updatedAt
  }) {
    this.id                       = id;
    this.storeId                  = storeId;
    this.toastOrderId             = toastOrderId;
    this.toastOrderGuid           = toastOrderGuid;
    this.displayNumber            = displayNumber;
    this.eventType                = eventType;
    this.status                   = status || 'pending';
    this.clientName               = clientName;
    this.clientEmail              = clientEmail;
    this.clientPhone              = clientPhone;
    this.orderDate                = orderDate;
    this.estimatedFulfillmentDate = estimatedFulfillmentDate;
    this.businessDate             = businessDate;
    this.deliveryMethod           = deliveryMethod;
    this.deliveryAddress          = deliveryAddress;
    this.deliveryNotes            = deliveryNotes;
    this.driverName               = driverName;
    this.parsedData               = parsedData;
    this.guestCount               = guestCount;
    this.totalAmount              = totalAmount;
    this.overrideData             = overrideData || {};
    this.overrideNotes            = overrideNotes;
    this.createdAt                = createdAt;
    this.updatedAt                = updatedAt;
  }

  getEventTypeLabel() {
    const labels = {
      TACO_BAR:     'Taco Bar',
      BIRD_BOX:     "'Bird Box",
      PERSONAL_BOX: 'Personal Box',
      FOODA:        'Fooda',
      NEEDS_REVIEW: 'Needs Review'
    };
    return labels[this.eventType] || this.eventType;
  }

  getStatusLabel() {
    const labels = {
      pending:   'Pending',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      completed: 'Completed'
    };
    return labels[this.status] || this.status;
  }

  isUpcoming() {
    if (!this.estimatedFulfillmentDate) return false;
    return new Date(this.estimatedFulfillmentDate) > new Date();
  }

  getKitchenFinishTime() {
    if (!this.estimatedFulfillmentDate) return null;
    const finish = new Date(this.estimatedFulfillmentDate);
    finish.setHours(finish.getHours() - 1);
    return finish;
  }
}

module.exports = CateringOrder;