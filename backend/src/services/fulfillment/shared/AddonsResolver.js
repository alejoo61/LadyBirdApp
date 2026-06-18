// src/services/fulfillment/shared/AddonsResolver.js

const CHIPS_ADDONS = ['Chips & Guacamole', 'Chips & Queso', 'Chips & Salsa'];

const FIXED_AMOUNTS = {
  'Chips & Queso':     { amount: 32, unit: 'oz' },
  'Chips & Guacamole': { amount: 32, unit: 'oz' },
  'Chips & Salsa':     { amount: 32, unit: 'oz' },
  'Bunuelos':          { amount: 40, unit: 'each' },
};

async function resolveAddon(item, resolver, eventType, guestCount) {
  const qty           = item.quantity || 1;
  const dn            = item.displayName || item.name || '';
  const canonicalName = await resolver.resolveCanonicalName(dn);
  if (!canonicalName) return null;

  const formula = await resolver.getFormula(canonicalName, eventType)
               || await resolver.getFormula(canonicalName, 'BIRD_BOX')
               || await resolver.getFormula(canonicalName, 'TACO_BAR');
  if (!formula || formula.category !== 'addon') return null;

  const fixed       = FIXED_AMOUNTS[canonicalName];
  const isFixedPack = fixed !== undefined || parseFloat(formula.amount_per_person) === 0;
  const totalAmount = isFixedPack
    ? (fixed?.amount ?? 1) * qty
    : resolver.calculateAmount(formula, guestCount);
  const unit        = isFixedPack ? (fixed?.unit ?? formula.unit) : formula.unit;
  const packaging   = resolver.getPackaging(formula, guestCount);
  const hasChipsPan = isFixedPack && CHIPS_ADDONS.includes(canonicalName);

  return {
    name:         canonicalName,
    quantity:     qty,
    totalAmount,
    unit,
    packaging:    packaging.package,
    packagingQty: isFixedPack ? qty : packaging.qty,
    tempType:     formula.temp_type || 'dry',
    hasChipsPan,
    chipPans:     hasChipsPan ? qty : 0,
  };
}

async function resolveAddons(items, resolver, eventType, guestCount, skipFn = null) {
  const addons = [];

  for (const item of items) {
    const nameLc    = (item.displayName || item.name || '').toLowerCase();
    const modifiers = item.modifiers || [];

    // Skip items with modifiers (they are event-specific items, not standalone addons)
    if (modifiers.length > 0) continue;

    // Allow caller to skip specific items (e.g. individual tacos, drinks)
    if (skipFn && skipFn(nameLc, modifiers)) continue;

    const addon = await resolveAddon(item, resolver, eventType, guestCount);
    if (addon) addons.push(addon);
  }

  return addons;
}

module.exports = { resolveAddon, resolveAddons, CHIPS_ADDONS, FIXED_AMOUNTS };