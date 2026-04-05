// src/services/ToastSyncService.js
const OrderClassifier = require('./OrderClassifier');
const OrderParser     = require('./OrderParser');

class ToastSyncService {
  constructor(toastApiClient, pool) {
    this.toastApiClient = toastApiClient;
    this.pool           = pool;
    this.classifier     = new OrderClassifier();
    this.parser         = new OrderParser();
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
    await this.pool.query(`
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
  }

  async _getExistingGuids(guids) {
    if (!guids.length) return new Set();
    const result = await this.pool.query(`
      SELECT toast_order_guid FROM toast_orders
      WHERE toast_order_guid = ANY($1)
    `, [guids]);
    return new Set(result.rows.map(r => r.toast_order_guid));
  }

  async _processOrders(orders, storeId) {
    let synced   = 0;
    let catering = 0;

    for (const order of orders) {
      if (!order.guid) continue;
      try {
        const orderDate    = order.estimatedFulfillmentDate || order.openedDate || order.createdDate;
        const toastOrderId = await this._upsertRawOrder(storeId, order.guid, order, orderDate);

        const eventType = this.classifier.classify(order);

        if (eventType) {
          const parsed = this.parser.parse(order, eventType);
          if (parsed) {
            await this._upsertCateringOrder(storeId, toastOrderId, parsed);
            catering++;
          }
        }
        synced++;
      } catch (error) {
        console.error(`   ❌ Error processing ${order.guid}:`, error.message);
      }
    }

    return { synced, catering };
  }

  // ─── MODO 1: Polling en producción (ventana corta, rápido) ─────────────
  async syncRecent(store, minutesBack = 30) {
    const now       = new Date();
    const startDate = new Date(now.getTime() - minutesBack * 60 * 1000);

    const orders = await this.toastApiClient.getOrdersBulk(
      store.toast_restaurant_guid,
      startDate.toISOString(),
      now.toISOString(),
      1
    );

    if (!orders || orders.length === 0) {
      return { store: store.code, synced: 0, catering: 0 };
    }

    const guids     = orders.map(o => o.guid).filter(Boolean);
    const existing  = await this._getExistingGuids(guids);
    const newOrders = orders.filter(o => o.guid && !existing.has(o.guid));

    if (newOrders.length === 0) {
      return { store: store.code, synced: 0, catering: 0 };
    }

    const { synced, catering } = await this._processOrders(newOrders, store.id);
    console.log(`   ✅ ${store.code}: ${synced} new — ${catering} catering`);
    return { store: store.code, synced, catering };
  }

  // ─── MODO 2: Sync histórico (día por día, con delay) ───────────────────
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

        if (!orders || orders.length === 0) {
          hasMore = false;
          break;
        }

        const guids     = orders.map(o => o.guid).filter(Boolean);
        const existing  = await this._getExistingGuids(guids);
        const newOrders = orders.filter(o => o.guid && !existing.has(o.guid));

        if (newOrders.length > 0) {
          const { synced, catering } = await this._processOrders(newOrders, store.id);
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

  // ─── syncStore: delega según el modo ───────────────────────────────────
  async syncStore(store, options = {}) {
    const { daysBack = 3, historical = false, minutesBack = 30 } = options;
    if (historical) return this.syncHistorical(store, daysBack);
    return this.syncRecent(store, minutesBack);
  }

  // ─── syncAll: todos los stores ─────────────────────────────────────────
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