/**
 * R365Ingest.js
 * Trae food cost y paper spend de Restaurant365 vía OData
 * y los guarda en rpt_daily_spend.
 *
 * OData base URL: https://odata.restaurant365.net/api/v2/views/
 * Auth: Basic Auth con formato  domain\username : password
 *
 * PENDIENTE: acceso OData requiere habilitación por parte de R365 Support.
 * Mientras tanto este servicio loguea un warning y retorna 0 records.
 * Cuando el acceso esté habilitado, configurar en .env:
 *   R365_ODATA_USER=domain\username
 *   R365_ODATA_PASS=password
 *   R365_ODATA_URL=https://odata.restaurant365.net/api/v2/views
 *
 * GL Account mapping — estos números dependen de la config de cada cliente R365.
 * Una vez con acceso, correr GET /GLAccount para obtener los IDs correctos
 * y mapearlos acá.
 */

const { pool } = require('../../../db');

const ODATA_URL  = process.env.R365_ODATA_URL  || 'https://odata.restaurant365.net/api/v2/views';
const ODATA_USER = process.env.R365_ODATA_USER;  // domain\username
const ODATA_PASS = process.env.R365_ODATA_PASS;

// GL Account keywords para clasificar spend
// Se completan después de obtener el listado real de /GLAccount
const GL_CATEGORY_MAP = {
  coffee:          process.env.R365_GL_COFFEE          || null,
  dairy:           process.env.R365_GL_DAIRY           || null,
  grocery:         process.env.R365_GL_GROCERY         || null,
  meat:            process.env.R365_GL_MEAT            || null,
  na_beverage:     process.env.R365_GL_NA_BEVERAGE     || null,
  poultry:         process.env.R365_GL_POULTRY         || null,
  produce:         process.env.R365_GL_PRODUCE         || null,
  catering_paper:  process.env.R365_GL_CATERING_PAPER  || null,
  food_paper:      process.env.R365_GL_FOOD_PAPER      || null,
  op_paper:        process.env.R365_GL_OP_PAPER        || null,
  linens:          process.env.R365_GL_LINENS          || null,
  paper_tax:       process.env.R365_GL_PAPER_TAX       || null,
};

class R365Ingest {
  /**
   * @param {string} date - YYYY-MM-DD
   * @returns {{ inserted: number, updated: number }}
   */
  async ingest(date) {
    if (!ODATA_USER || !ODATA_PASS) {
      console.warn('[R365] OData credentials no configuradas — skipping. Configurar R365_ODATA_USER y R365_ODATA_PASS en .env una vez que R365 Support habilite el acceso.');
      return { inserted: 0, updated: 0 };
    }

    const stores = await this._getActiveStores();
    let inserted = 0;
    let updated  = 0;

    // Obtener locations de R365 para mapear con nuestras stores
    const r365Locations = await this._getLocations();
    if (!r365Locations.length) {
      console.warn('[R365] No se pudieron obtener locations');
      return { inserted: 0, updated: 0 };
    }

    for (const store of stores) {
      const r365Location = this._matchLocation(r365Locations, store.name);
      if (!r365Location) {
        console.warn(`[R365] No se encontró location en R365 para store: ${store.name}`);
        continue;
      }

      try {
        const transactions = await this._fetchTransactions(r365Location.locationId, date);
        const details      = await this._fetchTransactionDetails(transactions.map(t => t.transactionId));
        const row          = await this._buildSpendRow(store.id, date, details);
        const result       = await this._upsert(row);

        if (result === 'inserted') inserted++;
        else updated++;

      } catch (err) {
        console.error(`[R365] Error para store ${store.name}:`, err.message);
      }
    }

    return { inserted, updated };
  }

  // ── API calls ──────────────────────────────────────────────

  async _getLocations() {
    try {
      const data = await this._get('/Location');
      return data?.value || [];
    } catch (err) {
      console.error('[R365] Error obteniendo locations:', err.message);
      return [];
    }
  }

