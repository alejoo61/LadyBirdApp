const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // BUSCAR TODOS (Solo activos)
  async findAll(filters = {}, includeStore = true) {
    let query = `
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.deleted_at IS NULL 
    `; 

    const values = [];
    let count = 1;

    if (filters.storeId) { query += ` AND e.store_id = $${count++}`; values.push(filters.storeId); }
    if (filters.type) { query += ` AND e.type = $${count++}`; values.push(filters.type); }
    if (filters.isDown !== undefined) { query += ` AND e.is_down = $${count++}`; values.push(filters.isDown); }

    query += ' ORDER BY e.name ASC';
    const result = await this.pool.query(query, values);
    return result.rows.map(row => EquipmentMapper.toDomain(row, row.s_id ? {id: row.s_id, code: row.s_code, name: row.s_name} : null));
  }

  // BUSCAR POR ID (Solo activos)
  async findById(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const query = `
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `;
    const result = await this.pool.query(query, [cleanId]);
    const row = result.rows[0];
    if (!row) return null;
    return EquipmentMapper.toDomain(row, row.s_id ? {id: row.s_id, code: row.s_code, name: row.s_name} : null);
  }

  // ELIMINAR (Soft Delete - Aquí estaba el error)
  async delete(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    
    // CAMBIO CLAVE: UPDATE en lugar de DELETE
    const result = await this.pool.query(
      'UPDATE equipment SET deleted_at = NOW() WHERE id = $1', 
      [cleanId]
    );
    
    return result.rowCount > 0;
  }

  // El resto de métodos (create, update, getMaxSequence, logTransfer) se mantienen igual...
  async create(data) {
    const result = await this.pool.query(
      `INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down, qr_code_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.seq, data.isDown || false, data.qrCodeText]
    );
    return EquipmentMapper.toDomain(result.rows[0]);
  }

  async update(id, data) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const result = await this.pool.query(
      `UPDATE equipment 
       SET store_id = $1, equipment_code = $2, type = $3, name = $4, year_code = $5, is_down = $6, seq = $7, qr_code_text = $8
       WHERE id = $9 RETURNING *`,
      [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.isDown, data.seq, data.qrCodeText, cleanId]
    );
    return result.rows[0] ? EquipmentMapper.toDomain(result.rows[0]) : null;
  }

  async getMaxSequenceInStore(storeId, initials) {
    const result = await this.pool.query(
      `SELECT MAX(seq) as max_seq FROM equipment WHERE store_id = $1 AND equipment_code LIKE $2`,
      [storeId, `%-${initials}-%`]
    );
    return parseInt(result.rows[0].max_seq || 0);
  }

  async logTransfer(equipmentId, fromStoreId, toStoreId) {
    await this.pool.query(
      `INSERT INTO equipment_transfer_history (equipment_id, from_store_id, to_store_id) VALUES ($1, $2, $3)`,
      [equipmentId, fromStoreId, toStoreId]
    );
  }
  
  async getTypes() {
    const result = await this.pool.query('SELECT DISTINCT type FROM equipment WHERE deleted_at IS NULL');
    return result.rows.map(r => r.type);
  }
}

module.exports = EquipmentRepository;