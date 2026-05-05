// src/services/generators/BirdBoxGenerator.js
const BaseGenerator = require('./BaseGenerator');

class BirdBoxGenerator extends BaseGenerator {

  build(data) {
    const {
      header, summaryItems, boxes, tacoRows, chipsAndSalsa,
      chipsBreakdown, salsas, hasManuasSalsas, drinks, paperGoods,
      hotItems, coldItems, dryItems, addons, salads, sidePacks,
    } = data;

    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    ${this._renderSummary(summaryItems || [])}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderTacosByCombo(tacoRows || [])}
        ${this._renderSidePacks(sidePacks || [])}
        ${this._renderSalsas(salsas || [])}
        ${this._renderChipsTotal(chipsBreakdown || [], chipsAndSalsa || [], boxes || [], hasManuasSalsas)}
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
      'Bird Box Side Pack prepared and labeled (Guac / Queso / Salsa / Chips)',
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

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  _renderSummary(summaryItems) {
    if (!summaryItems || summaryItems.length === 0) return '';

    const TYPE_BADGE = {
      box:      { label: 'Box',       color: '#457b9d' },
      sidepack: { label: 'Side Pack', color: '#7b2d8b' },
      salad:    { label: 'Salad',     color: '#2e7d32' },
      addon:    { label: 'Add-on',    color: '#6b21a8' },
      salsa:    { label: 'Salsa',     color: '#7d5a00' },
      drink:    { label: 'Drink',     color: '#1565c0' },
    };

    const rows = summaryItems.map(item => {
      const badge = TYPE_BADGE[item.type] || { label: 'Item', color: '#555' };

      const chipsCell = item.chipsAndSalsa === '—'
        ? `<td style="text-align:center; color:#bbb; font-size:10px">—</td>`
        : `<td class="checkbox-cell"><span class="yes-no ${item.chipsAndSalsa === 'Yes' ? 'yes' : 'no'}">${item.chipsAndSalsa}</span></td>`;

      const paperCell = item.paper === '—'
        ? `<td style="text-align:center; color:#bbb; font-size:10px">—</td>`
        : `<td class="checkbox-cell"><span class="yes-no ${item.paper === 'Yes' ? 'yes' : 'no'}">${item.paper}</span></td>`;

      return `
        <tr>
          <td>
            <span style="
              display:inline-block; margin-right:5px;
              padding:1px 5px; border-radius:3px; font-size:7px;
              font-weight:900; letter-spacing:0.06em; text-transform:uppercase;
              background:${badge.color}20; color:${badge.color};
              border:1px solid ${badge.color}50;
            ">${badge.label}</span>
            <strong>${item.name}</strong>
          </td>
          <td style="text-align:center; font-weight:700">${item.quantity}</td>
          <td style="font-size:8px; color:#444">${item.detail || '—'}</td>
          ${chipsCell}
          ${paperCell}
        </tr>`;
    }).join('');

    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#457b9d">Summary</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center">Qty</th>
            <th>Detail</th>
            <th>Chips+Salsa</th>
            <th>Paper</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ─── SIDE PACK ────────────────────────────────────────────────────────────
  _renderSidePacks(sidePacks) {
    if (!sidePacks || sidePacks.length === 0) return '';

    const contentRows = sidePacks.map((sp, idx) => {
      const subHeader = sidePacks.length > 1
        ? `<tr style="background:#ede9fe">
             <td colspan="6" style="font-size:8px; font-weight:900; color:#7b2d8b; text-transform:uppercase; letter-spacing:0.08em; padding:3px 8px">
               Pack ${idx + 1} — ${sp.salsaName}${sp.quantity > 1 ? ` ×${sp.quantity}` : ''}
             </td>
           </tr>`
        : '';

      // Contenido sin los chips — chips van en sección consolidada
      const rows = sp.contents.map(c => `
        <tr>
          <td><strong>${c.item}</strong></td>
          <td>${c.amount}</td>
          <td>${c.packaging}</td>
          <td>${c.utensil}</td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
          <td class="checkbox-cell"><span class="checkbox"></span></td>
        </tr>`).join('');

      return subHeader + rows;
    }).join('');

    return `
    <div class="section">
      <div class="section-header" style="background:#7b2d8b">'Bird Box Side Pack</div>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Amount</th><th>Packaging</th>
            <th>Utensil</th><th>Packed?</th><th>Loaded?</th>
          </tr>
        </thead>
        <tbody>${contentRows}</tbody>
      </table>
    </div>`;
  }

  // ─── CHIPS CONSOLIDADO ────────────────────────────────────────────────────
  // Una sola sección con todos los chips de la orden con contexto claro
  _renderChipsTotal(chipsBreakdown, chipsAndSalsa, boxes, hasManuasSalsas) {
    if (!chipsBreakdown || chipsBreakdown.length === 0) return '';

    const totalPans = chipsBreakdown.reduce((sum, c) => {
      const match = (c.amount || '').match(/^(\d+)/);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0);

    const rows = chipsBreakdown.map(c => `
      <tr>
        <td style="font-size:8px; color:#555">${c.label}</td>
        <td><strong>${c.amount}</strong></td>
        <td>${c.packaging}</td>
        <td>${c.utensil}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>`).join('');

    const totalRow = chipsBreakdown.length > 1 ? `
      <tr style="background:#fef3c7; border-top:2px solid #784212">
        <td style="font-weight:900; font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:#784212">
          TOTAL
        </td>
        <td style="font-weight:900; color:#784212">${totalPans} Full Pan${totalPans > 1 ? 's' : ''}</td>
        <td colspan="4"></td>
      </tr>` : '';

    return `
    <div class="section">
      <div class="section-header" style="background:#784212">Chips</div>
      <table>
        <thead>
          <tr>
            <th>Descripción</th><th>Cantidad</th><th>Packaging</th>
            <th>Utensil</th><th>Packed?</th><th>Loaded?</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${totalRow}
        </tbody>
      </table>
    </div>`;
  }

  // ─── TACOS BY COMBO ───────────────────────────────────────────────────────
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

  // ─── SALSAS ───────────────────────────────────────────────────────────────
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

  // ─── ADD-ONS ──────────────────────────────────────────────────────────────
  _renderAddons(addons) {
    if (!addons || addons.length === 0) return '';
    const rows = addons.map(addon => {
      const qty       = addon.quantity || 1;
      const isChurro  = addon.unit === 'pan';
      const amountStr = isChurro
        ? `${qty} pan${qty > 1 ? 's' : ''}`
        : `${addon.totalAmount || (32 * qty)} ${addon.unit}`;
      const chipsStr  = `+ ${qty} pan${qty > 1 ? 's' : ''} chips`;
      const servesStr = addon.servesCount
        ? `Serves ${addon.servesCount}`
        : (isChurro ? 'Serves 8–10' : `Serves ${20 * qty}`);
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

  // ─── SALADS ───────────────────────────────────────────────────────────────
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
            <th>Salad</th><th style="text-align:center">Protein</th>
            <th style="text-align:center">Serves</th><th>Dressing</th>
            <th>Packaging</th><th>Utensil</th><th>Packed?</th><th>Loaded?</th>
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
}

module.exports = BirdBoxGenerator;