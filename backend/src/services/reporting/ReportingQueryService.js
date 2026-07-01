/**
 * ReportingQueryService.js
 * Centraliza toda la lógica de queries para el módulo de Reporting.
 * Las routes solo llaman a este servicio — no tienen SQL directo.
 *
 * Ventaja: si cambia la DB o la lógica de agregación,
 * se cambia acá y todas las routes se actualizan solas.
 */

const { pool } = require('../../db');

class ReportingQueryService {

  // ── Daily Report ────────────────────────────────────────────────────────────

  /**
   * Retorna sales + labor + spend para una store en un día.
   * Usado por: GET /api/reporting/daily
   */
  async getDaily(storeId, date) {
    const [sales, labor, spend] = await Promise.all([
      pool.query('SELECT * FROM rpt_daily_sales WHERE store_id=$1 AND date=$2', [storeId, date]),
      pool.query('SELECT * FROM rpt_daily_labor WHERE store_id=$1 AND date=$2', [storeId, date]),
      pool.query('SELECT * FROM rpt_daily_spend WHERE store_id=$1 AND date=$2', [storeId, date]),
    ]);

    return {
      date,
      store_id: storeId,
      sales:    sales.rows[0]  || null,
      labor:    labor.rows[0]  || null,
      spend:    spend.rows[0]  || null,
    };
  }

  /**
   * Retorna el daily report de TODAS las stores para un día.
   * Útil para el group daily view.
   */
  async getGroupDaily(date) {
    const stores = await this._getActiveStores();
    const rows   = await Promise.all(stores.map(s => this.getDaily(s.id, date)));
    return rows.map((r, i) => ({ ...r, store_name: stores[i].name }));
  }

  // ── Weekly Scorecard ────────────────────────────────────────────────────────

  /**
   * Weekly scorecard por store o group.
   * Usado por: GET /api/reporting/weekly
   * @param {string} dateStart - YYYY-MM-DD
   * @param {string} dateEnd   - YYYY-MM-DD
   * @param {string|null} storeId - UUID, null = todas las stores
   */
  async getWeekly(dateStart, dateEnd, storeId = null) {
    const storeFilter = storeId ? 'AND s.store_id = $3' : '';
    const params      = storeId ? [dateStart, dateEnd, storeId] : [dateStart, dateEnd];

    const [sales, labor, spend] = await Promise.all([
      pool.query(
        `SELECT s.store_id, st.name as store_name,
                SUM(s.net_sales)       as net_sales,
                SUM(s.catering_sales)  as catering_sales,
                SUM(s.order_count)     as order_count,
                AVG(s.in_person_avg_check)  as in_person_avg,
                AVG(s.direct_online_avg)    as direct_online_avg,
                AVG(s.threepd_online_avg)   as threepd_online_avg,
                -- Trailing 4wk avg: promedio de las semanas anteriores si están cargadas
                AVG(s.trailing_4wk_avg)     as trailing_4wk_avg,
                SUM(s.forecast)             as forecast
         FROM rpt_daily_sales s
         JOIN stores st ON st.id = s.store_id
         WHERE s.date BETWEEN $1 AND $2 ${storeFilter}
         GROUP BY s.store_id, st.name
         ORDER BY st.name`,
        params
      ),
      pool.query(
        `SELECT l.store_id,
                AVG(l.hourly_labor_pct)    as labor_pct,
                AVG(l.forecast_labor_pct)  as forecast_labor_pct,
                SUM(l.hourly_labor_cost)   as labor_cost,
                SUM(l.scheduled_hours)     as scheduled_hours,
                SUM(l.actual_hours)        as actual_hours,
                AVG(l.splh)                as splh
         FROM rpt_daily_labor l
         WHERE l.date BETWEEN $1 AND $2 ${storeFilter}
         GROUP BY l.store_id`,
        params
      ),
      pool.query(
        `SELECT sp.store_id,
                SUM(sp.food_total)   as food_total,
                SUM(sp.paper_total)  as paper_total
         FROM rpt_daily_spend sp
         WHERE sp.date BETWEEN $1 AND $2 ${storeFilter}
         GROUP BY sp.store_id`,
        params
      ),
    ]);

    // Merge por store_id
    const result = sales.rows.map(s => {
      const lab      = labor.rows.find(l => l.store_id === s.store_id) || {};
      const sp       = spend.rows.find(p => p.store_id === s.store_id) || {};
      const netSales = parseFloat(s.net_sales) || 0;
      const forecast = parseFloat(s.forecast)  || null;

      return {
        store_id:         s.store_id,
        store_name:       s.store_name,
        net_sales:        netSales,
        catering_sales:   parseFloat(s.catering_sales) || 0,
        forecast,
        var_vs_forecast:      forecast ? netSales - forecast : null,
        var_vs_forecast_pct:  forecast ? (netSales - forecast) / forecast : null,
        trailing_4wk_avg:     parseFloat(s.trailing_4wk_avg) || null,
        order_count:          parseInt(s.order_count) || 0,
        in_person_avg:        parseFloat(s.in_person_avg)    || null,
        direct_online_avg:    parseFloat(s.direct_online_avg) || null,
        threepd_avg:          parseFloat(s.threepd_online_avg) || null,
        labor_pct:            parseFloat(lab.labor_pct)        || null,
        forecast_labor_pct:   parseFloat(lab.forecast_labor_pct) || null,
        labor_cost:           parseFloat(lab.labor_cost)       || null,
        scheduled_hours:      parseFloat(lab.scheduled_hours)  || null,
        actual_hours:         parseFloat(lab.actual_hours)     || null,
        splh:                 parseFloat(lab.splh)             || null,
        food_total:           parseFloat(sp.food_total)        || null,
        food_pct:             netSales && sp.food_total  ? sp.food_total  / netSales : null,
        paper_total:          parseFloat(sp.paper_total)       || null,
        paper_pct:            netSales && sp.paper_total ? sp.paper_total / netSales : null,
      };
    });

    // Group totals
    const group = this._sumStores(result);

    return { date_start: dateStart, date_end: dateEnd, stores: result, group };
  }

