// src/services/KitchenFinishTimeService.js

const axios = require('axios');

const GOOGLE_MAPS_API_URL  = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const MAX_GEOCODE_ATTEMPTS = 2;
const ALERT_EMAILS         = ['catering@ladybirdtaco.com', 'alejandro@ladybirdtaco.com', 'katia@ladybirdtaco.com'];
const METERS_TO_MILES      = 0.000621371;

class KitchenFinishTimeService {
  constructor(pool, emailService = null) {
    this.pool         = pool;
    this.emailService = emailService;
    this.apiKey       = process.env.GOOGLE_MAPS_API_KEY;
  }

  // ─── ENTRY POINT ──────────────────────────────────────────────────────────
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
      await this._saveKitchenFinishTime(id, kitchenFinishTime, 0, null);
      return { kitchenFinishTime, driveTimeMinutes: 0, distanceMiles: null };
    }

    if (geocodeAttempts >= MAX_GEOCODE_ATTEMPTS)
      return { kitchenFinishTime: null, driveTimeMinutes: null, distanceMiles: null, error: 'max_attempts_reached' };

    if (!deliveryAddress)
      return { kitchenFinishTime: null, driveTimeMinutes: null, distanceMiles: null, error: 'no_delivery_address' };

    if (!storeLatitude || !storeLongitude)
      return { kitchenFinishTime: null, driveTimeMinutes: null, distanceMiles: null, error: 'no_store_coordinates' };

    if (!this.apiKey)
      return { kitchenFinishTime: null, driveTimeMinutes: null, distanceMiles: null, error: 'no_api_key' };

    try {
      const { driveTimeMinutes, distanceMiles } = await this._getDriveTime(
        storeLatitude,
        storeLongitude,
        deliveryAddress,
        estimatedFulfillmentDate,
      );

      const kitchenFinishTime = this._applyFormula(estimatedFulfillmentDate, driveTimeMinutes);
      await this._saveKitchenFinishTime(id, kitchenFinishTime, driveTimeMinutes, distanceMiles);

      return { kitchenFinishTime, driveTimeMinutes, distanceMiles };

    } catch (error) {
      console.error(`[KitchenFinishTime] Error para orden ${id}:`, error.message);
      await this._incrementGeocodeFailed(id, geocodeAttempts + 1);
      if (geocodeAttempts + 1 >= MAX_GEOCODE_ATTEMPTS) {
        await this._sendAlert(cateringOrder, error.message);
      }
      return { kitchenFinishTime: null, driveTimeMinutes: null, distanceMiles: null, error: error.message };
    }
  }

  // ─── BATCH ────────────────────────────────────────────────────────────────
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
    const arrivalTimestamp = arrivalTime
      ? Math.floor(new Date(arrivalTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const params = {
      origins:      `${originLat},${originLng}`,
      destinations: destinationAddress,
      mode:         'driving',
      arrival_time: arrivalTimestamp,
      key:          this.apiKey,
    };

    const response = await axios.get(GOOGLE_MAPS_API_URL, { params });
    const data     = response.data;

    if (data.status !== 'OK')
      throw new Error(`Distance Matrix API error: ${data.status}`);

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK')
      throw new Error(`No route found: ${element?.status || 'unknown'}`);

    const driveTimeSeconds = element.duration_in_traffic?.value ?? element.duration?.value;
    if (!driveTimeSeconds)
      throw new Error('No duration in response');

    // Distancia en millas (distance.value viene en metros)
    const distanceMeters = element.distance?.value || null;
    const distanceMiles  = distanceMeters
      ? Math.round(distanceMeters * METERS_TO_MILES * 10) / 10  // 1 decimal
      : null;

    return {
      driveTimeMinutes: Math.ceil(driveTimeSeconds / 60),
      distanceMiles,
    };
  }

  // ─── FÓRMULA ──────────────────────────────────────────────────────────────
  _applyFormula(eventTimeISO, driveTimeMinutes) {
    if (!eventTimeISO) return null;
    const eventTime     = new Date(eventTimeISO);
    const bufferMinutes = Math.max(driveTimeMinutes + 15, 30);
    return new Date(eventTime.getTime() - bufferMinutes * 60 * 1000).toISOString();
  }

  // ─── DB ───────────────────────────────────────────────────────────────────
  async _saveKitchenFinishTime(orderId, kitchenFinishTime, driveTimeMinutes, distanceMiles) {
    await this.pool.query(`
      UPDATE catering_orders
      SET
        kitchen_finish_time      = $1,
        delivery_distance_miles  = $2,
        geocode_attempts         = geocode_attempts + 1,
        geocode_failed           = FALSE,
        pdf_needs_update         = TRUE,
        updated_at               = NOW()
      WHERE id = $3
    `, [kitchenFinishTime, distanceMiles, orderId]);
  }

  async _incrementGeocodeFailed(orderId, attempts) {
    const failed = attempts >= MAX_GEOCODE_ATTEMPTS;
    await this.pool.query(`
      UPDATE catering_orders
      SET geocode_attempts = $1, geocode_failed = $2, updated_at = NOW()
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