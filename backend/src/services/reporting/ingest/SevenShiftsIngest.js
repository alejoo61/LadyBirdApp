/**
 * SevenShiftsIngest.js
 * Trae labor data de 7Shifts y la guarda en rpt_daily_labor.
 *
 * API: https://api.7shifts.com/v2
 * Auth: Bearer token + x-company-guid header
 * Rate limit: 10 req/seg por token
 *
 * Tokens configurados por store en .env:
 *   SEVEN_SHIFTS_TOKEN_001=xxx   (12 South)
 *   SEVEN_SHIFTS_TOKEN_002=xxx   (Inglewood)
 *   SEVEN_SHIFTS_TOKEN_003=xxx   (MTB)
 *   SEVEN_SHIFTS_TOKEN_004=xxx   (Gulch)
 *   SEVEN_SHIFTS_COMPANY_GUID=xxx
 */

const { pool } = require('../../../db');

// Mapping store_id → env var del token de 7Shifts
const STORE_TOKEN_MAP = {
  1: process.env.SEVEN_SHIFTS_TOKEN_001,  // 12 South
  2: process.env.SEVEN_SHIFTS_TOKEN_002,  // Inglewood
  3: process.env.SEVEN_SHIFTS_TOKEN_003,  // MTB
  4: process.env.SEVEN_SHIFTS_TOKEN_004,  // Gulch
};

// Location IDs de 7Shifts por store (se obtienen una vez y se hardcodean)
// Correr GET /v2/locations una vez para obtenerlos
const STORE_LOCATION_MAP = {
  1: process.env.SEVEN_SHIFTS_LOCATION_001,
  2: process.env.SEVEN_SHIFTS_LOCATION_002,
  3: process.env.SEVEN_SHIFTS_LOCATION_003,
  4: process.env.SEVEN_SHIFTS_LOCATION_004,
};

const COMPANY_GUID = process.env.SEVEN_SHIFTS_COMPANY_GUID;
const BASE_URL     = 'https://api.7shifts.com/v2';

class SevenShiftsIngest {
  /**
   * @param {string} date - YYYY-MM-DD
   * @returns {{ inserted: number, updated: number }}
   */
  async ingest(date) {
    const stores = await this._getActiveStores();
    let inserted = 0;
    let updated  = 0;

    for (const store of stores) {
      const token      = STORE_TOKEN_MAP[store.id];
      const locationId = STORE_LOCATION_MAP[store.id];

      if (!token || !locationId) {
        console.warn(`[7Shifts] Sin token o location ID para store ${store.id} (${store.name}), skipping`);
        continue;
      }

      try {
        const laborData = await this._fetchDailySalesAndLabor(token, locationId, date);
        if (!laborData) {
          console.warn(`[7Shifts] Sin datos de labor para ${store.name} en ${date}`);
          continue;
        }

        const hoursData = await this._fetchHoursAndWages(token, locationId, date);
        const row       = this._buildRow(store.id, date, laborData, hoursData);
        const result    = await this._upsert(row);

        if (result === 'inserted') inserted++;
        else updated++;

      } catch (err) {
        console.error(`[7Shifts] Error para store ${store.name}:`, err.message);
        // Continúa con el siguiente store
      }
    }

    return { inserted, updated };
  }

  // ── API calls ──────────────────────────────────────────────

  async _fetchDailySalesAndLabor(token, locationId, date) {
    const url = `${BASE_URL}/reports/daily_sales_and_labor?location_id=${locationId}&date=${date}`;
    const res = await this._get(url, token);
    return res?.data || null;
  }

  async _fetchHoursAndWages(token, locationId, date) {
    // Hours & Wages: from=date, to=date para un solo día
    const url = `${BASE_URL}/reports/hours_and_wages?location_id=${locationId}&from=${date}&to=${date}&punches=true`;
    try {
      const res = await this._get(url, token);
      return res?.data || null;
    } catch (err) {
      // Este endpoint puede timeout con mucho data — no es blocker
      console.warn(`[7Shifts] hours_and_wages timeout para location ${locationId}:`, err.message);
      return null;
    }
  }

