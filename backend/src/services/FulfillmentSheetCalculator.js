// src/services/FulfillmentSheetCalculator.js

const INGREDIENT_NAME_MAP = {
  // Proteins
  'salsa verde braised chicken (taco bar)': 'Salsa Verde Braised Chicken',
  'house-smoked brisket (taco bar)':        'House-smoked Brisket',
  'house-smoked brisket (+premium)':        'House-smoked Brisket',
  'adobo chicken (taco bar)':               'Adobo Chicken',
  'chorizo (taco bar)':                     'Chorizo',
  'tenderbelly bacon (taco bar)':           'Tenderbelly Bacon',
  'egg (taco bar)':                         'Egg',
  'eggs (taco bar)':                        'Egg',
  'potato (taco bar)':                      'Crispy Potato',

  // Toppings
  'black beans (taco bar)':          'Black Beans',
  'rajas (taco bar)':                'Rajas',
  'sliced avocado (taco bar)':       'Sliced Avocado',
  'pico de gallo (taco bar)':        'Pico De Gallo',
  'monterrey jack cheese (taco bar)':'Shredded Cheese',
  'cotija (taco bar)':               'Cotija',
  'shredded cabbage (taco bar)':     'Cabbage',
  'pickled red onion (taco bar)':    'Pickled Onions',
  'crispy potato (taco bar)':        'Crispy Potato',

  // Salsas
  'salsa roja (mild)':    'Salsa Roja',
  'salsa verde (mild-med)':'Salsa Verde',
  'verde (mild-med)':     'Salsa Verde',
  'patron (spicy)':       'Patron',
  'roja (mild) 0.75 oz cup': 'Salsa Roja',

  // Tortillas
  'flour tortillas (catering)':  'Flour Tortillas',
  'housemade flour tortilla':    'Flour Tortillas',
  'housemade flour tortillas':   'Flour Tortillas',
  '50/50 flour/corn (catering)': '50/50',
  '50/50 flour & corn':          '50/50',
  'corn tortillas (catering)':   'Corn Tortillas',
  'housemade corn tortillas':    'Corn Tortillas',

  // Snacks
  'queso (taco bar)':    'Queso',
  'guacamole (taco bar)':'Guac',
};

// Combos predefinidos Bird Box / Wrapped Tacos
// Mapeamos el nombre del combo a sus ingredientes para el fulfillment
const COMBO_INGREDIENT_MAP = {
  '#1 bacon, egg, & cheese*':                    ['Tenderbelly Bacon', 'Egg', 'Shredded Cheese'],
  '#2 potato, egg, & cheese*':                   ['Crispy Potato', 'Egg', 'Shredded Cheese'],
  '#3 bacon, egg, & potato*':                    ['Tenderbelly Bacon', 'Egg', 'Crispy Potato'],
  '#4 chorizo, egg, & cheese*':                  ['Chorizo', 'Egg', 'Shredded Cheese'],
  '#5 flour':                                    ['Flour Tortillas'],
  '#6 flour':                                    ['Flour Tortillas'],
  '#7 brisket, potato, rajas, queso*':           ['House-smoked Brisket', 'Crispy Potato', 'Rajas', 'Queso'],
  '#8 brisket, avocado, pico*':                  ['House-smoked Brisket', 'Sliced Avocado', 'Pico De Gallo'],
  '#9 salsa verde braised chicken, cotija, pickled onion*': ['Salsa Verde Braised Chicken', 'Cotija', 'Pickled Onions'],
  '#10 adobo chicken, spicy pickled onion, avocado, crema *': ['Adobo Chicken', 'Pickled Onions', 'Sliced Avocado'],
  '#11 flour':                                   ['Flour Tortillas'],
  '#12 adobo chicken, spicy pickled onion, avocado, crema *': ['Adobo Chicken', 'Pickled Onions', 'Sliced Avocado'],
  '#2 corn':                                     ['Corn Tortillas'],
  '#11 corn':                                    ['Corn Tortillas'],
};

class FulfillmentSheetCalculator {
  constructor(ingredientFormulaRepository) {
    this.formulaRepo = ingredientFormulaRepository;
  }

