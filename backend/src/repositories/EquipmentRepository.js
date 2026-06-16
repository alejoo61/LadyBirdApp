// src/repositories/EquipmentRepository.js
const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // ── BUSCAR TODOS ──────────────────────────────────────────────────────────
  async findAll(filters = {}) {
    let query = `
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.deleted_at IS NULL
    `;
    const values = [];
    let count = 1;

    if (filters.storeId) { query += ` AND e.store_id = $${count++}`; values.push(filters.storeId); }
    if (filters.type)    { query += ` AND e.type = $${count++}`;     values.push(filters.type); }
    if (filters.isDown !== undefined) { query += ` AND e.is_down = $${count++}`; values.push(filters.isDown); }

    query += ' ORDER BY e.name ASC';
    const result = await this.pool.query(query, values);
    return result.rows.map(row =>
      EquipmentMapper.toDomain(row, row.s_id ? { id: row.s_id, code: row.s_code, name: row.s_name } : null)
    );
  }

  // ── BUSCAR POR ID ─────────────────────────────────────────────────────────
  async findById(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const result = await this.pool.query(`
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `, [cleanId]);
    const row = result.rows[0];
    if (!row) return null;
    return EquipmentMapper.toDomain(row, row.s_id ? { id: row.s_id, code: row.s_code, name: row.s_name } : null);
  }

  // ── BUSCAR POR QR CODE ────────────────────────────────────────────────────
  async findByCode(code) {
    const result = await this.pool.query(`
      SELECT e.*, s.id as s_id, s.code as s_code, s.name as s_name, s.emails as s_emails
      FROM equipment e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE (e.equipment_code = $1 OR e.qr_code_text = $1 OR e.qr_code_text = $2)
        AND e.deleted_at IS NULL
    `, [code, `LADYBIRD-EQ:${code}`]);
    const row = result.rows[0];
    if (!row) return null;
    const eq = EquipmentMapper.toDomain(row, row.s_id ? { id: row.s_id, code: row.s_code, name: row.s_name } : null);
    eq.storeEmails = row.s_emails || '';
    return eq;
  }

  // ── CREAR ─────────────────────────────────────────────────────────────────
  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down, qr_code_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.seq, data.isDown || false, data.qrCodeText]);
    return EquipmentMapper.toDomain(result.rows[0]);
  }

  // ── ACTUALIZAR ────────────────────────────────────────────────────────────
  async update(id, data) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const result = await this.pool.query(`
      UPDATE equipment
      SET store_id = $1, equipment_code = $2, type = $3, name = $4,
          year_code = $5, is_down = $6, seq = $7, qr_code_text = $8
      WHERE id = $9 RETURNING *
    `, [data.storeId, data.equipmentCode, data.type, data.name, data.yearCode, data.isDown, data.seq, data.qrCodeText, cleanId]);
    return result.rows[0] ? EquipmentMapper.toDomain(result.rows[0]) : null;
  }

  // ── ELIMINAR (soft delete) ────────────────────────────────────────────────
  async delete(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const result = await this.pool.query(
      'UPDATE equipment SET deleted_at = NOW() WHERE id = $1', [cleanId]
    );
    return result.rowCount > 0;
  }

  // ── SECUENCIA ─────────────────────────────────────────────────────────────
  async getMaxSequenceInStore(storeId, initials) {
    const result = await this.pool.query(
      `SELECT MAX(seq) as max_seq FROM equipment WHERE store_id = $1 AND equipment_code LIKE $2`,
      [storeId, `%-${initials}-%`]
    );
    return parseInt(result.rows[0].max_seq || 0);
  }

  // ── TRANSFER HISTORY ──────────────────────────────────────────────────────
  async logTransfer(equipmentId, fromStoreId, toStoreId, options = {}) {
    await this.pool.query(`
      INSERT INTO equipment_transfer_history
        (equipment_id, from_store_id, to_store_id, reason, is_temporary, return_date, transferred_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      equipmentId,
      fromStoreId,
      toStoreId,
      options.reason      || 'Store transfer',
      options.isTemporary || false,
      options.returnDate  || null,
      options.transferredBy || null,
    ]);
  }

  async getHistory(equipmentId) {
    const result = await this.pool.query(`
      SELECT
        h.*,
        fs.code as from_code, fs.name as from_name,
        ts.code as to_code,   ts.name as to_name
      FROM equipment_transfer_history h
      LEFT JOIN stores fs ON h.from_store_id = fs.id
      LEFT JOIN stores ts ON h.to_store_id   = ts.id
      WHERE h.equipment_id = $1
      ORDER BY h.transferred_at DESC
    `, [equipmentId]);
    return result.rows.map(r => ({
      id:            r.id,
      fromStore:     r.from_store_id ? { id: r.from_store_id, code: r.from_code, name: r.from_name } : null,
      toStore:       r.to_store_id   ? { id: r.to_store_id,   code: r.to_code,   name: r.to_name   } : null,
      reason:        r.reason,
      isTemporary:   r.is_temporary,
      returnDate:    r.return_date,
      transferredBy: r.transferred_by,
      transferredAt: r.transferred_at,
    }));
  }

  async getTypes() {
    const result = await this.pool.query('SELECT DISTINCT type FROM equipment WHERE deleted_at IS NULL');
    return result.rows.map(r => r.type);
  }

  // ── EQUIPMENT TYPE CATALOG ────────────────────────────────────────────────
  async getEquipmentTypeCatalog() {
    const result = await this.pool.query(
      'SELECT id, name, code FROM equipment_types WHERE is_active = true ORDER BY name ASC'
    );
    return result.rows;
  }
}

module.exports = EquipmentRepository;