/**
 * ToastReportingIngest.js
 * Trae sales + PMIX + fulfillment de Toast y los guarda en las tablas rpt_*.
 *
 * IMPORTANTE: Este servicio es INDEPENDIENTE de ToastSyncService.js.
 * No lo importa, no lo modifica, no comparte estado.
 * ToastSyncService sigue corriendo igual para catering.
 * Este servicio solo lee de Toast y escribe en tablas rpt_*.
 *
 * Usa las mismas API keys que ya existen en .env:
 *   TOAST_API_URL, TOAST_CLIENT_ID, TOAST_CLIENT_SECRET
 *   + TOAST_RESTAURANT_GUID_001..005 por store
 */

const { pool } = require('../../../db');

// Mapping store_id → Toast restaurant GUID (ya están en .env del backend)
const STORE_GUID_MAP = {
  1: process.env.TOAST_RESTAURANT_GUID_001,  // 12 South
  2: process.env.TOAST_RESTAURANT_GUID_002,  // Inglewood
  3: process.env.TOAST_RESTAURANT_GUID_003,  // MTB
  4: process.env.TOAST_RESTAURANT_GUID_004,  // Gulch
};

const TOAST_API_URL = process.env.TOAST_API_URL || 'https://ws-api.toasttab.com';

class ToastReportingIngest {
  constructor() {
    this._tokenCache = {}; // cache de tokens por store para no re-autenticar
  }

  /**
   * @param {string} date - YYYY-MM-DD
   * @returns {{ inserted: number, updated: number }}
   */
  async ingest(date) {
    const stores = await this._getActiveStores();
    let inserted = 0;
    let updated  = 0;

    for (const store of stores) {
      const guid = STORE_GUID_MAP[store.id];
      if (!guid) {
        console.warn(`[ToastReporting] Sin GUID para store ${store.id} (${store.name}), skipping`);
        continue;
      }

      try {
        const token = await this._getToken(store.id);

        // Correr en paralelo los 3 pulls por store
        const [salesResult, pmixResult, fulfillmentResult] = await Promise.allSettled([
          this._ingestSales(store.id, guid, token, date),
          this._ingestPmix(store.id, guid, token, date),
          this._ingestFulfillment(store.id, guid, token, date),
        ]);

        // Contar resultados — los settled permiten que uno falle sin bloquear
        for (const r of [salesResult, pmixResult, fulfillmentResult]) {
          if (r.status === 'fulfilled') {
            inserted += r.value?.inserted || 0;
            updated  += r.value?.updated  || 0;
          } else {
            console.warn(`[ToastReporting] Pull parcial para store ${store.name}:`, r.reason?.message);
          }
        }

      } catch (err) {
        console.error(`[ToastReporting] Error para store ${store.name}:`, err.message);
      }
    }

    return { inserted, updated };
  }

  // ── Sales ──────────────────────────────────────────────────

  async _ingestSales(storeId, guid, token, date) {
    // Toast Orders API — aggregate por día
    const startDate = `${date}T00:00:00.000+0000`;
    const endDate   = `${date}T23:59:59.999+0000`;

    const orders = await this._get(
      `/orders/v2/orders?restaurantGuid=${guid}&startDate=${startDate}&endDate=${endDate}&pageSize=500`,
      token, guid
    );

    if (!orders || !Array.isArray(orders)) return { inserted: 0, updated: 0 };

    // Agregar orders del día
    const row = this._aggregateSales(storeId, date, orders);
    const result = await this._upsertSales(row);
    return { inserted: result === 'inserted' ? 1 : 0, updated: result === 'updated' ? 1 : 0 };
  }

  _aggregateSales(storeId, date, orders) {
    // Filtrar solo orders completadas (no void/cancelled)
    const completed = orders.filter(o =>
      o.voided === false && o.deletedDate === null
    );

    const netSales      = completed.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const orderCount    = completed.length;
    const avgCheck      = orderCount > 0 ? netSales / orderCount : 0;

    // Separar por canal
    const inPerson      = completed.filter(o => !o.source || o.source === 'POS');
    const directOnline  = completed.filter(o => o.source === 'ONLINE');
    const threepd       = completed.filter(o => ['DOORDASH','UBEREATS','GRUBHUB'].includes(o.source));

    const inPersonAvg   = inPerson.length    > 0 ? inPerson.reduce((s, o) => s + o.totalAmount, 0)   / inPerson.length   : null;
    const directOnlineAvg = directOnline.length > 0 ? directOnline.reduce((s, o) => s + o.totalAmount, 0) / directOnline.length : null;
    const threedpdAvg   = threepd.length     > 0 ? threepd.reduce((s, o) => s + o.totalAmount, 0)    / threepd.length    : null;

    return {
      store_id:            storeId,
      date,
      net_sales:           netSales,
      catering_sales:      null, // viene del catering module que ya existe
      forecast:            null, // no disponible en Toast — se puede agregar manualmente
      order_count:         orderCount,
      in_person_avg_check: inPersonAvg,
      direct_online_avg:   directOnlineAvg,
      threepd_online_avg:  threedpdAvg,
      source:              'toast',
    };
  }

