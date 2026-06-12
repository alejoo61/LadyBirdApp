// src/services/generators/PersonalBoxGenerator.js
const BaseGenerator    = require('./BaseGenerator');
const BirdBoxGenerator = require('./BirdBoxGenerator');

class PersonalBoxGenerator extends BaseGenerator {

  build(data) {
    const {
      header, personalBoxes, personalTacoRows, chipsRow, salsaRow,
      totalBoxes, paperGoods, drinks, addons, birdBoxResult,
      hotItems, coldItems, dryItems,
    } = data;
    const badge      = this._eventTypeBadge(header.eventType);
    const bbGen      = new BirdBoxGenerator();
    const hasBirdBox = birdBoxResult && (birdBoxResult.tacoRows?.length > 0 || birdBoxResult.boxes?.length > 0);

    // ── Consolidar paper goods ──
    const consolidatedPaperGoods = this._consolidatePaperGoods(paperGoods, hasBirdBox ? birdBoxResult.paperGoods : null);


    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}

    ${totalBoxes > 0 ? `
    <div class="main-grid">
      <div class="left-col">
        ${this._renderBoxGroups(personalBoxes || [], totalBoxes)}
        ${this._renderPersonalTacoRows(personalTacoRows || [])}
        ${this._renderChipsAndSalsa(chipsRow, salsaRow)}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(consolidatedPaperGoods)}
      </div>
    </div>` : ''}

    ${hasBirdBox ? `
    <div style="margin-top:12px; border-top:3px solid #457b9d; padding-top:8px;">
      <div style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.12em; color:#457b9d; margin-bottom:6px;">
        'BIRD BOX — included in this order
      </div>
      <div class="left-col">
        ${bbGen._renderTacosByCombo(birdBoxResult.tacoRows || [])}
        ${bbGen._renderSidePacks(birdBoxResult.sidePacks || [])}
        ${bbGen._renderSalsas(birdBoxResult.salsas || [])}
        ${bbGen._renderChipsTotal(birdBoxResult.chipsBreakdown || [], birdBoxResult.chipsAndSalsa || [], birdBoxResult.boxes || [], birdBoxResult.hasManuasSalsas)}
        ${bbGen._renderAddons(birdBoxResult.addons || [])}
      </div>
    </div>` : ''}

    ${this._renderAddons(addons || [])}
    ${this._renderDrinksConsolidated(drinks || [], header.guestCount)}
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'Each personal box labeled with combo and tortilla type',
      'Total box count matches order',
      'Chips & Salsa (4oz Roja) included in every personal box',
      'Paper goods included',
      hasBirdBox ? 'Bird Box tacos counted and packed correctly' : null,
      hasBirdBox ? 'Bird Box chips & salsa included if requested' : null,
      'Drinks packed with cups & lids if requested',
      'Delivery notes reviewed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ].filter(Boolean))}
    </body></html>`;
  }

  // ─── CONSOLIDAR PAPER GOODS ───────────────────────────────────────────────
  _consolidatePaperGoods(personalPG, birdBoxPG) {
    if (!birdBoxPG || !birdBoxPG.included) return personalPG;
    if (!personalPG || !personalPG.included) return birdBoxPG;

    // Mergear sumando cantidades del mismo item
    const merged = {};
    const allItems = [...(personalPG.items || []), ...(birdBoxPG.items || [])];
    for (const item of allItems) {
      const key = item.name;
      if (merged[key]) {
        merged[key].qty += item.qty;
      } else {
        merged[key] = { ...item };
      }
    }

    return {
      included: true,
      items:    Object.values(merged),
    };
  }


  // ─── PERSONAL BOX GROUPS ──────────────────────────────────────────────────
  _renderBoxGroups(personalBoxes, totalBoxes) {
    if (!personalBoxes || personalBoxes.length === 0) return '';
    const rows = personalBoxes.map(box => `
      <tr>
        <td style="text-align:center; font-weight:900">${box.quantity}</td>
        <td><strong>${box.comboLabel}</strong></td>
        <td>${box.tortilla}</td>
        <td>${box.salsa || 'Salsa Roja'}</td>
        <td style="text-align:center; font-size:9px; color:#1e6b3a; font-weight:900">✓</td>
        ${box.note ? `<td style="font-size:9px; color:#92400e; font-weight:900; background:#fff3cd">⚠ ${box.note}</td>` : '<td>—</td>'}
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`).join('');
    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#b7791f">Personal Boxes — ${totalBoxes} Total</div>
      <table>
        <thead><tr>
          <th style="text-align:center">Qty</th>
          <th>Combo</th><th>Tortilla</th><th>Salsa</th>
          <th style="text-align:center">Chips</th><th>Note</th>
          <th>Packed?</th><th>Loaded?</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ─── PERSONALLY WRAPPED TACOS ─────────────────────────────────────────────
  _renderPersonalTacoRows(tacoRows) {
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
      <div class="section-header" style="background:#457b9d">Individually Wrapped Tacos</div>
      <table>
        <thead><tr>
          <th>Combo</th><th style="text-align:center">Total</th>
          <th>Tortilla</th><th>Packaging</th>
          <th>Packed?</th><th>Loaded?</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ─── CHIPS & SALSA ────────────────────────────────────────────────────────
  _renderChipsAndSalsa(chipsRow, salsaRow) {
    if (!chipsRow && !salsaRow) return '';
    const rows = [];
    if (chipsRow) rows.push(`
      <tr>
        <td><strong>${chipsRow.name}</strong></td>
        <td style="text-align:center; font-weight:900">${chipsRow.total}</td>
        <td>${chipsRow.unit || 'each'}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`);
    if (salsaRow) rows.push(`
      <tr>
        <td><strong>${salsaRow.name}</strong></td>
        <td style="text-align:center; font-weight:900">${salsaRow.total}</td>
        <td>${salsaRow.detail || salsaRow.unit || 'each'}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`);
    return `
    <div class="section">
      <div class="section-header" style="background:#784212">Chips &amp; Salsa</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Total</th><th>Detail</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
  }

  // ─── ADD-ONS ──────────────────────────────────────────────────────────────
  _renderAddons(addons) {
    if (!addons || addons.length === 0) return '';
    const rows = addons.map(addon => {
      const detail = addon.detail || addon.packaging
        ? `${addon.totalAmount ? addon.totalAmount + ' ' + (addon.unit || '') : ''} ${addon.packaging || addon.detail || ''}`.trim()
        : '';
      return `
      <tr>
        <td><strong>${addon.name}</strong></td>
        <td style="text-align:center; font-weight:900">${addon.quantity}</td>
        <td>${detail}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`;
    }).join('');
    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#6b21a8">Add-ons</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th>Detail</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
}

module.exports = PersonalBoxGenerator;