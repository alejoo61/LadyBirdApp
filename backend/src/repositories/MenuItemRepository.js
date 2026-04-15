// src/repositories/MenuItemRepository.js

// Categorías que se muestran en el selector de creación de órdenes
const ORDER_CREATION_CATEGORIES = [
  'protein',
  'topping',
  'salsa',
  'tortilla',
  'snack',
  'size',
  'combo',
  'paper',
  'chips_salsa',
  'drink',
  'creamer',
  'drink_cups',
];

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
      ORDER BY category ASC, sort_order ASC, name ASC
    `, [eventType]);
    return result.rows;
  }

  /**
   * Items filtrados para el modal de creación de órdenes.
   * Solo retorna categorías relevantes + el item base del evento (menu_item con precio > 0).
   */
  async findForOrderCreation(eventType) {
    const result = await this.pool.query(`
      SELECT * FROM menu_items
      WHERE $1 = ANY(event_types)
        AND is_active = true
        AND (
          category = ANY($2::text[])
          OR (category = 'menu_item' AND price > 0)
        )
      ORDER BY
        CASE category
          WHEN 'menu_item'   THEN 1
          WHEN 'size'        THEN 2
          WHEN 'combo'       THEN 3
          WHEN 'protein'     THEN 4
          WHEN 'topping'     THEN 5
          WHEN 'salsa'       THEN 6
          WHEN 'tortilla'    THEN 7
          WHEN 'snack'       THEN 8
          WHEN 'chips_salsa' THEN 9
          WHEN 'paper'       THEN 10
          WHEN 'drink'       THEN 11
          WHEN 'creamer'     THEN 12
          WHEN 'drink_cups'  THEN 13
          ELSE 99
        END,
        sort_order ASC,
        name ASC
    `, [eventType, ORDER_CREATION_CATEGORIES]);
    return result.rows;
  }

  /**
   * Retorna el item base del evento (precio por persona).
   * Ej: "Build Your Own Taco Bar" para TACO_BAR.
   */
  async findBaseItem(eventType) {
    const baseItemNames = {
      TACO_BAR:     'Build Your Own Taco Bar',
      BIRD_BOX:     null, // Bird Box no tiene precio base por persona — usa size
      PERSONAL_BOX: null, // Personal Box usa el precio del box directamente
    };

    const baseName = baseItemNames[eventType];
    if (!baseName) return null;

    const result = await this.pool.query(`
      SELECT * FROM menu_items
      WHERE name = $1 AND is_active = true
      LIMIT 1
    `, [baseName]);

    return result.rows[0] || null;
  }

  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO menu_items (name, category, event_types, description, price, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      data.name,
      data.category,
      data.eventTypes  || [],
      data.description || null,
      data.price       || 0,
      data.isActive    ?? true,
      data.sortOrder   || 0,
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
      data.name,
      data.category,
      data.eventTypes,
      data.description ?? null,
      data.price,
      data.isActive,
      data.sortOrder,
      id,
    ]);
    return result.rows[0];
  }

  async delete(id) {
    const result = await this.pool.query(
      'DELETE FROM menu_items WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = MenuItemRepository;