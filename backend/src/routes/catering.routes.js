// src/routes/catering.routes.js
const express             = require('express');
const router              = express.Router();
const CateringOrderMapper = require('../mappers/CateringOrderMapper');

module.exports = (
  pool,
  cateringOrderController,
  cateringOrderService,
  auditService,
  fulfillmentCalculator,
  fulfillmentGenerator,
  googleCalendarService,
  toastSyncService,
) => {

  // ── CRUD básico ───────────────────────────────────────────────────────────
  router.get('/',      (req, res) => cateringOrderController.getAll(req, res));
  router.get('/:id',   (req, res) => cateringOrderController.getById(req, res));
  router.post('/',     (req, res) => cateringOrderController.createManual(req, res));

  router.patch('/:id/status',         (req, res) => cateringOrderController.updateStatus(req, res));
  router.patch('/:id/override',       (req, res) => cateringOrderController.updateOverride(req, res));
  router.patch('/:id/payment-status', (req, res) => cateringOrderController.overridePaymentStatus(req, res));

  // ── Manual edit — responde y dispara PDF+Calendar+Audit en background ────
  router.patch('/:id/manual', async (req, res) => {
    try {
      const actor  = req.headers['x-user'] || 'unknown';
      const before = await cateringOrderService.getOrderById(req.params.id);
      const order  = await cateringOrderService.updateManual(req.params.id, req.body);
      const dto    = CateringOrderMapper.toDTO(order);
      res.json({ success: true, data: dto, message: 'Order updated manually' });

      setImmediate(async () => {
        try {
          await auditService.logManualEdit(req.params.id, actor, before, req.body);
          await toastSyncService._autoPdfAndCalendar(order.id, dto.storeCode, dto.storeName);
        } catch (err) {
          console.error('❌ Post-edit background error:', err.message);
        }
      });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  });

  // ── Calendar sync manual ──────────────────────────────────────────────────
  router.post('/:id/sync-calendar', async (req, res) => {
    try {
      const actor = req.headers['x-user'] || 'unknown';
      const order = await cateringOrderService.getOrderById(req.params.id);
      const storeResult = await pool.query(
        'SELECT name, code FROM stores WHERE id = $1', [order.storeId]
      );
      order.storeName = storeResult.rows[0]?.name || '';
      order.storeCode = storeResult.rows[0]?.code || '';
      res.json({ success: true, message: 'Calendar sync started' });

      setImmediate(async () => {
        try {
          await toastSyncService._autoPdfAndCalendar(order.id, order.storeCode, order.storeName);
          await auditService.logCalendarSynced(order.id, actor, order.googleEventId);
        } catch (err) {
          console.error('❌ Manual Calendar sync:', err.message);
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Fulfillment PDF ───────────────────────────────────────────────────────
  router.post('/:id/fulfillment-sheet', async (req, res) => {
    try {
      const actor = req.headers['x-user'] || 'unknown';
      const order = await cateringOrderService.getOrderById(req.params.id);

      const storeResult = await pool.query(
        'SELECT name, code FROM stores WHERE id = $1', [order.storeId]
      );
      order.storeName = storeResult.rows[0]?.name || '';
      order.storeCode = storeResult.rows[0]?.code || '';
      if (!order.items || order.items.length === 0)
        order.items = order.parsedData?.items || [];

      const newVersion = (order.pdfVersion || 1) + 1;
      await pool.query(`
        UPDATE catering_orders
        SET pdf_version = $1, pdf_needs_update = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newVersion, order.id]);
      order.pdfVersion = newVersion;

      const calculatedData = await fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = order.isManuallyEdited || false;
      calculatedData.header.pdfVersion       = newVersion;

      const pdf     = await fulfillmentGenerator.generate(calculatedData);
      const pdfName = fulfillmentGenerator.buildFilename(order, order.storeCode);

      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${pdfName}"`,
        'Content-Length':      pdf.length,
      });
      res.send(pdf);

      setImmediate(async () => {
        try {
          await auditService.logPdfGenerated(order.id, actor, newVersion);
          const orderRow = await pool.query(
            'SELECT google_event_id FROM catering_orders WHERE id = $1', [order.id]
          );
          const existingEventId = orderRow.rows[0]?.google_event_id;
          let calResult;
          if (existingEventId) {
            calResult = await googleCalendarService.updateEvent(order, existingEventId, pdf, pdfName);
          } else {
            calResult = await googleCalendarService.createEvent(order, pdf, pdfName);
          }
          if (calResult?.eventId) {
            await pool.query(`
              UPDATE catering_orders
              SET google_event_id = $1, calendar_needs_update = false, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [calResult.eventId, order.id]);
            await auditService.logCalendarSynced(order.id, 'system', calResult.eventId);
            console.log(`📅 Calendar synced for order ${order.displayNumber}`);
          }
        } catch (err) {
          console.error('❌ Post-PDF background error:', err.message);
        }
      });
    } catch (error) {
      console.error('❌ Fulfillment sheet error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── PDF Preview ───────────────────────────────────────────────────────────
  router.get('/:id/fulfillment-sheet/preview', async (req, res) => {
    try {
      const order = await cateringOrderService.getOrderById(req.params.id);
      const storeResult = await pool.query(
        'SELECT name, code FROM stores WHERE id = $1', [order.storeId]
      );
      order.storeName = storeResult.rows[0]?.name || '';
      order.storeCode = storeResult.rows[0]?.code || '';
      if (!order.items || order.items.length === 0)
        order.items = order.parsedData?.items || [];

      const calculatedData = await fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = order.isManuallyEdited || false;
      calculatedData.header.pdfVersion       = order.pdfVersion || 1;

      const pdf = await fulfillmentGenerator.generate(calculatedData);
      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'inline',
        'Content-Length':      pdf.length,
      });
      res.end(pdf, 'binary');
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};