  /**
   * Comparación de dos semanas (WoW) para el scorecard.
   */
  async getWeeklyComparison(dateStart1, dateEnd1, dateStart2, dateEnd2) {
    const [week1, week2] = await Promise.all([
      this.getWeekly(dateStart1, dateEnd1),
      this.getWeekly(dateStart2, dateEnd2),
    ]);

    return {
      current:  week1,
      previous: week2,
      wow_change: this._calculateWoW(week1.group, week2.group),
    };
  }

  // ── PMIX ────────────────────────────────────────────────────────────────────

  /**
   * Top N items por store o group en un rango de fechas.
   * @param {string} storeId    - UUID o null para group
   * @param {string} dateStart
   * @param {string} dateEnd
   * @param {string} category   - 'food' | 'bev' | 'modifier' | null = todos
   * @param {number} limit      - default 10
   */
  async getPmix(storeId, dateStart, dateEnd, category = null, limit = 10) {
    const storeFilter    = storeId  ? 'AND store_id = $4'         : '';
    const categoryFilter = category ? `AND item_category = $${storeId ? 5 : 4}` : '';

    const params = [dateStart, dateEnd, limit];
    if (storeId)  params.push(storeId);
    if (category) params.push(category);

    const result = await pool.query(
      `SELECT item_name, item_category,
              SUM(count_7d)              as count_7d,
              SUM(net_sales_7d)          as net_sales_7d,
              SUM(count_trailing_4wk)    as count_trailing_4wk,
              SUM(net_sales_trailing_4wk) as net_sales_trailing_4wk
       FROM rpt_pmix_items
       WHERE date_start >= $1 AND date_end <= $2
       ${storeFilter} ${categoryFilter}
       GROUP BY item_name, item_category
       ORDER BY net_sales_7d DESC
       LIMIT $3`,
      params
    );

    // Calcular % del total por categoría
    const totalSales = result.rows.reduce((sum, r) => sum + parseFloat(r.net_sales_7d || 0), 0);
    const items = result.rows.map(r => ({
      ...r,
      pct_category_7d: totalSales > 0 ? parseFloat(r.net_sales_7d) / totalSales : null,
    }));

    return { store_id: storeId, date_start: dateStart, date_end: dateEnd, items };
  }

  // ── Fulfillment ─────────────────────────────────────────────────────────────

  /**
   * Ticket times por hora y canal para una store en un día.
   * @param {string} storeId
   * @param {string} date
   * @param {string|null} channel - 'no3pd' | '3pd' | null = ambos
   */
  async getFulfillment(storeId, date, channel = null) {
    const channelFilter = channel ? 'AND channel = $3' : '';
    const params        = channel ? [storeId, date, channel] : [storeId, date];

    const result = await pool.query(
      `SELECT hour_bucket, channel,
              avg_order_time_sec, drinks_time_sec, salad_time_sec, taco_time_sec,
              order_count, items_per_order, mods_per_order, avg_check,
              pct_under_8min, pct_8_to_12min, pct_over_12min,
              labor_hours
       FROM rpt_fulfillment_snapshots
       WHERE store_id=$1 AND date=$2 ${channelFilter}
       ORDER BY hour_bucket, channel`,
      params
    );

    // Separar por canal y calcular totales
    const no3pd = result.rows.filter(r => r.channel === 'no3pd');
    const threepdRows = result.rows.filter(r => r.channel === '3pd');

    return {
      store_id: storeId,
      date,
      no3pd:    { rows: no3pd,      totals: this._fulfillmentTotals(no3pd)      },
      threepd:  { rows: threepdRows, totals: this._fulfillmentTotals(threepdRows) },
    };
  }

