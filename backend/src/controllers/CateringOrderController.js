// src/controllers/CateringOrderController.js
const CateringOrderMapper = require('../mappers/CateringOrderMapper');

class CateringOrderController {
  constructor(cateringOrderService, auditService) {
    this.cateringOrderService = cateringOrderService;
    this.auditService         = auditService;
  }

  // Extrae el actor del header x-user o usa 'unknown'
  _actor(req) {
    return req.headers['x-user'] || 'unknown';
  }

  async getAll(req, res) {
    try {
      const { storeId, eventType, status, deliveryMethod, dateFrom, dateTo, paymentStatus } = req.query;
      const orders = await this.cateringOrderService.getAll({
        storeId, eventType, status, paymentStatus, deliveryMethod, dateFrom, dateTo,
      });
      res.json({
        success: true,
        data: orders.map(o => {
          const dto = CateringOrderMapper.toDTO(o);
          dto.storeName = o.storeName;
          dto.storeCode = o.storeCode;
          return dto;
        }),
        count: orders.length,
      });
    } catch (error) {
      console.error('❌ CateringOrderController.getAll error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const order = await this.cateringOrderService.getOrderById(req.params.id);
      const dto   = CateringOrderMapper.toDTO(order);
      res.json({ success: true, data: { ...dto, storeName: order.storeName, storeCode: order.storeCode } });
    } catch (error) {
      const status = error.message === 'Order not found' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const actor      = this._actor(req);

      // Obtener status anterior para el log
      const before = await this.cateringOrderService.getOrderById(req.params.id);
      const order  = await this.cateringOrderService.updateStatus(req.params.id, status);

      res.json({ success: true, data: CateringOrderMapper.toDTO(order), message: 'Status updated' });

      // Audit log en background
      setImmediate(() =>
        this.auditService.logStatusChange(req.params.id, actor, before.status, status)
          .catch(e => console.error('⚠️  Audit log error:', e.message))
      );
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : error.message.includes('Invalid') ? 400 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async updateOverride(req, res) {
    try {
      const { overrideData, overrideNotes } = req.body;
      const actor = this._actor(req);

      const before = await this.cateringOrderService.getOrderById(req.params.id);
      const order  = await this.cateringOrderService.updateOverride(req.params.id, overrideData, overrideNotes);

      res.json({ success: true, data: CateringOrderMapper.toDTO(order), message: 'Order updated' });

      setImmediate(() =>
        this.auditService.logManualEdit(req.params.id, actor, before, { overrideNotes })
          .catch(e => console.error('⚠️  Audit log error:', e.message))
      );
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async updateManual(req, res) {
    try {
      const actor  = this._actor(req);
      const before = await this.cateringOrderService.getOrderById(req.params.id);
      const order  = await this.cateringOrderService.updateManual(req.params.id, req.body);
      const dto    = CateringOrderMapper.toDTO(order);

      res.json({ success: true, data: dto, message: 'Order updated manually' });

      setImmediate(() =>
        this.auditService.logManualEdit(req.params.id, actor, before, req.body)
          .catch(e => console.error('⚠️  Audit log error:', e.message))
      );
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async createManual(req, res) {
    try {
      const actor = this._actor(req);
      const order = await this.cateringOrderService.createManualOrder(req.body);

      res.status(201).json({
        success: true,
        data:    CateringOrderMapper.toDTO(order),
        message: 'Manual order created successfully',
      });

      setImmediate(() =>
        this.auditService.logOrderCreated(order.id, actor, {
          eventType:      order.eventType,
          clientName:     order.clientName,
          guestCount:     order.guestCount,
          totalAmount:    order.totalAmount,
          deliveryMethod: order.deliveryMethod,
        }).catch(e => console.error('⚠️  Audit log error:', e.message))
      );
    } catch (error) {
      const code = error.message.includes('required') ? 400 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async overridePaymentStatus(req, res) {
    try {
      const { paymentStatus } = req.body;
      const actor = this._actor(req);

      const before = await this.cateringOrderService.getOrderById(req.params.id);
      const order  = await this.cateringOrderService.overridePaymentStatus(req.params.id, paymentStatus);

      res.json({ success: true, data: CateringOrderMapper.toDTO(order), message: `Payment updated to ${paymentStatus}` });

      setImmediate(() =>
        this.auditService.logPaymentChange(req.params.id, actor, before.paymentStatus, paymentStatus)
          .catch(e => console.error('⚠️  Audit log error:', e.message))
      );
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 400;
      res.status(code).json({ success: false, error: error.message });
    }
  }
}

module.exports = CateringOrderController;