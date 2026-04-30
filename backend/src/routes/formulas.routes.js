// src/routes/formulas.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (ingredientFormulaController) => {
  // Rutas específicas ANTES de /:id para evitar colisiones
  router.get('/aliases',          (req, res) => ingredientFormulaController.getAllAliases(req, res));
  router.post('/aliases',         (req, res) => ingredientFormulaController.createAlias(req, res));
  router.delete('/aliases/:id',   (req, res) => ingredientFormulaController.deleteAlias(req, res));
  router.get('/canonical-names',  (req, res) => ingredientFormulaController.getCanonicalNames(req, res));

  router.get('/',       (req, res) => ingredientFormulaController.getAll(req, res));
  router.get('/:id',    (req, res) => ingredientFormulaController.getById(req, res));
  router.post('/',      (req, res) => ingredientFormulaController.create(req, res));
  router.put('/:id',    (req, res) => ingredientFormulaController.update(req, res));
  router.delete('/:id', (req, res) => ingredientFormulaController.delete(req, res));

  return router;
};