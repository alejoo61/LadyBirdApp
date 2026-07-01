/**
 * reportingJob.js
 * Job nocturno para el módulo de Reporting.
 * Corre a las 2am via PM2 scheduler — SEPARADO del sync de catering.
 *
 * Agregar a ecosystem.config.js de PM2:
 * {
 *   name: 'ladybird-reporting-job',
 *   script: './src/scheduler/reportingJob.js',
 *   cron_restart: '0 2 * * *',   // 2am todos los días
 *   autorestart: false,
 *   watch: false,
 * }
 *
 * También se puede correr manualmente para un día específico:
 *   node src/scheduler/reportingJob.js 2026-06-21
 */

const IngestOrchestrator = require('../services/reporting/IngestOrchestrator');

async function main() {
  // Permite correr manualmente con una fecha: node reportingJob.js 2026-06-21
  const dateArg = process.argv[2] || null;

  console.log('='.repeat(60));
  console.log(`[ReportingJob] Iniciando ${new Date().toISOString()}`);
  if (dateArg) console.log(`[ReportingJob] Fecha manual: ${dateArg}`);
  console.log('='.repeat(60));

  const orchestrator = new IngestOrchestrator();

  try {
    const results = await orchestrator.run(dateArg);

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed    = results.filter(r => r.status === 'failed').length;

    console.log('='.repeat(60));
    console.log(`[ReportingJob] Completado — ${succeeded} OK, ${failed} fallidos`);
    for (const r of results) {
      const icon = r.status === 'success' ? '✅' : '❌';
      console.log(`  ${icon} ${r.source}: ${r.status}${r.error ? ` — ${r.error}` : ''}`);
    }
    console.log('='.repeat(60));

    process.exit(failed === results.length ? 1 : 0);

  } catch (err) {
    console.error('[ReportingJob] Error fatal:', err);
    process.exit(1);
  }
}

main();