// src/services/FulfillmentSheetCalculator.js

// Mapeo de nombres de ingredientes en Toast → nombres en las fórmulas
const INGREDIENT_NAME_MAP = {
  // Proteins
  'salsa verde braised chicken (taco bar)': 'Salsa Verde Braised Chicken',
  'house-smoked brisket (taco bar)':        'House-smoked Brisket',
  'house-smoked brisket (+premium)':        'House-smoked Brisket',
  'adobo chicken (taco bar)':               'Adobo Chicken',
  'chorizo (taco bar)':                     'Chorizo',
  'tenderbelly bacon (taco bar)':           'Tenderbelly Bacon',
  'egg (taco bar)':                         'Egg',

  // Toppings
  'black beans (taco bar)':         'Black Beans',
  'rajas (taco bar)':               'Rajas',
  'sliced avocado (taco bar)':      'Sliced Avocado',
  'pico de gallo (taco bar)':       'Pico De Gallo',
  'monterrey jack cheese (taco bar)':'Shredded Cheese',
  'cotija (taco bar)':              'Cotija',
  'shredded cabbage (taco bar)':    'Cabbage',
  'pickled red onion (taco bar)':   'Pickled Onions',
  'crispy potato (taco bar)':       'Crispy Potato',

  // Salsas
  'salsa roja (mild)':              'Salsa Roja',
  'salsa verde (mild-med)':         'Salsa Verde',
  'verde (mild-med)':               'Salsa Verde',
  'patron (spicy)':                 'Patron',

  // Tortillas
  'flour tortillas (catering)':     'Flour Tortillas',
  'housemade flour tortilla':       'Flour Tortillas',
  '50/50 flour/corn (catering)':    '50/50',
  '50/50 flour & corn':             '50/50',
  'corn tortillas (catering)':      'Corn Tortillas',
  'housemade corn tortillas':       'Corn Tortillas',

  // Snacks
  'queso (taco bar)':               'Queso',
  'guacamole (taco bar)':           'Guac',
};

class FulfillmentSheetCalculator {
  constructor(ingredientFormulaRepository) {
    this.formulaRepo = ingredientFormulaRepository;
  }

