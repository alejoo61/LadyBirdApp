// src/mappers/IngredientFormulaMapper.js
const IngredientFormula = require('../entities/IngredientFormula');

class IngredientFormulaMapper {
  static toDomain(row) {
    if (!row) return null;

    const singularType = row.event_type ? [row.event_type] : [];
    const arrayTypes   = row.event_types || [];
    const eventTypes   = [...new Set([...arrayTypes, ...singularType])];

    return new IngredientFormula({
      id:              row.id,
      name:            row.name,
      canonicalName:   row.canonical_name || row.name,
      category:        row.category,
      amountPerPerson: parseFloat(row.amount_per_person) || 0,
      unit:            row.unit,
      utensil:         row.utensil,
      smallPackage:    row.small_package,
      smallPackageMax: row.small_package_max,
      largePackage:    row.large_package,
      largePackageMax: row.large_package_max,
      tempType:        row.temp_type,
      eventType:       row.event_type,
      eventTypes,
      isActive:        row.is_active,
      createdAt:       row.created_at,
      updatedAt:       row.updated_at,
    });
  }

  static toDTO(formula) {
    if (!formula) return null;
    const f = formula instanceof IngredientFormula ? formula : this.toDomain(formula);
    return {
      id:              f.id,
      name:            f.name,
      canonicalName:   f.canonicalName,
      category:        f.category,
      categoryLabel:   typeof f.getCategoryLabel === 'function' ? f.getCategoryLabel() : f.category,
      amountPerPerson: f.amountPerPerson,
      unit:            f.unit,
      utensil:         f.utensil,
      smallPackage:    f.smallPackage,
      smallPackageMax: f.smallPackageMax,
      largePackage:    f.largePackage,
      largePackageMax: f.largePackageMax,
      tempType:        f.tempType,
      eventType:       f.eventType,
      eventTypes:      f.eventTypes,
      isActive:        f.isActive,
      createdAt:       f.createdAt,
    };
  }

  static toDTOList(formulas) {
    if (!Array.isArray(formulas)) return [];
    return formulas.map(f => this.toDTO(f));
  }

  static aliasToDTO(row) {
    if (!row) return null;
    return {
      id:            row.id,
      canonicalName: row.canonical_name,
      alias:         row.alias,
      createdAt:     row.created_at,
    };
  }
}

module.exports = IngredientFormulaMapper;