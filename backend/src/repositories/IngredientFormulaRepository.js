// src/repositories/IngredientFormulaRepository.js
const IngredientFormulaMapper = require('../mappers/IngredientFormulaMapper');

class IngredientFormulaRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // ─── FORMULAS ─────────────────────────────────────────────────────────────

  async findAll(filters = {}) {
    const conditions = ['1=1'];
    const params     = [];

    if (filters.category) {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }
    if (filters.eventType) {
      params.push(filters.eventType);
      // Soporta tanto la columna nueva (event_type) como el array legacy (event_types)
      conditions.push(`(event_type = $${params.length} OR $${params.length} = ANY(event_types))`);
    }
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`is_active = $${params.length}`);
    }
    if (filters.canonicalName) {
      params.push(filters.canonicalName);
      conditions.push(`LOWER(canonical_name) = LOWER($${params.length})`);
    }

    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE ${conditions.join(' AND ')}
      ORDER BY category ASC, canonical_name ASC, event_type ASC
    `, params);

    return result.rows.map(row => IngredientFormulaMapper.toDomain(row));
  }

  async findById(id) {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_formulas WHERE id = $1',
      [id]
    );
    return result.rows[0] ? IngredientFormulaMapper.toDomain(result.rows[0]) : null;
  }

  // Busca fórmulas por event_type (columna singular — modelo nuevo)
  async findByEventType(eventType) {
    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE (event_type = $1 OR $1 = ANY(event_types))
        AND is_active = true
      ORDER BY category ASC, canonical_name ASC
    `, [eventType]);
    return result.rows.map(row => IngredientFormulaMapper.toDomain(row));
  }

  // Busca fórmula específica por canonical_name + event_type
  async findByCanonicalNameAndEventType(canonicalName, eventType) {
    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE LOWER(canonical_name) = LOWER($1)
        AND event_type = $2
        AND is_active = true
      LIMIT 1
    `, [canonicalName, eventType]);
    return result.rows[0] ? IngredientFormulaMapper.toDomain(result.rows[0]) : null;
  }

  // Busca todas las fórmulas de una categoría para un event_type
  async findByCategoryAndEventType(category, eventType) {
    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE category = $1
        AND (event_type = $2 OR $2 = ANY(event_types))
        AND is_active = true
      ORDER BY canonical_name ASC
    `, [category, eventType]);
    return result.rows.map(row => IngredientFormulaMapper.toDomain(row));
  }

  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO ingredient_formulas
        (name, canonical_name, category, amount_per_person, unit, utensil,
         small_package, small_package_max, large_package, large_package_max,
         temp_type, event_type, event_types, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      data.name            || data.canonicalName,
      data.canonicalName   || data.name,
      data.category,
      data.amountPerPerson,
      data.unit,
      data.utensil         || null,
      data.smallPackage    || null,
      data.smallPackageMax || null,
      data.largePackage    || null,
      data.largePackageMax || null,
      data.tempType        || null,
      data.eventType       || null,
      data.eventTypes      || [],
      data.isActive        ?? true,
    ]);
    return IngredientFormulaMapper.toDomain(result.rows[0]);
  }

  async update(id, data) {
    const result = await this.pool.query(`
      UPDATE ingredient_formulas SET
        name              = $1,
        canonical_name    = $2,
        category          = $3,
        amount_per_person = $4,
        unit              = $5,
        utensil           = $6,
        small_package     = $7,
        small_package_max = $8,
        large_package     = $9,
        large_package_max = $10,
        temp_type         = $11,
        event_type        = $12,
        event_types       = $13,
        is_active         = $14,
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `, [
      data.name            || data.canonicalName,
      data.canonicalName   || data.name,
      data.category,
      data.amountPerPerson,
      data.unit,
      data.utensil         || null,
      data.smallPackage    || null,
      data.smallPackageMax || null,
      data.largePackage    || null,
      data.largePackageMax || null,
      data.tempType        || null,
      data.eventType       || null,
      data.eventTypes      || [],
      data.isActive        ?? true,
      id,
    ]);
    return result.rows[0] ? IngredientFormulaMapper.toDomain(result.rows[0]) : null;
  }

  async delete(id) {
    const result = await this.pool.query(
      'DELETE FROM ingredient_formulas WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  // ─── ALIASES ──────────────────────────────────────────────────────────────

  async findAllAliases(canonicalName = null) {
    if (canonicalName) {
      const result = await this.pool.query(`
        SELECT * FROM ingredient_aliases
        WHERE LOWER(canonical_name) = LOWER($1)
        ORDER BY alias ASC
      `, [canonicalName]);
      return result.rows.map(r => IngredientFormulaMapper.aliasToDTO(r));
    }
    const result = await this.pool.query(`
      SELECT * FROM ingredient_aliases
      ORDER BY canonical_name ASC, alias ASC
    `);
    return result.rows.map(r => IngredientFormulaMapper.aliasToDTO(r));
  }

  async createAlias(canonicalName, alias) {
    const result = await this.pool.query(`
      INSERT INTO ingredient_aliases (canonical_name, alias)
      VALUES ($1, $2)
      ON CONFLICT (alias) DO UPDATE SET canonical_name = EXCLUDED.canonical_name
      RETURNING *
    `, [canonicalName, alias]);
    return IngredientFormulaMapper.aliasToDTO(result.rows[0]);
  }

  async deleteAlias(id) {
    const result = await this.pool.query(
      'DELETE FROM ingredient_aliases WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  // Retorna todos los canonical_names únicos que tienen fórmulas activas
  async findAllCanonicalNames() {
    const result = await this.pool.query(`
      SELECT DISTINCT canonical_name
      FROM ingredient_formulas
      WHERE canonical_name IS NOT NULL AND is_active = true
      ORDER BY canonical_name ASC
    `);
    return result.rows.map(r => r.canonical_name);
  }
}

module.exports = IngredientFormulaRepository;