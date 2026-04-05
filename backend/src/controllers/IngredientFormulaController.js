// src/controllers/IngredientFormulaController.js
const IngredientFormulaMapper = require('../mappers/IngredientFormulaMapper');

class IngredientFormulaController {
  constructor(ingredientFormulaService) {
    this.service = ingredientFormulaService;
  }

  async getAll(req, res) {
    try {
      const { category, eventType, isActive } = req.query;
      const formulas = await this.service.getAll({
        category,
        eventType,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      });
      res.json({
        success: true,
        data: IngredientFormulaMapper.toDTOList(formulas),
        count: formulas.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const formula = await this.service.getById(req.params.id);
      res.json({ success: true, data: IngredientFormulaMapper.toDTO(formula) });
    } catch (error) {
      const status = error.message === 'Formula not found' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async create(req, res) {
    try {
      const formula = await this.service.create(req.body);
      res.status(201).json({
        success: true,
        data: IngredientFormulaMapper.toDTO(formula),
        message: 'Formula created successfully'
      });
    } catch (error) {
      const code = error.message.includes('required') ? 400 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async update(req, res) {
    try {
      const formula = await this.service.update(req.params.id, req.body);
      res.json({
        success: true,
        data: IngredientFormulaMapper.toDTO(formula),
        message: 'Formula updated successfully'
      });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Formula deleted successfully' });
    } catch (error) {
      const code = error.message.includes('not found') ? 404 : 500;
      res.status(code).json({ success: false, error: error.message });
    }
  }
}

module.exports = IngredientFormulaController;