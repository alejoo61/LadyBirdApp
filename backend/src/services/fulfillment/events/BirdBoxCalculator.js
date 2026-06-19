// src/services/fulfillment/events/BirdBoxCalculator.js

const { resolveSalads }                           = require('../shared/SaladsResolver');
const { resolveUnknownItems }                      = require('../shared/AddonsResolver');
const { buildUtensilContext }                      = require('../shared/UtensilContextBuilder');
const { resolveIndividualTacos, isIndividualTaco } = require('../shared/IndividualTacosResolver');
const { isDrink, parseDrink }                     = require('../shared/DrinksResolver');

const SALAD_KEYWORDS    = ['salad', 'city slicker', 'cowboy', 'farmer'];
const SIDE_PACK_KEYWORD = 'side pack';
const THREE_SALSAS_THRESHOLD = 30;
const TACO_HALF_PAN_MAX      = 18;

async function calculateBirdBox(cateringOrder, resolver, pool) {
  const { guestCount, parsedData } = cateringOrder;
  const delivery = parsedData?.delivery || {};
  const items    = parsedData?.items || [];
  return _processBirdBoxItems(items, guestCount, cateringOrder, delivery, resolver, pool);
}

async function _processBirdBoxItems(items, guestCount, cateringOrder, delivery, resolver, pool) {
  const boxes        = [];
  const sidePacks    = [];
  const drinks       = [];
  const manualSalsas = [];
  const addonItems   = [];
  const individualTacos = resolveIndividualTacos(items);

  for (const item of items) {
    const nameLc       = (item.displayName || item.name || '').toLowerCase();
    const modifiers    = item.modifiers || [];
    const hasModifiers = modifiers.length > 0;
    const qty          = item.quantity || 1;

    if (SALAD_KEYWORDS.some(k => nameLc.includes(k))) continue;
    if (isIndividualTaco(nameLc, modifiers)) continue;

    if (nameLc.includes(SIDE_PACK_KEYWORD)) {
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
          { item: 'Guacamole', amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Spoon Serving', tempType: 'cold' },
          { item: 'Queso',     amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle',         tempType: 'hot'  },
          { item: salsaName,   amount: `${32*qty} oz`, packaging: `${qty}x 32 oz container`, utensil: 'Ladle',         tempType: 'cold' },
        ],
      });
      continue;
    }

    if (nameLc.startsWith('chips & salsa') || nameLc === 'chips & salsa') {
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

    if (nameLc.includes('salsa pack') && !nameLc.includes(SIDE_PACK_KEYWORD)) {
      const salsaMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('roja') || n.includes('verde') || n.includes('patron') || n.includes('patrón');
      });
      manualSalsas.push({ name: `Salsa Pack${salsaMod ? ` (${salsaMod.displayName})` : ''}`, category: 'addon', tempType: 'cold', unit: 'oz', utensil: 'Ladle', totalAmount: 32*qty, packaging: '32 oz container', packagingQty: qty, included: 'Yes', quantity: qty, servesCount: 20*qty });
      continue;
    }

    if (isDrink(nameLc)) {
      drinks.push(parseDrink(item, modifiers, qty));
      continue;
    }

    if (!hasModifiers) {
      const dn            = item.displayName || item.name || '';
      const canonicalName = await resolver.resolveCanonicalName(dn);
      if (canonicalName) {
        const formula = await resolver.getFormula(canonicalName, 'BIRD_BOX')
                     || await resolver.getFormula(canonicalName, 'PERSONAL_BOX');
        if (formula) {
          const isFixedPack = parseFloat(formula.amount_per_person) === 0;
          if (formula.category === 'addon') {
            const totalAmount = isFixedPack ? _getFixedAmount(canonicalName, qty) : resolver.calculateAmount(formula, guestCount);
            const fixedUnit   = isFixedPack ? _getFixedUnit(canonicalName) : formula.unit;
            const packaging   = resolver.getPackaging(formula, guestCount);
            const hasChipsPan = isFixedPack && ['Chips & Guacamole', 'Chips & Queso', 'Chips & Salsa'].includes(canonicalName);
            addonItems.push({ name: canonicalName, quantity: qty, totalAmount, unit: fixedUnit, packaging: packaging.package, packagingQty: isFixedPack ? qty : packaging.qty, tempType: formula.temp_type || 'dry', hasChipsPan, chipPans: hasChipsPan ? qty : 0 });
          } else {
            const totalAmount = isFixedPack ? _getFixedAmount(canonicalName, qty) : resolver.calculateAmount(formula, guestCount);
            const packaging   = resolver.getPackaging(formula, guestCount);
            manualSalsas.push({ name: canonicalName, category: formula.category, tempType: formula.temp_type, unit: formula.unit, utensil: formula.utensil, totalAmount, packaging: packaging.package, packagingQty: isFixedPack ? qty : packaging.qty, included: 'Yes', quantity: qty, servesCount: isFixedPack ? 20*qty : null });
          }
          continue;
        }
      }
      continue;
    }

    // Bird Box con tacos
    const sizeMod   = modifiers.find(m => resolver.isSizeModifier(m.displayName || ''));
    const tacoCount = sizeMod
      ? parseInt((sizeMod.displayName || '').match(/(\d+)\s*tacos?/i)?.[1] || 0)
      : (guestCount * 2);

    const combos        = modifiers.filter(m => /^#\d+/i.test((m.displayName || '').trim()));
    const tortillaMod   = modifiers.find(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('flour') || n.includes('corn') || n.includes('50/50'); });
    const chipsModifier = modifiers.find(m => { const n = (m.displayName||'').toLowerCase(); return n.includes('chip') || n.includes('yes! i would like') || n.includes('nope'); });
    const wantsChips    = chipsModifier ? (chipsModifier.displayName||'').toLowerCase().includes('yes') : false;
    const wantsPaper    = modifiers.some(m => resolver.isPaperYes(m.displayName || ''));
    const is5050        = (tortillaMod?.displayName || '').toLowerCase().includes('50/50');

    boxes.push({
      name:     item.displayName || item.name,
      quantity: qty, tacoCount,
      combos:   combos.map(c => c.displayName),
      tortilla: tortillaMod?.displayName || 'Flour Tortillas',
      is5050, wantsChips, wantsPaper,
    });
  }

  // Combo totals
  const comboTotals = {};
  let totalTacos    = 0;
  for (const box of boxes) {
    totalTacos += box.tacoCount * box.quantity;
    const numCombos     = box.combos.length > 0 ? box.combos.length : 1;
    const tacosPerCombo = Math.ceil(box.tacoCount / numCombos);
    for (const combo of box.combos) {
      if (!comboTotals[combo]) comboTotals[combo] = { total: 0, flourTortillas: 0, cornTortillas: 0 };
      const q = tacosPerCombo * box.quantity;
      comboTotals[combo].total += q;
      if (box.is5050) {
        comboTotals[combo].flourTortillas += Math.ceil(q / 2);
        comboTotals[combo].cornTortillas  += Math.floor(q / 2);
      } else if ((box.tortilla || '').toLowerCase().includes('corn')) {
        comboTotals[combo].cornTortillas += q;
      } else {
        comboTotals[combo].flourTortillas += q;
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

  const anyWantsChips   = boxes.some(b => b.wantsChips);
  const effectiveGuests = totalTacos > 0 ? Math.round(totalTacos / 2) : guestCount;
  const numSalsas       = effectiveGuests >= THREE_SALSAS_THRESHOLD ? 3 : 1;
  const ozPerSalsa      = Math.ceil(effectiveGuests / numSalsas);

  const _buildSalsa = (name) => ({
    name, totalAmount: ozPerSalsa, unit: 'oz', utensil: 'Ladle',
    packaging: '32 oz deli cup', packagingQty: ozPerSalsa > 32 ? 2 : 1,
    tempType: 'cold', included: 'Yes',
  });

  const includedSalsas = anyWantsChips
    ? effectiveGuests >= THREE_SALSAS_THRESHOLD
      ? [_buildSalsa('Salsa Roja'), _buildSalsa('Salsa Verde'), _buildSalsa('Salsa Patrón')]
      : [_buildSalsa('Salsa Roja')]
    : [];

  const manualSalsaItems = manualSalsas.filter(i => i.category === 'salsa');
  const chipsBoxCount    = boxes.filter(b => b.wantsChips).length;

  const chipsAndSalsa = anyWantsChips
    ? [{ name: 'Chips', total: chipsBoxCount, unit: 'Full Pan', packaging: 'Full Pan', packagingQty: chipsBoxCount, utensil: 'Tongs Large', tempType: 'dry', included: 'Yes' }, ...includedSalsas]
    : [{ name: 'Chips & Salsa', included: 'No', tempType: 'dry' }];

  const anyWantsPaper = boxes.some(b => b.wantsPaper);
  const salads        = resolveSalads(items);

  // ─── Tortillas para utensil context ──────────────────────────────────────
  // En Bird Box los tacos vienen pre-armados. Solo las tortillas necesitan
  // Tong Small (1 por tipo flour/corn). Los combo ingredients NO se pasan.
  const tortillaTypes = [];
  if (tacoRows.some(r => r.flourTortillas > 0)) tortillaTypes.push({ name: 'Flour Tortillas' });
  if (tacoRows.some(r => r.cornTortillas  > 0)) tortillaTypes.push({ name: 'Corn Tortillas'  });

  // ─── Chips para utensil context ───────────────────────────────────────────
  // Si hay chips incluidos en boxes → Tong Large.
  // Se pasa como snack con nombre 'Chips' (sin 'churro'/'bunuelo') para que
  // hasChips=true en UtensilContextBuilder sin interferir con hasBunuelos.
  // NO usar extraNames — causa doble conteo cuando anyWantsChips=true y
  // addonItems ya tiene Bunuelos (ambos triggerean Tong Large por separado).
  const chipsSnack = anyWantsChips
    ? [{ name: 'Chips' }]
    : [];

  // ─── Side pack salsas → Ladle ─────────────────────────────────────────────
  const sidePackSalsas = sidePacks.flatMap(sp =>
    sp.contents
      .filter(c => c.utensil === 'Ladle')
      .map(c => ({ name: c.item, packaging: '32 oz deli cup' }))
  );

  const bbContext = buildUtensilContext({
    salsas:    [...includedSalsas, ...manualSalsas.filter(s => s.category === 'salsa'), ...sidePackSalsas],
    addons:    addonItems,       // Bunuelos, Chips & Queso, etc. — standalone
    snacks:    chipsSnack,       // Chips del box → hasChips sin contaminar hasBunuelos
    salads,
    tortillas: tortillaTypes,    // Tong Small por tipo
    wantsPaper: anyWantsPaper,
    // extraNames: [] — nunca usar 'chip' como string suelto, causa doble conteo
  });

  const tacoBoatCount = Math.ceil((totalTacos / 2 + 10) / 10) * 10;
  let paperGoods = await resolver.calculatePaperGoods('BIRD_BOX', effectiveGuests, bbContext);
  paperGoods.items = (paperGoods.items || []).map(pg => {
    if ((pg.name || '').toLowerCase().includes('taco boat') || (pg.name || '').toLowerCase().includes('boat'))
      return { ...pg, qty: tacoBoatCount };
    return pg;
  });

  // Unknown items — check menu_items table
  if (pool) {
    const unknowns = await resolveUnknownItems(items, resolver, addonItems, pool);
    addonItems.push(...unknowns);
  }

  const chipsBreakdown = [];
  if (anyWantsChips) chipsBreakdown.push({ label: `Chips para tacos (${chipsBoxCount} box${chipsBoxCount > 1 ? 'es' : ''} con chips incluido)`, amount: `${chipsBoxCount} Full Pan${chipsBoxCount > 1 ? 's' : ''}`, packaging: `${chipsBoxCount}x Full Pan`, utensil: 'Tongs Large' });
  for (const sp of sidePacks) {
    const q = sp.quantity || 1;
    chipsBreakdown.push({ label: `Chips para Side Pack${q > 1 ? ` ×${q}` : ''} (Guac / Queso / ${sp.salsaName})`, amount: `${q} Full Pan${q > 1 ? 's' : ''}`, packaging: `${q}x Full Pan`, utensil: 'Tongs Large' });
  }

  return {
    individualTacos,
    boxes, sidePacks, tacoRows, chipsAndSalsa, chipsBreakdown,
    salsas: [...includedSalsas, ...manualSalsaItems],
    addons: addonItems,
    hasManuasSalsas: manualSalsaItems.length > 0,
    drinks, paperGoods, totalTacos, salads,
    summaryItems: [],
    proteins: [], toppings: [], tortillas: [], snacks: [],
    hotItems:  [...individualTacos, ...tacoRows, ...drinks.filter(d => d.tempType === 'hot'), ...addonItems.filter(i => i.tempType === 'hot'), ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'hot'))],
    coldItems: [...includedSalsas, ...drinks.filter(d => d.tempType === 'cold'), ...manualSalsaItems, ...addonItems.filter(i => i.tempType === 'cold'), ...salads, ...sidePacks.flatMap(sp => sp.contents.filter(c => c.tempType === 'cold')), ...drinks.flatMap(d => (d.creamers||[]).map(cr => ({ ...cr, tempType: 'cold' })))],
    dryItems:  [...chipsAndSalsa.filter(i => i.tempType === 'dry'), ...addonItems.filter(i => i.tempType === 'dry')],
  };
}

function _getFixedAmount(canonicalName, qty) {
  const map = { 'Chips & Queso': 32, 'Chips & Guacamole': 32, 'Chips & Salsa': 32, 'Bunuelos': 40 };
  return (map[canonicalName] ?? 1) * qty;
}

function _getFixedUnit(canonicalName) {
  const map = { 'Chips & Queso': 'oz', 'Chips & Guacamole': 'oz', 'Chips & Salsa': 'oz', 'Bunuelos': 'each' };
  return map[canonicalName] || 'each';
}

module.exports = { calculateBirdBox, _processBirdBoxItems, _processBirdBoxItemsWithPool: (items, gc, order, delivery, resolver, pool) => _processBirdBoxItems(items, gc, order, delivery, resolver, pool) };