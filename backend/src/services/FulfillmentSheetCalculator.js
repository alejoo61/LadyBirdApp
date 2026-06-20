// src/services/FulfillmentSheetCalculator.js
// Orchestrator — delegates to event-specific calculators
// Drop-in replacement: same constructor and calculate() API as before

const IngredientResolverService  = require('./IngredientResolverService');
const { buildHeader }            = require('./fulfillment/shared/HeaderBuilder');
const { calculateTacoBar }       = require('./fulfillment/events/TacoBarCalculator');
const { calculateBirdBox }       = require('./fulfillment/events/BirdBoxCalculator');
const { calculatePersonalBox }   = require('./fulfillment/events/PersonalBoxCalculator');

class FulfillmentSheetCalculator {
  constructor(ingredientFormulaRepository, pool) {
    this.formulaRepo = ingredientFormulaRepository;
    this.pool        = pool;
    this.resolver    = new IngredientResolverService(pool);
  }

  async calculate(cateringOrder) {
    const { eventType, parsedData } = cateringOrder;
    const delivery = parsedData?.delivery || {};
    const header   = buildHeader(cateringOrder, delivery);

    let result;

    switch (eventType) {
      case 'TACO_BAR':
        result = await calculateTacoBar(cateringOrder, this.resolver, this.pool);
        break;
      case 'BIRD_BOX':
        result = await calculateBirdBox(cateringOrder, this.resolver, this.pool);
        break;
      case 'PERSONAL_BOX':
        result = await calculatePersonalBox(cateringOrder, this.resolver, this.pool);
        break;
      case 'FOODA':
        result = await this._calculateFooda(cateringOrder);
        break;
      case 'SPACE_RENTAL':
        result = await this._calculateSpaceRental(cateringOrder);
        break;
      default:
        result = await calculateTacoBar(cateringOrder, this.resolver, this.pool);
    }

    // Inyectar extras (Equipment, Space Rental, Kids) desde parsedData
    // Vienen separados del flujo principal para no contaminar los calculators
    const extrasRaw = cateringOrder.parsedData?.extras || [];
    const extras = {
      equipment:    extrasRaw.filter(e => e.category === 'equipment'),
      spaceRental:  extrasRaw.filter(e => e.category === 'space_rental'),
      kids:         extrasRaw.filter(e => e.category === 'kids'),
      hasExtras:    extrasRaw.length > 0,
    };

    return { header, ...result, extras };
  }

  // ─── FOODA ────────────────────────────────────────────────────────────────
  async _calculateFooda(cateringOrder) {
    const { parsedData } = cateringOrder;
    const items    = parsedData?.items || [];
    const snacks   = [];
    const tacoRows = [];
    for (const item of items) {
      const name = (item.displayName || item.name || '').toLowerCase();
      if (name.includes('chip') || name.includes('fooda')) {
        snacks.push({ name: item.displayName || item.name, total: item.quantity, unit: 'each', packaging: 'black box bin', packagingQty: item.quantity, utensil: '-', tempType: 'dry' });
      } else if (name.includes('taco') || /^#\d+/.test((item.displayName || item.name || '').trim())) {
        tacoRows.push({ name: item.displayName || item.name, total: item.quantity * 50, unit: 'tacos', packaging: 'Half Pan', packagingQty: item.quantity, utensil: 'Tongs', tempType: 'hot' });
      }
    }
    return { snacks, tacoRows, paperGoods: { included: false, items: [] }, proteins: [], toppings: [], salsas: [], tortillas: [], hotItems: tacoRows, coldItems: [], dryItems: snacks };
  }

  // ─── SPACE RENTAL ─────────────────────────────────────────────────────────
  async _calculateSpaceRental(cateringOrder) {
    const { parsedData } = cateringOrder;
    const items      = parsedData?.items || [];
    const rentalItem = items.find(i => (i.displayName || i.name || '').toLowerCase().includes('space rental'));
    const timeMod    = rentalItem?.modifiers?.[0];
    const timeStr    = timeMod?.displayName || '';
    const timeRange  = this._parseSpaceRentalTime(timeStr, cateringOrder.estimatedFulfillmentDate);
    const hasFood    = items.some(i => {
      const n = (i.displayName||i.name||'').toLowerCase();
      return !n.includes('space rental') && !n.includes('ez cater') && !n.includes('open tax');
    });
    return {
      spaceRental: { rentalType: rentalItem?.displayName || 'Space Rental', timeStr, eventTime: timeRange.eventTimeLabel, readyBy: timeRange.readyByLabel, startISO: timeRange.startISO, endISO: timeRange.endISO, readyByISO: timeRange.readyByISO, duration: timeRange.duration, totalAmount: rentalItem?.price || cateringOrder.totalAmount, hasFood },
      hotItems: [], coldItems: [], dryItems: [], paperGoods: { included: false, items: [] },
    };
  }

  _parseSpaceRentalTime(timeStr, baseDateISO) {
    const READY_BEFORE_MINUTES = 25;
    if (!timeStr || !baseDateISO) return { eventTimeLabel: timeStr || '—', readyByLabel: '—', startISO: baseDateISO, endISO: null, readyByISO: null, duration: '—' };
    const match = timeStr.match(/(\d+:\d+\s*(?:am|pm))\s+to\s+(\d+:\d+\s*(?:am|pm))/i);
    if (!match) return { eventTimeLabel: timeStr, readyByLabel: '—', startISO: baseDateISO, endISO: null, readyByISO: null, duration: timeStr };
    const baseDate  = new Date(baseDateISO);
    const dateStr   = baseDate.toISOString().slice(0, 10);
    const parseTime = (t) => {
      const [time, meridiem] = t.trim().split(/\s+/);
      let [h, m] = time.split(':').map(Number);
      if (meridiem?.toLowerCase() === 'pm' && h !== 12) h += 12;
      if (meridiem?.toLowerCase() === 'am' && h === 12) h = 0;
      return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
    };
    const startDate   = parseTime(match[1]);
    const endDate     = parseTime(match[2]);
    const readyByDate = new Date(startDate.getTime() - READY_BEFORE_MINUTES * 60 * 1000);
    const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
    const diffMs  = endDate - startDate;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMin = Math.floor((diffMs % 3600000) / 60000);
    return {
      eventTimeLabel: `${fmt(startDate)} – ${fmt(endDate)}`,
      readyByLabel:   fmt(readyByDate),
      startISO:       startDate.toISOString(),
      endISO:         endDate.toISOString(),
      readyByISO:     readyByDate.toISOString(),
      duration:       diffHrs > 0 ? `${diffHrs}h${diffMin > 0 ? ` ${diffMin}min` : ''}` : `${diffMin}min`,
    };
  }
}

module.exports = FulfillmentSheetCalculator;