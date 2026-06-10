// src/services/FulfillmentSheetCalculator.js

const IngredientResolverService = require('./IngredientResolverService');

const SALAD_KEYWORDS    = ['salad', 'city slicker', 'cowboy', 'farmer'];
const DRINK_KEYWORDS    = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'milk', 'water'];
const SIDE_PACK_KEYWORD = 'side pack';

const PERSONAL_BOX_KEYWORDS = [
  "personal breakfast 'bird box",
  "personal lunch 'bird box",
  "byo personal 'bird box",
  "personal 'bird box",
];

const BIRD_BOX_KEYWORDS = [
  "breakfast 'bird box",
  "lunch 'bird box",
  "build your own 'bird box",
  'bird box',
];

const THREE_SALSAS_THRESHOLD = 30;
const TACO_HALF_PAN_MAX      = 18;

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
      case 'SPACE_RENTAL': return this._calculateSpaceRental(cateringOrder);
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
        name: canonicalName, category: formula.category, tempType: formula.temp_type,
        unit: formula.unit, utensil: formula.utensil, totalAmount,
        packaging: packaging.package, packagingQty: packaging.qty,
      };
    });

    const tortillas        = this._calculateTortillasFromResolved(ingredients, guestCount);
    const withoutTortillas = calculated.filter(i => !['Flour Tortillas', 'Corn Tortillas'].includes(i.name));
    const grouped          = this._groupByCategory(withoutTortillas);
    const paperGoods       = wantsPaper
      ? await this.resolver.calculatePaperGoods('TACO_BAR', guestCount)
      : { included: false, items: [] };
    const snacks = grouped.snack || [];
    const salads = this._extractSalads(items);

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      proteins:  grouped.protein || [],
      toppings:  grouped.topping || [],
      salsas:    grouped.salsa   || [],
      snacks, tortillas, paperGoods, salads,
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
    return this._processBirdBoxItems(items, guestCount, cateringOrder, delivery);
  }

  // ─── PERSONAL BOX ─────────────────────────────────────────────────────────
  async _calculatePersonalBox(cateringOrder) {
    const { guestCount, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const items    = parsedData?.items || [];

    const personalBoxes = [];
    const birdBoxItems  = [];
    const drinks        = [];
    const addons        = [];
    let totalBoxes = 0;

    for (const item of items) {
      const itemNameLc = (item.displayName || item.name || '').toLowerCase();
      const modifiers  = item.modifiers || [];
      const qty        = item.quantity || 1;

      // ── Bebidas ──
      if (DRINK_KEYWORDS.some(k => itemNameLc.includes(k))) {
        drinks.push(this._parseDrink(item, modifiers, qty));
        continue;
      }

      // ── Personal Box ──
      if (PERSONAL_BOX_KEYWORDS.some(k => itemNameLc.includes(k))) {
        const tortillaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('flour') || n.includes('corn') || n.includes('50/50');
        });

        // Extraer salsa del modifier (ej: "Verde (mild) 0.75 oz cup" → "Salsa Verde")
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return (n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón') || n.includes('most popular')) && n.includes('oz');
        });
        let salsaLabel = null;
        if (salsaMod) {
          const sn = (salsaMod.displayName || '').toLowerCase();
          if (sn.includes('verde'))                                 salsaLabel = 'Salsa Verde';
          else if (sn.includes('patron') || sn.includes('patrón')) salsaLabel = 'Salsa Patrón';
          else if (sn.includes('most popular'))                     salsaLabel = 'Most Popular';
          else                                                      salsaLabel = 'Salsa Roja';
        }

        // Extraer notas especiales (ej: 'Please label Vegetarian')
        const noteMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('please label') || n.includes('note:') || n.includes('allerg');
        });
        const note = noteMod?.displayName || null;

        const combos = modifiers
          .filter(m => /^#\d+/i.test((m.displayName || '').trim()))
          .map(m => m.displayName);

        const uniqueCombos = [...new Set(combos)];
        const comboLabel   = uniqueCombos.map(c => {
          const count = combos.filter(x => x === c).length;
          return count > 1 ? `${count}x ${c}` : c;
        }).join(' + ');

        totalBoxes += qty;

        personalBoxes.push({
          name:        item.displayName || item.name,
          quantity:    qty,
          combos,
          uniqueCombos,
          comboLabel:  comboLabel || (item.displayName || item.name || '—'),
          tortilla:    tortillaMod?.displayName || 'Corn',
          salsa:       salsaLabel,
          note,
        });
        continue;
      }

      // ── Bird Box regular (sin "personal") ──
      if (BIRD_BOX_KEYWORDS.some(k => itemNameLc.includes(k))) {
        birdBoxItems.push(item);
        continue;
      }

      // ── Addons (Bunuelos, Chips & Guacamole, etc.) ──
      // Intentar resolver packaging desde la DB
      {
        const dn            = item.displayName || item.name || '';
        const canonicalName = await this.resolver.resolveCanonicalName(dn);
        if (canonicalName) {
          const formula = await this.resolver.getFormula(canonicalName, 'PERSONAL_BOX')
                       || await this.resolver.getFormula(canonicalName, 'BIRD_BOX');
          if (formula) {
            const isFixedPack = formula.amount_per_person === 0;
            const totalAmount = isFixedPack
              ? this._getFixedPackAmount(canonicalName, qty)
              : this.resolver.calculateAmount(formula, guestCount);
            const packaging   = this.resolver.getPackaging(formula, guestCount);
            addons.push({
              name:         canonicalName,
              quantity:     qty,
              totalAmount,
              unit:         formula.unit,
              packaging:    packaging.package,
              packagingQty: isFixedPack ? qty : packaging.qty,
              tempType:     formula.temp_type || 'dry',
              detail:       `${totalAmount} ${formula.unit}${packaging.package ? ' · ' + packaging.package : ''}`,
            });
            continue;
          }
        }
        addons.push({ name: item.displayName || item.name, quantity: qty, tempType: 'dry' });
      }
    }

    // ── Tacos agrupados por combo (Personal Boxes) ──
    const comboTotals = {};
    for (const box of personalBoxes) {
      for (const combo of box.combos) {
        if (!comboTotals[combo]) comboTotals[combo] = { total: 0, tortilla: box.tortilla };
        comboTotals[combo].total += box.quantity;
      }
    }

    const personalTacoRows = Object.entries(comboTotals).map(([combo, data]) => ({
      name:         combo,
      total:        data.total,
      unit:         'each',
      tortilla:     data.tortilla,
      packaging:    'Personal Box',
      packagingQty: data.total,
      tempType:     'hot',
    }));

    const chipsRow = totalBoxes > 0 ? { name: 'Personal Chips',     total: totalBoxes, unit: 'each',              tempType: 'dry'  } : null;
    const salsaRow = totalBoxes > 0 ? { name: 'Personal Salsa Roja', total: totalBoxes, unit: 'each', detail: '4 oz cup', tempType: 'cold' } : null;

    const paperGoods = totalBoxes > 0 ? {
      included: true,
      items: [
        { name: 'Fork Small',  qty: guestCount + 5, unit: 'each' },
        { name: 'Napkin Pack', qty: guestCount + 5, unit: 'each' },
      ],
    } : { included: false, items: [] };

    // ── Procesar Bird Box items si los hay ──
    let birdBoxResult = null;
    if (birdBoxItems.length > 0) {
      birdBoxResult = await this._processBirdBoxItems(birdBoxItems, guestCount, cateringOrder, delivery);
    }

    const allDrinks = [...drinks, ...(birdBoxResult?.drinks || [])];

    return {
      header:            this._buildHeader(cateringOrder, delivery),
      personalBoxes,
      personalTacoRows,
      chipsRow,
      salsaRow,
      totalBoxes,
      paperGoods,
      birdBoxResult,
      drinks:            allDrinks,
      addons,
      proteins: [], toppings: [], salsas: [], tortillas: [], snacks: [],
      hotItems:  [...personalTacoRows, ...(birdBoxResult?.hotItems || []), ...allDrinks.filter(d => d.tempType === 'hot')],
      coldItems: [...(salsaRow ? [salsaRow] : []), ...(birdBoxResult?.coldItems || []), ...allDrinks.filter(d => d.tempType === 'cold')],
      dryItems:  [...(chipsRow ? [chipsRow] : []), ...(birdBoxResult?.dryItems || [])],
    };
  }

  // ─── BIRD BOX ITEMS PROCESSOR ─────────────────────────────────────────────
  async _processBirdBoxItems(items, guestCount, cateringOrder, delivery) {
    const boxes        = [];
    const sidePacks    = [];
    const drinks       = [];
    const manualSalsas = [];

    for (const item of items) {
      const itemNameLc   = (item.displayName || item.name || '').toLowerCase();
      const modifiers    = item.modifiers || [];
      const hasModifiers = modifiers.length > 0;

      if (SALAD_KEYWORDS.some(k => itemNameLc.includes(k))) continue;

      if (itemNameLc.includes(SIDE_PACK_KEYWORD)) {
        const qty      = item.quantity || 1;
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón');
        });
        let salsaName = 'Salsa Roja';
        if (salsaMod) {
          const sn = (salsaMod.displayName || '').toLowerCase();
          if (sn.includes('verde'))                                 salsaName = 'Salsa Verde';
          else if (sn.includes('patron') || sn.includes('patrón')) salsaName = 'Salsa Patrón';
        }
        sidePacks.push({
          name: item.displayName || item.name, quantity: qty, salsaName,
          contents: [
            { item: 'Guacamole', amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Spoon', tempType: 'cold' },
            { item: 'Queso',     amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle', tempType: 'hot'  },
            { item: salsaName,   amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle', tempType: 'cold' },
          ],
        });
        continue;
      }

      if (itemNameLc.startsWith('chips & salsa') || itemNameLc === 'chips & salsa') {
        const qty      = item.quantity || 1;
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón');
        });
        let salsaName = 'Salsa Roja';
        if (salsaMod) {
          const sn = (salsaMod.displayName || '').toLowerCase();
          if (sn.includes('verde'))                                 salsaName = 'Salsa Verde';
          else if (sn.includes('patron') || sn.includes('patrón')) salsaName = 'Salsa Patrón';
        }
        manualSalsas.push({ name: salsaName, category: 'salsa', tempType: 'cold', unit: 'oz', utensil: 'Ladle', totalAmount: 32*qty, packaging: '32 oz container', packagingQty: qty, included: 'Yes', quantity: qty });
        continue;
      }

      if (itemNameLc.includes('salsa pack') && !itemNameLc.includes(SIDE_PACK_KEYWORD)) {
        const qty      = item.quantity || 1;
        const salsaMod = modifiers.find(m => {
          const n = (m.displayName || '').toLowerCase();
          return n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón');
        });
        manualSalsas.push({ name: `Salsa Pack${salsaMod ? ` (${salsaMod.displayName})` : ''}`, category: 'addon', tempType: 'cold', unit: 'oz', utensil: 'Ladle', totalAmount: 32*qty, packaging: '32 oz container', packagingQty: qty, included: 'Yes', quantity: qty, servesCount: 20*qty });
        continue;
      }

      if (DRINK_KEYWORDS.some(k => itemNameLc.includes(k))) {
        drinks.push(this._parseDrink(item, modifiers, item.quantity || 1));
        continue;
      }

      if (!hasModifiers) {
        const dn            = item.displayName || item.name || '';
        const canonicalName = await this.resolver.resolveCanonicalName(dn);
        if (canonicalName) {
          const formula = await this.resolver.getFormula(canonicalName, 'BIRD_BOX');
          if (formula) {
            const qty         = item.quantity || 1;
            const isFixedPack = formula.amount_per_person === 0;
            const totalAmount = isFixedPack ? this._getFixedPackAmount(canonicalName, qty) : this.resolver.calculateAmount(formula, guestCount);
            const packaging   = this.resolver.getPackaging(formula, guestCount);
            manualSalsas.push({ name: canonicalName, category: formula.category, tempType: formula.temp_type, unit: formula.unit, utensil: formula.utensil, totalAmount, packaging: packaging.package, packagingQty: isFixedPack ? qty : packaging.qty, included: 'Yes', quantity: qty, servesCount: isFixedPack ? 20*qty : null });
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

      const combos        = modifiers.filter(m => /^#\d+/i.test((m.displayName || '').trim()));
      const tortillaMod   = modifiers.find(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('flour') || n.includes('corn') || n.includes('50/50'); });
      const chipsModifier = modifiers.find(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('chip') || n.includes('yes! i would like') || n.includes('nope'); });
      const wantsChips    = chipsModifier ? (chipsModifier.displayName||'').toLowerCase().includes('yes') : false;
      const wantsPaper    = modifiers.some(m => this.resolver.isPaperYes(m.displayName || ''));
      const is5050        = (tortillaMod?.displayName || '').toLowerCase().includes('50/50');

      boxes.push({
        name:       item.displayName || item.name,
        quantity:   item.quantity || 1,
        tacoCount,
        combos:     combos.map(c => c.displayName),
        tortilla:   tortillaMod?.displayName || 'Flour Tortillas',
        is5050, wantsChips, wantsPaper,
      });
    }

    // ── Combos + tortillas ──
    const comboTotals = {};
    let totalTacos    = 0;

    for (const box of boxes) {
      totalTacos += box.tacoCount * box.quantity;
      const numCombos     = box.combos.length > 0 ? box.combos.length : 1;
      const tacosPerCombo = Math.ceil(box.tacoCount / numCombos);
      for (const combo of box.combos) {
        if (!comboTotals[combo]) comboTotals[combo] = { total: 0, flourTortillas: 0, cornTortillas: 0 };
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
      if (data.flourTortillas > 0 && data.cornTortillas > 0) tortillaLabel = `${data.flourTortillas}F / ${data.cornTortillas}C`;
      else if (data.flourTortillas > 0) tortillaLabel = `${data.flourTortillas} Flour`;
      else tortillaLabel = `${data.cornTortillas} Corn`;
      return {
        name: combo, total: data.total, unit: 'tacos', tortillaLabel,
        flourTortillas: data.flourTortillas, cornTortillas: data.cornTortillas,
        packaging: data.total > TACO_HALF_PAN_MAX ? 'Full Pan' : 'Half Pan',
        packagingQty: 1, utensil: 'Tongs Small', tempType: 'hot',
      };
    });

    // ── Salsas ──
    const anyWantsChips = boxes.some(b => b.wantsChips);

    // Usar totalTacos/2 como guest count efectivo para salsas y paper goods
    const effectiveGuests = totalTacos > 0 ? Math.round(totalTacos / 2) : guestCount;
    const numSalsas       = effectiveGuests >= THREE_SALSAS_THRESHOLD ? 3 : 1;
    const ozPerSalsa      = Math.ceil(effectiveGuests / numSalsas);

    const _buildIncludedSalsa = (name) => ({
      name, totalAmount: ozPerSalsa, unit: 'oz', utensil: 'Ladle C/U',
      packaging: '32 oz deli cup', packagingQty: ozPerSalsa > 32 ? 2 : 1,
      tempType: 'cold', included: 'Yes',
    });

    const includedSalsas = anyWantsChips
      ? effectiveGuests >= THREE_SALSAS_THRESHOLD
        ? [_buildIncludedSalsa('Salsa Roja'), _buildIncludedSalsa('Salsa Verde'), _buildIncludedSalsa('Salsa Patrón')]
        : [_buildIncludedSalsa('Salsa Roja')]
      : [];

    const manualSalsaItems = manualSalsas.filter(i => i.category === 'salsa');
    const addonItems       = manualSalsas.filter(i => i.category === 'addon');
    const chipsBoxCount    = boxes.filter(b => b.wantsChips).length;

    const chipsAndSalsa = anyWantsChips
      ? [{ name: 'Chips', total: chipsBoxCount, unit: 'Full Pan', packaging: 'Full Pan', packagingQty: chipsBoxCount, utensil: 'Tongs Large', tempType: 'dry', included: 'Yes' }, ...includedSalsas]
      : [{ name: 'Chips & Salsa', included: 'No', tempType: 'dry' }];

    const hasManuasSalsas = manualSalsaItems.length > 0;
    const anyWantsPaper   = boxes.some(b => b.wantsPaper);
    let paperGoods        = { included: false, items: [] };

    if (anyWantsPaper) {
      // Usar tacos para inferir guests — más confiable que guestCount de la orden
      const base          = await this.resolver.calculatePaperGoods('BIRD_BOX', effectiveGuests);
      const tacoBoatCount = Math.ceil((totalTacos / 2 + 10) / 10) * 10;
      const forkCount     = tacoBoatCount;
      const napkinCount   = Math.ceil((effectiveGuests * 0.4) / 10) * 10;
      const updatedItems  = (base.items || []).map(pg => {
        const nameLc = (pg.name || '').toLowerCase();
        if (nameLc.includes('taco boat')) return { ...pg, qty: tacoBoatCount };
        if (nameLc.includes('fork'))      return { ...pg, qty: forkCount };
        if (nameLc.includes('napkin'))    return { ...pg, qty: napkinCount };
        return pg;
      });
      paperGoods = { ...base, items: updatedItems };
    }

    const salads       = this._extractSalads(items);
    const chipsBreakdown = [];
    if (anyWantsChips) chipsBreakdown.push({ label: `Chips para tacos (${chipsBoxCount} box${chipsBoxCount > 1 ? 'es' : ''} con chips incluido)`, amount: `${chipsBoxCount} Full Pan${chipsBoxCount > 1 ? 's' : ''}`, packaging: `${chipsBoxCount}x Full Pan`, utensil: 'Tongs Large' });
    for (const sp of sidePacks) {
      const qty = sp.quantity || 1;
      chipsBreakdown.push({ label: `Chips para Side Pack${qty > 1 ? ` ×${qty}` : ''} (Guac / Queso / ${sp.salsaName})`, amount: `${qty} Full Pan${qty > 1 ? 's' : ''}`, packaging: `${qty}x Full Pan`, utensil: 'Tongs Large' });
    }

    return {
      header: this._buildHeader(cateringOrder, delivery),
      boxes, sidePacks, tacoRows, chipsAndSalsa, chipsBreakdown,
      salsas: [...includedSalsas, ...manualSalsaItems], addons: addonItems,
      hasManuasSalsas, drinks, paperGoods, totalTacos, salads, summaryItems: [],
      hotItems:  [...tacoRows, ...drinks.filter(d => d.tempType === 'hot'), ...addonItems.filter(i => i.tempType === 'hot'), ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'hot'))],
      coldItems: [...includedSalsas, ...drinks.filter(d => d.tempType === 'cold'), ...manualSalsaItems, ...addonItems.filter(i => i.tempType === 'cold'), ...salads, ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'cold')), ...drinks.flatMap(d => (d.creamers||[]).map(cr => ({ ...cr, tempType: 'cold' })))],
      dryItems:  [...chipsAndSalsa.filter(i => i.tempType === 'dry'), ...addonItems.filter(i => i.tempType === 'dry')],
      proteins: [], toppings: [], tortillas: [], snacks: [],
    };
  }

  // ─── HELPER: parsear bebida ───────────────────────────────────────────────
  _parseDrink(item, modifiers, qty) {
    const itemNameLc = (item.displayName || item.name || '').toLowerCase();
    if (itemNameLc.includes('coffee')) {
      const creamers = modifiers
        .filter(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('milk') || n.includes('oat') || n.includes('cream') || n.includes('whole') || n.includes('skim') || n.includes('half'); })
        .map(m => ({ name: m.displayName, quantity: m.quantity || qty }));
      const wantsCups    = modifiers.some(m => (m.displayName||'').toLowerCase().includes('cups and lids') || (m.displayName||'').toLowerCase().includes('cups & lids'));
      const creamerItems = creamers.map(cr => { const totalOz = cr.quantity * 32; return { name: cr.name, totalOz, packaging: totalOz > 32 ? '½ Gallon Jug' : '32 oz deli cup', tempType: 'cold' }; });
      return { name: item.displayName || item.name, quantity: qty, totalOz: qty * 96, packaging: '96 oz coffee', packagingQty: qty, utensil: '—', tempType: 'hot', wantsCups, creamers: creamerItems };
    } else {
      const wantsCups = modifiers.some(m => (m.displayName||'').toLowerCase().includes('yes, i want cups'));
      return { name: item.displayName || item.name, quantity: qty, tempType: 'cold', wantsCups, creamers: [] };
    }
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
        snacks.push({ name: item.displayName || item.name, total: item.quantity, unit: 'each', packaging: 'black box bin', packagingQty: item.quantity, utensil: '-', tempType: 'dry' });
      } else if (name.includes('taco') || /^#\d+/.test((item.displayName || item.name || '').trim())) {
        tacoRows.push({ name: item.displayName || item.name, total: item.quantity * 50, unit: 'tacos', packaging: 'Half Pan', packagingQty: item.quantity, utensil: 'Tongs', tempType: 'hot' });
      }
    }
    return { header: this._buildHeader(cateringOrder, delivery), snacks, tacoRows, paperGoods: { included: false, items: [] }, proteins: [], toppings: [], salsas: [], tortillas: [], hotItems: tacoRows, coldItems: [], dryItems: snacks };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  _extractSalads(items) {
    const salads = [];
    for (const item of items) {
      const itemNameLc = (item.displayName || item.name || '').toLowerCase();
      if (!SALAD_KEYWORDS.some(k => itemNameLc.includes(k))) continue;
      const modifiers   = item.modifiers || [];
      const qty         = item.quantity || 1;
      const proteinMod  = modifiers.find(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('brisket') || n.includes('chicken') || n.includes('chorizo') || n.includes('without protein') || n.includes('no protein'); });
      const servesMatch = itemNameLc.match(/for\s+(\d+)/i);
      const isLarge     = itemNameLc.includes('large');
      let saladType = 'Salad';
      if (itemNameLc.includes('city slicker')) saladType = 'City Slicker';
      else if (itemNameLc.includes('cowboy'))  saladType = 'The Cowboy';
      else if (itemNameLc.includes('farmer'))  saladType = 'The Farmer';
      salads.push({ name: item.displayName || item.name, saladType, size: isLarge ? 'Large' : 'Small', protein: proteinMod?.displayName || null, serves: servesMatch ? parseInt(servesMatch[1]) : null, quantity: qty, packaging: isLarge ? '1 full pan' : '1 half pan', utensil: 'Tongs / Spoon', tempType: 'cold', dressing: this._getSaladDressing(saladType) });
    }
    return salads;
  }

  _getSaladDressing(saladType) {
    const map = { 'City Slicker': 'Cilantro dressing on the side', 'The Cowboy': 'Cilantro dressing on the side', 'The Farmer': 'Lime Jalapeño dressing on the side' };
    return map[saladType] || 'Dressing on the side';
  }

  _getFixedPackAmount(canonicalName, qty) {
    const fixedAmounts = { 'Chips & Queso': 32, 'Chips & Guacamole': 32, 'Chips & Salsa': 32, 'Bunuelos': 1 };
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
      isEZCater:                order.isEZCater || false,
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
      const total     = is5050 ? Math.round(this.resolver.calculateAmount(flourItem.formula, guestCount) / 2) : this.resolver.calculateAmount(flourItem.formula, guestCount);
      const packaging = this.resolver.getPackaging(flourItem.formula, guestCount);
      result.push({ name: is5050 ? 'Flour Tortillas (50/50)' : 'Flour Tortillas', total, unit: flourItem.formula.unit, packaging: packaging.package, packagingQty: packaging.qty, utensil: flourItem.formula.utensil, tempType: 'hot' });
    }
    if (cornItem) {
      const total     = is5050 ? Math.round(this.resolver.calculateAmount(cornItem.formula, guestCount) / 2) : this.resolver.calculateAmount(cornItem.formula, guestCount);
      const packaging = this.resolver.getPackaging(cornItem.formula, guestCount);
      result.push({ name: is5050 ? 'Corn Tortillas (50/50)' : 'Corn Tortillas', total, unit: cornItem.formula.unit, packaging: packaging.package, packagingQty: packaging.qty, utensil: cornItem.formula.utensil, tempType: 'hot' });
    }
    return result;
  }

  _groupByCategory(items) {
    return items.reduce((acc, item) => { const cat = item.category || 'other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
  }

  // ─── SPACE RENTAL ─────────────────────────────────────────────────────────
  async _calculateSpaceRental(cateringOrder) {
    const { parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const items    = parsedData?.items    || [];
    const rentalItem = items.find(i => (i.displayName || i.name || '').toLowerCase().includes('space rental'));
    const timeMod    = rentalItem?.modifiers?.[0];
    const timeStr    = timeMod?.displayName || '';
    const timeRange  = this._parseSpaceRentalTime(timeStr, cateringOrder.estimatedFulfillmentDate);
    const hasFood    = items.some(i => { const n = (i.displayName||i.name||'').toLowerCase(); return !n.includes('space rental') && !n.includes('ez cater') && !n.includes('open tax'); });
    return {
      header: this._buildHeader(cateringOrder, delivery),
      spaceRental: { rentalType: rentalItem?.displayName || 'Space Rental', timeStr, eventTime: timeRange.eventTimeLabel, readyBy: timeRange.readyByLabel, startISO: timeRange.startISO, endISO: timeRange.endISO, readyByISO: timeRange.readyByISO, duration: timeRange.duration, totalAmount: rentalItem?.price || cateringOrder.totalAmount, hasFood },
      hotItems: [], coldItems: [], dryItems: [], paperGoods: { included: false, items: [] },
    };
  }

  _parseSpaceRentalTime(timeStr, baseDateISO) {
    const READY_BEFORE_MINUTES = 25;
    if (!timeStr || !baseDateISO) return { eventTimeLabel: timeStr || '—', readyByLabel: '—', startISO: baseDateISO, endISO: null, readyByISO: null, duration: '—' };
    const match = timeStr.match(/(\d+:\d+\s*(?:am|pm))\s+to\s+(\d+:\d+\s*(?:am|pm))/i);
    if (!match) return { eventTimeLabel: timeStr, readyByLabel: '—', startISO: baseDateISO, endISO: null, readyByISO: null, duration: timeStr };
    const baseDate  = new Date(baseDateISO);
    const dateStr   = baseDate.toISOString().slice(0, 10);
    const parseTime = (t) => { const [time, meridiem] = t.trim().split(/\s+/); let [h, m] = time.split(':').map(Number); if (meridiem?.toLowerCase() === 'pm' && h !== 12) h += 12; if (meridiem?.toLowerCase() === 'am' && h === 12) h = 0; return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`); };
    const startDate   = parseTime(match[1]);
    const endDate     = parseTime(match[2]);
    const readyByDate = new Date(startDate.getTime() - READY_BEFORE_MINUTES * 60 * 1000);
    const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
    const diffMs  = endDate - startDate;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMin = Math.floor((diffMs % 3600000) / 60000);
    return { eventTimeLabel: `${fmt(startDate)} – ${fmt(endDate)}`, readyByLabel: fmt(readyByDate), startISO: startDate.toISOString(), endISO: endDate.toISOString(), readyByISO: readyByDate.toISOString(), duration: diffHrs > 0 ? `${diffHrs}h${diffMin > 0 ? ` ${diffMin}min` : ''}` : `${diffMin}min` };
  }
}

module.exports = FulfillmentSheetCalculator;