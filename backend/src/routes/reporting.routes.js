/**
 * reporting.routes.js
 * Los routes no tienen SQL — toda la lógica está en ReportingQueryService.
 * Se agrega a app.js con: app.use('/api/reporting', require('./routes/reporting.routes'));
 */

const express              = require('express');
const router               = express.Router();
const ReportingQueryService = require('../services/reporting/ReportingQueryService');

const svc = new ReportingQueryService();

// ── Helpers ────────────────────────────────────────────────────────────────

function parseWeekToDates(week) {
  // W26-2026 → { dateStart, dateEnd }
  const [w, year] = week.split('-');
  const weekNum   = parseInt(w.replace('W', ''));
  const jan1      = new Date(`${year}-01-01`);
  const dateStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 86400000).toISOString().split('T')[0];
  const dateEnd   = new Date(jan1.getTime() +  weekNum      * 7 * 86400000 - 86400000).toISOString().split('T')[0];
  return { dateStart, dateEnd };
}

// ── Daily ──────────────────────────────────────────────────────────────────
// GET /api/reporting/daily?store_id=<uuid>&date=2026-06-21
// GET /api/reporting/daily?date=2026-06-21  → todas las stores (group daily)

router.get('/daily', async (req, res) => {
  const { store_id, date } = req.query;
  if (!date) return res.status(400).json({ error: 'date requerido (YYYY-MM-DD)' });

  try {
    const data = store_id
      ? await svc.getDaily(store_id, date)
      : await svc.getGroupDaily(date);
    res.json(data);
  } catch (err) {
    console.error('[reporting/daily]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Weekly Scorecard ───────────────────────────────────────────────────────
// GET /api/reporting/weekly?week=W26-2026
// GET /api/reporting/weekly?date_start=2026-06-15&date_end=2026-06-21
// GET /api/reporting/weekly?week=W26-2026&store_id=<uuid>  → single store

router.get('/weekly', async (req, res) => {
  const { week, date_start, date_end, store_id } = req.query;

  let dateStart, dateEnd;
  if (week) {
    ({ dateStart, dateEnd } = parseWeekToDates(week));
  } else if (date_start && date_end) {
    dateStart = date_start;
    dateEnd   = date_end;
  } else {
    return res.status(400).json({ error: 'Requerido: week o date_start + date_end' });
  }

  try {
    const data = await svc.getWeekly(dateStart, dateEnd, store_id || null);
    res.json({ week: week || null, ...data });
  } catch (err) {
    console.error('[reporting/weekly]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Weekly WoW Comparison ──────────────────────────────────────────────────
// GET /api/reporting/weekly/compare?week1=W26-2026&week2=W25-2026

router.get('/weekly/compare', async (req, res) => {
  const { week1, week2 } = req.query;
  if (!week1 || !week2) return res.status(400).json({ error: 'week1 y week2 requeridos' });

  try {
    const { dateStart: s1, dateEnd: e1 } = parseWeekToDates(week1);
    const { dateStart: s2, dateEnd: e2 } = parseWeekToDates(week2);
    const data = await svc.getWeeklyComparison(s1, e1, s2, e2);
    res.json(data);
  } catch (err) {
    console.error('[reporting/weekly/compare]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PMIX ───────────────────────────────────────────────────────────────────
// GET /api/reporting/pmix?store_id=<uuid>&date_start=2026-06-15&date_end=2026-06-21
// GET /api/reporting/pmix?date_start=...&date_end=...&category=food&limit=10

router.get('/pmix', async (req, res) => {
  const { store_id, date_start, date_end, category, limit } = req.query;
  if (!date_start || !date_end) return res.status(400).json({ error: 'date_start y date_end requeridos' });

  try {
    const data = await svc.getPmix(
      store_id || null,
      date_start,
      date_end,
      category || null,
      parseInt(limit) || 10
    );
    res.json(data);
  } catch (err) {
    console.error('[reporting/pmix]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Fulfillment ────────────────────────────────────────────────────────────
// GET /api/reporting/fulfillment?store_id=<uuid>&date=2026-06-21&channel=no3pd
// GET /api/reporting/fulfillment/group?date_start=...&date_end=...

router.get('/fulfillment', async (req, res) => {
  const { store_id, date, channel } = req.query;
  if (!store_id || !date) return res.status(400).json({ error: 'store_id y date requeridos' });

  try {
    const data = await svc.getFulfillment(store_id, date, channel || null);
    res.json(data);
  } catch (err) {
    console.error('[reporting/fulfillment]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/fulfillment/group', async (req, res) => {
  const { date_start, date_end, channel } = req.query;
  if (!date_start || !date_end) return res.status(400).json({ error: 'date_start y date_end requeridos' });

  try {
    const data = await svc.getGroupFulfillment(date_start, date_end, channel || null);
    res.json(data);
  } catch (err) {
    console.error('[reporting/fulfillment/group]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Labor ──────────────────────────────────────────────────────────────────
// GET /api/reporting/labor?date_start=2026-06-15&date_end=2026-06-21&store_id=<uuid>

router.get('/labor', async (req, res) => {
  const { store_id, date_start, date_end } = req.query;
  if (!date_start || !date_end) return res.status(400).json({ error: 'date_start y date_end requeridos' });

  try {
    const data = await svc.getLaborWeekly(date_start, date_end, store_id || null);
    res.json(data);
  } catch (err) {
    console.error('[reporting/labor]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Spend ──────────────────────────────────────────────────────────────────
// GET /api/reporting/spend?date_start=2026-06-15&date_end=2026-06-21&store_id=<uuid>

router.get('/spend', async (req, res) => {
  const { store_id, date_start, date_end } = req.query;
  if (!date_start || !date_end) return res.status(400).json({ error: 'date_start y date_end requeridos' });

  try {
    const data = await svc.getSpendWeekly(date_start, date_end, store_id || null);
    res.json(data);
  } catch (err) {
    console.error('[reporting/spend]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Ingest Log ─────────────────────────────────────────────────────────────
// GET /api/reporting/ingest-log?days=7
// GET /api/reporting/ingest-log/last?source=7shifts

router.get('/ingest-log', async (req, res) => {
  try {
    const data = await svc.getIngestLog(parseInt(req.query.days) || 7);
    res.json(data);
  } catch (err) {
    console.error('[reporting/ingest-log]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ingest-log/last', async (req, res) => {
  const { source } = req.query;
  if (!source) return res.status(400).json({ error: 'source requerido (toast|7shifts|r365)' });

  try {
    const data = await svc.getLastSuccessfulRun(source);
    res.json(data);
  } catch (err) {
    console.error('[reporting/ingest-log/last]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;