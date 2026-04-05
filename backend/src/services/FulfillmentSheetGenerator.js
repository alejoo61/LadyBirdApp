// src/services/FulfillmentSheetGenerator.js
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');

class FulfillmentSheetGenerator {

  async generate(calculatedData) {
    const html    = this._buildHTML(calculatedData);
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
        margin:          { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      });
      const pdf = fs.readFileSync(tmpPath);
      return pdf;
    } finally {
      await browser.close();
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  _formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Chicago'
    });
  }

  _eventTypeBadge(eventType) {
    const colors = {
      TACO_BAR:     '#e63946',
      BIRD_BOX:     '#457b9d',
      PERSONAL_BOX: '#e9c46a',
      FOODA:        '#2d3748',
      NEEDS_REVIEW: '#f4a261',
    };
    const labels = {
      TACO_BAR:     'TACO BAR',
      BIRD_BOX:     "'BIRD BOX",
      PERSONAL_BOX: 'PERSONAL BOX',
      FOODA:        'FOODA',
      NEEDS_REVIEW: 'NEEDS REVIEW',
    };
    return { color: colors[eventType] || '#2d3748', label: labels[eventType] || eventType };
  }

_buildHTML(data) {
    const { header, proteins, toppings, salsas, tortillas, snacks, paperGoods, hotItems, coldItems, dryItems } = data;
    const badge = this._eventTypeBadge(header.eventType);

    const renderRows = (items) => items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.totalAmount || item.total || '—'} ${item.unit || ''}</td>
        <td>${item.utensil || '—'}</td>
        <td>${item.packagingQty ? `${item.packagingQty}x ${item.packaging}` : (item.packaging || '—')}</td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
        <td class="checkbox-cell"><span class="checkbox"></span></td>
      </tr>
    `).join('');

    const renderSection = (title, items, color = '#2d3748') => {
      if (!items || items.length === 0) return '';
      return `
        <div class="section">
          <div class="section-header" style="background:${color}">
            <span>${title}</span>
            <span class="section-cols">AMT | UTENSIL | PACKAGING | PACKED? | LOADED?</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>ITEM</th>
                <th>AMOUNT</th>
                <th>UTENSIL</th>
                <th>PACKAGING</th>
                <th>PACKED?</th>
                <th>LOADED?</th>
              </tr>
            </thead>
            <tbody>${renderRows(items)}</tbody>
          </table>
        </div>
      `;
    };

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: white; }

  /* HEADER — rojo igual al Excel */
  .doc-header {
    background: #c0392b;
    color: white;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 4px solid #922b21;
  }
  .doc-header h1 {
    font-size: 16px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .event-badge {
    padding: 3px 10px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    background: white;
    color: ${badge.color};
    border: 2px solid white;
  }

  /* ORDER INFO — fondo amarillo como el Excel */
  .order-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #fef9c3;
    border: 1px solid #f0c040;
    border-top: none;
  }
  .info-left, .info-right { padding: 8px 12px; }
  .info-right { border-left: 1px solid #f0c040; }
  .info-row { display: flex; gap: 6px; margin-bottom: 4px; align-items: baseline; }
  .info-label {
    font-size: 8px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7a6a00;
    min-width: 100px;
  }
  .info-value { font-size: 10px; font-weight: 700; color: #1a1a1a; }
  .info-value.highlight { font-size: 12px; font-weight: 900; color: #c0392b; }

  /* NOTES */
  .notes-box {
    background: #fff3cd;
    border: 1px solid #f0c040;
    border-top: none;
    padding: 6px 12px;
  }
  .notes-box h4 {
    font-size: 8px;
    font-weight: 900;
    text-transform: uppercase;
    color: #7a6a00;
    margin-bottom: 2px;
  }
  .notes-text { font-size: 9px; color: #1a1a1a; }

  /* MAIN GRID */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 8px;
    margin-top: 8px;
  }

  /* SECTIONS — estilo Excel */
  .section { margin-bottom: 6px; border: 1px solid #bbb; }
  .section-header {
    padding: 4px 8px;
    color: white;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-cols { font-size: 7px; opacity: 0.85; }

  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #e8e8e8; }
  th {
    padding: 3px 6px;
    font-size: 8px;
    font-weight: 900;
    text-transform: uppercase;
    color: #333;
    text-align: left;
    border: 1px solid #ccc;
  }
  td {
    padding: 3px 6px;
    border: 1px solid #ddd;
    font-size: 9px;
    vertical-align: middle;
  }
  tr:nth-child(even) td { background: #f9f9f9; }
  .checkbox-cell { text-align: center; width: 44px; }
  .checkbox {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1.5px solid #555;
    background: white;
  }

  /* RIGHT COLUMN */
  .right-col { display: flex; flex-direction: column; gap: 6px; }

  /* PAPER GOODS — fondo amarillo */
  .paper-goods {
    background: #fef9c3;
    border: 1px solid #f0c040;
  }
  .paper-goods-header {
    background: #f0c040;
    padding: 4px 8px;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    color: #1a1a1a;
    display: flex;
    justify-content: space-between;
  }
  .paper-goods table { background: #fef9c3; }
  .paper-goods th { background: #fde68a; border-color: #f0c040; color: #7a6a00; }
  .paper-goods td { border-color: #f0c040; font-size: 9px; }

  /* FOOD SUMMARY — igual al footer del Excel */
  .food-summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    border: 2px solid #1a1a1a;
    margin-top: 8px;
  }
  .food-type {
    padding: 6px;
    text-align: center;
    border-right: 1px solid #1a1a1a;
  }
  .food-type:last-child { border-right: none; }
  .food-type.hot  { background: #fde8e8; }
  .food-type.cold { background: #e8f0fe; }
  .food-type.dry  { background: #e8f5e9; }
  .food-type .count { font-size: 18px; font-weight: 900; }
  .food-type.hot  .count { color: #c0392b; }
  .food-type.cold .count { color: #1565c0; }
  .food-type.dry  .count { color: #2e7d32; }
  .food-type .label {
    font-size: 8px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    margin-top: 2px;
  }

  /* QC CHECKLIST */
  .qc-section {
    margin-top: 8px;
    border: 2px solid #1a1a1a;
  }
  .qc-header {
    background: #1a1a1a;
    color: white;
    padding: 4px 10px;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .qc-body { padding: 8px 10px; background: white; }
  .qc-item {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 4px;
    font-size: 9px;
  }
  .qc-checkbox {
    width: 12px;
    height: 12px;
    border: 1.5px solid #1a1a1a;
    background: white;
    flex-shrink: 0;
  }

  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- HEADER -->
<div class="doc-header">
  <h1>Ladybird Taco &mdash; Fulfillment Sheet</h1>
  <span class="event-badge">${badge.label}</span>
</div>

<!-- ORDER INFO -->
<div class="order-info">
  <div class="info-left">
    <div class="info-row">
      <span class="info-label">Order #</span>
      <span class="info-value highlight">#${header.orderNumber}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Client</span>
      <span class="info-value">${header.clientName}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Store</span>
      <span class="info-value">${header.storeName} (${header.storeCode})</span>
    </div>
    <div class="info-row">
      <span class="info-label">Guest Count</span>
      <span class="info-value highlight">${header.guestCount}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Method</span>
      <span class="info-value">${header.deliveryMethod}</span>
    </div>
    ${header.deliveryAddress ? `
    <div class="info-row">
      <span class="info-label">Address</span>
      <span class="info-value">${header.deliveryAddress}</span>
    </div>` : ''}
  </div>
  <div class="info-right">
    <div class="info-row">
      <span class="info-label">Event Time</span>
      <span class="info-value highlight">${this._formatDate(header.estimatedFulfillmentDate)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Kitchen Finish</span>
      <span class="info-value">${this._formatDate(header.kitchenFinishTime)}</span>
    </div>
    ${header.clientPhone ? `
    <div class="info-row">
      <span class="info-label">Phone</span>
      <span class="info-value">${header.clientPhone}</span>
    </div>` : ''}
    ${header.clientContact ? `
    <div class="info-row">
      <span class="info-label">Email</span>
      <span class="info-value">${header.clientContact}</span>
    </div>` : ''}
  </div>
</div>

${header.deliveryNotes ? `
<div class="notes-box">
  <h4>Delivery Notes</h4>
  <p class="notes-text">${header.deliveryNotes}</p>
