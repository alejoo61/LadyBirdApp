// src/services/generators/TacoBarGenerator.js
const BaseGenerator = require('./BaseGenerator');

class TacoBarGenerator extends BaseGenerator {

  build(data) {
    const {
      header, proteins, toppings, salsas, tortillas, snacks,
      paperGoods, hotItems, coldItems, dryItems, salads, addons,
      individualTacos, totalChipPans,
    } = data;
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
        ${this._renderIndividualTacos(this._sortByComboNumber(individualTacos || []))}
        ${this._renderSalads(salads || [])}
        ${this._renderAddons(addons || [], totalChipPans || 0)}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC(individualTacos && individualTacos.length > 0 ? [
      'All HOT items temped and packed in correct packaging',
      'All COLD items / condiments included',
      'Individual tacos wrapped and labeled correctly',
      'Serving utensils included (Tongs / Spoons / Ladles)',
      'Paper goods / Cutlery matched to guest count',
      'Delivery notes reviewed — special instructions followed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ] : null)}
    </body></html>`;
  }

  _renderSalads(salads) {
    if (!salads || salads.length === 0) return '';

    const rows = salads.map(salad => {
      const qty         = salad.quantity || 1;
      const isNoProtein = !salad.protein ||
        salad.protein.toLowerCase().includes('without') ||
        salad.protein.toLowerCase().includes('no protein');
      const proteinColor   = isNoProtein ? '#888888' : '#c0392b';
      const proteinDisplay = isNoProtein
        ? 'NO PROTEIN'
        : (salad.protein || '').replace(/^(small|large)\s+with\s+/i, '').toUpperCase();
      const servesTotal = salad.size === 'Individual'
        ? qty
        : salad.serves
          ? salad.serves * qty
          : (salad.size === 'Large' ? 20 : 10) * qty;

      return `
        <tr>
          <td>
            <strong>${salad.saladType}</strong>
            <span style="font-size:8px; color:#555; margin-left:4px">(${salad.size})</span>
            ${qty > 1 ? `<span style="color:#2e7d32; font-weight:900; margin-left:4px">×${qty}</span>` : ''}
          </td>
          <td style="text-align:center">
            <span style="
              display:inline-block; padding:3px 8px; border-radius:3px;
              font-size:9px; font-weight:900; letter-spacing:0.08em;
              background:${isNoProtein ? '#f0f0f0' : '#fde8e8'};
              color:${proteinColor};
              border:1.5px solid ${isNoProtein ? '#ccc' : '#f5aaaa'};
            ">${proteinDisplay}</span>
          </td>
          <td style="text-align:center; font-weight:700">${servesTotal} ppl</td>
          <td style="font-size:8px; color:#555; font-style:italic">${salad.dressing || '—'}</td>
          <td>${salad.packaging || '—'}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`;
    }).join('');

    const dressings = [...new Set(salads.map(s => s.dressing).filter(Boolean))];

    return `
    <div class="section">
      <div class="section-header" style="background:#2e7d32">Salads</div>
      <table>
        <thead>
          <tr>
            <th>Salad</th><th style="text-align:center">Protein</th>
            <th style="text-align:center">Serves</th><th>Dressing</th>
            <th>Packaging</th><th>Packed?</th><th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="
        background:#f0faf0; border-top:1px solid #a5d6a7;
        padding:5px 10px; font-size:8px; font-weight:900;
        color:#2e7d32; text-transform:uppercase; letter-spacing:0.08em;
      ">
        ⚠ Dressing served on the side — do not forget:
        ${dressings.map(d => `<span style="font-weight:700; color:#1a1a1a; margin-left:4px">${d}</span>`).join(' &nbsp;|&nbsp; ')}
      </div>
    </div>`;
  }

  _renderAddons(addons, totalChipPansOverride = 0) {
    if ((!addons || addons.length === 0) && totalChipPansOverride === 0) return '';

    let totalChipPans = totalChipPansOverride;
    for (const a of (addons || [])) { if (a.hasChipsPan) totalChipPans += a.chipPans || 0; }

    const rows = addons.map(addon => {
      const qty    = addon.quantity || 1;
      const amount = addon.totalAmount ? `${addon.totalAmount} ${addon.unit || ''}`.trim() : `${qty}x`;
      const pkg    = addon.packaging || '—';
      return `
        <tr>
          <td><strong>${addon.name}</strong>${qty > 1 ? `<span style="color:#6b21a8;font-weight:900;margin-left:4px">×${qty}</span>` : ''}</td>
          <td style="text-align:center;font-weight:900">${qty}</td>
          <td>${amount}</td>
          <td>${pkg}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`;
    }).join('');

    const totalRow = totalChipPans > 0 ? `
      <tr style="background:#fef3c7;border-top:2px solid #784212">
        <td colspan="2" style="font-weight:900;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#784212">Total Chips</td>
        <td colspan="2" style="font-weight:900;font-size:11px;color:#784212">${totalChipPans} Full Pans</td>
        <td class="checkbox-cell"></td><td class="checkbox-cell"></td>
      </tr>` : '';

    return `
    <div class="section">
      <div class="section-header" style="background:#6b21a8">Add-ons</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th>Amount</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>
    </div>`;
  }
}

module.exports = TacoBarGenerator;