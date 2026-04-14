// src/repositories/CateringOrderRepository.js
const CateringOrderMapper = require('../mappers/CateringOrderMapper');

class CateringOrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(filters = {}) {
    const conditions = ['1=1'];
    const params     = [];

    if (filters.storeId) {
      params.push(filters.storeId);
      conditions.push(`co.store_id = $${params.length}`);
    }
    if (filters.eventType) {
      params.push(filters.eventType);
      conditions.push(`co.event_type = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`co.status = $${params.length}`);
    }
    if (filters.paymentStatus) {
      params.push(filters.paymentStatus);
      conditions.push(`co.payment_status = $${params.length}`);
    }
    if (filters.deliveryMethod) {
      params.push(filters.deliveryMethod);
      conditions.push(`co.delivery_method = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`co.estimated_fulfillment_date >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`co.estimated_fulfillment_date <= $${params.length}`);
    }

    const result = await this.pool.query(`
      SELECT 
        co.*,
        s.name as store_name,
        s.code as store_code
      FROM catering_orders co
      LEFT JOIN stores s ON s.id = co.store_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE co.payment_status
          WHEN 'OPEN' THEN 1
          WHEN 'PAID' THEN 2
          WHEN 'CLOSED' THEN 2
          ELSE 3
        END ASC,
        co.estimated_fulfillment_date ASC
    `, params);

    return result.rows.map(row => {
      const entity = CateringOrderMapper.toDomain(row);
      entity.storeName = row.store_name;
      entity.storeCode = row.store_code;
      return entity;
    });
  }

  async findById(id) {
    const result = await this.pool.query(`
      SELECT 
        co.*,
        s.name as store_name,
        s.code as store_code
      FROM catering_orders co
      LEFT JOIN stores s ON s.id = co.store_id
      WHERE co.id = $1
    `, [id]);

    if (!result.rows[0]) return null;
    const entity = CateringOrderMapper.toDomain(result.rows[0]);
    entity.storeName = result.rows[0].store_name;
    entity.storeCode = result.rows[0].store_code;
    return entity;
  }

  async create(data) {
    const result = await this.pool.query(`
      INSERT INTO catering_orders (
        store_id, toast_order_guid, display_number, event_type,
        status, payment_status,
        client_name, client_email, client_phone,
        order_date, estimated_fulfillment_date, business_date,
        delivery_method, delivery_address, delivery_notes,
        guest_count, total_amount, parsed_data, is_manually_edited
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (toast_order_guid) DO UPDATE SET
        payment_status             = EXCLUDED.payment_status,
        status                     = EXCLUDED.status,
        estimated_fulfillment_date = EXCLUDED.estimated_fulfillment_date,
        parsed_data                = EXCLUDED.parsed_data,
        updated_at                 = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      data.storeId,
      data.toastOrderGuid || `MANUAL-${Date.now()}`,
      data.displayNumber  || `M-${Date.now()}`,
      data.eventType,
      data.status         || 'pending',
      data.paymentStatus  || 'CLOSED',
      data.clientName,
      data.clientEmail,
      data.clientPhone,
      data.orderDate      || new Date().toISOString(),
      data.estimatedFulfillmentDate,
      data.businessDate   || null,
      data.deliveryMethod || 'PICKUP',
      data.deliveryAddress,
      data.deliveryNotes,
      data.guestCount     || 0,
      data.totalAmount    || 0,
      JSON.stringify(data.parsedData || {}),
      data.isManuallyEdited ?? true,
    ]);
    return CateringOrderMapper.toDomain(result.rows[0]);
  }

  async updateStatus(id, status) {
    const result = await this.pool.query(`
      UPDATE catering_orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    return result.rows[0] ? CateringOrderMapper.toDomain(result.rows[0]) : null;
  }

  async updatePaymentStatus(id, paymentStatus) {
    const result = await this.pool.query(`
      UPDATE catering_orders 
      SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [paymentStatus, id]);
    return result.rows[0] ? CateringOrderMapper.toDomain(result.rows[0]) : null;
  }

  async updateOverride(id, overrideData, overrideNotes) {
    const result = await this.pool.query(`
      UPDATE catering_orders
      SET override_data = $1, override_notes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [JSON.stringify(overrideData), overrideNotes, id]);
    return result.rows[0] ? CateringOrderMapper.toDomain(result.rows[0]) : null;
  }

  // FIX: updateManual — edita todos los campos + marca is_manually_edited
  async updateManual(id, data) {
    const result = await this.pool.query(`
      UPDATE catering_orders SET
        store_id                   = COALESCE($1,  store_id),
        event_type                 = COALESCE($2,  event_type),
        status                     = COALESCE($3,  status),
        payment_status             = COALESCE($4,  payment_status),
        client_name                = COALESCE($5,  client_name),
        client_email               = COALESCE($6,  client_email),
        client_phone               = COALESCE($7,  client_phone),
        estimated_fulfillment_date = COALESCE($8,  estimated_fulfillment_date),
        delivery_method            = COALESCE($9,  delivery_method),
        delivery_address           = $10,
        delivery_notes             = $11,
        guest_count                = COALESCE($12, guest_count),
        total_amount               = COALESCE($13, total_amount),
        override_notes             = $14,
        is_manually_edited         = true,
        updated_at                 = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `, [
      data.storeId,
      data.eventType,
      data.status,
      data.paymentStatus,
      data.clientName,
      data.clientEmail,
      data.clientPhone,
      data.estimatedFulfillmentDate,
      data.deliveryMethod,
      data.deliveryAddress ?? null,
      data.deliveryNotes   ?? null,
      data.guestCount,
      data.totalAmount,
      data.overrideNotes   ?? null,
      id,
    ]);
    return result.rows[0] ? CateringOrderMapper.toDomain(result.rows[0]) : null;
  }
}

module.exports = CateringOrderRepository;