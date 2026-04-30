// src/services/OrderParser.js

class OrderParser {
  parse(rawOrder, eventType) {
    const check = rawOrder.checks?.[0];
    if (!check) return null;

    const items = this._parseItems(check.selections || []);

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
      guestCount:               rawOrder.numberOfGuests || this._inferGuestCount(check.selections, eventType),
      totalAmount:              check.totalAmount,
      source:                   rawOrder.source,
      voided:                   rawOrder.voided,
      approvalStatus:           rawOrder.approvalStatus,
    };
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

  /**
   * Calcula el guest count real desde los items.
   *
   * Bird Box: el guest count real = total tacos ÷ 2
   *   El taco count viene del modifier con el patrón "X Tacos" (ej. "Bird Box - 40 Tacos")
   *   multiplicado por la quantity del item (cuántas cajas de ese tipo pidieron).
   *
   * Personal Box: cada item es 1 persona.
   *
   * Taco Bar / Fooda: fallback al quantity del item principal.
   */
  _inferGuestCount(selections, eventType) {
    if (!selections || selections.length === 0) return 1;

    if (eventType === 'BIRD_BOX') {
      let totalTacos = 0;

      for (const sel of selections) {
        if (sel.voided) continue;
        const modifiers = sel.modifiers || [];

        // Buscar el modifier de tamaño: ej. "Lunch 'Bird Box - 40 Tacos", "BYO 'Bird Box - 30 Tacos"
        const sizeMod = modifiers.find(m => {
          const name = (m.displayName || '').toLowerCase();
          return name.includes('tacos') && /\d+\s*tacos?/i.test(name);
        });

        if (sizeMod) {
          const match = (sizeMod.displayName || '').match(/(\d+)\s*tacos?/i);
          if (match) {
            const tacosPerBox = parseInt(match[1]);
            const boxQty      = sel.quantity || 1;
            totalTacos       += tacosPerBox * boxQty;
          }
        }
      }

      // 2 tacos por persona
      if (totalTacos > 0) return Math.round(totalTacos / 2);
      return 1;
    }

    if (eventType === 'PERSONAL_BOX') {
      // Cada Personal Box = 1 persona, sumar quantities
      const personalItems = selections.filter(s =>
        !s.voided && (s.displayName || '').toLowerCase().includes('personal')
      );
      if (personalItems.length > 0) {
        return personalItems.reduce((sum, s) => sum + (s.quantity || 1), 0);
      }
    }

    // Fallback: quantity del item con más tacos o el primero con qty > 1
    const mainItem = selections.find(s => !s.voided && s.quantity > 1);
    return mainItem ? mainItem.quantity : 1;
  }
}

module.exports = OrderParser;