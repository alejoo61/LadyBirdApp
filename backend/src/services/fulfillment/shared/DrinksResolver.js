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
    // Reglas de cantidad (del documento de reglas):
    // - Creamers (milk/half&half/breve): 1 oz per person → ≤32oz = 32oz deli cup, >32oz = ½ Gallon Jug
    // - Sugar/Stevia packets: 0.25 per person
    // - Stirrers: 0.25 per person
    const SWEETENER_KEYWORDS = ['sugar', 'stevia', 'sweetener', 'packet'];
    const STIRRER_KEYWORDS   = ['stirrer', 'stir'];

    const creamers = modifiers
      .filter(m => {
        const n = (m.displayName || '').toLowerCase();
        if (n.includes('cup') || n.includes('lid')) return false;
        if (n.includes('yes') || n.startsWith('no,')) return false;
        if (STIRRER_KEYWORDS.some(k => n.includes(k))) return false;
        return true; // milk, half&half, breve, sweeteners — todo
      })
      .map(m => {
        const n = (m.displayName || '').toLowerCase();
        const isSweetener = SWEETENER_KEYWORDS.some(k => n.includes(k));
        const isStirrer   = STIRRER_KEYWORDS.some(k => n.includes(k));
        if (isSweetener) {
          // 0.25 packets per person
          const packets = Math.ceil(qty * 0.25);
          return { name: m.displayName, totalOz: null, packaging: `${packets} packets`, tempType: 'dry', isSweetener: true };
        }
        // Regular creamer: 1 oz per person
        const totalOz = qty * 1;
        return {
          name:      m.displayName,
          totalOz,
          packaging: totalOz > 32 ? '½ Gallon Jug' : '32 oz deli cup',
          tempType:  'cold',
        };
      });

    // Stirrers: 0.25 per person — agregar automáticamente si hay café
    const stirrerQty = Math.ceil(qty * 0.25);
    const stirrers = [{ name: 'Stirrers', totalOz: null, packaging: `${stirrerQty} each`, tempType: 'dry', isSweetener: false }];

    return {
      name: item.displayName || item.name, quantity: qty,
      totalOz: qty * 96, packaging: '96 oz coffee', packagingQty: qty,
      utensil: '—', tempType: 'hot', wantsCups, cupSize: '8 oz hot cups/lids',
      creamers: [...creamers, ...stirrers],
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