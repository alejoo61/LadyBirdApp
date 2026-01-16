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
    const result = await this.pool.query(
      `INSERT INTO stores (code, name, timezone, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [storeData.code, storeData.name, storeData.timezone, storeData.isActive ?? true]
    );
    return StoreMapper.toDomain(result.rows[0]);
  }

  async update(id, storeData) {
    const result = await this.pool.query(
      `UPDATE stores 
       SET code = $1, name = $2, timezone = $3, is_active = $4
       WHERE id = $5
       RETURNING *`,
      [storeData.code, storeData.name, storeData.timezone, storeData.isActive, id]
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