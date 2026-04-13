// src/services/FulfillmentSheetCalculator.js

const INGREDIENT_NAME_MAP = {
  'salsa verde braised chicken (taco bar)': 'Salsa Verde Braised Chicken',
  'house-smoked brisket (taco bar)':        'House-smoked Brisket',
  'house-smoked brisket (+premium)':        'House-smoked Brisket',
  'adobo chicken (taco bar)':               'Adobo Chicken',
  'chorizo (taco bar)':                     'Chorizo',
  'tenderbelly bacon (taco bar)':           'Tenderbelly Bacon',
  'egg (taco bar)':                         'Egg',
  'eggs (taco bar)':                        'Egg',
  'potato (taco bar)':                      'Crispy Potato',
  'black beans (taco bar)':                 'Black Beans',
  'rajas (taco bar)':                       'Rajas',
  'sliced avocado (taco bar)':              'Sliced Avocado',
  'pico de gallo (taco bar)':               'Pico De Gallo',
  'monterrey jack cheese (taco bar)':       'Shredded Cheese',
  'cotija (taco bar)':                      'Cotija',
  'shredded cabbage (taco bar)':            'Cabbage',
  'pickled red onion (taco bar)':           'Pickled Onions',
  'crispy potato (taco bar)':               'Crispy Potato',
  'salsa roja (mild)':                      'Salsa Roja',
  'salsa verde (mild-med)':                 'Salsa Verde',
  'verde (mild-med)':                       'Salsa Verde',
  'patron (spicy)':                         'Patron',
  'roja (mild) 0.75 oz cup':               'Salsa Roja',
  'flour tortillas (catering)':             'Flour Tortillas',
  'housemade flour tortilla':               'Flour Tortillas',
  'housemade flour tortillas':              'Flour Tortillas',
  '50/50 flour/corn (catering)':            '50/50',
  '50/50 flour & corn':                     '50/50',
  'corn tortillas (catering)':              'Corn Tortillas',
  'housemade corn tortillas':               'Corn Tortillas',
  'queso (taco bar)':                       'Queso',
  'guacamole (taco bar)':                   'Guac',
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
        name:         normalizedName,
        category:     formula.category,
        tempType:     formula.tempType,
        unit:         formula.unit,
        utensil:      formula.utensil,
        totalAmount,
        packaging:    packaging.package,
        packagingQty: packaging.qty,
      });
    }

    const defaultSalsas = this._getDefaultSalsas(items, formulas, guestCount, calculated);
    calculated.push(...defaultSalsas);

    const grouped    = this._groupByCategory(calculated);
    const tortillas  = this._calculateTortillas(items, guestCount, formulas);
    const paperGoods = this._calculatePaperGoods(items, guestCount);
    const snacks     = this._extractSnacks(items, guestCount, formulas);

    return {
      header:    this._buildHeader(cateringOrder, delivery),
      proteins:  grouped.protein || [],
      toppings:  grouped.topping || [],
      salsas:    grouped.salsa   || [],
      tortillas,
      snacks,
      paperGoods,
      hotItems:  [...calculated.filter(i => i.tempType === 'hot'), ...tortillas],
      coldItems: calculated.filter(i => i.tempType === 'cold'),
      dryItems:  calculated.filter(i => i.tempType === 'dry'),
    };
  }

  // ─── BIRD BOX ─────────────────────────────────────────────────────────────
  async _calculateBirdBox(cateringOrder) {
    const { guestCount, items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    const boxes = [];
    const drinks = []; // FIX: detectar bebidas

    for (const item of items) {
      const modifiers  = item.modifiers || [];
      const itemNameLc = (item.displayName || '').toLowerCase();

      // FIX: separar bebidas de los bird boxes
      if (
        itemNameLc.includes('coffee') ||
        itemNameLc.includes('agua') ||
        itemNameLc.includes('limeade') ||
        itemNameLc.includes('drink') ||
        itemNameLc.includes('beverage') ||
        itemNameLc.includes('side pack')
      ) {
        const wantsCups = modifiers.some(m =>
          m.displayName.toLowerCase().includes('yes, i want cups')
        );
        const extras = modifiers
          .filter(m => !m.displayName.toLowerCase().includes('yes, i want cups'))
          .map(m => m.displayName)
          .filter(Boolean);

        drinks.push({
          name:      item.displayName,
          quantity:  item.quantity || 1,
          wantsCups,
          extras,
          tempType:  itemNameLc.includes('coffee') ? 'hot' : 'cold',
        });
        continue; // no procesar como bird box
      }

      const sizeMod = modifiers.find(m => /\d+\s*tacos?/i.test(m.displayName));
      const tacoCount = sizeMod
        ? parseInt(sizeMod.displayName.match(/(\d+)\s*tacos?/i)?.[1] || 0)
        : guestCount * 2;

      const combos = modifiers.filter(m => /^#\d+/i.test(m.displayName.trim()));

      const tortillaMod = modifiers.find(m => {
        const n = m.displayName.toLowerCase();
        return n.includes('flour') || n.includes('corn') || n.includes('50/50');
      });

      // FIX: detectar chips correctamente incluyendo "Nope"
      const chipsModifier = modifiers.find(m =>
        m.displayName.toLowerCase().includes('chip') ||
        m.displayName.toLowerCase().includes('yes! i would like') ||
        m.displayName.toLowerCase().includes('nope! i do not want')
      );
      const wantsChips = chipsModifier
        ? chipsModifier.displayName.toLowerCase().includes('yes')
        : false;

      const wantsPaper = modifiers.some(m =>
        m.displayName.toLowerCase().includes('yes, i want paper') ||
        m.displayName.toLowerCase().includes('yes, i want taco boats')
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
    const comboTotals = {};
    let totalTacos = 0;
    for (const box of boxes) {
      totalTacos += box.tacoCount * box.quantity;
      const tacosPerCombo = box.combos.length > 0
        ? Math.ceil(box.tacoCount / box.combos.length)
        : box.tacoCount;
      for (const combo of box.combos) {
        comboTotals[combo] = (comboTotals[combo] || 0) + (tacosPerCombo * box.quantity);
      }
    }

    const tacoRows = Object.entries(comboTotals).map(([combo, total]) => ({
      name:         combo,
      total,
      unit:         'tacos',
      packaging:    'Half Pan',
      packagingQty: Math.ceil(total / 50),
      utensil:      'Tongs Small',
      tempType:     'hot',
    }));

    // Chips & Salsa
    const wantsChips = boxes.some(b => b.wantsChips);
    const chipsAndSalsa = wantsChips ? [{
      name:         'Chips',
      total:        1,
      unit:         'Full Pan',
      packaging:    'Full Pan',
      packagingQty: 1,
      utensil:      'Tongs Large',
      tempType:     'dry',
      included:     'Yes',
    }, {
      name:         'Salsa Roja',
      total:        Math.ceil(guestCount / 12),
      unit:         '6 oz cups',
      packaging:    '6 oz cup',
      packagingQty: Math.ceil(guestCount / 12),
      utensil:      'Ladle',
      tempType:     'cold',
      included:     'Yes',
    }] : [{
      name:     'Chips & Salsa',
      included: 'No',
      tempType: 'dry',
    }];

    // Paper goods
    const wantsPaper = boxes.some(b => b.wantsPaper);
    const paperGoods = wantsPaper ? {
      included: true,
      items: [
        { name: 'Plates',        qty: guestCount,     package: 'Stack'  },
        { name: 'Napkins',       qty: guestCount * 2, package: 'Bundle' },
        { name: 'Fork Small',    qty: guestCount,     package: 'Bundle' },
        { name: 'Taco Boats',    qty: guestCount * 2, package: 'Bundle' },
      ]
    } : { included: false, items: [] };

    const allHot  = [...tacoRows, ...drinks.filter(d => d.tempType === 'hot')];
    const allCold = [...chipsAndSalsa.filter(i => i.tempType === 'cold'), ...drinks.filter(d => d.tempType === 'cold')];
    const allDry  = chipsAndSalsa.filter(i => i.tempType === 'dry');

    return {
      header:       this._buildHeader(cateringOrder, delivery),
      boxes,
      tacoRows,
      chipsAndSalsa,
      drinks,       // FIX: incluir bebidas
      paperGoods,
      totalTacos,
      hotItems:     allHot,
      coldItems:    allCold,
      dryItems:     allDry,
      proteins:     [],
      toppings:     [],
      salsas:       [],
      tortillas:    [],
      snacks:       [],
    };
  }

  // ─── PERSONAL BOX ─────────────────────────────────────────────────────────
  async _calculatePersonalBox(cateringOrder) {
    const { items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};

    const personalBoxes = [];
    for (const item of items) {
      const modifiers = item.modifiers || [];
      const combo     = modifiers.find(m => /^#\d+/i.test(m.displayName.trim()));
      const tortilla  = modifiers.find(m => {
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
      proteins:  [], toppings: [], salsas: [], tortillas: [], snacks: [],
      hotItems:  [], coldItems: [], dryItems: [],
    };
  }

  // ─── FOODA ────────────────────────────────────────────────────────────────
  async _calculateFooda(cateringOrder) {
    const { items, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const snacks   = [];
    const tacoRows = [];

    for (const item of items) {
      const name = (item.displayName || '').toLowerCase();
      if (name.includes('chip') || name.includes('fooda')) {
        snacks.push({
          name: item.displayName, total: item.quantity, unit: 'each',
          packaging: 'black box bin', packagingQty: item.quantity,
          utensil: '-', tempType: 'dry',
        });
      } else if (name.includes('taco') || /^#\d+/.test(item.displayName.trim())) {
        tacoRows.push({
          name: item.displayName, total: item.quantity * 50, unit: 'tacos',
          packaging: 'Half Pan', packagingQty: item.quantity,
          utensil: 'Tongs', tempType: 'hot',
        });
      }
    }

    return {
      header:     this._buildHeader(cateringOrder, delivery),
      snacks, tacoRows,
      paperGoods: { included: false, items: [] },
      proteins: [], toppings: [], salsas: [], tortillas: [],
      hotItems: tacoRows, coldItems: [], dryItems: snacks,
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  _buildHeader(order, delivery) {
    return {
      orderNumber:              order.toastOrderGuid
                                  ? order.toastOrderGuid.split('-')[0].toUpperCase()
                                  : order.displayNumber,
      displayNumber:            order.displayNumber,
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

  _formatPhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    }
    return phone;
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
        const cups = Math.ceil(guestCount / 12);
        result.push({
          name:         salsa.name,
          category:     'salsa',
          tempType:     salsa.tempType,
          unit:         '6 oz cups',
          utensil:      salsa.utensil,
          totalAmount:  cups,
          packaging:    '6 oz cup',
          packagingQty: cups,
        });
      }
    }
    return result;
  }

  _calculateTortillas(items, guestCount, formulas) {
    const result = [];
    let flourCount = 0, cornCount = 0, is5050 = false;
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
            const total     = formula.calculateAmount(guestCount);
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