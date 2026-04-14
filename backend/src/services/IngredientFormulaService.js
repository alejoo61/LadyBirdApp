// src/services/IngredientFormulaService.js

class IngredientFormulaService {
  constructor(ingredientFormulaRepository) {
    this.repo = ingredientFormulaRepository;
  }

  // ─── FORMULAS ─────────────────────────────────────────────────────────────

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

  async getByCanonicalNameAndEventType(canonicalName, eventType) {
    return this.repo.findByCanonicalNameAndEventType(canonicalName, eventType);
  }

  async getAllCanonicalNames() {
    return this.repo.findAllCanonicalNames();
  }

  async create(data) {
    this._validateFormula(data);
    // canonical_name default = name si no viene
    if (!data.canonicalName) data.canonicalName = data.name;
    return this.repo.create(data);
  }

  async update(id, data) {
    await this.getById(id); // verifica existencia
    this._validateFormula(data);
    if (!data.canonicalName) data.canonicalName = data.name;
    return this.repo.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return this.repo.delete(id);
  }

  _validateFormula(data) {
    if (!data.name && !data.canonicalName)
      throw new Error('name or canonicalName is required');
    if (!data.category)
      throw new Error('category is required');
    if (data.amountPerPerson === undefined || data.amountPerPerson === null)
      throw new Error('amountPerPerson is required');
    if (!data.unit)
      throw new Error('unit is required');
  }

  // ─── ALIASES ──────────────────────────────────────────────────────────────

  async getAllAliases(canonicalName = null) {
    return this.repo.findAllAliases(canonicalName);
  }

  async createAlias(canonicalName, alias) {
    if (!canonicalName || !alias)
      throw new Error('canonicalName and alias are required');
    return this.repo.createAlias(canonicalName, alias.trim());
  }

  async deleteAlias(id) {
    const deleted = await this.repo.deleteAlias(id);
    if (!deleted) throw new Error('Alias not found');
    return true;
  }
}

module.exports = IngredientFormulaService;