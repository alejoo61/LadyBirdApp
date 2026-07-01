/**
 * IngestOrchestrator.js
 * Corre los 3 ingest services en secuencia y loguea cada resultado.
 * Se llama desde el job nocturno (reportingJob.js) a las 2am.
 *
 * INDEPENDIENTE del ToastSyncService existente — no lo importa ni lo toca.
 */

const { pool } = require('../../db');           // mismo pool que usa el resto del backend
const ToastReportingIngest  = require('./ingest/ToastReportingIngest');
const SevenShiftsIngest     = require('./ingest/SevenShiftsIngest');
const R365Ingest            = require('./ingest/R365Ingest');

class IngestOrchestrator {
  /**
   * @param {string} dateStr - fecha a ingestar en formato YYYY-MM-DD
   *                           default: ayer
   */
  async run(dateStr) {
    const targetDate = dateStr || this._yesterday();
    console.log(`[IngestOrchestrator] Arrancando ingest para ${targetDate}`);

    const services = [
      { name: 'toast',    service: new ToastReportingIngest() },
      { name: '7shifts',  service: new SevenShiftsIngest()    },
      { name: 'r365',     service: new R365Ingest()           },
    ];

    const results = [];

    for (const { name, service } of services) {
      const start = Date.now();
      try {
        console.log(`[IngestOrchestrator] Corriendo ${name}...`);
        const result = await service.ingest(targetDate);
        const duration = Date.now() - start;

        await this._log({
          run_date:         targetDate,
          source:           name,
          status:           'success',
          records_inserted: result.inserted || 0,
          records_updated:  result.updated  || 0,
          duration_ms:      duration,
        });

        console.log(`[IngestOrchestrator] ✅ ${name} — ${result.inserted} inserted, ${result.updated} updated (${duration}ms)`);
        results.push({ source: name, status: 'success', ...result });

      } catch (err) {
        const duration = Date.now() - start;
        console.error(`[IngestOrchestrator] ❌ ${name} falló:`, err.message);

        await this._log({
          run_date:      targetDate,
          source:        name,
          status:        'failed',
          error_message: err.message,
          duration_ms:   duration,
        });

        results.push({ source: name, status: 'failed', error: err.message });
        // Continúa con el siguiente servicio — un fallo no detiene los demás
      }
    }

    console.log(`[IngestOrchestrator] Ingest completo para ${targetDate}`);
    return results;
  }

  async _log({ run_date, source, status, records_inserted = 0, records_updated = 0, error_message = null, duration_ms }) {
    try {
      await pool.query(
        `INSERT INTO rpt_ingest_log
           (run_date, source, status, records_inserted, records_updated, error_message, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [run_date, source, status, records_inserted, records_updated, error_message, duration_ms]
      );
    } catch (err) {
      // No explotar si el log falla — solo avisar
      console.error('[IngestOrchestrator] Error guardando log:', err.message);
    }
  }

  _yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
}

module.exports = IngestOrchestrator;