// src/services/KitchenFinishTimeService.js

const axios = require('axios');

const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const MAX_GEOCODE_ATTEMPTS = 2;
const ALERT_EMAILS = ['catering@ladybirdtaco.com', 'alejandro@ladybirdtaco.com', 'katia@ladybirdtaco.com'];

class KitchenFinishTimeService {
  constructor(pool, emailService = null) {
    this.pool         = pool;
    this.emailService = emailService; // opcional, para alertas
    this.apiKey       = process.env.GOOGLE_MAPS_API_KEY;
  }

  // ─── ENTRY POINT ──────────────────────────────────────────────────────────
  // Calcula y guarda kitchen_finish_time para una orden
  // Retorna { kitchenFinishTime, driveTimeMinutes, error }
  async calculate(cateringOrder) {
    const {
      id,
      estimatedFulfillmentDate,
      deliveryMethod,
      deliveryAddress,
      geocodeAttempts = 0,
      storeLatitude,
      storeLongitude,
    } = cateringOrder;

    // Solo delivery necesita drive time
    if ((deliveryMethod || '').toUpperCase() !== 'DELIVERY') {
      const kitchenFinishTime = this._applyFormula(estimatedFulfillmentDate, 0);
      await this._saveKitchenFinishTime(id, kitchenFinishTime, 0);
      return { kitchenFinishTime, driveTimeMinutes: 0 };
    }

    // Si ya falló 2 veces no intentar más
    if (geocodeAttempts >= MAX_GEOCODE_ATTEMPTS) {
      return { kitchenFinishTime: null, driveTimeMinutes: null, error: 'max_attempts_reached' };
    }

    // Validaciones
    if (!deliveryAddress) {
      return { kitchenFinishTime: null, driveTimeMinutes: null, error: 'no_delivery_address' };
    }
    if (!storeLatitude || !storeLongitude) {
      return { kitchenFinishTime: null, driveTimeMinutes: null, error: 'no_store_coordinates' };
    }
    if (!this.apiKey) {
      return { kitchenFinishTime: null, driveTimeMinutes: null, error: 'no_api_key' };
    }

    try {
      // Llamar a Distance Matrix API
      const driveTimeMinutes = await this._getDriveTime(
        storeLatitude,
        storeLongitude,
        deliveryAddress,
        estimatedFulfillmentDate,
      );

      // Fórmula: event_time - MAX(drive_time + 15, 30)
      const kitchenFinishTime = this._applyFormula(estimatedFulfillmentDate, driveTimeMinutes);

      // Guardar en DB
      await this._saveKitchenFinishTime(id, kitchenFinishTime, driveTimeMinutes);

      return { kitchenFinishTime, driveTimeMinutes };

    } catch (error) {
      console.error(`[KitchenFinishTime] Error para orden ${id}:`, error.message);

      // Incrementar intentos fallidos
      await this._incrementGeocodeFailed(id, geocodeAttempts + 1);

      // Si llegó al máximo → enviar alerta
      if (geocodeAttempts + 1 >= MAX_GEOCODE_ATTEMPTS) {
        await this._sendAlert(cateringOrder, error.message);
      }

      return { kitchenFinishTime: null, driveTimeMinutes: null, error: error.message };
    }
  }

  // ─── BATCH ────────────────────────────────────────────────────────────────
  // Calcular kitchen_finish_time para todas las órdenes que no lo tienen
  async calculatePending() {
    const result = await this.pool.query(`
      SELECT
        co.id,
        co.estimated_fulfillment_date  AS "estimatedFulfillmentDate",
        co.delivery_method             AS "deliveryMethod",
        co.delivery_address            AS "deliveryAddress",
        co.geocode_attempts            AS "geocodeAttempts",
        co.geocode_failed              AS "geocodeFailed",
        s.latitude                     AS "storeLatitude",
        s.longitude                    AS "storeLongitude",
        co.client_name                 AS "clientName",
        co.display_number              AS "displayNumber"
      FROM catering_orders co
      JOIN stores s ON co.store_id = s.id
      WHERE co.kitchen_finish_time IS NULL
        AND co.geocode_failed = FALSE
        AND co.estimated_fulfillment_date IS NOT NULL
        AND co.status NOT IN ('cancelled')
        AND co.estimated_fulfillment_date > NOW()
      ORDER BY co.estimated_fulfillment_date ASC
    `);

    console.log(`[KitchenFinishTime] ${result.rows.length} órdenes pendientes`);

    const results = [];
    for (const order of result.rows) {
      const res = await this.calculate(order);
      results.push({ orderId: order.id, displayNumber: order.displayNumber, ...res });
    }

    return results;
  }

