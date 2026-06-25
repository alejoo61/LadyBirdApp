// src/services/fulfillment/shared/DrinksResolver.js

const DRINK_KEYWORDS = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'milk', 'water',
                        'half & half', 'fresca', 'juice', 'tea', 'soda', 'horchata'];

function isDrink(nameLc) {
  return DRINK_KEYWORDS.some(k => nameLc.includes(k));
}

function parseDrink(item, modifiers, qty) {
  const nameLc    = (item.displayName || item.name || '').toLowerCase();
  const isHot     = nameLc.includes('coffee') || nameLc.includes('tea') || nameLc.includes('hot');
  const tempType  = isHot ? 'hot' : 'cold';

  const wantsCups = modifiers.some(m => {
    const n = (m.displayName || '').toLowerCase();
    return n.includes('yes, i want cups') || n.includes('cups and lids') || 
           n.includes('cups & lids') || n.includes('cups and lids included');
  });

  if (nameLc.includes('coffee')) {
    // Separar creamers de condimentos (sweeteners no son creamers)
    const CREAMER_KEYWORDS   = ['milk', 'oat', 'cream', 'whole', 'skim', 'half', 'breve', 'almond', 'soy'];
    const CONDIMENT_KEYWORDS = ['sugar', 'stevia', 'sweetener', 'honey', 'splenda', 'equal', 'packet'];
    const creamers = modifiers
      .filter(m => {
        const n = (m.displayName || '').toLowerCase();
        // Skip condimentos (sweeteners)
        if (CONDIMENT_KEYWORDS.some(k => n.includes(k))) return false;
        // Skip cups/lids modifiers
        if (n.includes('cup') || n.includes('lid')) return false;
        return CREAMER_KEYWORDS.some(k => n.includes(k));
      })
      .map(m => {
        const totalOz = (m.quantity || qty) * 32;
        return {
          name:     m.displayName,
          totalOz,
          packaging: totalOz > 32 ? '½ Gallon Jug' : '32 oz deli cup',
          tempType:  'cold',
        };
      });

    const condiments = modifiers
      .filter(m => CONDIMENT_KEYWORDS.some(k => (m.displayName || '').toLowerCase().includes(k)))
      .map(m => m.displayName);

    return {
      name: item.displayName || item.name, quantity: qty,
      totalOz: qty * 96, packaging: '96 oz coffee', packagingQty: qty,
      utensil: '—', tempType: 'hot', wantsCups, cupSize: '8 oz hot cups/lids', creamers, condiments,
    };
  }

  const subDrinkKeywords = ['limeade', 'agua', 'fresca', 'horchata', 'juice', 'watermelon', 'lavender'];
  const subDrinks = modifiers
    .filter(m => subDrinkKeywords.some(k => (m.displayName || '').toLowerCase().includes(k)))
    .map(m => m.displayName);

  let packaging    = null;
  let packagingQty = qty;
  if (nameLc.includes('1/2 gal') || nameLc.includes('half gal')) packaging = '½ Gal jug';
  else if (nameLc.includes('1 gal') || nameLc.includes('gallon')) packaging = '1 Gal jug';
  else if (nameLc.includes('96 oz')) packaging = '96 oz container';

  return {
    name: item.displayName || item.name, quantity: qty,
    tempType, wantsCups, cupSize: '16 oz cold cups/lids',
    subDrinks, packaging, packagingQty, creamers: [],
  };
}

function resolveDrinks(items) {
  const drinks = [];
  for (const item of items) {
    const nameLc    = (item.displayName || item.name || '').toLowerCase();
    const modifiers = item.modifiers || [];
    const qty       = item.quantity || 1;
    if (isDrink(nameLc)) drinks.push(parseDrink(item, modifiers, qty));
  }
  return drinks;
}

module.exports = { isDrink, parseDrink, resolveDrinks, DRINK_KEYWORDS };