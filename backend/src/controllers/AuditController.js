// src/controllers/AuditController.js

class AuditController {
  constructor(auditService) {
    this.auditService = auditService;
  }

  // GET /api/audit/orders/:orderId
  async getByOrderId(req, res) {
    try {
      const logs = await this.auditService.getByOrderId(req.params.orderId);
      res.json({ success: true, data: logs, count: logs.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/audit?actor=alejandro&action=MANUAL_EDIT&limit=50
  async getAll(req, res) {
    try {
      const { actor, action, limit = 100, offset = 0 } = req.query;
      const logs = await this.auditService.getAll({
        actor,
        action,
        limit:  parseInt(limit),
        offset: parseInt(offset),
      });
      res.json({ success: true, data: logs, count: logs.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = AuditController;