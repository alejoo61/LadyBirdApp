// src/services/ToastSyncService.js
const OrderClassifier = require('./OrderClassifier');
const OrderParser     = require('./OrderParser');

class ToastSyncService {
  constructor(toastApiClient, pool, fulfillmentCalculator, fulfillmentGenerator, googleCalendarService, auditService) {
    this.toastApiClient         = toastApiClient;
    this.pool                   = pool;
    this.classifier             = new OrderClassifier();
    this.parser                 = new OrderParser();
    this.fulfillmentCalculator  = fulfillmentCalculator;
    this.fulfillmentGenerator   = fulfillmentGenerator;
    this.googleCalendarService  = googleCalendarService;
    this.auditService           = auditService || null; // opcional — no rompe si no se inyecta
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _getActiveStores() {
    const result = await this.pool.query(`
      SELECT id, code, name, timezone, toast_restaurant_guid
      FROM stores
      WHERE is_active = true
        AND toast_restaurant_guid IS NOT NULL
    `);
    return result.rows;
  }

  async _upsertRawOrder(storeId, toastOrderGuid, rawPayload, orderDate) {
    const result = await this.pool.query(`
      INSERT INTO toast_orders
        (store_id, toast_order_guid, raw_payload, order_date, sync_status)
      VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (toast_order_guid)
      DO UPDATE SET
        raw_payload = EXCLUDED.raw_payload,
        order_date  = EXCLUDED.order_date,
        updated_at  = CURRENT_TIMESTAMP
      RETURNING id
    `, [storeId, toastOrderGuid, JSON.stringify(rawPayload), orderDate]);
    return result.rows[0].id;
  }

  async _upsertCateringOrder(storeId, toastOrderId, parsed) {
    const result = await this.pool.query(`
      INSERT INTO catering_orders (
        store_id, toast_order_id, toast_order_guid, display_number,
        event_type, status, payment_status,
        client_name, client_email, client_phone,
        order_date, estimated_fulfillment_date, business_date,
        delivery_method, delivery_address, delivery_notes,
        parsed_data, guest_count, total_amount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (toast_order_guid)
      DO UPDATE SET
        event_type                 = EXCLUDED.event_type,
        payment_status             = EXCLUDED.payment_status,
        status                     = EXCLUDED.status,
        client_name                = EXCLUDED.client_name,
        client_email               = EXCLUDED.client_email,
        client_phone               = EXCLUDED.client_phone,
        estimated_fulfillment_date = EXCLUDED.estimated_fulfillment_date,
        delivery_method            = EXCLUDED.delivery_method,
        delivery_address           = EXCLUDED.delivery_address,
        delivery_notes             = EXCLUDED.delivery_notes,
        parsed_data                = EXCLUDED.parsed_data,
        guest_count                = EXCLUDED.guest_count,
        total_amount               = EXCLUDED.total_amount,
        updated_at                 = CURRENT_TIMESTAMP
      RETURNING id, (xmax = 0) AS is_new
    `, [
      storeId, toastOrderId,
      parsed.toastOrderGuid, parsed.displayNumber,
      parsed.eventType,
      parsed.status,
      parsed.paymentStatus || 'OPEN',
      parsed.client.name, parsed.client.email, parsed.client.phone,
      parsed.orderDate, parsed.estimatedFulfillmentDate, parsed.businessDate,
      parsed.delivery.method, parsed.delivery.address, parsed.delivery.notes,
      JSON.stringify(parsed), parsed.guestCount, parsed.totalAmount
    ]);
    return {
      id:    result.rows[0].id,
      isNew: result.rows[0].is_new,
    };
  }

  async _getExistingGuids(guids) {
    if (!guids.length) return new Set();
    const result = await this.pool.query(`
      SELECT toast_order_guid FROM toast_orders
      WHERE toast_order_guid = ANY($1)
    `, [guids]);
    return new Set(result.rows.map(r => r.toast_order_guid));
  }

  // ─── AUTO PDF + CALENDAR ──────────────────────────────────────────────────

  async _autoPdfAndCalendar(orderId, storeCode, storeName) {
    try {
      const orderResult = await this.pool.query(`
        SELECT co.*, s.name as store_name, s.code as store_code
        FROM catering_orders co
        LEFT JOIN stores s ON s.id = co.store_id
        WHERE co.id = $1
      `, [orderId]);

      if (!orderResult.rows[0]) return;
      const row = orderResult.rows[0];

      const order = {
        id:                       row.id,
        storeId:                  row.store_id,
        storeName:                row.store_name || storeName,
        storeCode:                row.store_code || storeCode,
        toastOrderGuid:           row.toast_order_guid,
        displayNumber:            row.display_number,
        eventType:                row.event_type,
        status:                   row.status,
        paymentStatus:            row.payment_status,
        clientName:               row.client_name,
        clientEmail:              row.client_email,
        clientPhone:              row.client_phone,
        estimatedFulfillmentDate: row.estimated_fulfillment_date,
        kitchenFinishTime:        null,
        deliveryMethod:           row.delivery_method,
        deliveryAddress:          row.delivery_address,
        deliveryNotes:            row.delivery_notes,
        parsedData:               row.parsed_data,
        items:                    row.parsed_data?.items || [],
        guestCount:               row.guest_count,
        totalAmount:              row.total_amount,
        isManuallyEdited:         row.is_manually_edited || false,
        pdfVersion:               row.pdf_version || 1,
        googleEventId:            row.google_event_id,
      };

      // Generar PDF
      const calculatedData = await this.fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = order.isManuallyEdited;
      calculatedData.header.pdfVersion       = order.pdfVersion;

      const pdf     = await this.fulfillmentGenerator.generate(calculatedData);
      const pdfName = this.fulfillmentGenerator.buildFilename(order, order.storeCode);

      console.log(`📄 Auto-generated PDF: ${pdfName}`);

      // Crear o actualizar evento en Calendar
      let calResult;
      if (order.googleEventId) {
        console.log(`📅 Updating existing event: ${order.googleEventId}`);
        calResult = await this.googleCalendarService.updateEvent(
          order, order.googleEventId, pdf, pdfName
        );
      } else {
        console.log(`📅 Creating new calendar event...`);
        calResult = await this.googleCalendarService.createEvent(order, pdf, pdfName);
      }

      // Guardar google_event_id y limpiar flags
      if (calResult?.eventId) {
        await this.pool.query(`
          UPDATE catering_orders
          SET google_event_id       = $1,
              pdf_needs_update      = false,
              calendar_needs_update = false,
              updated_at            = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [calResult.eventId, orderId]);

        console.log(`✅ Calendar synced for order ${order.displayNumber} — event: ${calResult.eventId}`);

        // Audit log de calendar sync
        if (this.auditService) {
          await this.auditService.logCalendarSynced(orderId, 'system', calResult.eventId)
            .catch(e => console.error('⚠️  Audit log error:', e.message));
        }
      }
    } catch (err) {
      console.error(`❌ Auto PDF/Calendar error for order ${orderId}:`, err.message);
    }
  }

  // ─── PROCESS ORDERS ───────────────────────────────────────────────────────

  async _processOrders(orders, storeId, storeCode, storeName) {
    let synced   = 0;
    let catering = 0;

    for (const order of orders) {
      if (!order.guid) continue;
      try {
        const orderDate    = order.estimatedFulfillmentDate || order.openedDate || order.createdDate;
        const toastOrderId = await this._upsertRawOrder(storeId, order.guid, order, orderDate);
        const eventType    = this.classifier.classify(order);

        if (eventType) {
          const parsed = this.parser.parse(order, eventType);
          if (parsed) {
            const { id: cateringOrderId, isNew } = await this._upsertCateringOrder(
              storeId, toastOrderId, parsed
            );
            catering++;

            if (isNew) {
              // Audit log de nueva orden desde Toast
              if (this.auditService) {
                this.auditService.logToastSync(cateringOrderId)
                  .catch(e => console.error('⚠️  Audit log error:', e.message));
              }

              // Auto PDF + Calendar
              if (this.fulfillmentCalculator && this.googleCalendarService) {
                setImmediate(() => this._autoPdfAndCalendar(cateringOrderId, storeCode, storeName));
              }
            }
          }
        }
        synced++;
      } catch (error) {
        console.error(`   ❌ Error processing ${order.guid}:`, error.message);
      }
    }

    return { synced, catering };
  }

  // ─── MODO 1: Polling en producción ────────────────────────────────────────
  async syncRecent(store, minutesBack = 30) {
    const now       = new Date();
    const startDate = new Date(now.getTime() - minutesBack * 60 * 1000);

    const orders = await this.toastApiClient.getOrdersBulk(
      store.toast_restaurant_guid,
      startDate.toISOString(),
      now.toISOString(),
      1
    );

    if (!orders || orders.length === 0) return { store: store.code, synced: 0, catering: 0 };

    const guids     = orders.map(o => o.guid).filter(Boolean);
    const existing  = await this._getExistingGuids(guids);
    const newOrders = orders.filter(o => o.guid && !existing.has(o.guid));

    if (newOrders.length === 0) return { store: store.code, synced: 0, catering: 0 };

    const { synced, catering } = await this._processOrders(newOrders, store.id, store.code, store.name);
    console.log(`   ✅ ${store.code}: ${synced} new — ${catering} catering`);
    return { store: store.code, synced, catering };
  }

  // ─── MODO 2: Sync histórico ───────────────────────────────────────────────
  async syncHistorical(store, daysBack = 7) {
    console.log(`📦 Historical sync ${store.name} — ${daysBack} days...`);

    let totalSynced   = 0;
    let totalCatering = 0;

    for (let i = 0; i < daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const businessDate = date.toISOString().slice(0, 10).replace(/-/g, '');

      let page    = 1;
      let hasMore = true;

      while (hasMore) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const orders = await this.toastApiClient.getOrdersBulk(
          store.toast_restaurant_guid,
          startDate.toISOString(),
          endDate.toISOString(),
          page
        );

        if (!orders || orders.length === 0) { hasMore = false; break; }

        const guids     = orders.map(o => o.guid).filter(Boolean);
        const existing  = await this._getExistingGuids(guids);
        const newOrders = orders.filter(o => o.guid && !existing.has(o.guid));

        if (newOrders.length > 0) {
          const { synced, catering } = await this._processOrders(newOrders, store.id, store.code, store.name);
          totalSynced   += synced;
          totalCatering += catering;
          console.log(`   📅 ${businessDate} p${page}: ${synced} new — ${catering} catering`);
        }

        hasMore = orders.length === 100;
        page++;
        await this._sleep(500);
      }

      await this._sleep(1000);
    }

    console.log(`✅ ${store.code} historical done — ${totalSynced} total — ${totalCatering} catering`);
    return { store: store.code, synced: totalSynced, catering: totalCatering };
  }

  // ─── syncStore ────────────────────────────────────────────────────────────
  async syncStore(store, options = {}) {
    const { daysBack = 3, historical = false, minutesBack = 30 } = options;
    if (historical) return this.syncHistorical(store, daysBack);
    return this.syncRecent(store, minutesBack);
  }

  // ─── syncAll ──────────────────────────────────────────────────────────────
  async syncAll(options = {}) {
    const stores = await this._getActiveStores();
    console.log(`\n🚀 Toast sync — ${stores.length} stores\n`);

    const results = [];
    for (const store of stores) {
      try {
        const result = await this.syncStore(store, options);
        results.push(result);
      } catch (error) {
        console.error(`❌ Error syncing ${store.code}:`, error.message);
        results.push({ store: store.code, synced: 0, catering: 0, error: error.message });
      }
    }

    console.log('\n✅ Sync completo:', results);
    return results;
  }
}

module.exports = ToastSyncService;