class MenuItemRepository {
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
      SELECT * FROM menu_items
      WHERE ${conditions.join(' AND ')}
      ORDER BY category ASC, sort_order ASC, name ASC
    `, params);

    return result.rows;
  }

  async findByEventType(eventType) {
    const result = await this.pool.query(`
      SELECT * FROM menu_items
      WHERE $1 = ANY(event_types) AND is_active = true
      ORDER BY category ASC, sort_order ASC
    `, [eventType]);
    return result.rows;
  }

  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO menu_items (name, category, event_types, description, price, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      data.name, data.category, data.eventTypes || [],
      data.description || null, data.price || 0,
      data.isActive ?? true, data.sortOrder || 0,
    ]);
    return result.rows[0];
  }

  async update(id, data) {
    const result = await this.pool.query(`
      UPDATE menu_items SET
        name        = COALESCE($1, name),
        category    = COALESCE($2, category),
        event_types = COALESCE($3, event_types),
        description = $4,
        price       = COALESCE($5, price),
        is_active   = COALESCE($6, is_active),
        sort_order  = COALESCE($7, sort_order),
        updated_at  = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      data.name, data.category, data.eventTypes,
      data.description ?? null, data.price,
      data.isActive, data.sortOrder, id,
    ]);
    return result.rows[0];
  }

  async delete(id) {
    const result = await this.pool.query(
      'DELETE FROM menu_items WHERE id = $1 RETURNING id', [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = MenuItemRepository;