  async calculate(cateringOrder) {
    const { eventType } = cateringOrder;

    switch (eventType) {
      case 'TACO_BAR':     return this._calculateTacoBar(cateringOrder);
      case 'BIRD_BOX':     return this._calculateBirdBox(cateringOrder);
      case 'PERSONAL_BOX': return this._calculatePersonalBox(cateringOrder);
      case 'FOODA':        return this._calculateFooda(cateringOrder);
      default:             return this._calculateTacoBar(cateringOrder);
    }
  }

  // ─── TACO BAR ─────────────────────────────────────────────────────────────
  async _calculateTacoBar(cateringOrder) {
    const { guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const formulas = await this.formulaRepo.findByEventType('TACO_BAR');
    const formulaMap = new Map(formulas.map(f => [f.name.toLowerCase(), f]));

    const selectedIngredients = this._extractIngredients(items);
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
        totalAmount,
        packaging:     packaging.package,
        packagingQty:  packaging.qty,
      });
    }

    const defaultSalsas = this._getDefaultSalsas(items, formulas, guestCount, calculated);
    calculated.push(...defaultSalsas);

    const grouped   = this._groupByCategory(calculated);
    const tortillas = this._calculateTortillas(items, guestCount, formulas);
    const paperGoods = this._calculatePaperGoods(items, guestCount);
    const snacks    = this._extractSnacks(items, guestCount, formulas);

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      proteins:  grouped.protein  || [],
      toppings:  grouped.topping  || [],
      salsas:    grouped.salsa    || [],
      tortillas,
      snacks,
      paperGoods,
      hotItems:  calculated.filter(i => i.tempType === 'hot'),
      coldItems: calculated.filter(i => i.tempType === 'cold'),
      dryItems:  calculated.filter(i => i.tempType === 'dry'),
    };
  }

  // ─── BIRD BOX ─────────────────────────────────────────────────────────────
  async _calculateBirdBox(cateringOrder) {
    const { guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    // Extraer combos y tamaños de cada Bird Box
    const boxes = [];
    let totalTacos = 0;

    for (const item of items) {
      const modifiers = item.modifiers || [];

      // Buscar tamaño del box (ej: "Breakfast 'Bird Box - 50 Tacos")
      const sizeMod = modifiers.find(m =>
        /\d+\s*tacos?/i.test(m.displayName)
      );
      const tacoCount = sizeMod
        ? parseInt(sizeMod.displayName.match(/(\d+)\s*tacos?/i)?.[1] || 0)
        : guestCount * 2;

      totalTacos += tacoCount * (item.quantity || 1);

      // Extraer combos (#1, #2, etc.)
      const combos = modifiers.filter(m =>
        /^#\d+/i.test(m.displayName.trim())
      );

      // Tortilla
      const tortillaMod = modifiers.find(m => {
        const n = m.displayName.toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      // Chips & salsa
      const wantsChips = modifiers.some(m =>
        m.displayName.toLowerCase().includes('yes! i would like the included chips')
      );

      // Paper goods
      const wantsPaper = modifiers.some(m =>
        m.displayName.toLowerCase().includes('yes, i want paper')
      );

      boxes.push({
        name:      item.displayName,
        quantity:  item.quantity || 1,
        tacoCount,
        combos:    combos.map(c => c.displayName),
        tortilla:  tortillaMod?.displayName || 'Flour Tortillas',
        wantsChips,
        wantsPaper,
      });
    }

    // Calcular tacos por combo
    const tacoRows = [];
    const comboTotals = {};

    for (const box of boxes) {
      const tacosPerCombo = box.combos.length > 0
        ? Math.ceil(box.tacoCount / box.combos.length)
        : box.tacoCount;

      for (const combo of box.combos) {
        const key = combo;
        comboTotals[key] = (comboTotals[key] || 0) + (tacosPerCombo * box.quantity);
      }
    }

    for (const [combo, total] of Object.entries(comboTotals)) {
      const tortType = combo.toLowerCase().includes('corn') ? 'corn' : 'flour';
      tacoRows.push({
        name:         combo,
        total,
        unit:         'tacos',
        packaging:    'Half Pan',
        packagingQty: Math.ceil(total / 50),
        utensil:      'Tongs Small',
        tempType:     'hot',
        tortilla:     tortType,
      });
    }

    // Tortillas totales
    let flourTotal = 0;
    let cornTotal  = 0;
    for (const box of boxes) {
      const t = box.tortilla.toLowerCase();
      if (t.includes('50/50')) {
        flourTotal += Math.ceil(box.tacoCount / 2) * box.quantity;
        cornTotal  += Math.ceil(box.tacoCount / 2) * box.quantity;
      } else if (t.includes('corn')) {
        cornTotal += box.tacoCount * box.quantity;
      } else {
        flourTotal += box.tacoCount * box.quantity;
      }
    }

    const tortillas = [];
    if (flourTotal > 0) tortillas.push({ name: 'Flour Tortillas', total: flourTotal, unit: 'each', packaging: flourTotal > 60 ? 'Full Pan' : 'Half Pan', packagingQty: Math.ceil(flourTotal / (flourTotal > 60 ? 160 : 60)), utensil: 'Tongs Small', tempType: 'hot' });
    if (cornTotal > 0)  tortillas.push({ name: 'Corn Tortillas',  total: cornTotal,  unit: 'each', packaging: cornTotal > 30  ? 'Full Pan' : 'Half Pan', packagingQty: Math.ceil(cornTotal  / (cornTotal  > 30  ? 80  : 30)),  utensil: 'Tongs Small', tempType: 'hot' });

    // Chips & salsa
    const wantsChips = boxes.some(b => b.wantsChips);
    const snacks = wantsChips ? [{
      name: 'Chips', total: 1, unit: 'Full Pan',
      packaging: 'Full Pan', packagingQty: 1,
      utensil: 'Tongs Large', tempType: 'dry',
    }, {
      name: 'Salsa Roja', total: guestCount, unit: 'oz-fl',
      packaging: guestCount > 12 ? '32 oz deli cup' : '6 oz cup',
      packagingQty: Math.ceil(guestCount / (guestCount > 12 ? 32 : 6)),
      utensil: 'Ladle', tempType: 'cold',
    }] : [];

    // Paper goods
    const wantsPaper = boxes.some(b => b.wantsPaper);
    const paperGoods = wantsPaper ? {
      included: true,
      items: [
        { name: 'Plates',      qty: guestCount,     package: 'Stack' },
        { name: 'Napkins',     qty: guestCount * 2, package: 'Bundle' },
        { name: 'Fork Small',  qty: guestCount,     package: 'Bundle' },
      ]
    } : { included: false, items: [] };

    const allItems = [...tacoRows, ...tortillas, ...snacks];

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      boxes,
      tacoRows,
      tortillas,
      snacks,
      paperGoods,
      totalTacos,
      hotItems:  allItems.filter(i => i.tempType === 'hot'),
      coldItems: allItems.filter(i => i.tempType === 'cold'),
      dryItems:  allItems.filter(i => i.tempType === 'dry'),
      // Para compatibilidad con el generador
      proteins:  [],
      toppings:  [],
      salsas:    [],
    };
  }

  // ─── PERSONAL BOX ─────────────────────────────────────────────────────────
  async _calculatePersonalBox(cateringOrder) {
    const { guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    // Cada item es un box individual con nombre y mods
    const personalBoxes = [];

    for (const item of items) {
      const modifiers = item.modifiers || [];
      const combo = modifiers.find(m => /^#\d+/i.test(m.displayName.trim()));
      const tortilla = modifiers.find(m => {
        const n = m.displayName.toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });
      const extras = modifiers
        .filter(m => m !== combo && m !== tortilla)
        .map(m => m.displayName);

      for (let i = 0; i < (item.quantity || 1); i++) {
        personalBoxes.push({
          combo:    combo?.displayName || item.displayName,
          tortilla: tortilla?.displayName || 'Flour',
          extras:   extras.join(', '),
          mode:     item.displayName,
        });
      }
    }

    // Paper goods
    const wantsPaper = items.some(item =>
      (item.modifiers || []).some(m =>
        m.displayName.toLowerCase().includes('yes, i want paper')
      )
    );

    const paperGoods = wantsPaper ? {
      included: true,
      items: [
        { name: 'Napkin Pack', qty: personalBoxes.length, package: 'each' },
        { name: 'Fork Small',  qty: personalBoxes.length, package: 'each' },
        { name: 'Spoon Small', qty: personalBoxes.length, package: 'each' },
      ]
    } : { included: false, items: [] };

    return {
      header:        this._buildHeader(cateringOrder, delivery),
      personalBoxes,
      paperGoods,
      proteins:  [],
      toppings:  [],
      salsas:    [],
      tortillas: [],
      snacks:    [],
      hotItems:  [],
      coldItems: [],
      dryItems:  [],
    };
  }

  // ─── FOODA ────────────────────────────────────────────────────────────────
  async _calculateFooda(cateringOrder) {
    const { guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    // Extraer snacks/sides de Fooda
    const snacks = [];
    const tacoRows = [];

    for (const item of items) {
      const name = (item.displayName || '').toLowerCase();

      if (name.includes('chip') || name.includes('fooda')) {
        snacks.push({
          name:         item.displayName,
          total:        item.quantity,
          unit:         'each',
          packaging:    'black box bin',
          packagingQty: item.quantity,
          utensil:      '-',
          tempType:     'dry',
          type:         'dry',
        });
      } else if (name.includes('taco') || /^#\d+/.test(item.displayName.trim())) {
        tacoRows.push({
          name:         item.displayName,
          total:        item.quantity * 50,
          unit:         'tacos',
          packaging:    'Half Pan',
          packagingQty: item.quantity,
          utensil:      'Tongs',
          tempType:     'hot',
        });
      }
    }

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      snacks,
      tacoRows,
      paperGoods: { included: false, items: [] },
      proteins:  [],
      toppings:  [],
      salsas:    [],
      tortillas: [],
      hotItems:  tacoRows,
      coldItems: [],
      dryItems:  snacks,
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  _buildHeader(order, delivery) {
    return {
      orderNumber:              order.displayNumber,
      eventType:                order.eventType,
      clientName:               order.clientName,
      clientContact:            order.clientEmail,
      clientPhone:              order.clientPhone,
      guestCount:               order.guestCount,
      estimatedFulfillmentDate: order.estimatedFulfillmentDate,
      kitchenFinishTime:        order.kitchenFinishTime,
      deliveryMethod:           order.deliveryMethod,
      deliveryAddress:          order.deliveryAddress,
      deliveryNotes:            delivery.notes || order.deliveryNotes,
      storeName:                order.storeName,
      storeCode:                order.storeCode,
    };
  }

  _extractIngredients(items) {
    const ingredients = [];
    for (const item of items) {
      const mainName = (item.displayName || '').toLowerCase();
      if (INGREDIENT_NAME_MAP[mainName]) {
        ingredients.push({ name: item.displayName, quantity: item.quantity });
      }
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
      const wasChosen = items.some(item =>
        (item.modifiers || []).some(mod => {
          const norm = INGREDIENT_NAME_MAP[(mod.displayName || '').toLowerCase()];
          return norm && norm.toLowerCase() === salsa.name.toLowerCase();
        })
      );
      if (wasChosen) {
        const packaging = salsa.getPackaging(guestCount);
        result.push({
          name:         salsa.name,
          category:     'salsa',
          tempType:     salsa.tempType,
          unit:         salsa.unit,
          utensil:      salsa.utensil,
          totalAmount:  salsa.calculateAmount(guestCount),
          packaging:    packaging.package,
          packagingQty: packaging.qty,
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
            f.category === 'snack' && f.name.toLowerCase().includes(keyword)
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
        return name.includes('yes, i want paper') || name.includes('yes! i want paper');
      })
    );
    if (!wantsPaper) return { included: false, items: [] };
    return {
      included: true,
      items: [
        { name: 'Plates',         qty: guestCount,     package: 'Stack'  },
        { name: 'Napkins',        qty: guestCount * 2, package: 'Bundle' },
        { name: 'Forks',          qty: guestCount,     package: 'Bundle' },
        { name: 'Tongs Small',    qty: 2,              package: 'each'   },
        { name: 'Serving Spoons', qty: 2,              package: 'each'   },
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