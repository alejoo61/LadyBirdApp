// src/services/fulfillment/shared/HeaderBuilder.js

function buildHeader(order, delivery = {}) {
  return {
    displayNumber:            order.displayNumber,
    eventType:                order.eventType,
    clientName:               order.clientName,
    clientContact:            order.clientEmail,
    clientPhone:              order.clientPhone,
    guestCount:               order.guestCount,
    estimatedFulfillmentDate: order.estimatedFulfillmentDate,
    kitchenFinishTime:        order.kitchenFinishTime,
    distanceMiles:            order.distanceMiles || null,
    deliveryMethod:           order.deliveryMethod,
    deliveryAddress:          order.deliveryAddress,
    deliveryNotes:            delivery.notes || order.deliveryNotes,
    storeName:                order.storeName,
    storeCode:                order.storeCode,
    isManuallyEdited:         order.isManuallyEdited,
    isManualSheet:            order.isManualSheet || false,
    isEZCater:                order.isEZCater || false,
    toastOrderGuid:           order.toastOrderGuid,
    pdfVersion:               order.pdfVersion || 1,
  };
}

module.exports = { buildHeader };