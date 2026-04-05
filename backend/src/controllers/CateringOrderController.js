// src/controllers/CateringOrderController.js
const CateringOrderMapper = require('../mappers/CateringOrderMapper');

class CateringOrderController {
  constructor(cateringOrderService) {
    this.cateringOrderService = cateringOrderService;
  }

  async getAll(req, res) {
    try {
      const { storeId, eventType, status, deliveryMethod, dateFrom, dateTo, paymentStatus } = req.query;
      const orders = await this.cateringOrderService.getAll({
        storeId,
        eventType,
        status,
        paymentStatus,
        deliveryMethod,
        dateFrom,
        dateTo,
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
      res.json({
        success: true,
        data: {
          ...dto,
          storeName: order.storeName,
          storeCode: order.storeCode,
        }
      });
    } catch (error) {
      const status = error.message === 'Order not found' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const order = await this.cateringOrderService.updateStatus(req.params.id, status);
      res.json({
        success: true,
        data: CateringOrderMapper.toDTO(order),
        message: 'Status updated successfully'
      });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 :
                   error.message.includes('Invalid') ? 400 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async updateOverride(req, res) {
    try {
      const { overrideData, overrideNotes } = req.body;
      const order = await this.cateringOrderService.updateOverride(
        req.params.id, overrideData, overrideNotes
      );
      res.json({
        success: true,
        data: CateringOrderMapper.toDTO(order),
        message: 'Order updated successfully'
      });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async createManual(req, res) {
    try {
      const order = await this.cateringOrderService.createManualOrder(req.body);
      res.status(201).json({
        success: true,
        data: CateringOrderMapper.toDTO(order),
        message: 'Manual order created successfully'
      });
    } catch (error) {
      const code = error.message.includes('required') ? 400 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async overridePaymentStatus(req, res) {
    try {
      const { paymentStatus } = req.body;
      const order = await this.cateringOrderService.overridePaymentStatus(req.params.id, paymentStatus);
      res.json({
        success: true,
        data: CateringOrderMapper.toDTO(order),
        message: `Payment status updated to ${paymentStatus}`
      });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 400;
      res.status(code).json({ success: false, error: error.message });
    }
  }
}

module.exports = CateringOrderController;