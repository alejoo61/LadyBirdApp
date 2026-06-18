// src/services/fulfillment/shared/IndividualTacosResolver.js

const INDIVIDUAL_TACO_KEYWORDS = ['individual taco', 'individually wrapped'];

function isIndividualTaco(nameLc, modifiers = []) {
  if (INDIVIDUAL_TACO_KEYWORDS.some(k => nameLc.includes(k))) return true;
  if (/^#\d+\s/.test(nameLc)) {
    return modifiers.every(m => {
      const mn = (m.displayName || '').toLowerCase();
      return mn.includes('flour') || mn.includes('corn') || mn.includes('50/50');
    });
  }
  return false;
}

function resolveIndividualTacos(items) {
  const result = [];

  for (const item of items) {
    const nameLc    = (item.displayName || item.name || '').toLowerCase();
    const modifiers = item.modifiers || [];
    if (!isIndividualTaco(nameLc, modifiers)) continue;

    const qty         = item.quantity || 1;
    const tortillaMod = modifiers.find(m => {
      const n = (m.displayName || '').toLowerCase();
      return n.includes('flour') || n.includes('corn') || n.includes('50/50');
    });

    result.push({
      name:      item.displayName || item.name,
      quantity:  qty,
      tortilla:  tortillaMod?.displayName || 'Housemade Flour Tortilla',
      is5050:    (tortillaMod?.displayName || '').toLowerCase().includes('50/50'),
      packaging: `${qty}x Individual Wrap`,
      tempType:  'hot',
    });
  }

  return result;
}

module.exports = { isIndividualTaco, resolveIndividualTacos };