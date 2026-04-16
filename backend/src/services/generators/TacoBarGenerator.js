// src/services/generators/TacoBarGenerator.js
const BaseGenerator = require('./BaseGenerator');

class TacoBarGenerator extends BaseGenerator {

  build(data) {
    const { header, proteins, toppings, salsas, tortillas, snacks, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    const tortillaItems = (tortillas || []).map(t => ({
      ...t,
      totalAmount: t.totalAmount ?? t.total,
      unit:        t.unit || 'each',
    }));

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderSection('Proteins',  proteins  || [], '#c0392b')}
        ${this._renderSection('Toppings',  toppings  || [], '#1e6b3a')}
        ${this._renderSection('Salsas',    salsas    || [], '#7d5a00')}
        ${this._renderSection('Tortillas', tortillaItems,   '#4a235a')}
        ${this._renderSection('Snacks',    snacks    || [], '#784212')}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC()}
    </body></html>`;
  }
}

module.exports = TacoBarGenerator;