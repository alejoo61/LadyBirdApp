// src/services/IngredientResolverService.js

class IngredientResolverService {
  constructor(pool) {
    this.pool = pool;
  }

  // ─── DETECCIÓN DE ITEMS IGNORABLES ────────────────────────────────────────

  isIgnoredItem(displayName) {
    if (!displayName) return true;
    const ignoredPatterns = [
      /^no[,!.\s]/i,
      /^nope/i,
      /do not want/i,
      /i do not/i,
      /^please\s/i,
      /open tax/i,
      /ez.?cater/i,
      /^small without/i,
      /^large without/i,
      /city slicker salad/i,
      /cowboy salad/i,
      /cups and lids/i,
    ];
    return ignoredPatterns.some(p => p.test(displayName.trim()));
  }

  isPaperYes(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return (
      (n.includes('yes') && n.includes('paper')) ||
      (n.includes('yes') && n.includes('taco boat'))
    );
  }

  isPaperNo(displayName) {
    if (!displayName) return false;
    const n = displayName.toLowerCase();
    return (
      (n.includes('no') && n.includes('paper')) ||
      n.includes('do not want paper') ||
      n.includes('opted out')
    );
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
    return (
      n.includes('coffee') ||
      n.includes('agua') ||
      n.includes('limeade') ||
      n.includes('milk') ||
      n.includes('water') ||
      n.includes('beverage') ||
      n.includes('drink') ||
      n.includes('juice')
    );
  }

  // ─── NORMALIZACIÓN DE NOMBRES ─────────────────────────────────────────────

  normalizeDisplayName(displayName) {
    return displayName
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s*\*\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── RESOLUCIÓN CANONICAL NAME ────────────────────────────────────────────

  async resolveCanonicalName(displayName) {
    if (!displayName) return null;

    const aliasResult = await this.pool.query(
      `SELECT canonical_name FROM ingredient_aliases WHERE LOWER(alias) = LOWER($1)`,
      [displayName.trim()]
    );
    if (aliasResult.rows.length > 0) {
      return aliasResult.rows[0].canonical_name;
    }

    const normalized = this.normalizeDisplayName(displayName);
    if (!normalized) return null;

    const formulaResult = await this.pool.query(
      `SELECT canonical_name FROM ingredient_formulas
       WHERE LOWER(canonical_name) = LOWER($1) AND is_active = true
       LIMIT 1`,
      [normalized]
    );
    if (formulaResult.rows.length > 0) {
      return formulaResult.rows[0].canonical_name;
    }

    return null;
  }

  // ─── OBTENER FÓRMULA ──────────────────────────────────────────────────────

  async getFormula(canonicalName, eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas
       WHERE LOWER(canonical_name) = LOWER($1)
         AND event_type = $2
         AND is_active = true
       LIMIT 1`,
      [canonicalName, eventType]
    );
    return result.rows[0] || null;
  }

  async getPaperFormulas(eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas
       WHERE category = 'paper'
         AND event_type = $1
         AND is_active = true
       ORDER BY name`,
      [eventType]
    );
    return result.rows;
  }

  async getFormulasByCategory(category, eventType) {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_formulas
       WHERE category = $1
         AND event_type = $2
         AND is_active = true
       ORDER BY name`,
      [category, eventType]
    );
    return result.rows;
  }

  // ─── RESOLUCIÓN COMPLETA DE UNA ORDEN ─────────────────────────────────────

  async resolveOrderIngredients(parsedData, eventType) {
    if (!parsedData?.items) return { ingredients: [], wantsPaper: false, wantsChips: false };

    const displayNames = new Set();
    let wantsPaper     = false;
    let wantsChips     = false;

    for (const item of parsedData.items) {
      const hasModifiers = item.modifiers && item.modifiers.length > 0;

      if (!hasModifiers) {
        // ── Orden manual (modifiers vacío o ausente) ──
        const dn = item.displayName || item.name || '';
        if (!dn) continue;

        if (this.isPaperYes(dn))     { wantsPaper = true;  continue; }
        if (this.isPaperNo(dn))      { wantsPaper = false; continue; }
        if (this.isChipsYes(dn))     { wantsChips = true;  continue; }
        if (this.isIgnoredItem(dn))  continue;
        if (this.isSizeModifier(dn)) continue;
        if (this.isDrink(dn))        continue;

        if (/50\/50/i.test(dn)) {
          displayNames.add('Corn Tortillas');
          displayNames.add('Flour Tortillas');
          continue;
        }

        displayNames.add(dn);

      } else {
        // ── Orden Toast (modifiers con contenido) ──
        for (const mod of item.modifiers) {
          const dn = mod.displayName || '';
          if (!dn) continue;

          if (this.isPaperYes(dn))     { wantsPaper = true;  continue; }
          if (this.isPaperNo(dn))      { wantsPaper = false; continue; }
          if (this.isChipsYes(dn))     { wantsChips = true;  continue; }
          if (this.isIgnoredItem(dn))  continue;
          if (this.isSizeModifier(dn)) continue;

          if (/50\/50/i.test(dn)) {
            displayNames.add('Corn Tortillas');
            displayNames.add('Flour Tortillas');
            continue;
          }

          displayNames.add(dn);
        }
      }
    }

    // Resolver cada displayName a canonical + formula
    const results = [];
    for (const displayName of displayNames) {
      const canonicalName = await this.resolveCanonicalName(displayName);
      if (!canonicalName) continue;

      const formula = await this.getFormula(canonicalName, eventType);
      if (!formula) continue;

      results.push({ canonicalName, formula, displayName });
    }

    return { ingredients: results, wantsPaper, wantsChips };
  }

  // ─── CALCULAR CANTIDADES ──────────────────────────────────────────────────

  calculateAmount(formula, guestCount) {
    return parseFloat((formula.amount_per_person * guestCount).toFixed(2));
  }

  getPackaging(formula, guestCount) {
    const total = this.calculateAmount(formula, guestCount);
    if (!formula.small_package_max) return { package: formula.small_package || formula.unit, qty: 1 };

    if (formula.large_package_max && total > formula.small_package_max) {
      return {
        package: formula.large_package,
        qty:     Math.ceil(total / formula.large_package_max),
      };
    }
    return {
      package: formula.small_package,
      qty:     Math.ceil(total / formula.small_package_max),
    };
  }

  // ─── CALCULAR PAPER GOODS DESDE DB ────────────────────────────────────────

  async calculatePaperGoods(eventType, guestCount) {
    const formulas = await this.getPaperFormulas(eventType);
    if (!formulas.length) return { included: false, items: [] };

    return {
      included: true,
      items: formulas.map(f => ({
        name:    f.canonical_name,
        qty:     Math.ceil(f.amount_per_person * guestCount),
        unit:    f.unit,
        package: f.small_package || 'each',
      })),
    };
  }
}

module.exports = IngredientResolverService;