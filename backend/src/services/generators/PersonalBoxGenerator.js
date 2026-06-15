// src/services/generators/PersonalBoxGenerator.js
const BaseGenerator    = require('./BaseGenerator');
const BirdBoxGenerator = require('./BirdBoxGenerator');

class PersonalBoxGenerator extends BaseGenerator {

  build(data) {
    const {
      header, personalBoxes, personalTacoRows, chipsRow, salsaRow,
      totalBoxes, paperGoods, drinks, addons, birdBoxResult, tacoBarResult,
      hotItems, coldItems, dryItems,
    } = data;
    const badge      = this._eventTypeBadge(header.eventType);
    const bbGen      = new BirdBoxGenerator();
    const hasBirdBox  = birdBoxResult && (birdBoxResult.tacoRows?.length > 0 || birdBoxResult.boxes?.length > 0);
    const hasTacoBar  = tacoBarResult && (tacoBarResult.proteins?.length > 0 || tacoBarResult.tortillas?.length > 0);

    // ── Consolidar paper goods (Personal Box + Bird Box + Taco Bar) ──
    let consolidatedPaperGoods = this._consolidatePaperGoods(paperGoods, hasBirdBox ? birdBoxResult.paperGoods : null);
    if (hasTacoBar) consolidatedPaperGoods = this._consolidatePaperGoods(consolidatedPaperGoods, tacoBarResult.paperGoods);

    // ── Consolidar utensils ──
    const utensilMap = this._collectUtensils([
      personalTacoRows || [],
      ...(hasBirdBox ? [birdBoxResult.tacoRows || [], birdBoxResult.salsas || []] : []),
      ...(hasTacoBar  ? [tacoBarResult.proteins || [], tacoBarResult.toppings || [], tacoBarResult.salsas || [], tacoBarResult.tortillas || []] : []),
    ]);


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
        ${this._renderUtensils(utensilMap)}
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

    ${hasTacoBar ? `
    <div style="margin-top:12px; border-top:3px solid #c0392b; padding-top:8px;">
      <div style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.12em; color:#c0392b; margin-bottom:6px;">
        TACO BAR — included in this order
      </div>
      <div class="main-grid">
        <div class="left-col">
          ${this._renderSection('Proteins',  tacoBarResult.proteins  || [], '#c0392b')}
          ${this._renderSection('Toppings',  tacoBarResult.toppings  || [], '#1e6b3a')}
          ${this._renderSection('Salsas',    tacoBarResult.salsas    || [], '#7d5a00')}
          ${this._renderSection('Tortillas', (tacoBarResult.tortillas || []).map(t => ({ ...t, totalAmount: t.totalAmount ?? t.total })), '#4a235a')}
          ${this._renderSection('Snacks',    tacoBarResult.snacks    || [], '#784212')}
        </div>
        <div class="right-col"></div>
      </div>
    </div>` : ''}

    ${this._renderAddons(addons || [])}
    ${this._renderChipsConsolidated(chipsRow, hasBirdBox ? birdBoxResult : null, addons || [])}
    ${this._renderDrinksConsolidated(drinks || [], header.guestCount)}
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'Each personal box labeled with combo and tortilla type',
      'Total box count matches order',
      'Chips & Salsa (4oz Roja) included in every personal box',
      'Paper goods included',
      hasBirdBox ? 'Bird Box tacos counted and packed correctly' : null,
      hasBirdBox ? 'Bird Box chips & salsa included if requested' : null,
      hasTacoBar ? 'Taco Bar proteins and toppings packed correctly' : null,
      hasTacoBar ? 'Taco Bar tortillas included' : null,
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

    // Normalizar nombres para poder mergear correctamente
    const normalize = (name) => {
      const n = (name || '').toLowerCase();
      if (n.includes('fork'))       return 'Forks';
      if (n.includes('napkin'))     return 'Napkins';
      if (n.includes('taco boat'))  return 'Taco Boats';
      if (n.includes('plate'))      return 'Plates';
      if (n.includes('spoon'))      return 'Spoons';
      return name;
    };

    const merged = {};
    const allItems = [...(personalPG.items || []), ...(birdBoxPG.items || [])];
    for (const item of allItems) {
      const key = normalize(item.name);
      if (merged[key]) {
        merged[key].qty += item.qty;
      } else {
        merged[key] = { ...item, name: key };
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
    if (!salsaRow) return '';
    return `
    <div class="section">
      <div class="section-header" style="background:#784212">Personal Salsa</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Total</th><th>Detail</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>${salsaRow.name}</strong></td>
            <td style="text-align:center; font-weight:900">${salsaRow.total}</td>
            <td>${salsaRow.detail || salsaRow.unit || 'each'}</td>
            <td class="checkbox-cell"><span class="checkbox"></span></td>
            <td class="checkbox-cell"><span class="checkbox"></span></td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }

  // ─── CHIPS SUMMARY ───────────────────────────────────────────────────────
  _renderChipsConsolidated(chipsRow, birdBoxResult, addons) {
    const rows = [];
    let totalPans = 0;

    // Personal chips (individual boxes)
    if (chipsRow && chipsRow.total > 0) {
      rows.push(`
        <tr>
          <td>Personal Boxes (${chipsRow.total} boxes)</td>
          <td style="font-weight:900">${chipsRow.total} each</td>
        </tr>`);
    }

    // Bird Box chips
    if (birdBoxResult?.chipsBreakdown?.length > 0) {
      for (const c of birdBoxResult.chipsBreakdown) {
        const match = (c.amount || '').match(/^(\d+)/);
        if (match) totalPans += parseInt(match[1]);
        rows.push(`
          <tr>
            <td>${c.label}</td>
            <td style="font-weight:900">${c.amount}</td>
          </tr>`);
      }
    }

    // Addons con chips (Chips & Guacamole, Chips & Queso, etc.)
    const chipAddons = (addons || []).filter(a => (a.name || '').toLowerCase().includes('chip'));
    for (const addon of chipAddons) {
      totalPans += addon.quantity || 1;
      rows.push(`
        <tr>
          <td>${addon.name} (×${addon.quantity || 1})</td>
          <td style="font-weight:900">${addon.quantity || 1} Full Pan${(addon.quantity || 1) > 1 ? 's' : ''}</td>
        </tr>`);
    }

    if (rows.length === 0) return '';

    return `
    <div class="section" style="margin-top:8px; border:2px solid #784212">
      <div class="section-header" style="background:#784212; font-size:10px">🍟 Chips Summary</div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          ${rows.join('')}
          <tr style="background:#fef3c7; border-top:2px solid #784212">
            <td style="font-weight:900; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#784212">TOTAL FULL PANS</td>
            <td style="font-weight:900; font-size:12px; color:#784212">${totalPans} Full Pan${totalPans !== 1 ? 's' : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }

  // ─── ADD-ONS ──────────────────────────────────────────────────────────────
  _renderAddons(addons) {
    if (!addons || addons.length === 0) return '';
    const rows = addons.map(addon => {
      const amount  = addon.totalAmount ? `${addon.totalAmount} ${addon.unit || ''}`.trim() : (addon.quantity ? `${addon.quantity}x` : '—');
      const pkg     = addon.packaging || '—';
      return `
      <tr>
        <td><strong>${addon.name}</strong></td>
        <td style="text-align:center; font-weight:900">${addon.quantity}</td>
        <td>${amount}</td>
        <td>${pkg}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`;
    }).join('');
    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#6b21a8">Add-ons</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th>Amount</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
}

module.exports = PersonalBoxGenerator;