// src/services/FulfillmentSheetGenerator.js
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');

class FulfillmentSheetGenerator {

  async generate(calculatedData, orderMeta = {}) {
    const { header } = calculatedData;
    let html;
    switch (header.eventType) {
      case 'BIRD_BOX':     html = this._buildBirdBoxHTML(calculatedData);     break;
      case 'PERSONAL_BOX': html = this._buildPersonalBoxHTML(calculatedData); break;
      case 'FOODA':        html = this._buildFoodaHTML(calculatedData);       break;
      default:             html = this._buildTacoBarHTML(calculatedData);     break;
    }

    const tmpPath = path.join(os.tmpdir(), `fulfillment-${Date.now()}.pdf`);
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path:            tmpPath,
        format:          'Letter',
        printBackground: true,
        margin:          { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      });
      return fs.readFileSync(tmpPath);
    } finally {
      await browser.close();
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  // ─── PDF FILENAME ──────────────────────────────────────────────────────────
  buildFilename(order, storeCode) {
    const eventTypeCode = {
      TACO_BAR:     'TB',
      BIRD_BOX:     'BB',
      PERSONAL_BOX: 'PB',
      FOODA:        'FD',
      NEEDS_REVIEW: 'NR',
    }[order.eventType] || 'XX';

    const store      = (storeCode || 'LB').replace(/\s/g, '');
    const clientSlug = (order.clientName || 'unknown')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .slice(0, 20);

    return `LB-${store}-${clientSlug}-${eventTypeCode}-v1.pdf`;
  }

  _formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Chicago'
    });
  }

  _formatPhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    if (cleaned.length === 11 && cleaned[0] === '1') return `(${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    return phone;
  }

  _eventTypeBadge(eventType) {
    const map = {
      TACO_BAR:     { color: '#c0392b', label: 'TACO BAR'     },
      BIRD_BOX:     { color: '#457b9d', label: "'BIRD BOX"    },
      PERSONAL_BOX: { color: '#b7791f', label: 'PERSONAL BOX' },
      FOODA:        { color: '#2d3748', label: 'FOODA'         },
      NEEDS_REVIEW: { color: '#f4a261', label: 'NEEDS REVIEW'  },
    };
    return map[eventType] || { color: '#2d3748', label: eventType };
  }

  _baseCSS(badgeColor) {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: white; }

    .doc-header {
      background: #c0392b;
      color: white;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 4px solid #922b21;
    }
    .doc-header h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
    .header-right { display: flex; align-items: center; gap: 6px; }
    .method-pill {
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid rgba(255,255,255,0.6);
      color: white;
    }
    .method-pill.pickup   { background: #1565c0; border-color: #1565c0; }
    .method-pill.delivery { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.5); }
    .event-badge {
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      background: white;
      color: ${badgeColor};
      border: 2px solid white;
    }
    /* Badge para ordenes editadas manualmente */
    .edited-badge {
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: #fbbf24;
      color: #1a1a1a;
      border: 2px solid #f59e0b;
    }

    .order-info { display: grid; grid-template-columns: 1fr 1fr; background: #fef9c3; border: 1px solid #f0c040; border-top: none; }
    .info-left, .info-right { padding: 8px 12px; }
    .info-right { border-left: 1px solid #f0c040; }
    .info-row { display: flex; gap: 6px; margin-bottom: 4px; align-items: baseline; }
    .info-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #7a6a00; min-width: 100px; }
    .info-value { font-size: 10px; font-weight: 700; color: #1a1a1a; }
    .info-value.highlight { font-size: 12px; font-weight: 900; color: #c0392b; }

    .notes-box { background: #fff3cd; border: 1px solid #f0c040; border-top: none; padding: 6px 12px; }
    .notes-box h4 { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #7a6a00; margin-bottom: 2px; }
    .notes-text { font-size: 9px; color: #1a1a1a; }

    .edited-banner {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-top: none;
      padding: 4px 12px;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #92400e;
    }

    .main-grid { display: grid; grid-template-columns: 1fr 260px; gap: 8px; margin-top: 8px; }

    .section { margin-bottom: 6px; border: 1px solid #bbb; }
    .section-header { padding: 4px 8px; color: white; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #e8e8e8; }
    th { padding: 3px 6px; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #333; text-align: left; border: 1px solid #ccc; }
    td { padding: 3px 6px; border: 1px solid #ddd; font-size: 9px; vertical-align: middle; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .checkbox-cell { text-align: center; width: 44px; }
    .checkbox { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #555; background: white; }
    .yes-no { font-weight: 900; }
    .yes-no.yes { color: #1e6b3a; }
    .yes-no.no  { color: #c0392b; }

    .right-col { display: flex; flex-direction: column; gap: 6px; }
    .paper-goods { background: #fef9c3; border: 1px solid #f0c040; }
    .paper-goods-header { background: #f0c040; padding: 4px 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #1a1a1a; }
    .paper-goods table { background: #fef9c3; }
    .paper-goods th { background: #fde68a; border-color: #f0c040; color: #7a6a00; }
    .paper-goods td { border-color: #f0c040; font-size: 9px; }

    .drinks-checklist { background: #e8f0fe; border: 1px solid #90caf9; margin-top: 6px; }
    .drinks-checklist-header { background: #1565c0; color: white; padding: 4px 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
    .drinks-checklist table { background: #e8f0fe; }
    .drinks-checklist th { background: #bbdefb; border-color: #90caf9; color: #0d47a1; }
    .drinks-checklist td { border-color: #90caf9; font-size: 9px; }

    .food-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 2px solid #1a1a1a; margin-top: 8px; }
    .food-type { padding: 6px; text-align: center; border-right: 1px solid #1a1a1a; }
    .food-type:last-child { border-right: none; }
    .food-type.hot  { background: #fde8e8; }
    .food-type.cold { background: #e8f0fe; }
    .food-type.dry  { background: #e8f5e9; }
    .food-type .count { font-size: 18px; font-weight: 900; }
    .food-type.hot  .count { color: #c0392b; }
    .food-type.cold .count { color: #1565c0; }
    .food-type.dry  .count { color: #2e7d32; }
    .food-type .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-top: 2px; }

    .qc-section { margin-top: 8px; border: 2px solid #1a1a1a; }
    .qc-header { background: #1a1a1a; color: white; padding: 4px 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
    .qc-body { padding: 8px 10px; background: white; }
    .qc-item { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; font-size: 9px; }
    .qc-checkbox { width: 12px; height: 12px; border: 1.5px solid #1a1a1a; background: white; flex-shrink: 0; }

    @media print { body { -webkit-print-color-adjust: exact; } }
    `;
  }

  _headerHTML(header, badge) {
    const method   = (header.deliveryMethod || '').toUpperCase();
    const isPickup = method === 'PICKUP';
    const phone    = this._formatPhone(header.clientPhone);

    return `
    <div class="doc-header">
      <h1>Ladybird Taco &mdash; Fulfillment Sheet</h1>
      <div class="header-right">
        ${header.isManuallyEdited ? '<span class="edited-badge">⚠ Edited</span>' : ''}
        <span class="method-pill ${isPickup ? 'pickup' : 'delivery'}">
          ${isPickup ? '🏪 Pickup' : '🚗 Delivery'}
        </span>
        <span class="event-badge">${badge.label}</span>
      </div>
    </div>
    ${header.isManuallyEdited ? '<div class="edited-banner">⚠ This order was manually edited — not synced with Toast</div>' : ''}
    <div class="order-info">
      <div class="info-left">
        <!-- ORDER # comentado hasta confirmar el número correcto con el equipo
        <div class="info-row"><span class="info-label">Order #</span><span class="info-value highlight">#${header.displayNumber || header.orderNumber}</span></div>
        -->
        <div class="info-row"><span class="info-label">Client</span><span class="info-value">${header.clientName || '—'}</span></div>
        <div class="info-row"><span class="info-label">Store</span><span class="info-value">${header.storeName} (${header.storeCode})</span></div>
        <div class="info-row"><span class="info-label">Guest Count</span><span class="info-value highlight">${header.guestCount}</span></div>
        ${!isPickup && header.deliveryAddress ? `<div class="info-row"><span class="info-label">Address</span><span class="info-value">${header.deliveryAddress}</span></div>` : ''}
      </div>
      <div class="info-right">
        <div class="info-row"><span class="info-label">Event Time</span><span class="info-value highlight">${this._formatDate(header.estimatedFulfillmentDate)}</span></div>
        <div class="info-row"><span class="info-label">Kitchen Finish</span><span class="info-value">${this._formatDate(header.kitchenFinishTime)}</span></div>
        ${phone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${phone}</span></div>` : ''}
        ${header.clientContact ? `<div class="info-row"><span class="info-label">Email</span><span class="info-value">${header.clientContact}</span></div>` : ''}
      </div>
    </div>
    ${header.deliveryNotes ? `<div class="notes-box"><h4>Delivery Notes</h4><p class="notes-text">${header.deliveryNotes}</p></div>` : ''}
    `;
  }

  _renderSection(title, items, color = '#2d3748') {
    if (!items || items.length === 0) return '';
    return `
    <div class="section">
      <div class="section-header" style="background:${color}"><span>${title}</span></div>
      <table>
        <thead><tr><th>ITEM</th><th>AMOUNT</th><th>UTENSIL</th><th>PACKAGING</th><th>PACKED?</th><th>LOADED?</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.totalAmount || item.total || '—'} ${item.unit || ''}</td>
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

  _renderPaperGoods(paperGoods) {
    if (!paperGoods.included) return `
    <div class="paper-goods">
      <div class="paper-goods-header">Paper Goods</div>
      <p style="padding:8px; font-size:9px; color:#999; font-style:italic;">Client opted out.</p>
    </div>`;
    return `
    <div class="paper-goods">
      <div class="paper-goods-header">Paper Goods</div>
      <table>
        <thead><tr><th>Item</th><th>Amt</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${paperGoods.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.qty} ${item.package}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  _renderDrinksChecklist(drinks = []) {
    if (!drinks || drinks.length === 0) return '';
    const rows = [];
    for (const drink of drinks) {
      rows.push({ label: `${drink.name} (x${drink.quantity})` });
      if (drink.wantsCups) rows.push({ label: `↳ Cups & Lids` });
      if (drink.extras?.length > 0) {
        for (const extra of drink.extras) rows.push({ label: `↳ ${extra}` });
      }
    }
    return `
    <div class="drinks-checklist">
      <div class="drinks-checklist-header">Drinks & Add-ons</div>
      <table>
        <thead><tr><th>Item</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.label}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  _renderFoodSummary(hotItems, coldItems, dryItems) {
    return `
    <div class="food-summary">
      <div class="food-type hot"><div class="count">${hotItems.length}</div><div class="label">Hot Foods</div></div>
      <div class="food-type cold"><div class="count">${coldItems.length}</div><div class="label">Cold Foods</div></div>
      <div class="food-type dry"><div class="count">${dryItems.length}</div><div class="label">Dry Foods</div></div>
    </div>`;
  }

  _renderQC(items = [
    'All HOT items temped and packed in correct packaging',
    'All COLD items / condiments included',
    'Serving utensils included (Tongs / Spoons / Ladles)',
    'Paper goods / Cutlery matched to guest count',
    'Delivery notes reviewed — special instructions followed',
    'Order label applied to all boxes',
    'Driver assigned and notified',
  ]) {
    return `
    <div class="qc-section">
      <div class="qc-header">Final QC Checklist</div>
      <div class="qc-body">
        ${items.map(item => `<div class="qc-item"><div class="qc-checkbox"></div><span>${item}</span></div>`).join('')}
      </div>
    </div>`;
  }

  // ─── TACO BAR ─────────────────────────────────────────────────────────────
  _buildTacoBarHTML(data) {
    const { header, proteins, toppings, salsas, tortillas, snacks, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderSection('Proteins',  proteins,  '#c0392b')}
        ${this._renderSection('Toppings',  toppings,  '#1e6b3a')}
        ${this._renderSection('Salsas',    salsas,    '#7d5a00')}
        ${this._renderSection('Tortillas', tortillas.map(t => ({ ...t, totalAmount: t.total, unit: 'each' })), '#4a235a')}
        ${this._renderSection('Snacks',    snacks,    '#784212')}
      </div>
      <div class="right-col">${this._renderPaperGoods(paperGoods)}</div>
    </div>
    ${this._renderFoodSummary(hotItems, coldItems, dryItems)}
    ${this._renderQC()}
    </body></html>`;
  }

  // ─── BIRD BOX ─────────────────────────────────────────────────────────────
  _buildBirdBoxHTML(data) {
    const { header, boxes, tacoRows, chipsAndSalsa, drinks, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    const boxSummary = `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#457b9d"><span>Summary</span></div>
      <table>
        <thead><tr><th>Box Type</th><th>Qty</th><th>Tacos</th><th>Combos</th><th>Tortilla</th><th>Chips+Salsa</th><th>Paper</th></tr></thead>
        <tbody>
          ${boxes.map(box => `
            <tr>
              <td>${box.name}</td>
              <td>${box.quantity}</td>
              <td>${box.tacoCount}</td>
              <td style="font-size:8px">${box.combos.join(' / ') || '—'}</td>
              <td>${box.tortilla}</td>
              <td class="checkbox-cell"><span class="yes-no ${box.wantsChips ? 'yes' : 'no'}">${box.wantsChips ? 'Yes' : 'No'}</span></td>
              <td class="checkbox-cell"><span class="yes-no ${box.wantsPaper ? 'yes' : 'no'}">${box.wantsPaper ? 'Yes' : 'No'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

    const wantsChips = boxes.some(b => b.wantsChips);
    const chipsSection = wantsChips ? `
    <div class="section">
      <div class="section-header" style="background:#784212"><span>Chips & Salsa</span></div>
      <table>
        <thead><tr><th>Item</th><th>Amount</th><th>Packaging</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${chipsAndSalsa.filter(i => i.included === 'Yes').map(item => `
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
    </div>` : '';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    ${boxSummary}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderSection('Tacos by Combo', tacoRows, '#457b9d')}
        ${chipsSection}
      </div>
      <div class="right-col">
        ${this._renderPaperGoods(paperGoods)}
        ${this._renderDrinksChecklist(drinks)}
      </div>
    </div>
    ${this._renderFoodSummary(hotItems, coldItems, dryItems)}
    ${this._renderQC([
      'All taco combos counted and packed correctly',
      'Chips & Salsa included if requested',
      'Drinks packed with cups & lids if requested',
      'Paper goods / taco boats matched to order',
      'Delivery notes reviewed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ])}
    </body></html>`;
  }

  // ─── PERSONAL BOX ─────────────────────────────────────────────────────────
  _buildPersonalBoxHTML(data) {
    const { header, personalBoxes, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    const boxList = `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#b7791f">
        <span>Individual Boxes — ${personalBoxes.length} Total</span>
      </div>
      <table>
        <thead><tr><th>#</th><th>Combo</th><th>Tortilla</th><th>Extras</th><th>Packed?</th><th>Loaded?</th></tr></thead>
        <tbody>
          ${personalBoxes.map((box, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${box.combo}</td>
              <td>${box.tortilla}</td>
              <td style="font-size:8px">${box.extras || '—'}</td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
              <td class="checkbox-cell"><span class="checkbox"></span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">${boxList}</div>
      <div class="right-col">${this._renderPaperGoods(paperGoods)}</div>
    </div>
    ${this._renderFoodSummary(hotItems, coldItems, dryItems)}
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

  // ─── FOODA ────────────────────────────────────────────────────────────────
  _buildFoodaHTML(data) {
    const { header, snacks, tacoRows, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    <div class="main-grid">
      <div class="left-col">
        ${this._renderSection('Tacos',          tacoRows, '#2d3748')}
        ${this._renderSection('Snacks & Sides', snacks,   '#744210')}
      </div>
      <div class="right-col">${this._renderPaperGoods(paperGoods)}</div>
    </div>
    ${this._renderFoodSummary(hotItems, coldItems, dryItems)}
    ${this._renderQC()}
    </body></html>`;
  }
}

module.exports = FulfillmentSheetGenerator;