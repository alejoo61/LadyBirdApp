// src/services/generators/SpaceRentalGenerator.js
const BaseGenerator = require('./BaseGenerator');

class SpaceRentalGenerator extends BaseGenerator {

  build(data) {
    const { header, spaceRental } = data;
    const badge = this._eventTypeBadge(header.eventType);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${this._baseCSS(badge.color)}</style></head><body>
    ${this._headerHTML(header, badge)}
    ${this._renderSpaceRentalDetails(spaceRental, header)}
    ${this._renderQC([
      'Space confirmed with management',
      'Tables and chairs arranged per client request',
      'Space cleaned and ready 25 min before event',
      'Client contact notified of readiness',
      'Payment confirmed',
      'Driver / staff assigned and notified',
    ])}
    </body></html>`;
  }

  _renderSpaceRentalDetails(spaceRental, header) {
    if (!spaceRental) return '';

    const hasFood = spaceRental.hasFood;

    return `
    <div class="section" style="margin-top:8px">
      <div class="section-header" style="background:#7b2d8b">Space Rental Details</div>
      <table>
        <tbody>
          <tr>
            <td style="font-weight:900; width:160px; background:#f9f0ff">Rental Type</td>
            <td><strong>${spaceRental.rentalType || 'Space Rental'}</strong></td>
          </tr>
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Event Time</td>
            <td><strong style="color:#c0392b">${spaceRental.eventTime || '—'}</strong></td>
          </tr>
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Duration</td>
            <td>${spaceRental.duration || '—'}</td>
          </tr>
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Ready By</td>
            <td>
              <strong style="color:#1565c0">${spaceRental.readyBy || '—'}</strong>
              <span style="font-size:8px; color:#666; margin-left:6px">(25 min before event — adjust as needed)</span>
            </td>
          </tr>
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Includes Food</td>
            <td>
              <span style="
                display:inline-block; padding:2px 8px; border-radius:3px;
                font-size:9px; font-weight:900;
                background:${hasFood ? '#e8f5e9' : '#f5f5f5'};
                color:${hasFood ? '#2e7d32' : '#888'};
                border:1px solid ${hasFood ? '#a5d6a7' : '#ccc'};
              ">${hasFood ? 'YES — See fulfillment sheet' : 'NO — Space only'}</span>
            </td>
          </tr>
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Total Amount</td>
            <td><strong>$${parseFloat(spaceRental.totalAmount || 0).toFixed(2)}</strong></td>
          </tr>
          ${header.deliveryNotes ? `
          <tr>
            <td style="font-weight:900; background:#f9f0ff">Notes</td>
            <td style="font-size:9px">${header.deliveryNotes}</td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>

    ${hasFood ? `
    <div style="
      background:#fff3e0; border:2px solid #ff8c00; border-radius:4px;
      padding:8px 12px; margin-top:8px;
      font-size:9px; font-weight:900; color:#e65100;
      text-transform:uppercase; letter-spacing:0.08em;
    ">
      ⚠ This order includes food — refer to the catering fulfillment sheet for food prep details
    </div>` : ''}`;
  }
}

module.exports = SpaceRentalGenerator;