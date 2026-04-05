// src/services/IngredientFormulaService.js

class IngredientFormulaService {
  constructor(ingredientFormulaRepository) {
    this.repo = ingredientFormulaRepository;
  }

  async getAll(filters = {}) {
    return this.repo.findAll(filters);
  }

  async getById(id) {
    const formula = await this.repo.findById(id);
    if (!formula) throw new Error('Formula not found');
    return formula;
  }

  async getByEventType(eventType) {
    return this.repo.findByEventType(eventType);
  }

  async create(data) {
    if (!data.name || !data.category || !data.amountPerPerson) {
      throw new Error('name, category and amountPerPerson are required');
    }
    return this.repo.create(data);
  }

  async update(id, data) {
    await this.getById(id);
    return this.repo.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return this.repo.delete(id);
  }
}

module.exports = IngredientFormulaService;