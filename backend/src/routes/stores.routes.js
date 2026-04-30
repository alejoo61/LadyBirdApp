// src/routes/stores.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (storeController) => {
  router.get('/',        (req, res) => storeController.getAll(req, res));
  router.get('/:id',     (req, res) => storeController.getById(req, res));
  router.post('/',       (req, res) => storeController.create(req, res));
  router.put('/:id',     (req, res) => storeController.update(req, res));
  router.delete('/:id',  (req, res) => storeController.delete(req, res));
  return router;
};