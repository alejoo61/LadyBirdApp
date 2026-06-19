// src/services/IngredientResolverService.js

// ─── UTENSIL RULES ────────────────────────────────────────────────────────
const UTENSIL_RULES = {
  'Chips':            'Tongs Large',
  'Bunuelos':         'Tongs Large',
  'Rajas':            'Tongs Large',
  'House-Smoked Brisket': 'Tongs Large',
  'Adobo Chicken':    'Tongs Large',
  'Bacon':            'Tongs Large',
  'Sliced Avocado':   'Tongs Small',
  'Pickled Onions':   'Tongs Small',
  'Shredded Cheese':  'Tongs Small',
  'Cabbage':          'Tongs Small',
  'Flour Tortillas':  'Tongs Small',
  'Corn Tortillas':   'Tongs Small',
  'Guacamole':        'Spoon Serving',
  'Esquites':         'Spoon Serving',
  'Black Beans':      'Spoon Serving',
  'Pico de Gallo':    'Spoon Serving',
  'Potato':           'Spoon Serving',
  'Refried Beans':    'Spoon Serving',
  'Scrambled Eggs':   'Spoon Serving',
  'Salsa Verde Braised Chicken': 'Spoon Serving',
  'Chorizo':          'Spoon Serving',
  'Cotija':           'Spoon Small',
  'Queso':            'Ladle',
  'Salsa Roja':       'Ladle',
  'Salsa Verde':      'Ladle',
  'Salsa Patrón':     'Ladle',
};

class IngredientResolverService {
  constructor(pool) {
    this.pool = pool;
  }

  isIgnoredItem(displayName) {
    if (!displayName) return true;
    const ignoredPatterns = [
      /^no[,!.\s]/i, /^nope/i, /do not want/i, /i do not/i,
      /^please\s/i, /open tax/i, /ez.?cater/i,
      /^small without/i, /^large without/i,
      /city slicker salad/i, /cowboy salad/i, /cups and lids/i,
    ];
    return ignoredPatterns.some(p => p.test(displayName.trim()));
  }

  isPaperYes(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return (n.includes('yes') && n.includes('paper')) ||
           (n.includes('yes') && n.includes('taco boat'));
  }

  isPaperNo(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return (n.includes('no') && n.includes('paper')) ||
            n.includes('do not want paper') ||
            n.includes('opted out');
  }

  isChipsYes(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return n.includes('yes') && (n.includes('chip') || n.includes('salsa'));
  }

  isSizeModifier(displayName) {
    if (!displayName) return false;
    return /\d+\s*tacos?/i.test(displayName);
  }

  isDrink(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return n.includes('coffee') || n.includes('agua') || n.includes('limeade') ||
           n.includes('milk') || n.includes('water') || n.includes('beverage') ||
           n.includes('drink') || n.includes('juice');
  }

  normalizeDisplayName(displayName) {
    return displayName
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s*\*\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async resolveCanonicalName(displayName) {
    if (!displayName) return null;
    const aliasResult = await this.pool.query(
      `SELECT canonical_name FROM ingredient_aliases WHERE LOWER(alias) = LOWER($1)`,
      [displayName.trim()]
    );
    if (aliasResult.rows.length > 0) return aliasResult.rows[0].canonical_name;

    const normalized = this.normalizeDisplayName(displayName);
    if (!normalized) return null;

    const formulaResult = await this.pool.query(
      `SELECT canonical_name FROM ingredient_formulas
       WHERE LOWER(canonical_name) = LOWER($1) AND is_active = true LIMIT 1`,
      [normalized]
    );
    if (formulaResult.rows.length > 0) return formulaResult.rows[0].canonical_name;
    return null;
  }

  async getFormula(canonicalName, eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas
       WHERE LOWER(canonical_name) = LOWER($1) AND event_type = $2 AND is_active = true LIMIT 1`,
      [canonicalName, eventType]
    );
    return result.rows[0] || null;
  }

  async getPaperFormulas(eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas WHERE category = 'paper' AND event_type = $1 AND is_active = true ORDER BY name`,
      [eventType]
    );
    return result.rows;
  }

