// src/services/ToastSyncService.js
const OrderClassifier = require('./OrderClassifier');
const OrderParser     = require('./OrderParser');
const crypto          = require('crypto');

class ToastSyncService {
  constructor(toastApiClient, pool, fulfillmentCalculator, fulfillmentGenerator, googleCalendarService, auditService, kitchenFinishTimeService) {
    this.toastApiClient            = toastApiClient;
    this.pool                      = pool;
    this.classifier                = new OrderClassifier();
    this.parser                    = new OrderParser();
    this.fulfillmentCalculator     = fulfillmentCalculator;
    this.fulfillmentGenerator      = fulfillmentGenerator;
    this.googleCalendarService     = googleCalendarService;
    this.auditService              = auditService || null;
    this.kitchenFinishTimeService  = kitchenFinishTimeService || null;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── HASH ─────────────────────────────────────────────────────────────────
  _computeHash(rawOrder) {
    const relevant = {
      paymentStatus: rawOrder.checks?.[0]?.paymentStatus,
      totalAmount:   rawOrder.checks?.[0]?.totalAmount,
      voided:        rawOrder.voided,
      approvalStatus: rawOrder.approvalStatus,
      estimatedFulfillmentDate: rawOrder.estimatedFulfillmentDate,
      deliveryInfo:  rawOrder.deliveryInfo,
      selections:    rawOrder.checks?.[0]?.selections?.map(s => ({
        guid:        s.guid,
        displayName: s.displayName,
        quantity:    s.quantity,
        price:       s.price,
        voided:      s.voided,
        modifiers:   s.modifiers?.map(m => ({
          displayName: m.displayName,
          quantity:    m.quantity,
          price:       m.price,
        })),
      })),
    };
    return crypto.createHash('md5').update(JSON.stringify(relevant)).digest('hex');
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

  // ─── UPSERT RAW ORDER ─────────────────────────────────────────────────────
  async _upsertRawOrder(storeId, toastOrderGuid, rawPayload, orderDate) {
    const newHash = this._computeHash(rawPayload);

    const existing = await this.pool.query(
      `SELECT id, payload_hash FROM toast_orders WHERE toast_order_guid = $1`,
      [toastOrderGuid]
    );

    if (existing.rows.length > 0) {
      const currentHash = existing.rows[0].payload_hash;
      const id          = existing.rows[0].id;

      if (currentHash === newHash) {
        return { id, changed: false };
      }

      await this.pool.query(`
        UPDATE toast_orders SET
          raw_payload  = $1,
          order_date   = $2,
          payload_hash = $3,
          updated_at   = CURRENT_TIMESTAMP
        WHERE toast_order_guid = $4
      `, [JSON.stringify(rawPayload), orderDate, newHash, toastOrderGuid]);

      return { id, changed: true };
    }

    const result = await this.pool.query(`
      INSERT INTO toast_orders
        (store_id, toast_order_guid, raw_payload, order_date, sync_status, payload_hash)
      VALUES ($1, $2, $3, $4, 'pending', $5)
      RETURNING id
    `, [storeId, toastOrderGuid, JSON.stringify(rawPayload), orderDate, newHash]);

    return { id: result.rows[0].id, changed: false };
  }

  async _upsertCateringOrder(storeId, toastOrderId, parsed) {
    const result = await this.pool.query(`
      INSERT INTO catering_orders (
        store_id, toast_order_id, toast_order_guid, display_number,
        event_type, status, payment_status,
        client_name, client_email, client_phone,
        order_date, estimated_fulfillment_date, business_date,
        delivery_method, delivery_address, delivery_notes,
        parsed_data, guest_count, total_amount, is_ez_cater,
        last_synced_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        CURRENT_TIMESTAMP
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
        is_ez_cater                = EXCLUDED.is_ez_cater,
        last_synced_at             = CURRENT_TIMESTAMP,
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
      JSON.stringify(parsed), parsed.guestCount, parsed.totalAmount,
      parsed.isEZCater || false,
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

  // ─── KITCHEN FINISH TIME ──────────────────────────────────────────────────
  async _calculateKitchenFinishTime(cateringOrderId) {
    if (!this.kitchenFinishTimeService) return;
    try {
      const result = await this.pool.query(`
        SELECT
          co.id,
          co.estimated_fulfillment_date  AS "estimatedFulfillmentDate",
          co.delivery_method             AS "deliveryMethod",
          co.delivery_address            AS "deliveryAddress",
          co.geocode_attempts            AS "geocodeAttempts",
          co.geocode_failed              AS "geocodeFailed",
          co.client_name                 AS "clientName",
          co.display_number              AS "displayNumber",
          s.latitude                     AS "storeLatitude",
          s.longitude                    AS "storeLongitude"
        FROM catering_orders co
        JOIN stores s ON co.store_id = s.id
        WHERE co.id = $1
      `, [cateringOrderId]);

      if (!result.rows[0]) return;
      const order = result.rows[0];

      const { kitchenFinishTime, driveTimeMinutes, error } =
        await this.kitchenFinishTimeService.calculate(order);

      if (kitchenFinishTime) {
        console.log(`🍳 Kitchen Finish Time calculado para #${order.displayNumber}: ${new Date(kitchenFinishTime).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })} (drive: ${driveTimeMinutes} min)`);
      } else if (error) {
        console.warn(`⚠️  Kitchen Finish Time no calculado para #${order.displayNumber}: ${error}`);
      }
    } catch (err) {
      console.error(`❌ Error calculando Kitchen Finish Time para orden ${cateringOrderId}:`, err.message);
    }
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
        kitchenFinishTime:        row.kitchen_finish_time || null,
        deliveryMethod:           row.delivery_method,
        deliveryAddress:          row.delivery_address,
        deliveryNotes:            row.delivery_notes,
        parsedData:               row.parsed_data,
        items:                    row.parsed_data?.items || [],
        guestCount:               row.guest_count,
        totalAmount:              row.total_amount,
        isManuallyEdited:         row.is_manually_edited || false,
        isEZCater:                row.is_ez_cater || false,
        pdfVersion:               row.pdf_version || 1,
        googleEventId:            row.google_event_id,
      };

      const calculatedData = await this.fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = order.isManuallyEdited;
      calculatedData.header.isEZCater        = order.isEZCater;
      calculatedData.header.pdfVersion       = order.pdfVersion;

      const pdf     = await this.fulfillmentGenerator.generate(calculatedData);
      const pdfName = this.fulfillmentGenerator.buildFilename(order, order.storeCode);

      console.log(`📄 Auto-generated PDF: ${pdfName}`);

      // Generar labels para Personal Box
      let labelsPdf     = null;
      let labelsPdfName = null;
      if (order.eventType === 'PERSONAL_BOX') {
        try {
          const PersonalBoxLabelsGenerator = require('./generators/PersonalBoxLabelsGenerator');
          const labelsGen  = new PersonalBoxLabelsGenerator();
          const labelsHtml = labelsGen.build(calculatedData);
          labelsPdf        = await this.fulfillmentGenerator.generateFromHtml(labelsHtml);
          labelsPdfName    = this.fulfillmentGenerator.buildFilename(order, order.storeCode, 'labels');
          console.log(`🏷️  Auto-generated Labels: ${labelsPdfName}`);
        } catch (err) {
          console.error('❌ Labels generation error:', err.message);
        }
      }

      let calResult;
      if (order.googleEventId) {
        calResult = await this.googleCalendarService.updateEvent(
          order, order.googleEventId, pdf, pdfName, calculatedData, labelsPdf, labelsPdfName
        );
      } else {
        calResult = await this.googleCalendarService.createEvent(order, pdf, pdfName, calculatedData, labelsPdf, labelsPdfName);
      }

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
    let updated  = 0;

    for (const order of orders) {
      if (!order.guid) continue;
      try {
        const rawDate   = order.estimatedFulfillmentDate || order.openedDate || order.createdDate;
        const orderDate = rawDate ? new Date(rawDate).toISOString() : null;

        const { id: toastOrderId, changed } = await this._upsertRawOrder(
          storeId, order.guid, order, orderDate
        );

        const eventType = this.classifier.classify(order);
        if (!eventType) { synced++; continue; }

        const parsed = this.parser.parse(order, eventType);
        if (!parsed) { synced++; continue; }

        const { id: cateringOrderId, isNew } = await this._upsertCateringOrder(
          storeId, toastOrderId, parsed
        );
        catering++;

        if (isNew) {
          console.log(`🆕 Nueva orden catering: ${parsed.client?.name} (${eventType})`);

          if (this.auditService) {
            this.auditService.logToastSync(cateringOrderId)
              .catch(e => console.error('⚠️  Audit log error:', e.message));
          }

          // Kitchen Finish Time primero (await) → luego PDF para que el PDF lo incluya
          if (this.fulfillmentCalculator && this.googleCalendarService) {
            setImmediate(async () => {
              if (parsed.delivery?.method === 'DELIVERY') {
                await this._calculateKitchenFinishTime(cateringOrderId);
              }
              await this._autoPdfAndCalendar(cateringOrderId, storeCode, storeName);
            });
          }

        } else if (changed) {
          updated++;
          console.log(`🔄 Orden actualizada: ${parsed.client?.name} — payment: ${parsed.paymentStatus}`);

          const manualCheck = await this.pool.query(
            `SELECT is_manually_edited FROM catering_orders WHERE id = $1`,
            [cateringOrderId]
          );
          const isManual = manualCheck.rows[0]?.is_manually_edited || false;

          if (!isManual) {
            // Kitchen Finish Time primero (await) → luego PDF para que el PDF lo incluya
            if (this.fulfillmentCalculator && this.googleCalendarService) {
              setImmediate(async () => {
                if (parsed.delivery?.method === 'DELIVERY') {
                  await this._calculateKitchenFinishTime(cateringOrderId);
                }
                await this._autoPdfAndCalendar(cateringOrderId, storeCode, storeName);
              });
            }
          } else {
            console.log(`⚠️  Orden ${cateringOrderId} editada manualmente — PDF/Calendar no regenerado`);
          }

          if (this.auditService) {
            this.auditService.logToastSync(cateringOrderId)
              .catch(e => console.error('⚠️  Audit log error:', e.message));
          }
        }

        synced++;
      } catch (error) {
        console.error(`   ❌ Error processing ${order.guid}:`, error.message);
      }
    }

    return { synced, catering, updated };
  }

