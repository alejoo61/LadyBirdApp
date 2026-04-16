// src/services/generators/BirdBoxGenerator.js
const BaseGenerator = require('./BaseGenerator');

class BirdBoxGenerator extends BaseGenerator {

  build(data) {
    const { header, boxes, tacoRows, chipsAndSalsa, salsas, hasManuasSalsas, drinks, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    ${this._renderBoxSummary(boxes)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderTacosByCombo(tacoRows || [])}
        ${this._renderSalsas(salsas || [])}
        ${this._renderChipsAndSalsa(chipsAndSalsa || [], boxes || [], hasManuasSalsas)}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
        ${this._renderDrinksChecklist(drinks)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'All taco combos counted and packed correctly',
      'Chips & Salsa included if requested',
      'Drinks packed with cups & lids if requested',
      'Paper goods / taco boats matched to guest count',
      'Delivery notes reviewed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ])}
    </body></html>`;
  }

  _renderBoxSummary(boxes) {
    if (!boxes || boxes.length === 0) return '';
    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#457b9d">Summary</div>
      <table>
        <thead><tr><th>Box Type</th><th>Qty</th><th>Tacos</th><th>Combos</th><th>Tortilla</th><th>Chips+Salsa</th><th>Paper</th></tr></thead>
        <tbody>
          ${boxes.map(box => `
            <tr>
              <td>${box.name}</td>
              <td>${box.quantity}</td>
              <td>${box.tacoCount}</td>
              <td style="font-size:8px">${(box.combos || []).join(' / ') || '—'}</td>
              <td>${box.tortilla || '—'}</td>
              <td class="checkbox-cell"><span class="yes-no ${box.wantsChips ? 'yes' : 'no'}">${box.wantsChips ? 'Yes' : 'No'}</span></td>
              <td class="checkbox-cell"><span class="yes-no ${box.wantsPaper ? 'yes' : 'no'}">${box.wantsPaper ? 'Yes' : 'No'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  _renderTacosByCombo(tacoRows) {
    if (!tacoRows || tacoRows.length === 0) return '';
    return `
    <div class="section">
      <div class="section-header" style="background:#457b9d">Tacos by Combo</div>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Tacos</th><th>Tortillas</th>
            <th>Utensil</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th>
          </tr>
        </thead>
        <tbody>
          ${tacoRows.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.total} ${item.unit || ''}</td>
              <td style="font-size:8px; font-weight:bold; color:#457b9d">${item.tortillaLabel || '—'}</td>
              <td>${item.utensil || '—'}</td>
              <td>${item.packagingQty ? `${item.packagingQty}x ${item.packaging}` : (item.packaging || '—')}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  _renderSalsas(salsas) {
    if (!salsas || salsas.length === 0) return '';
    return `
    <div class="section">
      <div class="section-header" style="background:#7d5a00">Salsas</div>
      <table>
        <thead><tr><th>Item</th><th>Amount</th><th>Utensil</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${salsas.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.totalAmount || '—'} ${item.unit || ''}</td>
              <td>${item.utensil || '—'}</td>
              <td>${item.packagingQty ? `${item.packagingQty}x ${item.packaging}` : (item.packaging || '—')}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  _renderChipsAndSalsa(chipsAndSalsa, boxes, hasManuasSalsas = false) {
    const wantsChips    = boxes.some(b => b.wantsChips);
    const chipsFiltered = chipsAndSalsa.filter(i => i.included === 'Yes');
    if (!wantsChips || chipsFiltered.length === 0) return '';
    const title = hasManuasSalsas ? 'Chips' : 'Chips & Salsa';
    return `
    <div class="section">
      <div class="section-header" style="background:#784212">${title}</div>
      <table>
        <thead><tr><th>Item</th><th>Amount</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${chipsFiltered.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.total ? `${item.total} ${item.unit || ''}` : '—'}</td>
              <td>${item.packagingQty ? `${item.packagingQty}x ${item.packaging}` : '—'}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }
}

module.exports = BirdBoxGenerator;