  async getFormulasByCategory(category, eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas WHERE category = $1 AND event_type = $2 AND is_active = true ORDER BY name`,
      [category, eventType]
    );
    return result.rows;
  }

  async resolveOrderIngredients(parsedData, eventType) {
    if (!parsedData?.items) return { ingredients: [], wantsPaper: false, wantsChips: false };

    const displayNames = new Set();
    let wantsPaper     = false;
    let wantsChips     = false;

    for (const item of parsedData.items) {
      const hasModifiers = item.modifiers && item.modifiers.length > 0;

      if (!hasModifiers) {
        const dn = item.displayName || item.name || '';
        if (!dn) continue;
        if (this.isPaperYes(dn))     { wantsPaper = true;  continue; }
        if (this.isPaperNo(dn))      { wantsPaper = false; continue; }
        if (this.isChipsYes(dn))     { wantsChips = true;  continue; }
        if (this.isIgnoredItem(dn))  continue;
        if (this.isSizeModifier(dn)) continue;
        if (this.isDrink(dn))        continue;
        if (/50\/50/i.test(dn)) { displayNames.add('Corn Tortillas'); displayNames.add('Flour Tortillas'); continue; }
        displayNames.add(dn);
      } else {
        for (const mod of item.modifiers) {
          const dn = mod.displayName || '';
          if (!dn) continue;
          if (this.isPaperYes(dn))     { wantsPaper = true;  continue; }
          if (this.isPaperNo(dn))      { wantsPaper = false; continue; }
          if (this.isChipsYes(dn))     { wantsChips = true;  continue; }
          if (this.isIgnoredItem(dn))  continue;
          if (this.isSizeModifier(dn)) continue;
          if (/50\/50/i.test(dn)) { displayNames.add('Corn Tortillas'); displayNames.add('Flour Tortillas'); continue; }
          displayNames.add(dn);
        }
      }
    }

    const results = [];
    for (const displayName of displayNames) {
      const canonicalName = await this.resolveCanonicalName(displayName);
      if (!canonicalName) continue;
      const formula = await this.getFormula(canonicalName, eventType);
      if (!formula) continue;
      const utensil = formula.utensil || this.getUtensilForItem(canonicalName) || '—';
      results.push({ canonicalName, formula: { ...formula, utensil }, displayName });
    }

    return { ingredients: results, wantsPaper, wantsChips };
  }

  getUtensilForItem(canonicalName) {
    if (!canonicalName) return null;
    if (UTENSIL_RULES[canonicalName]) return UTENSIL_RULES[canonicalName];
    const nameLc = canonicalName.toLowerCase();
    for (const [key, utensil] of Object.entries(UTENSIL_RULES)) {
      if (nameLc.includes(key.toLowerCase())) return utensil;
    }
    return null;
  }

  calculateAmount(formula, guestCount) {
    return parseFloat((formula.amount_per_person * guestCount).toFixed(2));
  }

  getSalsaPackaging(totalOz) {
    if (totalOz > 16) return { package: '32 oz deli cup', qty: Math.ceil(totalOz / 32) };
    if (totalOz > 6)  return { package: '16 oz deli cup', qty: 1 };
    return              { package: '6 oz cup',      qty: Math.ceil(totalOz / 6) };
  }

  getPackaging(formula, guestCount) {
    const total = this.calculateAmount(formula, guestCount);
    if (formula.category === 'salsa') return this.getSalsaPackaging(total);
    if (!formula.small_package_max) return { package: formula.small_package || formula.unit, qty: 1 };
    if (formula.large_package_max && total > formula.small_package_max) {
      return { package: formula.large_package, qty: Math.ceil(total / formula.large_package_max) };
    }
    return { package: formula.small_package, qty: Math.ceil(total / formula.small_package_max) };
  }

  // ─── CALCULAR PAPER GOODS ─────────────────────────────────────────────────
  // wantsPaper = cliente pidió paper goods (Taco Boats, Napkins, Fork Small)
  // Utensilios de servir siempre se incluyen si aplican según la orden

  async calculatePaperGoods(eventType, guestCount, context = {}) {
    const {
      wantsPaper       = false,
      // Pre-computed quantities from UtensilContextBuilder
      tongSmallQty     = 0,
      tongLargeQty     = 0,
      ladleQty         = 0,
      spoonSmallQty    = 0,
      spoonServingCount = 0,
      forkServingQty   = 0,
      saladCount       = 0,
      // For boat doubling
      hasQueso         = false,
      hasGuac          = false,
      hasBunuelos      = false,
      // Fallback legacy fields (when called without UtensilContextBuilder)
      salsaCount       = 0,
      salsaLargeCount  = 0,
      dressingCount    = 0,
      hasTortillaFlour = false,
      hasTortillaCorn  = false,
      hasChips         = false,
      hasRajas         = false,
      hasBrisket       = false,
      hasAdobo         = false,
      hasBacon         = false,
    } = context;

    const items = [];

    // ── Cutlery — only if client requested paper goods ─────────────────────
    if (wantsPaper) {
      const boatBase = guestCount + 5;
      const boatQty  = (hasQueso || hasGuac || hasBunuelos) ? boatBase * 2 : boatBase;
      items.push({ name: 'Taco Boats', qty: boatQty,                       unit: 'each' });
      items.push({ name: 'Napkins',    qty: Math.ceil(guestCount * 2.5),   unit: 'each' });
      items.push({ name: 'Fork Small', qty: guestCount + 5,                unit: 'each' });
    }

    // ── Serving utensils — always, based on what's in the order ───────────

    // Use pre-computed quantities if available, else fall back to legacy fields
    const effectiveSpoonSmall   = spoonSmallQty   || (salsaCount + dressingCount);
    const effectiveForkServing  = forkServingQty  || (saladCount * 2);
    const effectiveTongSmall    = tongSmallQty    || ((hasTortillaFlour ? 1 : 0) + (hasTortillaCorn ? 1 : 0));
    const effectiveTongLarge    = tongLargeQty    || ([hasChips, hasBunuelos, hasRajas, hasBrisket, hasAdobo, hasBacon].filter(Boolean).length);
    const effectiveLadle        = ladleQty        || ((hasQueso ? 1 : 0) + salsaLargeCount);

    if (effectiveSpoonSmall  > 0) items.push({ name: 'Spoon Small',   qty: effectiveSpoonSmall,   unit: 'each' });
    if (effectiveForkServing > 0) items.push({ name: 'Fork Serving',  qty: effectiveForkServing,  unit: 'each' });
    if (spoonServingCount    > 0) items.push({ name: 'Spoon Serving', qty: spoonServingCount,     unit: 'each' });
    if (effectiveTongSmall   > 0) items.push({ name: 'Tong Small',    qty: effectiveTongSmall,    unit: 'each' });
    if (effectiveTongLarge   > 0) items.push({ name: 'Tong Large',    qty: effectiveTongLarge,    unit: 'each' });
    if (effectiveLadle       > 0) items.push({ name: 'Ladle',         qty: effectiveLadle,        unit: 'each' });

    return { included: items.length > 0, wantsPaper, items };
  }
}

module.exports = IngredientResolverService;