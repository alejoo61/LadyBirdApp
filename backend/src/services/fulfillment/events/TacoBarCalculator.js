// src/services/fulfillment/events/TacoBarCalculator.js

const { resolveSalads }          = require('../shared/SaladsResolver');
const { resolveIndividualTacos, isIndividualTaco } = require('../shared/IndividualTacosResolver');
const { isDrink, resolveDrinks, DRINK_KEYWORDS } = require('../shared/DrinksResolver');
const { resolveAddons, resolveUnknownItems } = require('../shared/AddonsResolver');
const { buildUtensilContext }              = require('../shared/UtensilContextBuilder');

const TACO_BAR_KEYWORDS = ['build your own taco bar', 'taco bar'];

async function calculateTacoBar(cateringOrder, resolver, pool) {
  const { parsedData }  = cateringOrder;
  const delivery        = parsedData?.delivery || {};
  const items           = parsedData?.items || [];

  // Use item quantity as effective guest count (more reliable than order.guestCount)
  const tacoBarItem = items.find(i =>
    TACO_BAR_KEYWORDS.some(k => (i.displayName || i.name || '').toLowerCase().includes(k))
  );
  const guestCount = tacoBarItem?.quantity || cateringOrder.guestCount;

  const { ingredients, wantsPaper, wantsChips } =
    await resolver.resolveOrderIngredients(parsedData, 'TACO_BAR');

  const calculated = ingredients.map(({ canonicalName, formula }) => ({
    name:         canonicalName,
    category:     formula.category,
    tempType:     formula.temp_type,
    unit:         formula.unit,
    utensil:      formula.utensil,
    totalAmount:  resolver.calculateAmount(formula, guestCount),
    packaging:    resolver.getPackaging(formula, guestCount).package,
    packagingQty: resolver.getPackaging(formula, guestCount).qty,
  }));

  const tortillas        = _calculateTortillas(ingredients, guestCount, resolver);
  const withoutTortillas = calculated.filter(i => !['Flour Tortillas', 'Corn Tortillas'].includes(i.name));
  const grouped          = _groupByCategory(withoutTortillas);

  // Chips always included in Taco Bar — add if not already resolved from ingredients
  if (!(grouped.snack || []).some(s => (s.name || '').toLowerCase() === 'chips')) {
    const chipsFormula = await resolver.getFormula('Chips', 'TACO_BAR');
    if (chipsFormula) {
      const rawAmount    = resolver.calculateAmount(chipsFormula, guestCount);
      const chipPanCount = Math.ceil(rawAmount);
      if (!grouped.snack) grouped.snack = [];
      grouped.snack.unshift({
        name:         'Chips',
        category:     'snack',
        tempType:     chipsFormula.temp_type || 'dry',
        unit:         'Full Pan',
        utensil:      'Tongs Large',
        totalAmount:  chipPanCount,
        packaging:    'Full Pan',
        packagingQty: chipPanCount,
      });
    }
  }
  const individualTacos  = resolveIndividualTacos(items);

  // Standalone addons — skip drinks and individual tacos
  const addons = await resolveAddons(items, resolver, 'TACO_BAR', guestCount, (nameLc, mods) => {
    return isDrink(nameLc) || isIndividualTaco(nameLc, mods);
  });

  // Unknown items — check menu_items table for any item not resolved by formulas
  if (pool) {
    const unknowns = await resolveUnknownItems(items, resolver, addons, pool);
    addons.push(...unknowns);
  }

  const salads       = resolveSalads(items);

  const paperContext = buildUtensilContext({
    proteins:  grouped.protein || [],
    toppings:  grouped.topping || [],
    salsas:    grouped.salsa   || [],
    tortillas,
    snacks:    grouped.snack   || [],
    addons,
    salads,
    wantsPaper,
  });
  const paperGoods = await resolver.calculatePaperGoods('TACO_BAR', guestCount, paperContext);

  // Total chip pans: chips from snack formula + chips from addons (Chips & Guac, etc.)
  const snackChips     = (grouped.snack || []).filter(s => (s.name || '').toLowerCase().includes('chip'));
  const snackChipPans  = snackChips.reduce((sum, s) => sum + (s.packagingQty || Math.ceil(s.totalAmount || 0)), 0);
  const addonChipPans  = addons.reduce((sum, a) => sum + (a.chipPans || 0), 0);
  const totalChipPans  = snackChipPans + addonChipPans;

  const drinks = resolveDrinks(items, guestCount);

  return {
    proteins:  grouped.protein || [],
    toppings:  grouped.topping || [],
    salsas:    grouped.salsa   || [],
    snacks:    grouped.snack   || [],
    tortillas,
    paperGoods,
    salads,
    addons,
    individualTacos,
    totalChipPans,
    drinks,
    hotItems:  [...individualTacos, ...(grouped.protein || []), ...tortillas, ...drinks.filter(d => d.tempType === 'hot')],
    coldItems: [...(grouped.topping || []), ...(grouped.salsa || []), ...salads, ...drinks.filter(d => d.tempType === 'cold')],
    dryItems:  [...(grouped.snack || []), ...addons.filter(a => a.tempType === 'dry')],
    _guestCount: guestCount,
  };
}

function _calculateTortillas(ingredients, guestCount, resolver) {
  const result    = [];
  const flourItem = ingredients.find(i => i.canonicalName === 'Flour Tortillas');
  const cornItem  = ingredients.find(i => i.canonicalName === 'Corn Tortillas');
  const is5050    = flourItem && cornItem;

  if (flourItem) {
    const total     = is5050
      ? Math.round(resolver.calculateAmount(flourItem.formula, guestCount) / 2)
      : resolver.calculateAmount(flourItem.formula, guestCount);
    const packaging = resolver.getPackaging(flourItem.formula, guestCount);
    result.push({
      name: is5050 ? 'Flour Tortillas (50/50)' : 'Flour Tortillas',
      total, unit: flourItem.formula.unit,
      packaging: packaging.package, packagingQty: packaging.qty,
      utensil: flourItem.formula.utensil, tempType: 'hot',
    });
  }
  if (cornItem) {
    const total     = is5050
      ? Math.round(resolver.calculateAmount(cornItem.formula, guestCount) / 2)
      : resolver.calculateAmount(cornItem.formula, guestCount);
    const packaging = resolver.getPackaging(cornItem.formula, guestCount);
    result.push({
      name: is5050 ? 'Corn Tortillas (50/50)' : 'Corn Tortillas',
      total, unit: cornItem.formula.unit,
      packaging: packaging.package, packagingQty: packaging.qty,
      utensil: cornItem.formula.utensil, tempType: 'hot',
    });
  }
  return result;
}

function _groupByCategory(items) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}


module.exports = { calculateTacoBar };