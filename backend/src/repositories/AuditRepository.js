// src/repositories/AuditRepository.js

class AuditRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ orderId, action, actor, changes, metadata }) {
    const result = await this.pool.query(`
      INSERT INTO audit_logs (order_id, action, actor, changes, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orderId,
      action,
      actor || 'system',
      changes  ? JSON.stringify(changes)  : null,
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return result.rows[0];
  }

  async findByOrderId(orderId) {
    const result = await this.pool.query(`
      SELECT *
      FROM audit_logs
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [orderId]);
    return result.rows;
  }

  async findAll({ limit = 100, offset = 0, actor, action } = {}) {
    const conditions = ['1=1'];
    const params     = [];

    if (actor) {
      params.push(actor);
      conditions.push(`actor = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    params.push(limit);
    params.push(offset);

    const result = await this.pool.query(`
      SELECT
        al.*,
        co.client_name,
        co.display_number
      FROM audit_logs al
      LEFT JOIN catering_orders co ON co.id = al.order_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY al.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    return result.rows;
  }
}

module.exports = AuditRepository;