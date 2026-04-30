// src/routes/menu.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (menuItemController) => {
  router.get('/',                            (req, res) => menuItemController.getAll(req, res));
  router.get('/event/:eventType',            (req, res) => menuItemController.getByEventType(req, res));
  router.get('/order-creation/:eventType',   (req, res) => menuItemController.getForOrderCreation(req, res));
  router.post('/',                           (req, res) => menuItemController.create(req, res));
  router.put('/:id',                         (req, res) => menuItemController.update(req, res));
  router.delete('/:id',                      (req, res) => menuItemController.delete(req, res));
  return router;
};