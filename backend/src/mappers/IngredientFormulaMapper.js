// src/mappers/IngredientFormulaMapper.js
const IngredientFormula = require('../entities/IngredientFormula');

class IngredientFormulaMapper {
  static toDomain(row) {
    if (!row) return null;
    return new IngredientFormula({
      id:              row.id,
      name:            row.name,
      category:        row.category,
      amountPerPerson: row.amount_per_person,
      unit:            row.unit,
      utensil:         row.utensil,
      smallPackage:    row.small_package,
      smallPackageMax: row.small_package_max,
      largePackage:    row.large_package,
      largePackageMax: row.large_package_max,
      tempType:        row.temp_type,
      eventTypes:      row.event_types,
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
      category:        f.category,
      categoryLabel:   f.getCategoryLabel(),
      amountPerPerson: f.amountPerPerson,
      unit:            f.unit,
      utensil:         f.utensil,
      smallPackage:    f.smallPackage,
      smallPackageMax: f.smallPackageMax,
      largePackage:    f.largePackage,
      largePackageMax: f.largePackageMax,
      tempType:        f.tempType,
      eventTypes:      f.eventTypes,
      isActive:        f.isActive,
      createdAt:       f.createdAt,
    };
  }

  static toDTOList(formulas) {
    if (!Array.isArray(formulas)) return [];
    return formulas.map(f => this.toDTO(f));
  }
}

module.exports = IngredientFormulaMapper;