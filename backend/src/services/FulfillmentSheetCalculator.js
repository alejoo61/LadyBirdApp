// src/services/FulfillmentSheetCalculator.js

const IngredientResolverService = require('./IngredientResolverService');

class FulfillmentSheetCalculator {
  constructor(ingredientFormulaRepository, pool) {
    this.formulaRepo = ingredientFormulaRepository;
    this.resolver    = new IngredientResolverService(pool);
  }

  async calculate(cateringOrder) {
    const { eventType } = cateringOrder;
    switch (eventType) {
      case 'TACO_BAR':     return this._calculateTacoBar(cateringOrder);
      case 'BIRD_BOX':     return this._calculateBirdBox(cateringOrder);
      case 'PERSONAL_BOX': return this._calculatePersonalBox(cateringOrder);
      case 'FOODA':        return this._calculateFooda(cateringOrder);
      default:             return this._calculateTacoBar(cateringOrder);
    }
  }

  // ─── TACO BAR ─────────────────────────────────────────────────────────────
  async _calculateTacoBar(cateringOrder) {
    const { guestCount, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    const { ingredients, wantsPaper } =
      await this.resolver.resolveOrderIngredients(parsedData, 'TACO_BAR');

    const calculated = ingredients.map(({ canonicalName, formula }) => {
      const totalAmount = this.resolver.calculateAmount(formula, guestCount);
      const packaging   = this.resolver.getPackaging(formula, guestCount);
      return {
        name:         canonicalName,
        category:     formula.category,
        tempType:     formula.temp_type,
        unit:         formula.unit,
        utensil:      formula.utensil,
        totalAmount,
        packaging:    packaging.package,
        packagingQty: packaging.qty,
      };
    });

    // Tortillas — calcular separado porque dependen de elección flour/corn/50-50
    const tortillas = this._calculateTortillasFromResolved(ingredients, guestCount);

    // Filtrar tortillas del calculated para no duplicar
    const withoutTortillas = calculated.filter(
      i => !['Flour Tortillas', 'Corn Tortillas'].includes(i.name)
    );

    const grouped    = this._groupByCategory(withoutTortillas);
    const paperGoods = wantsPaper
      ? await this.resolver.calculatePaperGoods('TACO_BAR', guestCount)
      : { included: false, items: [] };

    const snacks = grouped.snack || [];

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      proteins:  grouped.protein  || [],
      toppings:  grouped.topping  || [],
      salsas:    grouped.salsa    || [],
      snacks,
      tortillas,
      paperGoods,
      hotItems:  [...(grouped.protein || []), ...tortillas],
      coldItems: [...(grouped.topping || []), ...(grouped.salsa || [])],
      dryItems:  [...snacks],
    };
  }

  // ─── BIRD BOX ─────────────────────────────────────────────────────────────
  async _calculateBirdBox(cateringOrder) {
    const { guestCount, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const items    = parsedData?.items || [];

    const boxes  = [];
    const drinks = [];

    const drinkKeywords = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'side pack', 'milk', 'water'];

    for (const item of items) {
      const itemNameLc = (item.displayName || item.name || '').toLowerCase();
      const modifiers  = item.modifiers || [];

      // Detectar bebidas
      if (drinkKeywords.some(k => itemNameLc.includes(k))) {
        const wantsCups = modifiers.some(m =>
          (m.displayName || '').toLowerCase().includes('yes, i want cups')
        );
        drinks.push({
          name:      item.displayName || item.name,
          quantity:  item.quantity || 1,
          wantsCups,
          tempType:  itemNameLc.includes('coffee') ? 'hot' : 'cold',
        });
        continue;
      }

      // Detectar tamaño del box
      const sizeMod   = modifiers.find(m => this.resolver.isSizeModifier(m.displayName || ''));
      const tacoCount = sizeMod
        ? parseInt((sizeMod.displayName || '').match(/(\d+)\s*tacos?/i)?.[1] || 0)
        : (guestCount * 2);

      // Combos (#1, #2, etc.)
      const combos = modifiers.filter(m => /^#\d+/i.test((m.displayName || '').trim()));

      // Tortilla
      const tortillaMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      // Chips
      const chipsModifier = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('chip') || n.includes('yes! i would like') || n.includes('nope');
      });
      const wantsChips = chipsModifier
        ? (chipsModifier.displayName || '').toLowerCase().includes('yes')
        : false;

      // Paper
      const wantsPaper = modifiers.some(m =>
        this.resolver.isPaperYes(m.displayName || '')
      );

      boxes.push({
        name:       item.displayName || item.name,
        quantity:   item.quantity || 1,
        tacoCount,
        combos:     combos.map(c => c.displayName),
        tortilla:   tortillaMod?.displayName || 'Flour Tortillas',
        wantsChips,
        wantsPaper,
      });
    }