  async _fetchTransactions(locationId, date) {
    // Filtrar por location y fecha — máximo 31 días por request (limitación R365)
    const filter = `$filter=locationId eq guid'${locationId}' and date ge ${date}T00:00:00Z and date le ${date}T23:59:59Z`;
    const data   = await this._get(`/Transaction?${filter}`);
    return data?.value || [];
  }

  async _fetchTransactionDetails(transactionIds) {
    if (!transactionIds.length) return [];

    // Fetch details en lotes de 50 para no superar límites
    const BATCH_SIZE = 50;
    const allDetails = [];

    for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
      const batch  = transactionIds.slice(i, i + BATCH_SIZE);
      const filter = batch.map(id => `transactionId eq guid'${id}'`).join(' or ');
      const data   = await this._get(`/TransactionDetail?$filter=${filter}`);
      allDetails.push(...(data?.value || []));

      // Rate limiting básico entre lotes
      if (i + BATCH_SIZE < transactionIds.length) {
        await this._sleep(500);
      }
    }

    return allDetails;
  }

  async _get(path) {
    const fetch = (await import('node-fetch')).default;
    const auth  = Buffer.from(`${ODATA_USER}:${ODATA_PASS}`).toString('base64');
    const url   = `${ODATA_URL}${path}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`R365 OData ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json();
  }

  // ── Transformación ─────────────────────────────────────────

  _matchLocation(r365Locations, storeName) {
    // Match por nombre — case insensitive, substring match
    const name = storeName.toLowerCase();
    return r365Locations.find(l =>
      l.name?.toLowerCase().includes(name) ||
      name.includes(l.name?.toLowerCase())
    ) || null;
  }

  async _buildSpendRow(storeId, date, details) {
    // Obtener GL accounts para clasificar
    const glAccounts = await this._getGLAccounts();
    const glMap      = {};
    for (const gl of glAccounts) {
      glMap[gl.glAccountId] = gl.operationalCategory || gl.name || '';
    }

    // Sumar amounts por categoría GL
    const spend = {
      coffee: 0, dairy: 0, grocery: 0, meat: 0,
      na_beverage: 0, poultry: 0, produce: 0,
      catering_paper: 0, food_paper: 0, op_paper: 0,
      linens: 0, paper_tax: 0,
    };

    for (const detail of details) {
      const glName = glMap[detail.glAccountId] || '';
      const amount = Math.abs(detail.amount || 0);
      const cat    = this._classifyGL(glName);
      if (cat && spend[cat] !== undefined) spend[cat] += amount;
    }

    const foodTotal  = spend.coffee + spend.dairy + spend.grocery + spend.meat +
                       spend.na_beverage + spend.poultry + spend.produce;
    const paperTotal = spend.catering_paper + spend.food_paper + spend.op_paper +
                       spend.linens + spend.paper_tax;

    // Obtener net_sales del día para calcular %
    const salesRes  = await pool.query(
      'SELECT net_sales FROM rpt_daily_sales WHERE store_id=$1 AND date=$2',
      [storeId, date]
    );
    const netSales  = salesRes.rows[0]?.net_sales || null;

    return {
      store_id:               storeId,
      date,
      week_label:             this._weekLabel(date),
      food_total:             foodTotal,
      food_pct_sales:         netSales ? foodTotal / netSales : null,
      coffee_cost:            spend.coffee,
      dairy_cost:             spend.dairy,
      grocery_dry_goods_cost: spend.grocery,
      meat_cost:              spend.meat,
      na_beverage_cost:       spend.na_beverage,
      poultry_cost:           spend.poultry,
      produce_cost:           spend.produce,
      paper_total:            paperTotal,
      paper_pct_sales:        netSales ? paperTotal / netSales : null,
      catering_paper_cost:    spend.catering_paper,
      food_sale_paper_cost:   spend.food_paper,
      operational_paper_cost: spend.op_paper,
      linens_cost:            spend.linens,
      paper_tax:              spend.paper_tax,
      source:                 'r365',
    };
  }

  _classifyGL(glName) {
    const lc = glName.toLowerCase();
    if (lc.includes('coffee'))                            return 'coffee';
    if (lc.includes('dairy') || lc.includes('milk'))     return 'dairy';
    if (lc.includes('grocery') || lc.includes('dry'))    return 'grocery';
    if (lc.includes('meat') || lc.includes('beef') || lc.includes('brisket')) return 'meat';
    if (lc.includes('beverage') || lc.includes('drink')) return 'na_beverage';
    if (lc.includes('poultry') || lc.includes('chicken'))return 'poultry';
    if (lc.includes('produce') || lc.includes('vegetable')) return 'produce';
    if (lc.includes('catering') && lc.includes('paper')) return 'catering_paper';
    if (lc.includes('linen'))                            return 'linens';
    if (lc.includes('paper') && lc.includes('tax'))     return 'paper_tax';
    if (lc.includes('paper') || lc.includes('napkin'))  return 'food_paper';
    if (lc.includes('operational'))                      return 'op_paper';
    return null;
  }

  async _getGLAccounts() {
    try {
      const data = await this._get('/GLAccount');
      return data?.value || [];
    } catch (err) {
      console.warn('[R365] No se pudieron obtener GL accounts:', err.message);
      return [];
    }
  }

  // ── DB ─────────────────────────────────────────────────────

  async _upsert(row) {
    const existing = await pool.query(
      'SELECT id FROM rpt_daily_spend WHERE store_id=$1 AND date=$2',
      [row.store_id, row.date]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE rpt_daily_spend SET
           food_total=$1, food_pct_sales=$2,
           coffee_cost=$3, dairy_cost=$4, grocery_dry_goods_cost=$5,
           meat_cost=$6, na_beverage_cost=$7, poultry_cost=$8, produce_cost=$9,
           paper_total=$10, paper_pct_sales=$11,
           catering_paper_cost=$12, food_sale_paper_cost=$13,
           operational_paper_cost=$14, linens_cost=$15, paper_tax=$16,
           updated_at=NOW()
         WHERE store_id=$17 AND date=$18`,
        [
          row.food_total, row.food_pct_sales,
          row.coffee_cost, row.dairy_cost, row.grocery_dry_goods_cost,
          row.meat_cost, row.na_beverage_cost, row.poultry_cost, row.produce_cost,
          row.paper_total, row.paper_pct_sales,
          row.catering_paper_cost, row.food_sale_paper_cost,
          row.operational_paper_cost, row.linens_cost, row.paper_tax,
          row.store_id, row.date,
        ]
      );
      return 'updated';
    }

    await pool.query(
      `INSERT INTO rpt_daily_spend (
         store_id, date, week_label,
         food_total, food_pct_sales,
         coffee_cost, dairy_cost, grocery_dry_goods_cost,
         meat_cost, na_beverage_cost, poultry_cost, produce_cost,
         paper_total, paper_pct_sales,
         catering_paper_cost, food_sale_paper_cost,
         operational_paper_cost, linens_cost, paper_tax, source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        row.store_id, row.date, row.week_label,
        row.food_total, row.food_pct_sales,
        row.coffee_cost, row.dairy_cost, row.grocery_dry_goods_cost,
        row.meat_cost, row.na_beverage_cost, row.poultry_cost, row.produce_cost,
        row.paper_total, row.paper_pct_sales,
        row.catering_paper_cost, row.food_sale_paper_cost,
        row.operational_paper_cost, row.linens_cost, row.paper_tax, row.source,
      ]
    );
    return 'inserted';
  }

  // ── Helpers ────────────────────────────────────────────────

  _weekLabel(date) {
    const d    = new Date(date);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `W${week}-${d.getFullYear()}`;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _getActiveStores() {
    const res = await pool.query('SELECT id, name, code FROM stores WHERE is_active = true ORDER BY id');
    return res.rows;
  }
}

module.exports = R365Ingest;