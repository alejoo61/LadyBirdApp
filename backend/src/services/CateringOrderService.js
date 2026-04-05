// src/services/CateringOrderService.js

class CateringOrderService {
  constructor(cateringOrderRepository) {
    this.cateringOrderRepository = cateringOrderRepository;
  }

  async getAll(filters = {}) {
    return this.cateringOrderRepository.findAll(filters);
  }

  async getAllOrders(filters = {}) {
    return this.cateringOrderRepository.findAll(filters);
  }

  async getOrderById(id) {
    const order = await this.cateringOrderRepository.findById(id);
    if (!order) throw new Error('Order not found');
    return order;
  }

  async updateStatus(id, status) {
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    await this.getOrderById(id);
    return this.cateringOrderRepository.updateStatus(id, status);
  }

  async updateOverride(id, overrideData, overrideNotes) {
    await this.getOrderById(id);
    return this.cateringOrderRepository.updateOverride(id, overrideData, overrideNotes);
  }

  async createManualOrder(data) {
    if (!data.clientName || !data.eventType || !data.estimatedFulfillmentDate) {
      throw new Error('clientName, eventType and estimatedFulfillmentDate are required');
    }
    return this.cateringOrderRepository.create(data);
  }

  async overridePaymentStatus(id, paymentStatus) {
    const validStatuses = ['OPEN', 'PAID', 'CLOSED'];
    if (!validStatuses.includes(paymentStatus)) {
      throw new Error(`Invalid payment status: ${paymentStatus}`);
    }
    await this.getOrderById(id);
    return this.cateringOrderRepository.updatePaymentStatus(id, paymentStatus);
  }
}

module.exports = CateringOrderService;