    // Calcular totales por combo
    const comboTotals = {};
    let totalTacos = 0;
    for (const box of boxes) {
      totalTacos += box.tacoCount * box.quantity;
      const tacosPerCombo = box.combos.length > 0
        ? Math.ceil(box.tacoCount / box.combos.length)
        : box.tacoCount;
      for (const combo of box.combos) {
        comboTotals[combo] = (comboTotals[combo] || 0) + (tacosPerCombo * box.quantity);
      }
    }

    const tacoRows = Object.entries(comboTotals).map(([combo, total]) => ({
      name:         combo,
      total,
      unit:         'tacos',
      packaging:    'Half Pan',
      packagingQty: Math.ceil(total / 50),
      utensil:      'Tongs Small',
      tempType:     'hot',
    }));

    // Chips & Salsa
    const anyWantsChips = boxes.some(b => b.wantsChips);
    const chipsAndSalsa = anyWantsChips ? [
      {
        name: 'Chips', total: 1, unit: 'Full Pan',
        packaging: 'Full Pan', packagingQty: 1,
        utensil: 'Tongs Large', tempType: 'dry', included: 'Yes',
      },
      {
        name: 'Salsa Roja', total: Math.ceil(guestCount / 12), unit: '6 oz cups',
        packaging: '6 oz cup', packagingQty: Math.ceil(guestCount / 12),
        utensil: 'Ladle', tempType: 'cold', included: 'Yes',
      },
    ] : [{ name: 'Chips & Salsa', included: 'No', tempType: 'dry' }];

    // Paper goods desde DB
    const anyWantsPaper = boxes.some(b => b.wantsPaper);
    const paperGoods    = anyWantsPaper
      ? await this.resolver.calculatePaperGoods('BIRD_BOX', guestCount)
      : { included: false, items: [] };

