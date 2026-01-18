// src/repositories/StoreRepository.js
const StoreMapper = require('../mappers/StoreMapper');

class StoreRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const result = await this.pool.query(
      'SELECT * FROM stores ORDER BY name ASC'
    );
    return result.rows.map(row => StoreMapper.toDomain(row));
  }

  async findById(id) {
    const result = await this.pool.query(
      'SELECT * FROM stores WHERE id = $1',
      [id]
    );
    return result.rows[0] ? StoreMapper.toDomain(result.rows[0]) : null;
  }

  async findByCode(code) {
    const result = await this.pool.query(
      'SELECT * FROM stores WHERE code = $1',
      [code]
    );
    return result.rows[0] ? StoreMapper.toDomain(result.rows[0]) : null;
  }

  async findActive() {
    const result = await this.pool.query(
      'SELECT * FROM stores WHERE is_active = true ORDER BY name ASC'
    );
    return result.rows.map(row => StoreMapper.toDomain(row));
  }

  async create(storeData) {
    // ERROR CORREGIDO: Faltaba el $5 en los VALUES
    const result = await this.pool.query(
      `INSERT INTO stores (code, name, timezone, is_active, emails)
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        storeData.code, 
        storeData.name, 
        storeData.timezone, 
        storeData.isActive ?? true, 
        storeData.emails || ''
      ]
    );
    return StoreMapper.toDomain(result.rows[0]);
  }

  async update(id, storeData) {
    // ERROR CORREGIDO: Tenías "WHERE id = $5" pero el ID es el sexto parámetro ($6)
    // También tenías el $5 repetido.
    const result = await this.pool.query(
      `UPDATE stores 
       SET code = $1, name = $2, timezone = $3, is_active = $4, emails = $5
       WHERE id = $6
       RETURNING *`,
      [
        storeData.code, 
        storeData.name, 
        storeData.timezone, 
        storeData.isActive, 
        storeData.emails, 
        id // Este es el $6
      ]
    );
    return result.rows[0] ? StoreMapper.toDomain(result.rows[0]) : null;
  }

  async delete(id) {
    const result = await this.pool.query(
      'DELETE FROM stores WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = StoreRepository;