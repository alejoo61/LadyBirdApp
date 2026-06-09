// src/services/generators/PersonalBoxLabelsGenerator.js

class PersonalBoxLabelsGenerator {

  /**
   * Genera HTML de labels para Personal Box orders.
   * 10 labels por página (2 columnas x 5 filas), formato carta.
   */
  build(data) {
    const { header, personalBoxes } = data;

    if (!personalBoxes || personalBoxes.length === 0) return '<p>No personal boxes found.</p>';

    // Expandir boxes: qty > 1 → múltiples labels individuales
    const labels = [];
    for (const box of personalBoxes) {
      for (let i = 0; i < box.quantity; i++) {
        labels.push({
          combo:    box.comboLabel,
          tortilla: box.tortilla,
          salsa:    box.salsa    || null,
          note:     box.note     || null,
        });
      }
    }

    const total      = labels.length;
    const storeName  = header.storeName  || 'Ladybird Taco';
    const clientName = header.clientName || '—';
    const orderNum   = header.displayNumber || '—';
    const eventDate  = header.estimatedFulfillmentDate
      ? new Date(header.estimatedFulfillmentDate).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          timeZone: 'America/Chicago',
        }).toUpperCase()
      : '—';

    const labelHTML = (label, index) => {
      if (!label) return `<div class="label label-empty"></div>`;

      const boxNum  = `${index + 1} of ${total}`;
      const combos  = label.combo || '—';
      const details = [label.tortilla, label.salsa].filter(Boolean).join(' ∙ ');
      const footer  = `#${orderNum} ∙ ${storeName.toUpperCase()} ∙ ${eventDate}`;

      return `
        <div class="label">
          <div class="label-top">
            <span class="client">${this._esc(clientName)}</span>
            <span class="boxnum">${boxNum}</span>
          </div>
          <div class="label-mid">
            <div class="brand">LADYBIRD TACO ∙ Personal Bird Taco Box</div>
            <div class="combo">${this._esc(combos)}</div>
            ${details ? `<div class="details">${this._esc(details)}</div>` : ''}
            ${label.note ? `<div class="note">⚠ ${this._esc(label.note)}</div>` : ''}
          </div>
          <div class="label-foot">${this._esc(footer)}</div>
        </div>`;
    };

    // Agrupar en páginas de 10
    const pages = [];
    for (let i = 0; i < labels.length; i += 10) {
      pages.push(labels.slice(i, i + 10));
    }

    const pagesHTML = pages.map((page, pageIdx) => {
      // Rellenar hasta 10 si la última página tiene menos
      while (page.length < 10) page.push(null);
      return `
        <div class="page">
          ${page.map((label, i) => labelHTML(label, pageIdx * 10 + i)).join('')}
        </div>`;
    }).join('\n');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._css()}</style></head><body>
    ${pagesHTML}
    </body></html>`;
  }

  _css() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; background: white; }

      .page {
        width: 8.5in;
        height: 11in;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: repeat(5, 1fr);
        page-break-after: always;
      }

      .label {
        border: 1px solid #ccc;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }

      .label-empty {
        background: #fafafa;
      }

      /* Top row: client name + box number */
      .label-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }

      .client {
        font-size: 9px;
        font-weight: 700;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .boxnum {
        font-size: 9px;
        font-weight: 900;
        color: #c0392b;
      }

      /* Middle: main content */
      .label-mid {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3px;
      }

      .brand {
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #c0392b;
        margin-bottom: 2px;
      }

      .combo {
        font-size: 13px;
        font-weight: 900;
        color: #1a1a1a;
        line-height: 1.25;
      }

      .details {
        font-size: 9px;
        font-weight: 700;
        color: #444;
        margin-top: 2px;
      }

      .note {
        display: inline-block;
        margin-top: 4px;
        padding: 2px 8px;
        background: #fff3cd;
        border: 1.5px solid #f59e0b;
        border-radius: 4px;
        font-size: 8px;
        font-weight: 900;
        color: #92400e;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        width: fit-content;
      }

      /* Footer */
      .label-foot {
        font-size: 7px;
        font-weight: 700;
        color: #aaa;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-top: 1px solid #eee;
        padding-top: 4px;
        margin-top: 4px;
      }

      @media print {
        body { -webkit-print-color-adjust: exact; }
        .page { page-break-after: always; }
      }
    `;
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = PersonalBoxLabelsGenerator;