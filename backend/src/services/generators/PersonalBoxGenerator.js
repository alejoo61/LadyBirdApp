// src/services/generators/PersonalBoxGenerator.js
const BaseGenerator = require('./BaseGenerator');

class PersonalBoxGenerator extends BaseGenerator {

  build(data) {
    const {
      header, personalBoxes, tacoRows, chipsRow, salsaRow,
      totalBoxes, paperGoods, hotItems, coldItems, dryItems,
    } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderBoxGroups(personalBoxes || [], totalBoxes || 0)}
        ${this._renderTacoRows(tacoRows || [])}
        ${this._renderChipsAndSalsa(chipsRow, salsaRow)}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'Each box labeled with combo and tortilla type',
      'Total box count matches order',
      'Chips & Salsa (4oz Roja) included in every box',
      'Paper goods included',
      'Delivery notes reviewed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ])}
    </body></html>`;
  }

  // ─── BOX GROUPS ───────────────────────────────────────────────────────────
  _renderBoxGroups(personalBoxes, totalBoxes) {
    if (!personalBoxes || personalBoxes.length === 0) return '';

    const rows = personalBoxes.map(box => `
      <tr>
        <td style="text-align:center; font-weight:900">${box.quantity}</td>
        <td><strong>${box.comboLabel}</strong></td>
        <td>${box.tortilla}</td>
        <td style="text-align:center; font-size:9px; color:#1e6b3a; font-weight:900">✓</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`).join('');

    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#b7791f">
        Personal Boxes — ${totalBoxes} Total
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:center">Qty</th>
            <th>Combo</th>
            <th>Tortilla</th>
            <th style="text-align:center">Chips+Salsa</th>
            <th>Packed?</th>
            <th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ─── TACOS BY COMBO ───────────────────────────────────────────────────────
  _renderTacoRows(tacoRows) {
    if (!tacoRows || tacoRows.length === 0) return '';

    const rows = tacoRows.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td style="text-align:center; font-weight:900">${item.total}</td>
        <td>${item.tortilla || '—'}</td>
        <td>${item.packagingQty ? `${item.packagingQty}x ${item.packaging}` : (item.packaging || '—')}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`).join('');

    return `
    <div class="section">
      <div class="section-header" style="background:#457b9d">Tacos by Combo</div>
      <table>
        <thead>
          <tr>
            <th>Combo</th>
            <th style="text-align:center">Total</th>
            <th>Tortilla</th>
            <th>Packaging</th>
            <th>Packed?</th>
            <th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ─── CHIPS & SALSA ────────────────────────────────────────────────────────
  _renderChipsAndSalsa(chipsRow, salsaRow) {
    if (!chipsRow && !salsaRow) return '';

    const rows = [];

    if (chipsRow) {
      rows.push(`
        <tr>
          <td><strong>${chipsRow.name}</strong></td>
          <td style="text-align:center; font-weight:900">${chipsRow.total}</td>
          <td>${chipsRow.unit || 'each'}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`);
    }

    if (salsaRow) {
      rows.push(`
        <tr>
          <td><strong>${salsaRow.name}</strong></td>
          <td style="text-align:center; font-weight:900">${salsaRow.total}</td>
          <td>${salsaRow.detail || salsaRow.unit || 'each'}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`);
    }

    return `
    <div class="section">
      <div class="section-header" style="background:#784212">Chips &amp; Salsa</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center">Total</th>
            <th>Detail</th>
            <th>Packed?</th>
            <th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
  }
}

module.exports = PersonalBoxGenerator;