  /**
   * Group fulfillment — agrega ticket times de todas las stores.
   */
  async getGroupFulfillment(dateStart, dateEnd, channel = null) {
    const channelFilter = channel ? 'AND fs.channel = $3' : '';
    const params        = channel ? [dateStart, dateEnd, channel] : [dateStart, dateEnd];

    const result = await pool.query(
      `SELECT st.name as store_name, fs.channel, fs.hour_bucket,
              AVG(fs.avg_order_time_sec) as avg_order_time_sec,
              AVG(fs.drinks_time_sec)    as drinks_time_sec,
              AVG(fs.salad_time_sec)     as salad_time_sec,
              AVG(fs.taco_time_sec)      as taco_time_sec,
              SUM(fs.order_count)        as order_count,
              AVG(fs.items_per_order)    as items_per_order,
              AVG(fs.avg_check)          as avg_check,
              AVG(fs.pct_under_8min)     as pct_under_8min,
              AVG(fs.pct_8_to_12min)     as pct_8_to_12min,
              AVG(fs.pct_over_12min)     as pct_over_12min
       FROM rpt_fulfillment_snapshots fs
       JOIN stores st ON st.id = fs.store_id
       WHERE fs.date BETWEEN $1 AND $2 ${channelFilter}
       GROUP BY st.name, fs.channel, fs.hour_bucket
       ORDER BY fs.hour_bucket, fs.channel, st.name`,
      params
    );

    return {
      date_start: dateStart,
      date_end:   dateEnd,
      rows:       result.rows,
    };
  }

  // ── Labor Detail ────────────────────────────────────────────────────────────

  /**
   * Labor semanal por store con breakdown por categoría.
   */
  async getLaborWeekly(dateStart, dateEnd, storeId = null) {
    const storeFilter = storeId ? 'AND l.store_id = $3' : '';
    const params      = storeId ? [dateStart, dateEnd, storeId] : [dateStart, dateEnd];

    const result = await pool.query(
      `SELECT l.store_id, st.name as store_name, l.date,
              l.hourly_labor_pct, l.hourly_labor_cost,
              l.scheduled_hours, l.actual_hours, l.variance_hours,
              l.splh, l.forecast_labor_pct, l.var_vs_forecast_pct,
              l.leadership_scheduled, l.leadership_actual,
              l.boh_scheduled, l.boh_actual,
              l.foh_scheduled, l.foh_actual,
              l.training_scheduled, l.training_actual
       FROM rpt_daily_labor l
       JOIN stores st ON st.id = l.store_id
       WHERE l.date BETWEEN $1 AND $2 ${storeFilter}
       ORDER BY l.store_id, l.date`,
      params
    );

    return { date_start: dateStart, date_end: dateEnd, rows: result.rows };
  }

  // ── Spend Detail ────────────────────────────────────────────────────────────

  /**
   * Spend breakdown (food + paper) semanal.
   * Equivale al Appendix del Weekly Scorecard PDF.
   */
  async getSpendWeekly(dateStart, dateEnd, storeId = null) {
    const storeFilter = storeId ? 'AND sp.store_id = $3' : '';
    const params      = storeId ? [dateStart, dateEnd, storeId] : [dateStart, dateEnd];

    const result = await pool.query(
      `SELECT sp.store_id, st.name as store_name,
              SUM(sp.food_total)              as food_total,
              SUM(sp.coffee_cost)             as coffee_cost,
              SUM(sp.dairy_cost)              as dairy_cost,
              SUM(sp.grocery_dry_goods_cost)  as grocery_dry_goods_cost,
              SUM(sp.meat_cost)               as meat_cost,
              SUM(sp.na_beverage_cost)        as na_beverage_cost,
              SUM(sp.poultry_cost)            as poultry_cost,
              SUM(sp.produce_cost)            as produce_cost,
              SUM(sp.paper_total)             as paper_total,
              SUM(sp.catering_paper_cost)     as catering_paper_cost,
              SUM(sp.food_sale_paper_cost)    as food_sale_paper_cost,
              SUM(sp.operational_paper_cost)  as operational_paper_cost,
              SUM(sp.linens_cost)             as linens_cost,
              SUM(sp.paper_tax)               as paper_tax
       FROM rpt_daily_spend sp
       JOIN stores st ON st.id = sp.store_id
       WHERE sp.date BETWEEN $1 AND $2 ${storeFilter}
       GROUP BY sp.store_id, st.name
       ORDER BY st.name`,
      params
    );

    // Group total
    const groupTotals = result.rows.reduce((acc, r) => {
      for (const key of Object.keys(r)) {
        if (key !== 'store_id' && key !== 'store_name') {
          acc[key] = (acc[key] || 0) + parseFloat(r[key] || 0);
        }
      }
      return acc;
    }, {});

    return {
      date_start: dateStart,
      date_end:   dateEnd,
      stores:     result.rows,
      group:      groupTotals,
    };
  }