  // ─── GOOGLE MAPS DISTANCE MATRIX ──────────────────────────────────────────
  async _getDriveTime(originLat, originLng, destinationAddress, arrivalTime) {
    // Usar arrival_time para obtener el drive time estimado al momento del evento
    const arrivalTimestamp = arrivalTime
      ? Math.floor(new Date(arrivalTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const params = {
      origins:        `${originLat},${originLng}`,
      destinations:   destinationAddress,
      mode:           'driving',
      arrival_time:   arrivalTimestamp,
      key:            this.apiKey,
    };

    const response = await axios.get(GOOGLE_MAPS_API_URL, { params });
    const data     = response.data;

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API error: ${data.status}`);
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new Error(`No route found: ${element?.status || 'unknown'}`);
    }

    const driveTimeSeconds = element.duration_in_traffic?.value ?? element.duration?.value;
    if (!driveTimeSeconds) {
      throw new Error('No duration in response');
    }

    return Math.ceil(driveTimeSeconds / 60); // convertir a minutos
  }

  // ─── FÓRMULA ──────────────────────────────────────────────────────────────
  // kitchen_finish_time = event_time - MAX(drive_time + 15, 30)
  _applyFormula(eventTimeISO, driveTimeMinutes) {
    if (!eventTimeISO) return null;
    const eventTime      = new Date(eventTimeISO);
    const bufferMinutes  = Math.max(driveTimeMinutes + 15, 30);
    const kitchenFinish  = new Date(eventTime.getTime() - bufferMinutes * 60 * 1000);
    return kitchenFinish.toISOString();
  }

  // ─── DB ───────────────────────────────────────────────────────────────────
  async _saveKitchenFinishTime(orderId, kitchenFinishTime, driveTimeMinutes) {
    await this.pool.query(`
      UPDATE catering_orders
      SET
        kitchen_finish_time = $1,
        geocode_attempts    = geocode_attempts + 1,
        geocode_failed      = FALSE,
        pdf_needs_update    = TRUE,
        updated_at          = NOW()
      WHERE id = $2
    `, [kitchenFinishTime, orderId]);
  }

  async _incrementGeocodeFailed(orderId, attempts) {
    const failed = attempts >= MAX_GEOCODE_ATTEMPTS;
    await this.pool.query(`
      UPDATE catering_orders
      SET
        geocode_attempts = $1,
        geocode_failed   = $2,
        updated_at       = NOW()
      WHERE id = $3
    `, [attempts, failed, orderId]);
  }

  // ─── ALERT ────────────────────────────────────────────────────────────────
  async _sendAlert(order, errorMessage) {
    if (!this.emailService) {
      console.error(`[KitchenFinishTime] ALERT — No se pudo calcular kitchen finish para orden #${order.displayNumber} (${order.clientName}): ${errorMessage}`);
      return;
    }

    try {
      await this.emailService.send({
        to:      ALERT_EMAILS,
        subject: `⚠️ Kitchen Finish Time failed — Order #${order.displayNumber}`,
        text:    `No se pudo calcular el Kitchen Finish Time para la orden #${order.displayNumber} (${order.clientName || 'Unknown'}).\n\nError: ${errorMessage}\n\nDirección: ${order.deliveryAddress}\n\nPor favor calcular manualmente.`,
      });
    } catch (e) {
      console.error('[KitchenFinishTime] Error enviando alerta:', e.message);
    }
  }
}

module.exports = KitchenFinishTimeService;