  async calculate(cateringOrder) {
    const { eventType, guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    // Cargar fórmulas activas para este event type
    const formulas = await this.formulaRepo.findByEventType(eventType);
    const formulaMap = new Map(formulas.map(f => [f.name.toLowerCase(), f]));

    // Extraer ingredientes seleccionados de los items
    const selectedIngredients = this._extractIngredients(items, eventType);

    // Calcular cantidades para cada ingrediente seleccionado
    const calculated = [];
    for (const ingredient of selectedIngredients) {
      const normalizedName = INGREDIENT_NAME_MAP[ingredient.name.toLowerCase()];
      if (!normalizedName) continue;

      const formula = formulaMap.get(normalizedName.toLowerCase());
      if (!formula) continue;

      const totalAmount = formula.calculateAmount(guestCount);
      const packaging   = formula.getPackaging(guestCount);

      calculated.push({
        name:          normalizedName,
        category:      formula.category,
        tempType:      formula.tempType,
        unit:          formula.unit,
        utensil:       formula.utensil,
        amountPerPerson: formula.amountPerPerson,
        totalAmount,
        packaging:     packaging.package,
        packagingQty:  packaging.qty,
        selectedInOrder: true,
      });
    }

    // También incluir salsas incluidas por defecto (si no están ya)
    const defaultSalsas = this._getDefaultSalsas(items, formulas, guestCount, calculated);
    calculated.push(...defaultSalsas);

    // Agrupar por categoría
    const grouped = this._groupByCategory(calculated);

    // Calcular tortillas
    const tortillas = this._calculateTortillas(items, guestCount, formulas);

    // Paper goods
    const paperGoods = this._calculatePaperGoods(items, guestCount);

    // Determinar snacks elegidos
    const snacks = this._extractSnacks(items, guestCount, formulas);

    return {
      header: {
        orderNumber:             cateringOrder.displayNumber,
        eventType,
        clientName:              cateringOrder.clientName,
        clientContact:           cateringOrder.clientEmail,
        clientPhone:             cateringOrder.clientPhone,
        guestCount,
        estimatedFulfillmentDate: cateringOrder.estimatedFulfillmentDate,
        kitchenFinishTime:       cateringOrder.kitchenFinishTime,
        deliveryMethod:          cateringOrder.deliveryMethod,
        deliveryAddress:         cateringOrder.deliveryAddress,
        deliveryNotes:           delivery.notes || cateringOrder.deliveryNotes,
        storeName:               cateringOrder.storeName,
        storeCode:               cateringOrder.storeCode,
      },
      proteins:   grouped.protein   || [],
      toppings:   grouped.topping   || [],
      salsas:     grouped.salsa     || [],
      tortillas,
      snacks,
      paperGoods,
      hotItems:   calculated.filter(i => i.tempType === 'hot'),
      coldItems:  calculated.filter(i => i.tempType === 'cold'),
      dryItems:   calculated.filter(i => i.tempType === 'dry'),
    };
  }

  // Extrae todos los modificadores de los items que son ingredientes
  _extractIngredients(items, eventType) {
    const ingredients = [];
    for (const item of items) {
      // El item principal puede ser un ingrediente
      const mainName = (item.displayName || '').toLowerCase();
      if (INGREDIENT_NAME_MAP[mainName]) {
        ingredients.push({ name: item.displayName, quantity: item.quantity });
      }
      // Los modificadores contienen los ingredientes
      for (const mod of item.modifiers || []) {
        const modName = (mod.displayName || '').toLowerCase();
        if (INGREDIENT_NAME_MAP[modName]) {
          ingredients.push({ name: mod.displayName, quantity: mod.quantity });
        }
      }
    }
    return ingredients;
  }

  _getDefaultSalsas(items, formulas, guestCount, alreadyCalculated) {
    const calculatedNames = new Set(alreadyCalculated.map(i => i.name.toLowerCase()));
    const salsaFormulas   = formulas.filter(f => f.category === 'salsa');
    const result          = [];

    for (const salsa of salsaFormulas) {
      if (calculatedNames.has(salsa.name.toLowerCase())) continue;

      // Verificar si esta salsa fue elegida en el order
      const wasChosen = items.some(item =>
        (item.modifiers || []).some(mod => {
          const norm = INGREDIENT_NAME_MAP[(mod.displayName || '').toLowerCase()];
          return norm && norm.toLowerCase() === salsa.name.toLowerCase();
        })
      );

      if (wasChosen) {
        const packaging = salsa.getPackaging(guestCount);
        result.push({
          name:          salsa.name,
          category:      'salsa',
          tempType:      salsa.tempType,
          unit:          salsa.unit,
          utensil:       salsa.utensil,
          totalAmount:   salsa.calculateAmount(guestCount),
          packaging:     packaging.package,
          packagingQty:  packaging.qty,
          selectedInOrder: true,
        });
      }
    }
    return result;
  }

  _calculateTortillas(items, guestCount, formulas) {
    const result = [];
    let flourCount = 0;
    let cornCount  = 0;
    let is5050     = false;

    for (const item of items) {
      for (const mod of item.modifiers || []) {
        const name = (mod.displayName || '').toLowerCase();
        if (name.includes('flour tortilla') || name === 'housemade flour tortilla') {
          flourCount += guestCount * 2;
        } else if (name.includes('corn tortilla') || name === 'housemade corn tortillas') {
          cornCount += guestCount * 2;
        } else if (name.includes('50/50')) {
          is5050 = true;
          flourCount += guestCount;
          cornCount  += guestCount;
        }
      }
    }

    const flourFormula = formulas.find(f => f.name === 'Flour Tortillas');
    const cornFormula  = formulas.find(f => f.name === 'Corn Tortillas');

    if (flourCount > 0 && flourFormula) {
      result.push({
        name:         is5050 ? 'Flour Tortillas (50/50)' : 'Flour Tortillas',
        total:        flourCount,
        packaging:    flourCount > flourFormula.smallPackageMax ? flourFormula.largePackage : flourFormula.smallPackage,
        packagingQty: Math.ceil(flourCount / (flourCount > flourFormula.smallPackageMax ? flourFormula.largePackageMax : flourFormula.smallPackageMax)),
        utensil:      flourFormula.utensil,
        tempType:     'hot',
      });
    }

    if (cornCount > 0 && cornFormula) {
      result.push({
        name:         is5050 ? 'Corn Tortillas (50/50)' : 'Corn Tortillas',
        total:        cornCount,
        packaging:    cornCount > cornFormula.smallPackageMax ? cornFormula.largePackage : cornFormula.smallPackage,
        packagingQty: Math.ceil(cornCount / (cornCount > cornFormula.smallPackageMax ? cornFormula.largePackageMax : cornFormula.smallPackageMax)),
        utensil:      cornFormula.utensil,
        tempType:     'hot',
      });
    }

    return result;
  }

  _extractSnacks(items, guestCount, formulas) {
    const snacks = [];
    const snackKeywords = ['queso', 'guac', 'chips'];

    for (const item of items) {
      const name = (item.displayName || '').toLowerCase();
      for (const keyword of snackKeywords) {
        if (name.includes(keyword)) {
          const formula = formulas.find(f =>
            f.category === 'snack' &&
            f.name.toLowerCase().includes(keyword)
          );
          if (formula) {
            const total    = formula.calculateAmount(guestCount);
            const packaging = formula.getPackaging(guestCount);
            snacks.push({
              name:         formula.name,
              total,
              unit:         formula.unit,
              packaging:    packaging.package,
              packagingQty: packaging.qty,
              utensil:      formula.utensil,
              tempType:     formula.tempType,
            });
          }
          break;
        }
      }
    }

    return snacks;
  }

  _calculatePaperGoods(items, guestCount) {
    const wantsPaper = items.some(item =>
      (item.modifiers || []).some(mod => {
        const name = (mod.displayName || '').toLowerCase();
        return name.includes('yes, i want paper') || name.includes('yes, i want paper goods') || name.includes('yes! i want paper');
      })
    );

    if (!wantsPaper) return { included: false, items: [] };

    return {
      included: true,
      items: [
        { name: 'Plates',         qty: guestCount,       package: 'Stack' },
        { name: 'Napkins',        qty: guestCount * 2,   package: 'Bundle' },
        { name: 'Forks',          qty: guestCount,       package: 'Bundle' },
        { name: 'Tongs Small',    qty: 2,                package: 'each' },
        { name: 'Serving Spoons', qty: 2,                package: 'each' },
      ]
    };
  }

  _groupByCategory(items) {
    return items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }
}

module.exports = FulfillmentSheetCalculator;