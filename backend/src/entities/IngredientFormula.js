// src/entities/IngredientFormula.js

class IngredientFormula {
  constructor({
    id, name, category, amountPerPerson, unit, utensil,
    smallPackage, smallPackageMax, largePackage, largePackageMax,
    tempType, eventTypes, isActive, createdAt, updatedAt
  }) {
    this.id              = id;
    this.name            = name;
    this.category        = category;
    this.amountPerPerson = parseFloat(amountPerPerson) || 0;
    this.unit            = unit;
    this.utensil         = utensil;
    this.smallPackage    = smallPackage;
    this.smallPackageMax = smallPackageMax;
    this.largePackage    = largePackage;
    this.largePackageMax = largePackageMax;
    this.tempType        = tempType;
    this.eventTypes      = eventTypes || [];
    this.isActive        = isActive;
    this.createdAt       = createdAt;
    this.updatedAt       = updatedAt;
  }

  // Calcula la cantidad total para N personas
  calculateAmount(guestCount) {
    return Math.ceil(this.amountPerPerson * guestCount);
  }

  // Determina si necesita envase grande o chico
  getPackaging(guestCount) {
    const total = this.calculateAmount(guestCount);
    if (this.largePackageMax && total > this.smallPackageMax) {
      const qty = Math.ceil(total / this.largePackageMax);
      return { package: this.largePackage, qty, total };
    }
    const qty = Math.ceil(total / (this.smallPackageMax || 1));
    return { package: this.smallPackage, qty, total };
  }

  appliesTo(eventType) {
    return this.eventTypes.includes(eventType);
  }

  getCategoryLabel() {
    const labels = {
      protein:  'Proteins',
      topping:  'Toppings',
      salsa:    'Salsas',
      tortilla: 'Tortillas',
      snack:    'Snacks',
      drink:    'Drinks',
    };
    return labels[this.category] || this.category;
  }
}

module.exports = IngredientFormula;