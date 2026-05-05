// src/services/FulfillmentSheetCalculator.js

const IngredientResolverService = require('./IngredientResolverService');

const SALAD_KEYWORDS    = ['salad', 'city slicker', 'cowboy', 'farmer'];
const DRINK_KEYWORDS    = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'milk', 'water'];
const SIDE_PACK_KEYWORD = 'side pack';

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
    const items    = parsedData?.items || [];

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
    const salads = this._extractSalads(items);

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      proteins:  grouped.protein || [],
      toppings:  grouped.topping || [],
      salsas:    grouped.salsa   || [],
      snacks,
      tortillas,
      paperGoods,
      salads,
      hotItems:  [...(grouped.protein || []), ...tortillas],
      coldItems: [...(grouped.topping || []), ...(grouped.salsa || []), ...salads],
      dryItems:  [...snacks],
    };
  }

  // ─── BIRD BOX ─────────────────────────────────────────────────────────────
  async _calculateBirdBox(cateringOrder) {
    const { guestCount, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const items    = parsedData?.items || [];

    const boxes        = [];
    const sidePacks    = [];   // 'Bird Box Side Pack — nueva sección
    const drinks       = [];
    const manualSalsas = [];

    for (const item of items) {
      const itemNameLc   = (item.displayName || item.name || '').toLowerCase();
      const modifiers    = item.modifiers || [];
      const hasModifiers = modifiers.length > 0;

      // ── Ensaladas ──
      if (SALAD_KEYWORDS.some(k => itemNameLc.includes(k))) continue;

      // ── Bird Box Side Pack ──
      if (itemNameLc.includes(SIDE_PACK_KEYWORD)) {
        const qty = item.quantity || 1;

        // Detectar salsa elegida por el cliente
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('roja') || n.includes('verde') ||
                 n.includes('patron') || n.includes('patrón');
        });

        // Normalizar nombre de salsa
        let salsaName = 'Salsa Roja'; // default
        if (salsaMod) {
          const sn = (salsaMod.displayName || '').toLowerCase();
          if (sn.includes('verde'))           salsaName = 'Salsa Verde';
          else if (sn.includes('patron') || sn.includes('patrón')) salsaName = 'Salsa Patrón';
          else                                salsaName = 'Salsa Roja';
        }

        sidePacks.push({
          name:      item.displayName || item.name,
          quantity:  qty,
          salsaName,
          // Contenido fijo del pack × qty
          contents: [
            { item: 'Guacamole',   amount: `${32 * qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Spoon',      tempType: 'cold' },
            { item: 'Queso',       amount: `${32 * qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle',      tempType: 'hot'  },
            { item: salsaName,     amount: `${32 * qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle',      tempType: 'cold' },
            { item: 'Chips',       amount: `${qty} pan${qty > 1 ? 's' : ''}`, packaging: `${qty}x Full Pan`, utensil: 'Tongs Large', tempType: 'dry'  },
          ],
        });
        continue;
      }

      // ── Salsa Pack standalone (distinto del Side Pack) ──
      if (itemNameLc.includes('salsa pack') && !itemNameLc.includes(SIDE_PACK_KEYWORD)) {
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón');
        });
        const qty = item.quantity || 1;
        manualSalsas.push({
          name:         `Salsa Pack${salsaMod ? ` (${salsaMod.displayName})` : ''}`,
          category:     'addon',
          tempType:     'cold',
          unit:         'oz',
          utensil:      'Ladle',
          totalAmount:  32 * qty,
          packaging:    '32 oz container',
          packagingQty: qty,
          included:     'Yes',
          quantity:     qty,
          servesCount:  20 * qty,
          chipsQty:     qty,
        });
        continue;
      }

      // ── Bebidas ──
      if (DRINK_KEYWORDS.some(k => itemNameLc.includes(k))) {
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

      // ── Items sin modifiers — addons/salsas manuales ──
      if (!hasModifiers) {
        const dn            = item.displayName || item.name || '';
        const canonicalName = await this.resolver.resolveCanonicalName(dn);
        if (canonicalName) {
          const formula = await this.resolver.getFormula(canonicalName, 'BIRD_BOX');
          if (formula) {
            const qty         = item.quantity || 1;
            const isFixedPack = formula.amount_per_person === 0;
            const totalAmount = isFixedPack
              ? this._getFixedPackAmount(canonicalName, qty)
              : this.resolver.calculateAmount(formula, guestCount);
            const packaging   = this.resolver.getPackaging(formula, guestCount);
            manualSalsas.push({
              name:         canonicalName,
              category:     formula.category,
              tempType:     formula.temp_type,
              unit:         formula.unit,
              utensil:      formula.utensil,
              totalAmount,
              packaging:    packaging.package,
              packagingQty: isFixedPack ? qty : packaging.qty,
              included:     'Yes',
              quantity:     qty,
              servesCount:  isFixedPack ? 20 * qty : null,
              chipsQty:     isFixedPack ? qty : null,
            });
            continue;
          }
        }
        continue;
      }

      // ── Bird Box con tacos ──
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

    // ── Combos + tortillas ──
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
          comboTotals[combo].cornTortillas += qty;
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
      } else {
        tortillaLabel = `${data.cornTortillas} Corn`;
      }
      return {
        name: combo, total: data.total, unit: 'tacos',
        tortillaLabel,
        flourTortillas: data.flourTortillas,
        cornTortillas:  data.cornTortillas,
        packaging:      'Half Pan',
        packagingQty:   Math.ceil(data.total / 50),
        utensil:        'Tongs Small',
        tempType:       'hot',
      };
    });

    // ── Clasificar manuales ──
    const manualSalsaItems = manualSalsas.filter(i => i.category === 'salsa');
    const addonItems       = manualSalsas.filter(i => i.category === 'addon');
    const manualOtherItems = manualSalsas.filter(i => !['salsa', 'addon'].includes(i.category));

    // ── Chips & Salsa ──
    const anyWantsChips   = boxes.some(b => b.wantsChips);
    const hasManuasSalsas = manualSalsaItems.length > 0;

    const chipsAndSalsa = anyWantsChips ? [
      {
        name: 'Chips', total: 1, unit: 'Full Pan',
        packaging: 'Full Pan', packagingQty: 1,
        utensil: 'Tongs Large', tempType: 'dry', included: 'Yes',
      },
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

    // ── Ensaladas ──
    const salads = this._extractSalads(items);

    // ── Summary items — una fila por line item ──
    const summaryItems = [
      // Boxes de tacos
      ...boxes.map(box => ({
        type:     'box',
        name:     box.name,
        quantity: box.quantity,
        detail:   [
          `${box.tacoCount * box.quantity} tacos`,
          box.combos.length > 0 ? box.combos.join(' / ') : '—',
          box.is5050 ? '50/50 Tortilla' : (box.tortilla || 'Flour'),
        ].filter(Boolean).join(' · '),
        chipsAndSalsa: box.wantsChips ? 'Yes' : 'No',
        paper:         box.wantsPaper ? 'Yes' : 'No',
      })),
      // Side Packs
      ...sidePacks.map(sp => ({
        type:     'sidepack',
        name:     sp.name,
        quantity: sp.quantity,
        detail:   `32oz Guac · 32oz Queso · 32oz ${sp.salsaName} · Chips`,
        chipsAndSalsa: '—',
        paper:         '—',
      })),
      // Addons
      ...addonItems.map(a => ({
        type:     'addon',
        name:     a.name,
        quantity: a.quantity || 1,
        detail:   `${a.totalAmount} ${a.unit}`,
        chipsAndSalsa: '—',
        paper:         '—',
      })),
      // Salads
      ...salads.map(s => ({
        type:     'salad',
        name:     `${s.saladType} Salad (${s.size})`,
        quantity: s.quantity || 1,
        detail:   [
          s.protein
            ? s.protein.toLowerCase().includes('without') || s.protein.toLowerCase().includes('no protein')
              ? 'No protein'
              : s.protein
            : 'No protein',
          `Serves ${(s.serves || (s.size === 'Large' ? 20 : 10)) * (s.quantity || 1)}`,
          s.dressing || '',
        ].filter(Boolean).join(' · '),
        chipsAndSalsa: '—',
        paper:         '—',
      })),
      // Drinks
      ...drinks.map(d => ({
        type:     'drink',
        name:     d.name,
        quantity: d.quantity,
        detail:   d.wantsCups ? 'With cups & lids' : 'No cups',
        chipsAndSalsa: '—',
        paper:         '—',
      })),
    ];

    return {
      header:         this._buildHeader(cateringOrder, delivery),
      summaryItems,   // ← nuevo — reemplaza boxes en el Summary
      boxes,          // ← se mantiene para lógica de chips/paper
      sidePacks,      // ← nuevo
      tacoRows,
      chipsAndSalsa,
      salsas:         manualSalsaItems,
      addons:         addonItems,
      extras:         manualOtherItems,
      hasManuasSalsas,
      drinks,
      paperGoods,
      totalTacos,
      salads,
      hotItems: [
        ...tacoRows,
        ...drinks.filter(d => d.tempType === 'hot'),
        ...addonItems.filter(i => i.tempType === 'hot'),
        ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'hot')),
      ],
      coldItems: [
        ...chipsAndSalsa.filter(i => i.tempType === 'cold'),
        ...drinks.filter(d => d.tempType === 'cold'),
        ...manualSalsaItems,
        ...addonItems.filter(i => i.tempType === 'cold'),
        ...salads,
        ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'cold')),
      ],
      dryItems: [
        ...chipsAndSalsa.filter(i => i.tempType === 'dry'),
        ...addonItems.filter(i => i.tempType === 'dry'),
        ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'dry')),
      ],
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
      const combo     = modifiers.find(m => /^#\d+/i.test((m.displayName || '').trim()));
      const tortilla  = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });
      if (modifiers.some(m => this.resolver.isPaperYes(m.displayName || ''))) wantsPaper = true;
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
      personalBoxes, paperGoods,
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

  _extractSalads(items) {
    const salads = [];
    for (const item of items) {
      const itemNameLc = (item.displayName || item.name || '').toLowerCase();
      if (!SALAD_KEYWORDS.some(k => itemNameLc.includes(k))) continue;

      const modifiers  = item.modifiers || [];
      const qty        = item.quantity || 1;
      const proteinMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('brisket') || n.includes('chicken') || n.includes('chorizo') ||
               n.includes('without protein') || n.includes('no protein');
      });

      const servesMatch = itemNameLc.match(/for\s+(\d+)/i);
      const serves      = servesMatch ? parseInt(servesMatch[1]) : null;
      const isLarge     = itemNameLc.includes('large');
      const size        = isLarge ? 'Large' : 'Small';

      let saladType = 'Salad';
      if (itemNameLc.includes('city slicker')) saladType = 'City Slicker';
      else if (itemNameLc.includes('cowboy'))  saladType = 'The Cowboy';
      else if (itemNameLc.includes('farmer'))  saladType = 'The Farmer';

      salads.push({
        name:      item.displayName || item.name,
        saladType, size,
        protein:   proteinMod?.displayName || null,
        serves, quantity: qty,
        packaging: isLarge ? '1 full pan' : '1 half pan',
        utensil:   'Tongs / Spoon',
        tempType:  'cold',
        dressing:  this._getSaladDressing(saladType),
      });
    }
    return salads;
  }

  _getSaladDressing(saladType) {
    const map = {
      'City Slicker': 'Cilantro dressing on the side',
      'The Cowboy':   'Cilantro dressing on the side',
      'The Farmer':   'Lime Jalapeño dressing on the side',
    };
    return map[saladType] || 'Dressing on the side';
  }

  _getFixedPackAmount(canonicalName, qty) {
    const fixedAmounts = {
      'Chips & Queso':     32,
      'Chips & Guacamole': 32,
      'Chips & Salsa':     32,
      'Bunuelos':           1,
    };
    return (fixedAmounts[canonicalName] ?? 1) * qty;
  }

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
        total, unit:  flourItem.formula.unit,
        packaging:    packaging.package, packagingQty: packaging.qty,
        utensil:      flourItem.formula.utensil, tempType: 'hot',
      });
    }
    if (cornItem) {
      const total     = this.resolver.calculateAmount(cornItem.formula, guestCount);
      const packaging = this.resolver.getPackaging(cornItem.formula, guestCount);
      result.push({
        name:         is5050 ? 'Corn Tortillas (50/50)' : 'Corn Tortillas',
        total, unit:  cornItem.formula.unit,
        packaging:    packaging.package, packagingQty: packaging.qty,
        utensil:      cornItem.formula.utensil, tempType: 'hot',
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