  async _upsertSales(row) {
    const existing = await pool.query(
      'SELECT id FROM rpt_daily_sales WHERE store_id = $1 AND date = $2',
      [row.store_id, row.date]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE rpt_daily_sales SET
           net_sales = $1, order_count = $2,
           in_person_avg_check = $3, direct_online_avg = $4, threepd_online_avg = $5,
           updated_at = NOW()
         WHERE store_id = $6 AND date = $7`,
        [row.net_sales, row.order_count, row.in_person_avg_check, row.direct_online_avg, row.threepd_online_avg, row.store_id, row.date]
      );
      return 'updated';
    }

    await pool.query(
      `INSERT INTO rpt_daily_sales
         (store_id, date, net_sales, catering_sales, forecast, order_count,
          in_person_avg_check, direct_online_avg, threepd_online_avg, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.store_id, row.date, row.net_sales, row.catering_sales, row.forecast,
       row.order_count, row.in_person_avg_check, row.direct_online_avg, row.threepd_online_avg, row.source]
    );
    return 'inserted';
  }

  // ── PMIX ───────────────────────────────────────────────────

  async _ingestPmix(storeId, guid, token, date) {
    // Toast Reports API — item selections
    const startDate = `${date}T00:00:00.000+0000`;
    const endDate   = `${date}T23:59:59.999+0000`;

    const selections = await this._get(
      `/orders/v2/ordersBulk?restaurantGuid=${guid}&startDate=${startDate}&endDate=${endDate}`,
      token, guid
    );

    if (!selections) return { inserted: 0, updated: 0 };

    const items = this._aggregatePmix(storeId, date, selections);
    let inserted = 0, updated = 0;

    for (const item of items) {
      const existing = await pool.query(
        'SELECT id FROM rpt_pmix_items WHERE store_id=$1 AND date_start=$2 AND date_end=$3 AND item_name=$4 AND item_category=$5',
        [item.store_id, item.date_start, item.date_end, item.item_name, item.item_category]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE rpt_pmix_items SET count_7d=$1, net_sales_7d=$2, updated_at=NOW()
           WHERE store_id=$3 AND date_start=$4 AND date_end=$5 AND item_name=$6 AND item_category=$7`,
          [item.count_7d, item.net_sales_7d, item.store_id, item.date_start, item.date_end, item.item_name, item.item_category]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO rpt_pmix_items
             (store_id, date_start, date_end, item_name, item_category, count_7d, net_sales_7d, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [item.store_id, item.date_start, item.date_end, item.item_name, item.item_category, item.count_7d, item.net_sales_7d, 'toast']
        );
        inserted++;
      }
    }

    return { inserted, updated };
  }

  _aggregatePmix(storeId, date, orders) {
    const itemMap = {};
    for (const order of (orders || [])) {
      for (const check of (order.checks || [])) {
        for (const selection of (check.selections || [])) {
          const name     = selection.displayName || 'Unknown';
          const category = this._classifyItem(selection);
          const key      = `${name}||${category}`;
          if (!itemMap[key]) itemMap[key] = { name, category, count: 0, sales: 0 };
          itemMap[key].count  += selection.quantity || 1;
          itemMap[key].sales  += selection.price    || 0;
        }
      }
    }

    return Object.values(itemMap).map(item => ({
      store_id:      storeId,
      date_start:    date,
      date_end:      date,
      item_name:     item.name,
      item_category: item.category,
      count_7d:      item.count,
      net_sales_7d:  item.sales,
    }));
  }

  _classifyItem(selection) {
    // Clasificación básica por tipo de item Toast
    if (selection.selectionType === 'MODIFIER') return 'modifier';
    const name = (selection.displayName || '').toLowerCase();
    if (name.includes('coffee') || name.includes('latte') || name.includes('agua')) return 'bev';
    return 'food';
  }

  // ── Fulfillment ────────────────────────────────────────────

  async _ingestFulfillment(storeId, guid, token, date) {
    // Toast no tiene un endpoint específico de ticket times —
    // se calculan desde los orders con timestamps de cada check
    const startDate = `${date}T00:00:00.000+0000`;
    const endDate   = `${date}T23:59:59.999+0000`;

    const orders = await this._get(
      `/orders/v2/orders?restaurantGuid=${guid}&startDate=${startDate}&endDate=${endDate}&pageSize=500`,
      token, guid
    );

    if (!orders || !Array.isArray(orders)) return { inserted: 0, updated: 0 };

    const snapshots = this._aggregateFulfillment(storeId, date, orders);
    let inserted = 0, updated = 0;

    for (const snap of snapshots) {
      const existing = await pool.query(
        'SELECT id FROM rpt_fulfillment_snapshots WHERE store_id=$1 AND date=$2 AND hour_bucket=$3 AND channel=$4',
        [snap.store_id, snap.date, snap.hour_bucket, snap.channel]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE rpt_fulfillment_snapshots SET
             avg_order_time_sec=$1, order_count=$2, items_per_order=$3,
             avg_check=$4, pct_under_8min=$5, pct_8_to_12min=$6, pct_over_12min=$7,
             updated_at=NOW()
           WHERE store_id=$8 AND date=$9 AND hour_bucket=$10 AND channel=$11`,
          [snap.avg_order_time_sec, snap.order_count, snap.items_per_order,
           snap.avg_check, snap.pct_under_8min, snap.pct_8_to_12min, snap.pct_over_12min,
           snap.store_id, snap.date, snap.hour_bucket, snap.channel]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO rpt_fulfillment_snapshots
             (store_id, date, hour_bucket, channel, avg_order_time_sec,
              order_count, items_per_order, avg_check,
              pct_under_8min, pct_8_to_12min, pct_over_12min, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [snap.store_id, snap.date, snap.hour_bucket, snap.channel,
           snap.avg_order_time_sec, snap.order_count, snap.items_per_order, snap.avg_check,
           snap.pct_under_8min, snap.pct_8_to_12min, snap.pct_over_12min, 'toast']
        );
        inserted++;
      }
    }

    return { inserted, updated };
  }

