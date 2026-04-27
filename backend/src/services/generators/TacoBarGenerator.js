// src/services/generators/TacoBarGenerator.js
const BaseGenerator = require('./BaseGenerator');

class TacoBarGenerator extends BaseGenerator {

  build(data) {
    const {
      header, proteins, toppings, salsas, tortillas, snacks,
      paperGoods, hotItems, coldItems, dryItems,
      salads,
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
        ${this._renderSalads(salads || [])}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems || [], coldItems || [], dryItems || [])}
    ${this._renderQC()}
    </body></html>`;
  }

  _renderSalads(salads) {
    if (!salads || salads.length === 0) return '';

    const rows = salads.map(salad => {
      const qty       = salad.quantity || 1;
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

module.exports = TacoBarGenerator;