  // ── Ingest Log ──────────────────────────────────────────────────────────────

  async getIngestLog(days = 7) {
    const result = await pool.query(
      `SELECT * FROM rpt_ingest_log
       WHERE run_date >= NOW() - INTERVAL '${parseInt(days)} days'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async getLastSuccessfulRun(source) {
    const result = await pool.query(
      `SELECT * FROM rpt_ingest_log
       WHERE source=$1 AND status='success'
       ORDER BY run_date DESC LIMIT 1`,
      [source]
    );
    return result.rows[0] || null;
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  _sumStores(stores) {
    if (!stores.length) return null;
    const sum = {
      net_sales: 0, catering_sales: 0, order_count: 0,
      labor_cost: 0, food_total: 0, paper_total: 0,
      scheduled_hours: 0, actual_hours: 0,
    };
    const avgs = {
      in_person_avg: [], direct_online_avg: [], threepd_avg: [],
      labor_pct: [], splh: [],
    };

    for (const s of stores) {
      for (const key of Object.keys(sum)) {
        sum[key] += parseFloat(s[key] || 0);
      }
      for (const key of Object.keys(avgs)) {
        if (s[key] != null) avgs[key].push(parseFloat(s[key]));
      }
    }

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      ...sum,
      in_person_avg:     avg(avgs.in_person_avg),
      direct_online_avg: avg(avgs.direct_online_avg),
      threepd_avg:       avg(avgs.threepd_avg),
      labor_pct:         avg(avgs.labor_pct),
      splh:              avg(avgs.splh),
      food_pct:          sum.net_sales ? sum.food_total  / sum.net_sales : null,
      paper_pct:         sum.net_sales ? sum.paper_total / sum.net_sales : null,
    };
  }

  _calculateWoW(current, previous) {
    if (!current || !previous) return null;
    const pct = (curr, prev) => prev ? (curr - prev) / Math.abs(prev) : null;
    return {
      net_sales_change:    pct(current.net_sales,    previous.net_sales),
      labor_pct_change:    pct(current.labor_pct,    previous.labor_pct),
      food_total_change:   pct(current.food_total,   previous.food_total),
      paper_total_change:  pct(current.paper_total,  previous.paper_total),
      order_count_change:  pct(current.order_count,  previous.order_count),
    };
  }

  _fulfillmentTotals(rows) {
    if (!rows.length) return null;
    const totalOrders = rows.reduce((s, r) => s + (parseInt(r.order_count) || 0), 0);
    const avgTime     = rows.reduce((s, r) => s + (parseInt(r.avg_order_time_sec) || 0), 0) / rows.length;
    const avgCheck    = rows.reduce((s, r) => s + (parseFloat(r.avg_check) || 0), 0) / rows.length;
    const pctUnder8   = rows.reduce((s, r) => s + (parseFloat(r.pct_under_8min) || 0), 0) / rows.length;
    const pct8to12    = rows.reduce((s, r) => s + (parseFloat(r.pct_8_to_12min) || 0), 0) / rows.length;
    const pctOver12   = rows.reduce((s, r) => s + (parseFloat(r.pct_over_12min) || 0), 0) / rows.length;

    return {
      total_orders:    totalOrders,
      avg_time_sec:    Math.round(avgTime),
      avg_check:       Math.round(avgCheck * 100) / 100,
      pct_under_8min:  Math.round(pctUnder8 * 10000) / 10000,
      pct_8_to_12min:  Math.round(pct8to12  * 10000) / 10000,
      pct_over_12min:  Math.round(pctOver12  * 10000) / 10000,
    };
  }

  async _getActiveStores() {
    const res = await pool.query('SELECT id, name FROM stores WHERE is_active=true ORDER BY name');
    return res.rows;
  }
}

module.exports = ReportingQueryService;