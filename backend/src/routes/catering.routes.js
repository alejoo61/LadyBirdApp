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
  router.get('/',    (req, res) => cateringOrderController.getAll(req, res));
  router.get('/:id', (req, res) => cateringOrderController.getById(req, res));

  // ── Manual Fulfillment Sheet (sin Toast, sin Calendar) ────────────────────
  // IMPORTANTE: debe ir antes de router.post('/') para que no sea capturado por /:id
  router.post('/manual-fulfillment', async (req, res) => {
    try {
      const {
        storeId, clientName, clientPhone, clientEmail,
        company, eventType, guestCount,
        deliveryMethod, deliveryAddress, deliveryNotes,
        eventDate, eventTime, kitchenFinishTime,
        distanceMiles, ezCaterCode,
        items = [], drinks = [], addons = [], extras = [],
      } = req.body;

      if (!storeId || !clientName || !eventType || !eventDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: storeId, clientName, eventType, eventDate',
        });
      }

      // Parsear time en formato AM/PM (e.g. "2:30 PM") o 24h (e.g. "14:30")
      function parseEventTime(dateStr, timeStr) {
        if (!timeStr) return new Date(`${dateStr}T12:00:00`);
        // Si ya es formato 24h (HH:MM) usarlo directo
        if (/^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
          return new Date(`${dateStr}T${timeStr.trim()}:00`);
        }
        // Parsear AM/PM
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hours = parseInt(match[1]);
          const mins = match[2];
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          const hh = String(hours).padStart(2, '0');
          return new Date(`${dateStr}T${hh}:${mins}:00`);
        }
        // Fallback: intentar parseo directo
        return new Date(`${dateStr}T${timeStr}`);
      }

      const fulfillmentDate = parseEventTime(eventDate, eventTime);

      if (isNaN(fulfillmentDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid eventDate or eventTime. Use format like "2:30 PM"' });
      }

      const kitchenFinish = kitchenFinishTime
        ? parseEventTime(eventDate, kitchenFinishTime)
        : null;

      const storeResult = await pool.query(
        'SELECT id, name, code FROM stores WHERE id = $1', [storeId]
      );
      if (!storeResult.rows.length) {
        return res.status(404).json({ success: false, error: 'Store not found' });
      }
      const store = storeResult.rows[0];

      const isEzCater = !!ezCaterCode;
      const parsedData = {
        // items: solo eventos (taco bar, bird box, personal box) + drinks + addons
        // extras (equipment, space rental, kids) van separados para no contaminar el calculator
        items: [...items, ...drinks, ...addons],
        extras: extras || [],
        ...(ezCaterCode ? { ezCaterCode } : {}),
      };

      const displayNumber = `M-${Date.now()}`;
      const toastGuid     = `MANUAL-SHEET-${Date.now()}`;

      const insertResult = await pool.query(`
        INSERT INTO catering_orders (
          store_id, toast_order_guid, display_number,
          event_type, status, client_name, client_email, client_phone,
          estimated_fulfillment_date, kitchen_finish_time,
          delivery_method, delivery_address, delivery_notes,
          parsed_data, guest_count, total_amount,
          delivery_distance_miles,
          is_manually_edited, is_manual_sheet, is_ez_cater,
          payment_status, pdf_version,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, 'confirmed', $5, $6, $7,
          $8, $9,
          $10, $11, $12,
          $13, $14, 0,
          $15,
          true, true, $16,
          'PAID', 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id
      `, [
        storeId, toastGuid, displayNumber,
        eventType, clientName, clientEmail || null, clientPhone || null,
        fulfillmentDate.toISOString(),
        kitchenFinish ? kitchenFinish.toISOString() : null,
        deliveryMethod || 'PICKUP',
        deliveryAddress || null,
        deliveryNotes || null,
        JSON.stringify(parsedData),
        guestCount || 1,
        distanceMiles || null,
        isEzCater,
      ]);

      const orderId = insertResult.rows[0].id;

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
        kitchenFinishTime:        kitchenFinish ? kitchenFinish.toISOString() : null,
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
        isEzCater:                isEzCater,
        ezCaterCode:              ezCaterCode || null,
        isManualSheet:            true,
        pdfVersion:               1,
        paymentStatus:            'PAID',
        distanceMiles:            distanceMiles || null,
        getKitchenFinishTime:     () => kitchenFinish ? kitchenFinish.toISOString() : null,
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

  // ── Edit Manual Sheet ─────────────────────────────────────────────────────
  router.patch('/:id/manual-fulfillment', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        storeId, clientName, clientPhone, clientEmail,
        company, eventType, guestCount,
        deliveryMethod, deliveryAddress, deliveryNotes,
        eventDate, eventTime, kitchenFinishTime,
        distanceMiles, ezCaterCode,
        items = [], drinks = [], addons = [], extras = [],
      } = req.body;

      function parseEventTime(dateStr, timeStr) {
        if (!timeStr) return new Date(`${dateStr}T12:00:00`);
        if (/^\d{1,2}:\d{2}$/.test(timeStr.trim())) return new Date(`${dateStr}T${timeStr.trim()}:00`);
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hours = parseInt(match[1]);
          const mins = match[2];
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return new Date(`${dateStr}T${String(hours).padStart(2,'0')}:${mins}:00`);
        }
        return new Date(`${dateStr}T${timeStr}`);
      }

      const fulfillmentDate = eventDate ? parseEventTime(eventDate, eventTime) : null;
      const kitchenFinish   = kitchenFinishTime && eventDate ? parseEventTime(eventDate, kitchenFinishTime) : null;
      const isEzCater       = !!ezCaterCode;
      const parsedData      = {
        items: [...items, ...drinks, ...addons],
        extras: extras || [],
        ...(ezCaterCode ? { ezCaterCode } : {}),
      };

      await pool.query(`
        UPDATE catering_orders SET
          store_id                   = COALESCE($1, store_id),
          event_type                 = COALESCE($2, event_type),
          client_name                = COALESCE($3, client_name),
          client_email               = $4,
          client_phone               = $5,
          estimated_fulfillment_date = COALESCE($6, estimated_fulfillment_date),
          kitchen_finish_time        = $7,
          delivery_method            = COALESCE($8, delivery_method),
          delivery_address           = $9,
          delivery_notes             = $10,
          guest_count                = COALESCE($11, guest_count),
          delivery_distance_miles    = $12,
          parsed_data                = $13,
          is_ez_cater                = $14,
          is_manually_edited         = true,
          updated_at                 = CURRENT_TIMESTAMP
        WHERE id = $15 AND is_manual_sheet = true
      `, [
        storeId || null,
        eventType || null,
        clientName || null,
        clientEmail || null,
        clientPhone || null,
        fulfillmentDate?.toISOString() || null,
        kitchenFinish?.toISOString() || null,
        deliveryMethod || null,
        deliveryAddress || null,
        deliveryNotes || null,
        guestCount || null,
        distanceMiles || null,
        JSON.stringify(parsedData),
        isEzCater,
        id,
      ]);

      // Re-generate PDF with updated data
      const storeResult = await pool.query('SELECT id, name, code FROM stores WHERE id = $1', [storeId]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

      const orderResult = await pool.query('SELECT * FROM catering_orders WHERE id = $1', [id]);
      const row = orderResult.rows[0];

      const order = {
        id, storeId: row.store_id, storeName: store.name, storeCode: store.code,
        toastOrderGuid: row.toast_order_guid, displayNumber: row.display_number,
        eventType: row.event_type, status: row.status,
        clientName: row.client_name, clientEmail: row.client_email, clientPhone: row.client_phone,
        estimatedFulfillmentDate: row.estimated_fulfillment_date,
        kitchenFinishTime: row.kitchen_finish_time || null,
        deliveryMethod: row.delivery_method, deliveryAddress: row.delivery_address,
        deliveryNotes: row.delivery_notes, parsedData: row.parsed_data,
        items: row.parsed_data?.items || [],
        guestCount: row.guest_count, totalAmount: row.total_amount,
        isManuallyEdited: true, isManualSheet: true,
        pdfVersion: row.pdf_version || 1,
        distanceMiles: row.delivery_distance_miles || null,
        getKitchenFinishTime: () => row.kitchen_finish_time || null,
        getEventTypeLabel: () => row.event_type,
        getStatusLabel: () => row.status,
        isUpcoming: () => new Date(row.estimated_fulfillment_date) > new Date(),
      };

      const calculatedData = await fulfillmentCalculator.calculate(order);
      calculatedData.header.isManuallyEdited = true;
      calculatedData.header.isManualSheet    = true;

      const pdf     = await fulfillmentGenerator.generate(calculatedData);
      const pdfName = fulfillmentGenerator.buildFilename(order, store.code);

      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${pdfName}"`,
        'Content-Length':      pdf.length,
      });
      res.send(pdf);

    } catch (error) {
      console.error('❌ Manual fulfillment edit error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── CRUD post/patch ───────────────────────────────────────────────────────
  router.post('/', (req, res) => cateringOrderController.createManual(req, res));

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

          let labelsPdf     = null;
          let labelsPdfName = null;
          if (order.eventType === 'PERSONAL_BOX') {
            const labelsGen  = new PersonalBoxLabelsGenerator();
            const labelsHtml = labelsGen.build(calculatedData);
            labelsPdf        = await fulfillmentGenerator.generateFromHtml(labelsHtml);
            labelsPdfName    = fulfillmentGenerator.buildFilename(order, order.storeCode, 'labels');
          }

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