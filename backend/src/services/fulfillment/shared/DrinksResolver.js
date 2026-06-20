// src/services/fulfillment/shared/DrinksResolver.js

const DRINK_KEYWORDS = ['coffee', 'agua', 'limeade', 'drink', 'beverage', 'milk', 'water',
                        'half & half', 'fresca', 'juice', 'tea', 'soda', 'horchata'];

function isDrink(nameLc) {
  return DRINK_KEYWORDS.some(k => nameLc.includes(k));
}

function parseDrink(item, modifiers, qty) {
  const nameLc    = (item.displayName || item.name || '').toLowerCase();
  // Hot drinks: coffee, hot tea, hot drip
  // Cold drinks: hibiscus tea, iced tea, agua fresca, limeade, watermelon, half & half
  const isHot = (nameLc.includes('coffee') || nameLc.includes('hot')) &&
                !nameLc.includes('iced coffee');
  // Hibiscus Tea y otros teas fríos son cold
  // Solo 'hot tea' explícito sería hot
  const tempType  = isHot ? 'hot' : 'cold';

  // Hot drinks → 8 oz hot cups/lids (solo si cliente lo pidió)
  // Cold drinks → 16 oz cold cups/lids/straws (siempre, si el drink lo requiere)
  const cupsModifier = modifiers.some(m => {
    const n = (m.displayName || '').toLowerCase();
    return n.includes('yes, i want cups') || n.includes('cups and lids') || n.includes('cups & lids');
  });
  const noCupsModifier = modifiers.some(m => {
    const n = (m.displayName || '').toLowerCase();
    return n.includes('no') && (n.includes('cup') || n.includes('lid'));
  });
  // Hot: requiere que cliente lo pida. Cold: incluye cups por default a menos que diga no
  const wantsCups = isHot ? cupsModifier : !noCupsModifier;

  if (nameLc.includes('coffee')) {
    const creamers = modifiers
      .filter(m => {
        const n = (m.displayName || '').toLowerCase();
        return n.includes('milk') || n.includes('oat') || n.includes('cream') ||
               n.includes('whole') || n.includes('skim');
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

    return {
      name: item.displayName || item.name, quantity: qty,
      totalOz: qty * 96, packaging: '96 oz coffee', packagingQty: qty,
      utensil: '—', tempType: 'hot', wantsCups, cupSize: '8 oz hot cups/lids', creamers,
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