    return {
      header:       this._buildHeader(cateringOrder, delivery),
      boxes,
      tacoRows,
      chipsAndSalsa,
      drinks,
      paperGoods,
      totalTacos,
      hotItems:  [...tacoRows, ...drinks.filter(d => d.tempType === 'hot')],
      coldItems: [...chipsAndSalsa.filter(i => i.tempType === 'cold'), ...drinks.filter(d => d.tempType === 'cold')],
      dryItems:  chipsAndSalsa.filter(i => i.tempType === 'dry'),
      proteins: [], toppings: [], salsas: [], tortillas: [], snacks: [],
    };
  }

  // ─── PERSONAL BOX ─────────────────────────────────────────────────────────
  async _calculatePersonalBox(cateringOrder) {
    const { guestCount, parsedData } = cateringOrder;
    const delivery  = parsedData?.delivery || {};
    const items     = parsedData?.items || [];

    const personalBoxes = [];
    let wantsPaper = false;

    for (const item of items) {
      const modifiers = item.modifiers || [];

      const combo    = modifiers.find(m => /^#\d+/i.test((m.displayName || '').trim()));
      const tortilla = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      if (modifiers.some(m => this.resolver.isPaperYes(m.displayName || ''))) {
        wantsPaper = true;
      }

      for (let i = 0; i < (item.quantity || 1); i++) {
        personalBoxes.push({
          combo:    combo?.displayName || item.displayName || item.name,
          tortilla: tortilla?.displayName || 'Flour',
          mode:     item.displayName || item.name,
        });
      }
    }

    const paperGoods = wantsPaper
      ? await this.resolver.calculatePaperGoods('PERSONAL_BOX', guestCount)
      : { included: false, items: [] };

    return {
      header: this._buildHeader(cateringOrder, delivery),
      personalBoxes,
      paperGoods,
      proteins: [], toppings: [], salsas: [], tortillas: [], snacks: [],
      hotItems: [], coldItems: [], dryItems: [],
    };
  }

  // ─── FOODA ────────────────────────────────────────────────────────────────
  async _calculateFooda(cateringOrder) {
    const { parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const items    = parsedData?.items || [];
    const snacks   = [];
    const tacoRows = [];

    for (const item of items) {
      const name = (item.displayName || item.name || '').toLowerCase();
      if (name.includes('chip') || name.includes('fooda')) {
        snacks.push({
          name: item.displayName || item.name, total: item.quantity, unit: 'each',
          packaging: 'black box bin', packagingQty: item.quantity,
          utensil: '-', tempType: 'dry',
        });
      } else if (name.includes('taco') || /^#\d+/.test((item.displayName || item.name || '').trim())) {
        tacoRows.push({
          name: item.displayName || item.name, total: item.quantity * 50, unit: 'tacos',
          packaging: 'Half Pan', packagingQty: item.quantity,
          utensil: 'Tongs', tempType: 'hot',
        });
      }
    }

    return {
      header:     this._buildHeader(cateringOrder, delivery),
      snacks, tacoRows,
      paperGoods: { included: false, items: [] },
      proteins: [], toppings: [], salsas: [], tortillas: [],
      hotItems: tacoRows, coldItems: [], dryItems: snacks,
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  _buildHeader(order, delivery) {
    return {
      displayNumber:            order.displayNumber,
      eventType:                order.eventType,
      clientName:               order.clientName,
      clientContact:            order.clientEmail,
      clientPhone:              order.clientPhone,
      guestCount:               order.guestCount,
      estimatedFulfillmentDate: order.estimatedFulfillmentDate,
      kitchenFinishTime:        order.kitchenFinishTime,
      deliveryMethod:           order.deliveryMethod,
      deliveryAddress:          order.deliveryAddress,
      deliveryNotes:            delivery.notes || order.deliveryNotes,
      storeName:                order.storeName,
      storeCode:                order.storeCode,
      isManuallyEdited:         order.isManuallyEdited,
      toastOrderGuid:           order.toastOrderGuid,
    };
  }

  _calculateTortillasFromResolved(ingredients, guestCount) {
    const result     = [];
    const flourItem  = ingredients.find(i => i.canonicalName === 'Flour Tortillas');
    const cornItem   = ingredients.find(i => i.canonicalName === 'Corn Tortillas');
    const is5050     = flourItem && cornItem;

    if (flourItem) {
      const total      = this.resolver.calculateAmount(flourItem.formula, guestCount);
      const packaging  = this.resolver.getPackaging(flourItem.formula, guestCount);
      result.push({
        name:         is5050 ? 'Flour Tortillas (50/50)' : 'Flour Tortillas',
        total,
        unit:         flourItem.formula.unit,
        packaging:    packaging.package,
        packagingQty: packaging.qty,
        utensil:      flourItem.formula.utensil,
        tempType:     'hot',
      });
    }

    if (cornItem) {
      const total      = this.resolver.calculateAmount(cornItem.formula, guestCount);
      const packaging  = this.resolver.getPackaging(cornItem.formula, guestCount);
      result.push({
        name:         is5050 ? 'Corn Tortillas (50/50)' : 'Corn Tortillas',
        total,
        unit:         cornItem.formula.unit,
        packaging:    packaging.package,
        packagingQty: packaging.qty,
        utensil:      cornItem.formula.utensil,
        tempType:     'hot',
      });
    }

    return result;
  }

  _groupByCategory(items) {
    return items.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }
}

module.exports = FulfillmentSheetCalculator;