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

    const tortillas        = this._calculateTortillasFromResolved(ingredients, guestCount);
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
      proteins:  grouped.protein || [],
      toppings:  grouped.topping || [],
      salsas:    grouped.salsa   || [],
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

    const boxes          = [];
    const drinks         = [];
    const manualSalsas   = [];
    const drinkKeywords  = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'side pack', 'milk', 'water'];

    for (const item of items) {
      const itemNameLc   = (item.displayName || item.name || '').toLowerCase();
      const modifiers    = item.modifiers || [];
      const hasModifiers = modifiers.length > 0;

      // ── Bebidas ──
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

      // ── Items sin modifiers — salsas/ingredientes agregados manualmente ──
      if (!hasModifiers) {
        const dn          = item.displayName || item.name || '';
        const canonicalName = await this.resolver.resolveCanonicalName(dn);
        if (canonicalName) {
          const formula = await this.resolver.getFormula(canonicalName, 'BIRD_BOX');
          if (formula) {
            const totalAmount = this.resolver.calculateAmount(formula, guestCount);
            const packaging   = this.resolver.getPackaging(formula, guestCount);
            manualSalsas.push({
              name:         canonicalName,
              category:     formula.category,
              tempType:     formula.temp_type,
              unit:         formula.unit,
              utensil:      formula.utensil,
              totalAmount,
              packaging:    packaging.package,
              packagingQty: packaging.qty,
              included:     'Yes',
            });
            continue;
          }
        }
        continue;
      }

      // ── Bird Box con modifiers ──
      const sizeMod   = modifiers.find(m => this.resolver.isSizeModifier(m.displayName || ''));
      const tacoCount = sizeMod
        ? parseInt((sizeMod.displayName || '').match(/(\d+)\s*tacos?/i)?.[1] || 0)
        : (guestCount * 2);

      const combos = modifiers.filter(m => /^#\d+/i.test((m.displayName || '').trim()));

      const tortillaMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      const chipsModifier = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('chip') || n.includes('yes! i would like') || n.includes('nope');
      });
      const wantsChips = chipsModifier
        ? (chipsModifier.displayName || '').toLowerCase().includes('yes')
        : false;

      const wantsPaper = modifiers.some(m =>
        this.resolver.isPaperYes(m.displayName || '')
      );

      const is5050 = (tortillaMod?.displayName || '').toLowerCase().includes('50/50');

      boxes.push({
        name:       item.displayName || item.name,
        quantity:   item.quantity || 1,
        tacoCount,
        combos:     combos.map(c => c.displayName),
        tortilla:   tortillaMod?.displayName || 'Flour Tortillas',
        is5050,
        wantsChips,
        wantsPaper,
      });
    }

    // ── Calcular totales por combo + tortillas por combo ──
    const comboTotals = {};
    let totalTacos = 0;

    for (const box of boxes) {
      totalTacos += box.tacoCount * box.quantity;
      const numCombos     = box.combos.length > 0 ? box.combos.length : 1;
      const tacosPerCombo = Math.ceil(box.tacoCount / numCombos);

      for (const combo of box.combos) {
        if (!comboTotals[combo]) {
          comboTotals[combo] = { total: 0, flourTortillas: 0, cornTortillas: 0 };
        }
        const qty = tacosPerCombo * box.quantity;
        comboTotals[combo].total += qty;

        if (box.is5050) {
          comboTotals[combo].flourTortillas += Math.ceil(qty / 2);
          comboTotals[combo].cornTortillas  += Math.floor(qty / 2);
        } else if ((box.tortilla || '').toLowerCase().includes('corn')) {
          comboTotals[combo].cornTortillas  += qty;
        } else {
          comboTotals[combo].flourTortillas += qty;
        }
      }
    }

    const tacoRows = Object.entries(comboTotals).map(([combo, data]) => {
      let tortillaLabel = '';
      if (data.flourTortillas > 0 && data.cornTortillas > 0) {
        tortillaLabel = `${data.flourTortillas}F / ${data.cornTortillas}C`;
      } else if (data.flourTortillas > 0) {
        tortillaLabel = `${data.flourTortillas} Flour`;
      } else if (data.cornTortillas > 0) {
        tortillaLabel = `${data.cornTortillas} Corn`;
      }
      return {
        name:           combo,
        total:          data.total,
        unit:           'tacos',
        tortillaLabel,
        flourTortillas: data.flourTortillas,
        cornTortillas:  data.cornTortillas,
        packaging:      'Half Pan',
        packagingQty:   Math.ceil(data.total / 50),
        utensil:        'Tongs Small',
        tempType:       'hot',
      };
    });

    // ── Salsas manuales — separar por categoría ──
    const manualSalsaItems = manualSalsas.filter(i => i.category === 'salsa');
    const manualOtherItems = manualSalsas.filter(i => i.category !== 'salsa');

    // ── Chips & Salsa ──
    // Si hay salsas manuales, los chips van solos (las salsas tienen su propia sección)
    const anyWantsChips = boxes.some(b => b.wantsChips);
    const hasManuasSalsas = manualSalsaItems.length > 0;

    const chipsAndSalsa = anyWantsChips ? [
      {
        name: hasManuasSalsas ? 'Chips' : 'Chips', total: 1, unit: 'Full Pan',
        packaging: 'Full Pan', packagingQty: 1,
        utensil: 'Tongs Large', tempType: 'dry', included: 'Yes',
      },
      // Salsa Roja solo si NO hay salsas manuales
      ...(!hasManuasSalsas ? [{
        name: 'Salsa Roja', total: Math.ceil(guestCount / 12), unit: '6 oz cups',
        packaging: '6 oz cup', packagingQty: Math.ceil(guestCount / 12),
        utensil: 'Ladle', tempType: 'cold', included: 'Yes',
      }] : []),
    ] : [{ name: 'Chips & Salsa', included: 'No', tempType: 'dry' }];

    // ── Paper goods ──
    const anyWantsPaper = boxes.some(b => b.wantsPaper);
    const paperGoods    = anyWantsPaper
      ? await this.resolver.calculatePaperGoods('BIRD_BOX', guestCount)
      : { included: false, items: [] };

    return {
      header:       this._buildHeader(cateringOrder, delivery),
      boxes,
      tacoRows,
      chipsAndSalsa,
      salsas:       manualSalsaItems,
      extras:       manualOtherItems,
      hasManuasSalsas,
      drinks,
      paperGoods,
      totalTacos,
      hotItems:  [...tacoRows, ...drinks.filter(d => d.tempType === 'hot')],
      coldItems: [
        ...chipsAndSalsa.filter(i => i.tempType === 'cold'),
        ...drinks.filter(d => d.tempType === 'cold'),
        ...manualSalsaItems,
      ],
      dryItems:  chipsAndSalsa.filter(i => i.tempType === 'dry'),
      proteins: [], toppings: [], tortillas: [], snacks: [],
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
      pdfVersion:               order.pdfVersion || 1,
    };
  }

  _calculateTortillasFromResolved(ingredients, guestCount) {
    const result    = [];
    const flourItem = ingredients.find(i => i.canonicalName === 'Flour Tortillas');
    const cornItem  = ingredients.find(i => i.canonicalName === 'Corn Tortillas');
    const is5050    = flourItem && cornItem;

    if (flourItem) {
      const total     = this.resolver.calculateAmount(flourItem.formula, guestCount);
      const packaging = this.resolver.getPackaging(flourItem.formula, guestCount);
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
      const total     = this.resolver.calculateAmount(cornItem.formula, guestCount);
      const packaging = this.resolver.getPackaging(cornItem.formula, guestCount);
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