  // ─── MODO 1: Polling reciente (cada 15 min) ───────────────────────────────
  async syncRecent(store, minutesBack = 30) {
    const now       = new Date();
    const startDate = new Date(now.getTime() - minutesBack * 60 * 1000);

    const orders = await this.toastApiClient.getOrdersBulk(
      store.toast_restaurant_guid,
      startDate.toISOString(),
      now.toISOString(),
      1
    );

    if (!orders || orders.length === 0) return { store: store.code, synced: 0, catering: 0, updated: 0 };

    const { synced, catering, updated } = await this._processOrders(
      orders, store.id, store.code, store.name
    );

    if (synced > 0) console.log(`   ✅ ${store.code}: ${synced} procesadas — ${catering} catering — ${updated} actualizadas`);
    return { store: store.code, synced, catering, updated };
  }

  // ─── MODO 2: Sync histórico ───────────────────────────────────────────────
  async syncHistorical(store, daysBack = 7) {
    console.log(`📦 Historical sync ${store.name} — ${daysBack} days...`);

    let totalSynced   = 0;
    let totalCatering = 0;
    let totalUpdated  = 0;

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

        const { synced, catering, updated } = await this._processOrders(
          orders, store.id, store.code, store.name
        );
        totalSynced   += synced;
        totalCatering += catering;
        totalUpdated  += updated;

        if (synced > 0) console.log(`   📅 ${businessDate} p${page}: ${synced} procesadas — ${updated} actualizadas`);

        hasMore = orders.length === 100;
        page++;
        await this._sleep(500);
      }

