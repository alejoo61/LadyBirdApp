// src/services/generators/FoodaGenerator.js
const BaseGenerator = require('./BaseGenerator');

class FoodaGenerator extends BaseGenerator {

  build(data) {
    const { header, snacks, tacoRows, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderSection('Tacos',          tacoRows || [], '#2d3748')}
        ${this._renderSection('Snacks & Sides', snacks   || [], '#744210')}
      </div>
      <div class="right-col">${this._renderPaperGoods(paperGoods)}</div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC()}
    </body></html>`;
  }
}

module.exports = FoodaGenerator;