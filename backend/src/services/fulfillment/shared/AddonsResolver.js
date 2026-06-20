// src/services/fulfillment/shared/AddonsResolver.js

const CHIPS_ADDONS = ['Chips & Guacamole', 'Chips & Queso', 'Chips & Salsa'];

const FIXED_AMOUNTS = {
  'Chips & Queso':     { amount: 32, unit: 'oz' },
  'Chips & Guacamole': { amount: 32, unit: 'oz' },
  'Chips & Salsa':     { amount: 32, unit: 'oz' },
  'Bunuelos':          { amount: 40, unit: 'each' },
};

// Keywords that identify event-level items — never treat as addons
const SKIP_KEYWORDS = [
  'taco bar', 'bird box', 'space rental', 'ez cater', 'open tax',
  'salad', 'city slicker', 'cowboy', 'farmer',
  'relish minimum',
];

// Modifiers that are only tortilla choices — items with only these are still addons
function hasOnlyTortillaModifiers(modifiers) {
  if (!modifiers || modifiers.length === 0) return true;
  return modifiers.every(m => {
    const mn = (m.displayName || '').toLowerCase();
    return mn.includes('flour') || mn.includes('corn') || mn.includes('50/50') || mn.includes('tortilla');
  });
}

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

    if (modifiers.length > 0 && !hasOnlyTortillaModifiers(modifiers)) continue;
    if (skipFn && skipFn(nameLc, modifiers)) continue;

    const addon = await resolveAddon(item, resolver, eventType, guestCount);
    if (addon) addons.push(addon);
  }

  return addons;
}

// Resolve items that didn't match any known formula — check menu_items as fallback
// This catches quesadillas, seasonal items, or any new menu item automatically
async function resolveUnknownItems(items, resolver, existingAddons, pool) {
  const unknowns = [];

  for (const item of items) {
    const nameLc    = (item.displayName || item.name || '').toLowerCase();
    const modifiers = item.modifiers || [];

    // Skip items with non-tortilla modifiers
    if (!hasOnlyTortillaModifiers(modifiers)) continue;

    // Skip known event-level items
    if (SKIP_KEYWORDS.some(k => nameLc.includes(k))) continue;

    const dn = item.displayName || item.name || '';

    // Skip if already in addons
    const canonicalName = await resolver.resolveCanonicalName(dn);
    const alreadyAdded  = existingAddons.some(a => a.name === (canonicalName || dn));
    if (alreadyAdded) continue;

    // Check menu_items table — if it exists there, it's a known menu item
    const menuResult = await pool.query(
      `SELECT name, category FROM menu_items WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [dn]
    );

    if (menuResult.rows.length > 0) {
      const menuItem = menuResult.rows[0];
      // Skip salads and drinks — handled separately by their own resolvers
      if (['salad', 'drink', 'creamer', 'drink_cups'].includes(menuItem.category)) continue;
      if (SKIP_KEYWORDS.some(k => menuItem.name.toLowerCase().includes(k))) continue;

      unknowns.push({
        name:         menuItem.name,
        quantity:     item.quantity || 1,
        totalAmount:  null,
        unit:         'each',
        packaging:    '—',
        packagingQty: item.quantity || 1,
        tempType:     'hot',
        hasChipsPan:  false,
        chipPans:     0,
      });
    }
  }

  return unknowns;
}

module.exports = { resolveAddon, resolveAddons, resolveUnknownItems, hasOnlyTortillaModifiers, CHIPS_ADDONS, FIXED_AMOUNTS, SKIP_KEYWORDS };