      await this._sleep(1000);
    }

    console.log(`✅ ${store.code} historical done — ${totalSynced} total — ${totalCatering} catering — ${totalUpdated} actualizadas`);
    return { store: store.code, synced: totalSynced, catering: totalCatering, updated: totalUpdated };
  }

  // ─── MODO 3: Sync de órdenes futuras (diario 2am) ─────────────────────────
  async syncUpcoming() {
    console.log(`\n🔍 Upcoming orders sync — verificando cambios en órdenes futuras...`);

    let totalChecked = 0;
    let totalUpdated = 0;

    const upcomingResult = await this.pool.query(`
      SELECT co.toast_order_guid, co.id, s.toast_restaurant_guid, s.code, s.name, s.id as store_id
      FROM catering_orders co
      JOIN stores s ON s.id = co.store_id
      WHERE co.estimated_fulfillment_date > NOW()
        AND co.status IN ('pending', 'confirmed')
        AND co.toast_order_guid IS NOT NULL
        AND co.toast_order_guid NOT LIKE 'MANUAL-%'
      ORDER BY co.estimated_fulfillment_date ASC
    `);

    if (upcomingResult.rows.length === 0) {
      console.log(`✅ No hay órdenes futuras para verificar`);
      return { checked: 0, updated: 0 };
    }

    console.log(`📋 ${upcomingResult.rows.length} órdenes futuras a verificar`);

    const byStore = upcomingResult.rows.reduce((acc, row) => {
      if (!acc[row.toast_restaurant_guid]) {
        acc[row.toast_restaurant_guid] = {
          storeId:   row.store_id,
          storeCode: row.code,
          storeName: row.name,
          guids:     [],
        };
      }
      acc[row.toast_restaurant_guid].guids.push(row.toast_order_guid);
      return acc;
    }, {});

    for (const [restaurantGuid, storeData] of Object.entries(byStore)) {
      try {
        const start = new Date();
        start.setDate(start.getDate() - 90);
        const end = new Date();
        end.setDate(end.getDate() + 90);

        let page    = 1;
        let hasMore = true;
        let found   = 0;

        while (hasMore) {
          const orders = await this.toastApiClient.getOrdersBulk(
            restaurantGuid,
            start.toISOString(),
            end.toISOString(),
            page
          );

          if (!orders || orders.length === 0) { hasMore = false; break; }

          const relevantOrders = orders.filter(o => storeData.guids.includes(o.guid));

          if (relevantOrders.length > 0) {
            const { updated } = await this._processOrders(
              relevantOrders, storeData.storeId, storeData.storeCode, storeData.storeName
            );
            totalChecked += relevantOrders.length;
            totalUpdated += updated;
            found        += relevantOrders.length;
          }

          hasMore = orders.length === 100 && found < storeData.guids.length;
          page++;
          await this._sleep(300);
        }
      } catch (err) {
        console.error(`❌ Error en syncUpcoming para store ${storeData.storeCode}:`, err.message);
      }

      await this._sleep(500);
    }

    console.log(`✅ Upcoming sync completo — ${totalChecked} verificadas — ${totalUpdated} actualizadas`);
    return { checked: totalChecked, updated: totalUpdated };
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
        results.push({ store: store.code, synced: 0, catering: 0, updated: 0, error: error.message });
      }
    }

    console.log('\n✅ Sync completo:', results);
    return results;
  }
}

module.exports = ToastSyncService;