</div>` : ''}

<!-- MAIN GRID -->
<div class="main-grid">

  <!-- LEFT: Ingredientes -->
  <div class="left-col">
    ${renderSection('Proteins',  proteins,  '#c0392b')}
    ${renderSection('Toppings',  toppings,  '#1e6b3a')}
    ${renderSection('Salsas',    salsas,    '#7d5a00')}
    ${renderSection('Tortillas', tortillas.map(t => ({ ...t, totalAmount: t.total, unit: 'each' })), '#4a235a')}
    ${renderSection('Snacks',    snacks,    '#784212')}
  </div>

  <!-- RIGHT: Paper Goods -->
  <div class="right-col">
    ${paperGoods.included ? `
    <div class="paper-goods">
      <div class="paper-goods-header">
        <span>Paper Goods</span>
        <span style="font-size:7px">AMT | PACKED? | LOADED?</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amt</th>
            <th>Packed?</th>
            <th>Loaded?</th>
          </tr>
        </thead>
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
    </div>` : `
    <div class="paper-goods">
      <div class="paper-goods-header">Paper Goods</div>
      <p style="padding:8px; font-size:9px; color:#999; font-style:italic;">Client opted out.</p>
    </div>`}
  </div>
</div>

<!-- FOOD TYPE SUMMARY -->
<div class="food-summary">
  <div class="food-type hot">
    <div class="count">${hotItems.length}</div>
    <div class="label">Hot Foods</div>
  </div>
  <div class="food-type cold">
    <div class="count">${coldItems.length}</div>
    <div class="label">Cold Foods</div>
  </div>
  <div class="food-type dry">
    <div class="count">${dryItems.length}</div>
    <div class="label">Dry Foods (besides boxes)</div>
  </div>
</div>

<!-- QC CHECKLIST -->
<div class="qc-section">
  <div class="qc-header">Final QC Checklist</div>
  <div class="qc-body">
    ${[
      'All HOT items temped and packed in correct packaging',
      'All COLD items / condiments included',
      'Serving utensils included (Tongs / Spoons / Ladles)',
      'Paper goods / Cutlery matched to guest count',
      'Delivery notes reviewed — special instructions followed',
      'Order label applied to all boxes',
      'Driver assigned and notified',
    ].map(item => `
      <div class="qc-item">
        <div class="qc-checkbox"></div>
        <span>${item}</span>
      </div>
    `).join('')}
  </div>
</div>

</body>
</html>`;
  }
}

module.exports = FulfillmentSheetGenerator;