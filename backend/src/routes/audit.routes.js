// src/routes/audit.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (auditController) => {
  // GET /api/audit/orders/:orderId — logs de una orden específica
  router.get('/orders/:orderId', (req, res) => auditController.getByOrderId(req, res));

  // GET /api/audit?actor=alejandro&action=MANUAL_EDIT&limit=50
  router.get('/', (req, res) => auditController.getAll(req, res));

  return router;
};