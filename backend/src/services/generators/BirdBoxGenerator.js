// src/services/generators/BirdBoxGenerator.js
const BaseGenerator = require('./BaseGenerator');

class BirdBoxGenerator extends BaseGenerator {

  build(data) {
    const {
      header, boxes, tacoRows, chipsAndSalsa, salsas,
      hasManuasSalsas, drinks, paperGoods, hotItems, coldItems, dryItems,
      addons, salads,
    } = data;
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
        ${this._renderAddons(addons || [])}
        ${this._renderSalads(salads || [])}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
        ${this._renderDrinksChecklist(drinks)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC([
      'All taco combos counted and packed correctly',
      'Add-on packs prepared and labeled (Queso / Guac / Salsa / Churro Chips)',
      'Salads packed with dressing on the side',
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
        <thead><tr><th>Box Type</th><th>Qty</th><th>Tacos</th><th>Combos</th><th>Chips+Salsa</th><th>Paper</th></tr></thead>
        <tbody>
          ${boxes.map(box => `
            <tr>
              <td>${box.name}</td>
              <td>${box.quantity}</td>
              <td>${box.tacoCount}</td>
              <td style="font-size:8px">${(box.combos || []).join(' / ') || '—'}</td>
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

  _renderAddons(addons) {
    if (!addons || addons.length === 0) return '';

    const rows = addons.map(addon => {
      const qty        = addon.quantity || 1;
      const isChurro   = addon.unit === 'pan';
      const amountStr  = isChurro
        ? `${qty} pan${qty > 1 ? 's' : ''}`
        : `${addon.totalAmount || (32 * qty)} ${addon.unit}`;
      const chipsStr   = `+ ${qty} pan${qty > 1 ? 's' : ''} chips`;
      const servesStr  = addon.servesCount ? `Serves ${addon.servesCount}` : (isChurro ? 'Serves 8–10' : `Serves ${20 * qty}`);

      return `
        <tr>
          <td>
            <strong>${addon.name}</strong>
            ${qty > 1 ? `<span style="color:#6b21a8; font-weight:900; margin-left:4px">×${qty}</span>` : ''}
          </td>
          <td>
            ${amountStr}
            ${!isChurro ? `<br><span style="font-size:8px; color:#666">${chipsStr}</span>` : ''}
          </td>
          <td style="font-size:8px; color:#555">${servesStr}</td>
          <td>${addon.utensil || '—'}</td>
          <td>${addon.packagingQty ? `${addon.packagingQty}x ${addon.packaging}` : (addon.packaging || '—')}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`;
    }).join('');

    return `
    <div class="section">
      <div class="section-header" style="background:#6b21a8">Add-on Packs</div>
      <table>
        <thead>
          <tr>
            <th>Pack</th><th>Amount</th><th>Serves</th>
            <th>Utensil</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
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

      const servesTotal = salad.serves
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
              display:inline-block;
              padding:3px 8px;
              border-radius:3px;
              font-size:9px;
              font-weight:900;
              letter-spacing:0.08em;
              background:${isNoProtein ? '#f0f0f0' : '#fde8e8'};
              color:${proteinColor};
              border:1.5px solid ${isNoProtein ? '#ccc' : '#f5aaaa'};
            ">${proteinDisplay}</span>
          </td>
          <td style="text-align:center; font-weight:700">${servesTotal} ppl</td>
          <td style="font-size:8px; color:#555; font-style:italic">${salad.dressing || '—'}</td>
          <td>${salad.packaging || '—'}</td>
          <td>${salad.utensil || '—'}</td>
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
            <th>Salad</th>
            <th style="text-align:center">Protein</th>
            <th style="text-align:center">Serves</th>
            <th>Dressing</th>
            <th>Packaging</th>
            <th>Utensil</th>
            <th>Packed?</th>
            <th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="
        background:#f0faf0;
        border-top:1px solid #a5d6a7;
        padding:5px 10px;
        font-size:8px;
        font-weight:900;
        color:#2e7d32;
        text-transform:uppercase;
        letter-spacing:0.08em;
      ">
        ⚠ Dressing served on the side — do not forget:
        ${dressings.map(d => `<span style="font-weight:700; color:#1a1a1a; margin-left:4px">${d}</span>`).join(' &nbsp;|&nbsp; ')}
      </div>
    </div>`;
  }
}

module.exports = BirdBoxGenerator;