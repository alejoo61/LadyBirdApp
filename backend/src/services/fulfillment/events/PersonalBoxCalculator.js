// src/services/fulfillment/events/PersonalBoxCalculator.js

const { resolveSalads }                           = require('../shared/SaladsResolver');
const { resolveIndividualTacos, isIndividualTaco } = require('../shared/IndividualTacosResolver');
const { isDrink, parseDrink }                     = require('../shared/DrinksResolver');
const { _processBirdBoxItems }                    = require('./BirdBoxCalculator');
const { resolveUnknownItems }                      = require('../shared/AddonsResolver');
const { calculateTacoBar }                        = require('./TacoBarCalculator');

const PERSONAL_BOX_KEYWORDS = [
  "personal breakfast 'bird box",
  "personal lunch 'bird box",
  "byo personal 'bird box",
  "personal 'bird box",
];

const TACO_BAR_KEYWORDS = ['build your own taco bar', 'taco bar'];

const BIRD_BOX_KEYWORDS = [
  "breakfast 'bird box",
  "lunch 'bird box",
  "build your own 'bird box",
  'bird box',
];

async function calculatePersonalBox(cateringOrder, resolver, pool) {
  const { guestCount, parsedData } = cateringOrder;
  const delivery  = parsedData?.delivery || {};
  const items     = parsedData?.items || [];

  const personalBoxes   = [];
  const birdBoxItems    = [];
  const tacoBarItems    = [];
  const drinks          = [];
  const addons          = [];
  const individualTacos = resolveIndividualTacos(items);
  let totalBoxes = 0;

  for (const item of items) {
    const nameLc    = (item.displayName || item.name || '').toLowerCase();
    const modifiers = item.modifiers || [];
    const qty       = item.quantity || 1;

    if (isDrink(nameLc)) {
      drinks.push(parseDrink(item, modifiers, qty));
      continue;
    }

    if (isIndividualTaco(nameLc, modifiers)) continue;

    if (PERSONAL_BOX_KEYWORDS.some(k => nameLc.includes(k))) {
      const tortillaMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      const salsaMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return (n.includes('roja') || n.includes('verde') || n.includes('patron') ||
                n.includes('patrón') || n.includes('most popular')) && n.includes('oz');
      });

      let salsaLabel = null;
      if (salsaMod) {
        const sn = (salsaMod.displayName || '').toLowerCase();
        if (sn.includes('verde'))                                 salsaLabel = 'Salsa Verde';
        else if (sn.includes('patron') || sn.includes('patrón')) salsaLabel = 'Salsa Patrón';
        else if (sn.includes('most popular'))                     salsaLabel = 'Most Popular';
        else                                                      salsaLabel = 'Salsa Roja';
      }

      const noteMod = modifiers.find(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('please label') || n.includes('note:') || n.includes('allerg');
      });

      const combos       = modifiers.filter(m => /^#\d+/i.test((m.displayName || '').trim())).map(m => m.displayName);
      const uniqueCombos = [...new Set(combos)];
      const comboLabel   = uniqueCombos.map(c => {
        const count = combos.filter(x => x === c).length;
        return count > 1 ? `${count}x ${c}` : c;
      }).join(' + ');

      totalBoxes += qty;
      personalBoxes.push({
        name:       item.displayName || item.name,
        quantity:   qty,
        combos,
        uniqueCombos,
        comboLabel: comboLabel || (item.displayName || item.name || '—'),
        tortilla:   tortillaMod?.displayName || 'Corn',
        salsa:      salsaLabel,
        note:       noteMod?.displayName || null,
      });
      continue;
    }

    if (TACO_BAR_KEYWORDS.some(k => nameLc.includes(k))) {
      tacoBarItems.push(item);
      continue;
    }

    if (BIRD_BOX_KEYWORDS.some(k => nameLc.includes(k))) {
      birdBoxItems.push(item);
      continue;
    }

    // Standalone addons
    if (modifiers.length === 0) {
      const dn            = item.displayName || item.name || '';
      const canonicalName = await resolver.resolveCanonicalName(dn);
      if (canonicalName) {
        const formula = await resolver.getFormula(canonicalName, 'PERSONAL_BOX')
                     || await resolver.getFormula(canonicalName, 'BIRD_BOX');
        if (formula) {
          const isFixedPack = parseFloat(formula.amount_per_person) === 0;
          const totalAmount = isFixedPack ? _getFixedAmount(canonicalName, qty) : resolver.calculateAmount(formula, guestCount);
          const fixedUnit   = isFixedPack ? _getFixedUnit(canonicalName) : formula.unit;
          const packaging   = resolver.getPackaging(formula, guestCount);
          const hasChipsPan = isFixedPack && ['Chips & Guacamole', 'Chips & Queso', 'Chips & Salsa'].includes(canonicalName);
          addons.push({ name: canonicalName, quantity: qty, totalAmount, unit: fixedUnit, packaging: packaging.package, packagingQty: isFixedPack ? qty : packaging.qty, tempType: formula.temp_type || 'dry', hasChipsPan, chipPans: hasChipsPan ? qty : 0 });
          continue;
        }
      }
      addons.push({ name: item.displayName || item.name, quantity: qty, tempType: 'dry' });
    }
  }

  // Combo totals for personal boxes
  const comboTotals = {};
  for (const box of personalBoxes) {
    for (const combo of box.combos) {
      if (!comboTotals[combo]) comboTotals[combo] = { total: 0, tortilla: box.tortilla };
      comboTotals[combo].total += box.quantity;
    }
  }

  const personalTacoRows = Object.entries(comboTotals).map(([combo, data]) => ({
    name: combo, total: data.total, unit: 'each',
    tortilla: data.tortilla, packaging: 'Personal Box',
    packagingQty: data.total, tempType: 'hot',
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

  let birdBoxResult = null;
  if (birdBoxItems.length > 0) {
    birdBoxResult = await _processBirdBoxItems(birdBoxItems, guestCount, cateringOrder, delivery, resolver, pool);
  }

  let tacoBarResult = null;
  if (tacoBarItems.length > 0) {
    // Create virtual order for taco bar sub-calculation
    const virtualOrder = { ...cateringOrder, parsedData: { ...(parsedData || {}), items: tacoBarItems } };
    const tbResult = await calculateTacoBar(virtualOrder, resolver);
    tacoBarResult = {
      proteins:  tbResult.proteins,
      toppings:  tbResult.toppings,
      salsas:    tbResult.salsas,
      snacks:    tbResult.snacks,
      tortillas: tbResult.tortillas,
      paperGoods: tbResult.paperGoods,
      salads:    tbResult.salads,
      addons:    tbResult.addons,
      drinks:    [],
      hotItems:  tbResult.hotItems,
      coldItems: tbResult.coldItems,
      dryItems:  tbResult.dryItems,
    };
  }

  // Unknown items — check menu_items table
  if (pool) {
    const unknowns = await resolveUnknownItems(items, resolver, addons, pool);
    addons.push(...unknowns);
  }

  const allDrinks = [...drinks, ...(birdBoxResult?.drinks || []), ...(tacoBarResult?.drinks || [])];

  return {
    individualTacos,
    personalBoxes, personalTacoRows, chipsRow, salsaRow,
    totalBoxes, paperGoods, birdBoxResult, tacoBarResult,
    drinks: allDrinks, addons,
    proteins: [], toppings: [], salsas: [], tortillas: [], snacks: [],
    hotItems:  [...individualTacos, ...personalTacoRows, ...(birdBoxResult?.hotItems || []), ...(tacoBarResult?.hotItems || []), ...allDrinks.filter(d => d.tempType === 'hot')],
    coldItems: [...(salsaRow ? [salsaRow] : []), ...(birdBoxResult?.coldItems || []), ...(tacoBarResult?.coldItems || []), ...allDrinks.filter(d => d.tempType === 'cold')],
    dryItems:  [...(chipsRow ? [chipsRow] : []), ...(birdBoxResult?.dryItems || []), ...(tacoBarResult?.dryItems || [])],
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

module.exports = { calculatePersonalBox };