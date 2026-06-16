// src/routes/equipment.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (equipmentController) => {
  // ── CRUD base ─────────────────────────────────────────────────────────────
  router.get('/',                       (req, res) => equipmentController.getAll(req, res));
  router.get('/types',                  (req, res) => equipmentController.getTypes(req, res));
  router.get('/type-catalog',           (req, res) => equipmentController.getTypeCatalog(req, res));
  router.get('/qr/:code',               (req, res) => equipmentController.getByCode(req, res));
  router.get('/:id',                    (req, res) => equipmentController.getById(req, res));
  router.post('/',                      (req, res) => equipmentController.create(req, res));
  router.post('/batch',                 (req, res) => equipmentController.createBatch(req, res));
  router.put('/:id',                    (req, res) => equipmentController.update(req, res));
  router.delete('/:id',                 (req, res) => equipmentController.delete(req, res));

  // ── Status ────────────────────────────────────────────────────────────────
  router.patch('/:id/mark-down',        (req, res) => equipmentController.markAsDown(req, res));
  router.patch('/:id/mark-operational', (req, res) => equipmentController.markAsOperational(req, res));

  // ── Transfer ──────────────────────────────────────────────────────────────
  router.post('/:id/transfer',          (req, res) => equipmentController.transfer(req, res));
  router.get('/:id/history',            (req, res) => equipmentController.getHistory(req, res));

  return router;
};