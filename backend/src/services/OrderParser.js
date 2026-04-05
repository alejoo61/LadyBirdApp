// src/services/OrderParser.js

class OrderParser {
  parse(rawOrder, eventType) {
    const check = rawOrder.checks?.[0];
    if (!check) return null;

    return {
      toastOrderGuid: rawOrder.guid,
      displayNumber: rawOrder.displayNumber,
      eventType,
      status: this._inferStatus(rawOrder),
      paymentStatus: check.paymentStatus || "OPEN", // <- agregar esto
      isHouseAccount:           this._isHouseAccount(check),
      orderDate: rawOrder.openedDate,
      estimatedFulfillmentDate: rawOrder.estimatedFulfillmentDate,
      businessDate: rawOrder.businessDate,
      client: this._parseClient(check),
      delivery: this._parseDelivery(rawOrder),
      items: this._parseItems(check.selections || []),
      guestCount:
        rawOrder.numberOfGuests || this._inferGuestCount(check.selections),
      totalAmount: check.totalAmount,
      source: rawOrder.source,
      voided: rawOrder.voided,
      approvalStatus: rawOrder.approvalStatus,
    };
  }

  _isHouseAccount(check) {
    const selections = check.selections || [];
    return selections.some((s) =>
      (s.displayName || "").toLowerCase().includes("pay balance"),
    );
  }

  _inferStatus(rawOrder) {
    // 1. Voided en Toast → cancelled
    if (rawOrder.voided === true) return "cancelled";

    // 2. Fecha futura o sin fecha → pending
    if (!rawOrder.estimatedFulfillmentDate) return "pending";
    const fulfillmentDate = new Date(rawOrder.estimatedFulfillmentDate);
    if (fulfillmentDate > new Date()) return "pending";

    // 3. Fecha pasada → completed
    return "completed";
  }

  _parseClient(check) {
    const customer = check.customer;
    if (!customer)
      return { name: "Unknown", contact: null, email: null, phone: null };
    const fullName = [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      name: fullName || "Unknown",
      email: customer.email || null,
      phone: customer.phone || null,
      contact: fullName || null,
    };
  }

  _parseDelivery(rawOrder) {
    const info = rawOrder.deliveryInfo;
    if (!info)
      return { method: "PICKUP", address: null, notes: null, driver: null };
    const addressParts = [
      info.address1,
      info.address2,
      info.city,
      info.state,
      info.zipCode,
    ].filter(Boolean);
    return {
      method: "DELIVERY",
      address: addressParts.join(", "),
      notes: info.notes || null,
      driver: null,
    };
  }

  _parseItems(selections) {
    return selections
      .filter((s) => !s.voided)
      .map((s) => ({
        guid: s.guid,
        displayName: s.displayName,
        quantity: s.quantity,
        price: s.price,
        modifiers: this._parseModifiers(s.modifiers || []),
      }));
  }

  _parseModifiers(modifiers) {
    return modifiers
      .filter((m) => !m.voided)
      .map((m) => ({
        displayName: m.displayName,
        quantity: m.quantity,
        price: m.price,
      }));
  }

  _inferGuestCount(selections) {
    if (!selections || selections.length === 0) return null;
    const mainItem = selections.find((s) => s.quantity > 1);
    return mainItem ? mainItem.quantity : null;
  }
}

module.exports = OrderParser;
