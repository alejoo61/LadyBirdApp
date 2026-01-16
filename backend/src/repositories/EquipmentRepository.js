const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(filters = {}, includeStore = true) {
    let query = `
      SELECT e.*, 
             s.id as s_id, s.code as s_code, s.name as s_name, s.timezone as s_timezone, s.is_active as s_active
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE 1=1
    `;
    const values = [];
    let count = 1;

    if (filters.storeId) {
      query += ` AND e.store_id = $${count++}`;
      values.push(filters.storeId);
    }
    if (filters.type) {
      query += ` AND e.type = $${count++}`;
      values.push(filters.type);
    }
    if (filters.isDown !== undefined) {
      query += ` AND e.is_down = $${count++}`;
      values.push(filters.isDown);
    }

    query += ' ORDER BY e.name ASC';

    const result = await this.pool.query(query, values);
    
    return result.rows.map(row => {
      // Extraemos los datos de la tienda que vienen en el JOIN (prefijo s_)
      const storeData = row.s_id ? {
        id: row.s_id,
        code: row.s_code,
        name: row.s_name,
        timezone: row.s_timezone,
        is_active: row.s_active
      } : null;
      
      return EquipmentMapper.toDomain(row, storeData);
    });
  }

  async findById(id, includeStore = true) {
    const query = `
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.id = $1
    `;
    const result = await this.pool.query(query, [id]);
    const row = result.rows[0];
    if (!row) return null;

    const storeData = row.s_id ? { id: row.s_id, code: row.s_code, name: row.s_name } : null;
    return EquipmentMapper.toDomain(row, storeData);
  }

  async getTypes() {
    const result = await this.pool.query(
      'SELECT DISTINCT type FROM equipment WHERE type IS NOT NULL ORDER BY type ASC'
    );
    return result.rows.map(r => r.type);
  }

  async create(data) {
    const result = await this.pool.query(
      `INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.seq, data.isDown || false]
    );
    return EquipmentMapper.toDomain(result.rows[0]);
  }

  async update(id, data) {
    const result = await this.pool.query(
      `UPDATE equipment 
       SET store_id = $1, equipment_code = $2, type = $3, name = $4, year_code = $5, is_down = $6
       WHERE id = $7
       RETURNING *`,
      [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.isDown, id]
    );
    return result.rows[0] ? EquipmentMapper.toDomain(result.rows[0]) : null;
  }

  async delete(id) {
    const result = await this.pool.query('DELETE FROM equipment WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Métodos de compatibilidad con tu service anterior
  async findByStoreId(storeId, includeStore) { return this.findAll({ storeId }, includeStore); }
  async findByType(type, includeStore) { return this.findAll({ type }, includeStore); }
  async findDown(includeStore) { return this.findAll({ isDown: true }, includeStore); }
}

module.exports = EquipmentRepository;