  async _get(url, token) {
    const fetch = (await import('node-fetch')).default;
    const res   = await fetch(url, {
      headers: {
        'Authorization':  `Bearer ${token}`,
        'x-company-guid': COMPANY_GUID,
        'Content-Type':   'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`7Shifts API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  // ── Transformación ─────────────────────────────────────────

  _buildRow(storeId, date, laborData, hoursData) {
    // daily_sales_and_labor response fields
    // https://developers.7shifts.com/reference/getdailysalesandlabor
    const d = laborData;
    const h = hoursData;

    return {
      store_id:              storeId,
      date,
      hourly_labor_pct:      d?.labor_percentage         ?? null,
      hourly_labor_cost:     d?.total_labor_cost         ?? null,
      scheduled_cost:        d?.scheduled_labor_cost     ?? null,
      var_vs_scheduled_cost: d?.labor_cost_variance      ?? null,
      splh:                  d?.sales_per_labor_hour     ?? null,
      forecast_labor_pct:    d?.forecasted_labor_percentage ?? null,
      var_vs_forecast_pct:   d?.labor_percentage_variance   ?? null,

      // Hours del hoursData si está disponible
      scheduled_hours:   h?.total_scheduled_hours ?? null,
      actual_hours:      h?.total_worked_hours    ?? null,
      variance_hours:    h ? (h.total_scheduled_hours - h.total_worked_hours) : null,

      // Breakdown por categoría — si 7Shifts los expone por department
      leadership_scheduled: this._getDeptHours(h, 'leadership', 'scheduled'),
      leadership_actual:    this._getDeptHours(h, 'leadership', 'actual'),
      boh_scheduled:        this._getDeptHours(h, 'boh', 'scheduled'),
      boh_actual:           this._getDeptHours(h, 'boh', 'actual'),
      foh_scheduled:        this._getDeptHours(h, 'foh', 'scheduled'),
      foh_actual:           this._getDeptHours(h, 'foh', 'actual'),
      training_scheduled:   this._getDeptHours(h, 'training', 'scheduled'),
      training_actual:      this._getDeptHours(h, 'training', 'actual'),

      source: '7shifts',
    };
  }

  _getDeptHours(hoursData, dept, type) {
    // Los departments en 7Shifts tienen nombres configurables
    // Buscar por nombre que contenga el keyword
    if (!hoursData?.departments) return null;
    const match = hoursData.departments.find(d =>
      d.name?.toLowerCase().includes(dept)
    );
    if (!match) return null;
    return type === 'scheduled' ? match.scheduled_hours : match.worked_hours;
  }

  // ── DB ─────────────────────────────────────────────────────

  async _upsert(row) {
    const existing = await pool.query(
      'SELECT id FROM rpt_daily_labor WHERE store_id = $1 AND date = $2',
      [row.store_id, row.date]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE rpt_daily_labor SET
           hourly_labor_pct      = $1,
           hourly_labor_cost     = $2,
           scheduled_cost        = $3,
           var_vs_scheduled_cost = $4,
           splh                  = $5,
           forecast_labor_pct    = $6,
           var_vs_forecast_pct   = $7,
           scheduled_hours       = $8,
           actual_hours          = $9,
           variance_hours        = $10,
           leadership_scheduled  = $11,
           leadership_actual     = $12,
           boh_scheduled         = $13,
           boh_actual            = $14,
           foh_scheduled         = $15,
           foh_actual            = $16,
           training_scheduled    = $17,
           training_actual       = $18,
           updated_at            = NOW()
         WHERE store_id = $19 AND date = $20`,
        [
          row.hourly_labor_pct, row.hourly_labor_cost, row.scheduled_cost,
          row.var_vs_scheduled_cost, row.splh, row.forecast_labor_pct,
          row.var_vs_forecast_pct, row.scheduled_hours, row.actual_hours,
          row.variance_hours, row.leadership_scheduled, row.leadership_actual,
          row.boh_scheduled, row.boh_actual, row.foh_scheduled, row.foh_actual,
          row.training_scheduled, row.training_actual,
          row.store_id, row.date,
        ]
      );
      return 'updated';
    }

    await pool.query(
      `INSERT INTO rpt_daily_labor (
         store_id, date,
         hourly_labor_pct, hourly_labor_cost, scheduled_cost, var_vs_scheduled_cost,
         splh, forecast_labor_pct, var_vs_forecast_pct,
         scheduled_hours, actual_hours, variance_hours,
         leadership_scheduled, leadership_actual,
         boh_scheduled, boh_actual,
         foh_scheduled, foh_actual,
         training_scheduled, training_actual,
         source
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
       )`,
      [
        row.store_id, row.date,
        row.hourly_labor_pct, row.hourly_labor_cost, row.scheduled_cost,
        row.var_vs_scheduled_cost, row.splh, row.forecast_labor_pct,
        row.var_vs_forecast_pct, row.scheduled_hours, row.actual_hours,
        row.variance_hours, row.leadership_scheduled, row.leadership_actual,
        row.boh_scheduled, row.boh_actual, row.foh_scheduled, row.foh_actual,
        row.training_scheduled, row.training_actual, row.source,
      ]
    );
    return 'inserted';
  }

  async _getActiveStores() {
    const res = await pool.query('SELECT id, name, code FROM stores WHERE is_active = true ORDER BY id');
    return res.rows;
  }
}

module.exports = SevenShiftsIngest;