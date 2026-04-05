// src/repositories/IngredientFormulaRepository.js
const IngredientFormulaMapper = require('../mappers/IngredientFormulaMapper');

class IngredientFormulaRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(filters = {}) {
    const conditions = ['1=1'];
    const params     = [];

    if (filters.category) {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }
    if (filters.eventType) {
      params.push(filters.eventType);
      conditions.push(`$${params.length} = ANY(event_types)`);
    }
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE ${conditions.join(' AND ')}
      ORDER BY category ASC, name ASC
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

  async findByEventType(eventType) {
    const result = await this.pool.query(`
      SELECT * FROM ingredient_formulas
      WHERE $1 = ANY(event_types) AND is_active = true
      ORDER BY category ASC, name ASC
    `, [eventType]);
    return result.rows.map(row => IngredientFormulaMapper.toDomain(row));
  }

  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO ingredient_formulas
        (name, category, amount_per_person, unit, utensil,
         small_package, small_package_max, large_package, large_package_max,
         temp_type, event_types, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      data.name, data.category, data.amountPerPerson, data.unit, data.utensil,
      data.smallPackage, data.smallPackageMax, data.largePackage, data.largePackageMax,
      data.tempType, data.eventTypes || [], data.isActive ?? true
    ]);
    return IngredientFormulaMapper.toDomain(result.rows[0]);
  }

  async update(id, data) {
    const result = await this.pool.query(`
      UPDATE ingredient_formulas SET
        name              = $1,
        category          = $2,
        amount_per_person = $3,
        unit              = $4,
        utensil           = $5,
        small_package     = $6,
        small_package_max = $7,
        large_package     = $8,
        large_package_max = $9,
        temp_type         = $10,
        event_types       = $11,
        is_active         = $12,
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      data.name, data.category, data.amountPerPerson, data.unit, data.utensil,
      data.smallPackage, data.smallPackageMax, data.largePackage, data.largePackageMax,
      data.tempType, data.eventTypes || [], data.isActive ?? true, id
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
}

module.exports = IngredientFormulaRepository;