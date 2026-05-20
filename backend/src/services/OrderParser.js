// src/services/OrderParser.js

class OrderParser {
  parse(rawOrder, eventType) {
    const check     = rawOrder.checks?.[0];
    if (!check) return null;

    const items     = this._parseItems(check.selections || []);
    const isEZCater = this._isEZCater(rawOrder);

    return {
      toastOrderGuid:           rawOrder.guid,
      displayNumber:            rawOrder.displayNumber,
      eventType,
      status:                   this._inferStatus(rawOrder),
      paymentStatus:            check.paymentStatus || 'OPEN',
      isHouseAccount:           this._isHouseAccount(check),
      orderDate:                rawOrder.openedDate,
      estimatedFulfillmentDate: rawOrder.estimatedFulfillmentDate,
      businessDate:             rawOrder.businessDate,
      client:                   this._parseClient(check),
      delivery:                 this._parseDelivery(rawOrder),
      items,
      guestCount: (rawOrder.numberOfGuests > 1 ? rawOrder.numberOfGuests : null)
                  || this._inferGuestCount(check.selections, eventType),
      totalAmount:              check.totalAmount,
      source:                   rawOrder.source,
      voided:                   rawOrder.voided,
      approvalStatus:           rawOrder.approvalStatus,
      isEZCater,
    };
  }

  // Detectado por el descuento "3pd EZ Cater Fees/Promos" en appliedDiscounts
  _isEZCater(rawOrder) {
    const rootDiscounts  = rawOrder.appliedDiscounts || [];
    const checkDiscounts = rawOrder.checks?.[0]?.appliedDiscounts || [];
    const allDiscounts   = [...rootDiscounts, ...checkDiscounts];
    return allDiscounts.some(d =>
      (d.name || '').toLowerCase().includes('ez cater')
    );
  }

  _isHouseAccount(check) {
    const selections = check.selections || [];
    return selections.some(s =>
      (s.displayName || '').toLowerCase().includes('pay balance')
    );
  }

  _inferStatus(rawOrder) {
    if (rawOrder.voided === true) return 'cancelled';
    if (!rawOrder.estimatedFulfillmentDate) return 'pending';
    const fulfillmentDate = new Date(rawOrder.estimatedFulfillmentDate);
    if (fulfillmentDate > new Date()) return 'pending';
    return 'completed';
  }

  _parseClient(check) {
    const customer = check.customer;
    if (!customer) return { name: 'Unknown', contact: null, email: null, phone: null };
    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    return {
      name:    fullName || 'Unknown',
      email:   customer.email || null,
      phone:   customer.phone || null,
      contact: fullName || null,
    };
  }

  _parseDelivery(rawOrder) {
    const info = rawOrder.deliveryInfo;
    if (!info) return { method: 'PICKUP', address: null, notes: null, driver: null };
    const addressParts = [info.address1, info.address2, info.city, info.state, info.zipCode].filter(Boolean);
    return {
      method:  'DELIVERY',
      address: addressParts.join(', '),
      notes:   info.notes || null,
      driver:  null,
    };
  }

  _parseItems(selections) {
    return selections
      .filter(s => !s.voided)
      .map(s => ({
        guid:        s.guid,
        displayName: s.displayName,
        quantity:    s.quantity,
        price:       s.price,
        modifiers:   this._parseModifiers(s.modifiers || []),
      }));
  }

  _parseModifiers(modifiers) {
    return modifiers
      .filter(m => !m.voided)
      .map(m => ({
        displayName: m.displayName,
        quantity:    m.quantity,
        price:       m.price,
      }));
  }

  _inferGuestCount(selections, eventType) {
    if (!selections || selections.length === 0) return 1;

    if (eventType === 'BIRD_BOX') {
      let totalTacos = 0;
      for (const sel of selections) {
        if (sel.voided) continue;
        const modifiers = sel.modifiers || [];
        const sizeMod = modifiers.find(m => {
          const name = (m.displayName || '').toLowerCase();
          return name.includes('tacos') && /\d+\s*tacos?/i.test(name);
        });
        if (sizeMod) {
          const match = (sizeMod.displayName || '').match(/(\d+)\s*tacos?/i);
          if (match) {
            totalTacos += parseInt(match[1]) * (sel.quantity || 1);
          }
        }
      }
      if (totalTacos > 0) return Math.round(totalTacos / 2);
      return 1;
    }

    if (eventType === 'TACO_BAR') {
      const tacoBarItem = selections.find(s =>
        !s.voided &&
        (s.displayName || '').toLowerCase().includes('taco bar') &&
        s.modifiers && s.modifiers.length > 0
      );
      if (tacoBarItem) {
        const firstMod = tacoBarItem.modifiers.find(m => (m.quantity || 0) > 1);
        if (firstMod && firstMod.quantity > 1) return firstMod.quantity;
        if (tacoBarItem.quantity > 1) return tacoBarItem.quantity;
      }
    }

    if (eventType === 'PERSONAL_BOX') {
      const personalItems = selections.filter(s =>
        !s.voided && (s.displayName || '').toLowerCase().includes('personal')
      );
      if (personalItems.length > 0) {
        return personalItems.reduce((sum, s) => sum + (s.quantity || 1), 0);
      }
    }

    const mainItem = selections.find(s => !s.voided && s.quantity > 1);
    return mainItem ? mainItem.quantity : 1;
  }
}

module.exports = OrderParser;