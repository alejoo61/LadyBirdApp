// src/routes/catering.routes.js
const express             = require('express');
const router              = express.Router();
const CateringOrderMapper = require('../mappers/CateringOrderMapper');
const PersonalBoxLabelsGenerator = require('../services/generators/PersonalBoxLabelsGenerator');

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

  // ── Manual edit ───────────────────────────────────────────────────────────
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

  // ── Manual Fulfillment Sheet (sin Toast, sin Calendar) ────────────────────
  router.post('/manual-fulfillment', async (req, res) => {
    try {
      const {
        storeId, clientName, clientPhone, clientEmail,
        eventType, guestCount, deliveryMethod, deliveryAddress,
        deliveryNotes, eventDate, eventTime,
        items = [], drinks = [], addons = [],
      } = req.body;

      if (!storeId || !clientName || !eventType || !guestCount || !eventDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: storeId, clientName, eventType, guestCount, eventDate',
        });
      }

      // Construir estimatedFulfillmentDate combinando fecha + hora
      const fulfillmentDate = eventTime
        ? new Date(`${eventDate}T${eventTime}`)
        : new Date(`${eventDate}T12:00:00`);

      if (isNaN(fulfillmentDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid eventDate or eventTime' });
      }

      const storeResult = await pool.query(
        'SELECT id, name, code FROM stores WHERE id = $1', [storeId]
      );
      if (!storeResult.rows.length) {
        return res.status(404).json({ success: false, error: 'Store not found' });
      }
      const store = storeResult.rows[0];

      // Armar parsedData con el formato que espera FulfillmentSheetCalculator
      const parsedData = {
        items: [
          ...items,
          ...drinks,
          ...addons,
        ],
      };

      // Insertar orden en DB con is_manual_sheet = true
      const displayNumber = `M-${Date.now()}`;
      const toastGuid     = `MANUAL-SHEET-${Date.now()}`;

      const insertResult = await pool.query(`
        INSERT INTO catering_orders (
          store_id, toast_order_guid, display_number,
          event_type, status, client_name, client_email, client_phone,
          estimated_fulfillment_date, delivery_method, delivery_address, delivery_notes,
          parsed_data, guest_count, total_amount,
          is_manually_edited, is_manual_sheet,
          payment_status, pdf_version,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, 'confirmed', $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, 0,
          true, true,
          'PAID', 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id
      `, [
        storeId, toastGuid, displayNumber,
        eventType, clientName, clientEmail || null, clientPhone || null,
        fulfillmentDate.toISOString(),
        deliveryMethod || 'PICKUP',
        deliveryAddress || null,
        deliveryNotes || null,
        JSON.stringify(parsedData),
        guestCount,
      ]);

      const orderId = insertResult.rows[0].id;

      // Construir objeto order para el generator
      const order = {
        id:                       orderId,
        storeId,
        storeName:                store.name,
        storeCode:                store.code,
        toastOrderGuid:           toastGuid,
        displayNumber,
        eventType,
        status:                   'confirmed',
        clientName,
        clientEmail:              clientEmail || null,
        clientPhone:              clientPhone || null,
        estimatedFulfillmentDate: fulfillmentDate.toISOString(),
        kitchenFinishTime:        null,
        deliveryMethod:           deliveryMethod || 'PICKUP',
        deliveryAddress:          deliveryAddress || null,
        deliveryNotes:            deliveryNotes || null,
        parsedData,
        items:                    parsedData.items,
        guestCount,
        totalAmount:              0,
        overrideData:             {},
        overrideNotes:            null,
        isManuallyEdited:         true,
        isManualSheet:            true,
        pdfVersion:               1,
        paymentStatus:            'PAID',
        distanceMiles:            null,
        getKitchenFinishTime:     () => null,
        getEventTypeLabel:        () => eventType,
        getStatusLabel:           () => 'Confirmed',
        isUpcoming:               () => fulfillmentDate > new Date(),
      };

      const calculatedData = await fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = true;
      calculatedData.header.isManualSheet    = true;
      calculatedData.header.pdfVersion       = 1;

      const pdf     = await fulfillmentGenerator.generate(calculatedData);
      const pdfName = fulfillmentGenerator.buildFilename(order, store.code);

      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${pdfName}"`,
        'Content-Length':      pdf.length,
      });
      res.send(pdf);

    } catch (error) {
      console.error('❌ Manual fulfillment error:', error.message);
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
      calculatedData.header.isManualSheet    = order.isManualSheet    || false;
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

          // Generar labels si es Personal Box
          let labelsPdf     = null;
          let labelsPdfName = null;
          if (order.eventType === 'PERSONAL_BOX') {
            const labelsGen  = new PersonalBoxLabelsGenerator();
            const labelsHtml = labelsGen.build(calculatedData);
            labelsPdf        = await fulfillmentGenerator.generateFromHtml(labelsHtml);
            labelsPdfName    = fulfillmentGenerator.buildFilename(order, order.storeCode, 'labels');
          }

          // Skip calendar para manual sheets
          if (!order.isManualSheet) {
            let calResult;
            if (existingEventId) {
              calResult = await googleCalendarService.updateEvent(order, existingEventId, pdf, pdfName, calculatedData, labelsPdf, labelsPdfName);
            } else {
              calResult = await googleCalendarService.createEvent(order, pdf, pdfName, calculatedData, labelsPdf, labelsPdfName);
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

  // ── Personal Box Labels PDF ───────────────────────────────────────────────
  router.post('/:id/labels', async (req, res) => {
    try {
      const order = await cateringOrderService.getOrderById(req.params.id);

      if (order.eventType !== 'PERSONAL_BOX') {
        return res.status(400).json({ success: false, error: 'Labels are only available for Personal Box orders' });
      }

      const storeResult = await pool.query(
        'SELECT name, code FROM stores WHERE id = $1', [order.storeId]
      );
      order.storeName = storeResult.rows[0]?.name || '';
      order.storeCode = storeResult.rows[0]?.code || '';
      if (!order.items || order.items.length === 0)
        order.items = order.parsedData?.items || [];

      const calculatedData = await fulfillmentCalculator.calculate(order);
      const labelsGen      = new PersonalBoxLabelsGenerator();
      const labelsHtml     = labelsGen.build(calculatedData);
      const labelsPdf      = await fulfillmentGenerator.generateFromHtml(labelsHtml);
      const labelsPdfName  = fulfillmentGenerator.buildFilename(order, order.storeCode, 'labels');

      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${labelsPdfName}"`,
        'Content-Length':      labelsPdf.length,
      });
      res.send(labelsPdf);

    } catch (error) {
      console.error('❌ Labels error:', error.message);
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
      calculatedData.header.isManualSheet    = order.isManualSheet    || false;
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