  _aggregateFulfillment(storeId, date, orders) {
    // Agrupar orders por hora y canal
    const buckets = {};

    for (const order of orders) {
      if (order.voided || order.deletedDate) continue;

      const openedAt = new Date(order.openedDate);
      const closedAt = order.closedDate ? new Date(order.closedDate) : null;
      if (!closedAt) continue;

      const durationSec = Math.round((closedAt - openedAt) / 1000);
      if (durationSec < 0 || durationSec > 3600) continue; // sanity check

      const hour    = openedAt.getHours();
      const hourStr = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
      const is3pd   = ['DOORDASH','UBEREATS','GRUBHUB'].includes(order.source);
      const channel = is3pd ? '3pd' : 'no3pd';
      const key     = `${hourStr}||${channel}`;

      if (!buckets[key]) {
        buckets[key] = {
          hour_bucket: hourStr,
          channel,
          durations:   [],
          checks:      [],
          itemCounts:  [],
        };
      }

      const itemCount = (order.checks || []).reduce((sum, c) => sum + (c.selections?.length || 0), 0);
      const checkAmt  = (order.checks || []).reduce((sum, c) => sum + (c.totalAmount || 0), 0);

      buckets[key].durations.push(durationSec);
      buckets[key].checks.push(checkAmt);
      buckets[key].itemCounts.push(itemCount);
    }

    return Object.values(buckets).map(b => {
      const n          = b.durations.length;
      const avgSec     = Math.round(b.durations.reduce((s, d) => s + d, 0) / n);
      const avgCheck   = b.checks.reduce((s, c) => s + c, 0) / n;
      const avgItems   = b.itemCounts.reduce((s, i) => s + i, 0) / n;
      const under8     = b.durations.filter(d => d < 480).length  / n;
      const bet8to12   = b.durations.filter(d => d >= 480 && d < 720).length / n;
      const over12     = b.durations.filter(d => d >= 720).length / n;

      return {
        store_id:          storeId,
        date,
        hour_bucket:       b.hour_bucket,
        channel:           b.channel,
        avg_order_time_sec: avgSec,
        order_count:       n,
        items_per_order:   Math.round(avgItems * 100) / 100,
        avg_check:         Math.round(avgCheck * 100) / 100,
        pct_under_8min:    Math.round(under8   * 10000) / 10000,
        pct_8_to_12min:    Math.round(bet8to12 * 10000) / 10000,
        pct_over_12min:    Math.round(over12   * 10000) / 10000,
      };
    });
  }

  // ── Auth ───────────────────────────────────────────────────

  async _getToken(storeId) {
    // Cache simple — el token de Toast dura 24hs
    if (this._tokenCache[storeId]) return this._tokenCache[storeId];

    const fetch = (await import('node-fetch')).default;
    const res   = await fetch(`${TOAST_API_URL}/authentication/v1/authentication/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        clientId:     process.env.TOAST_CLIENT_ID,
        clientSecret: process.env.TOAST_CLIENT_SECRET,
        userAccessType: 'TOAST_MACHINE_CLIENT',
      }),
    });

    if (!res.ok) throw new Error(`Toast auth failed: ${res.status}`);
    const data  = await res.json();
    const token = data.token?.accessToken;
    if (!token) throw new Error('Toast: no accessToken en respuesta');

    this._tokenCache[storeId] = token;
    return token;
  }

  async _get(path, token, guid) {
    const fetch = (await import('node-fetch')).default;
    const res   = await fetch(`${TOAST_API_URL}${path}`, {
      headers: {
        'Authorization':         `Bearer ${token}`,
        'Toast-Restaurant-External-ID': guid,
        'Content-Type':          'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Toast API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  async _getActiveStores() {
    const res = await pool.query('SELECT id, name, code FROM stores WHERE is_active = true ORDER BY id');
    return res.rows;
  }
}

module.exports = ToastReportingIngest;