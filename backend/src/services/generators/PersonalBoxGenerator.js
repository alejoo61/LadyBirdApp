// src/services/generators/PersonalBoxGenerator.js
const BaseGenerator = require('./BaseGenerator');

class PersonalBoxGenerator extends BaseGenerator {

  build(data) {
    const { header, personalBoxes, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">${this._renderBoxList(personalBoxes || [])}</div>
      <div class="right-col">${this._renderPaperGoods(paperGoods)}</div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'Each box labeled with combo and mods',
      'Total box count matches order',
      'Tortilla type correct per box',
      'Paper goods included if requested',
      'Delivery notes reviewed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ])}
    </body></html>`;
  }

  _renderBoxList(personalBoxes) {
    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#b7791f">
        Individual Boxes — ${personalBoxes.length} Total
      </div>
      <table>
        <thead><tr><th>#</th><th>Combo</th><th>Tortilla</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${personalBoxes.map((box, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${box.combo}</td>
              <td>${box.tortilla}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }
}

module.exports = PersonalBoxGenerator;