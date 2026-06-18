// src/services/fulfillment/shared/SaladsResolver.js

const SALAD_KEYWORDS = ['salad', 'city slicker', 'cowboy', 'farmer'];

const DRESSING_MAP = {
  'City Slicker': 'Cilantro dressing on the side',
  'The Cowboy':   'Cilantro dressing on the side',
  'The Farmer':   'Lime Jalapeño dressing on the side',
};

function resolveSalads(items) {
  const salads = [];

  for (const item of items) {
    const nameLc = (item.displayName || item.name || '').toLowerCase();
    if (!SALAD_KEYWORDS.some(k => nameLc.includes(k))) continue;

    const modifiers    = item.modifiers || [];
    const qty          = item.quantity || 1;
    const isLarge      = nameLc.includes('large');
    const isIndividual = nameLc.includes('individual');

    const proteinMod = modifiers.find(m => {
      const n = (m.displayName || '').toLowerCase();
      return n.includes('brisket') || n.includes('chicken') || n.includes('chorizo') ||
             n.includes('without protein') || n.includes('no protein');
    });

    const servesMatch = nameLc.match(/for\s+(\d+)/i);

    let saladType = 'Salad';
    if (nameLc.includes('city slicker')) saladType = 'City Slicker';
    else if (nameLc.includes('cowboy'))  saladType = 'The Cowboy';
    else if (nameLc.includes('farmer'))  saladType = 'The Farmer';

    salads.push({
      name:      item.displayName || item.name,
      saladType,
      size:      isIndividual ? 'Individual' : isLarge ? 'Large' : 'Small',
      protein:   proteinMod?.displayName || null,
      serves:    isIndividual ? 1 : servesMatch ? parseInt(servesMatch[1]) : null,
      quantity:  qty,
      packaging: isIndividual ? `${qty}x Individual container` : isLarge ? '1 full pan' : '1 half pan',
      utensil:   'Tongs / Spoon',
      tempType:  'cold',
      dressing:  DRESSING_MAP[saladType] || 'Dressing on the side',
    });
  }

  return salads;
}

module.exports = { resolveSalads };