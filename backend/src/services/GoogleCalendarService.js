// src/services/GoogleCalendarService.js
const { google } = require('googleapis');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');

// Calendar IDs por store code
const STORE_CALENDARS = {
  '002': 'c_5180aeb27d1682079c6843eb35a504b01f692ef32de39acf7274f4a93ec7414b@group.calendar.google.com',
  '004': 'c_eeaabbf1d44ea1d2dfb6fed01cfb25613ec6ad19bd10e91b5e8baf50accf8b63@group.calendar.google.com',
  // '001': 'xxx@group.calendar.google.com',
  // '003': 'xxx@group.calendar.google.com',
  // '005': 'xxx@group.calendar.google.com',
};

const DRIVE_FOLDER_ID   = '1-cJOkjMm4c3hSBkW-52UPx_Edqw_9tJg';
const CREDENTIALS_PATH  = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '../../google-credentials.json');
const IS_TEST_MODE      = process.env.GOOGLE_CALENDAR_TEST_MODE !== 'false';

class GoogleCalendarService {
  constructor() {
    this.auth   = null;
    this.drive  = null;
    this.cal    = null;
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────

  async _getAuth() {
    if (this.auth) return this.auth;
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive',
      ],
      clientOptions: {
        subject: 'catering@ladybirdtaco.com',
      },
    });
    return this.auth;
  }

  async _getDrive() {
    if (this.drive) return this.drive;
    const auth  = await this._getAuth();
    this.drive  = google.drive({ version: 'v3', auth });
    return this.drive;
  }

  async _getCal() {
    if (this.cal) return this.cal;
    const auth = await this._getAuth();
    this.cal   = google.calendar({ version: 'v3', auth });
    return this.cal;
  }

  // ─── CALENDAR ID ──────────────────────────────────────────────────────────

  _getCalendarId(storeCode) {
    return STORE_CALENDARS[storeCode] || null;
  }

  // ─── BUILD EVENT TITLE ────────────────────────────────────────────────────

  _buildEventTitle(order) {
    const status = (order.status || 'pending').toUpperCase();
    const name   = order.clientName || 'Unknown';
    const prefix = '[APP] ';

    const isSpaceRental = order.eventType === 'SPACE_RENTAL' ||
      (order.parsedData?.items || order.items || []).some(i =>
        (i.displayName || i.name || '').toLowerCase().includes('space rental')
      );

    if (isSpaceRental) {
      return `${prefix}${status}, Space Rental: ${name}`;
    }

    const method = order.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Pickup';
    return `${prefix}${status}, ${method}: ${name}`;
  }

  _buildDescription(order) {
    const toastUrl = order.toastOrderGuid && !order.toastOrderGuid.startsWith('MANUAL-')
      ? `https://www.toasttab.com/restaurants/admin/invoices/events/${order.toastOrderGuid}`
      : null;

    const itemsList = (order.parsedData?.items || order.items || [])
      .map(item => {
        const mods = (item.modifiers || [])
          .filter(m => m.displayName && !m.displayName.startsWith('NO,'))
          .map(m => m.displayName)
          .join(', ');
        return `${item.quantity}x ${item.displayName || item.name}${mods ? ` - ${mods}` : ''} = $${parseFloat(item.price || 0).toFixed(2)}`;
      })
      .join('\n');

    return [
      `Catering order #${order.displayNumber || '—'}`,
      `Catering order status: ${order.status || 'pending'}`,
      toastUrl ? `Order: ${toastUrl}` : null,
      '',
      '------------------',
      '',
      'Customer info:',
      order.clientName    || '—',
      order.orgName       || '',
      order.clientEmail   || '—',
      order.deliveryAddress ? order.deliveryAddress : '',
      order.clientPhone   || '—',
      '',
      '------------------',
      '',
      `Guest Count: ${order.guestCount || '—'}`,
      order.deliveryAddress ? `Delivery Address: ${order.deliveryAddress}` : '',
      order.deliveryNotes ? `Notes: ${order.deliveryNotes}` : '',
      '',
      '------------------',
      '',
      itemsList,
      '',
      `Total = $${parseFloat(order.totalAmount || 0).toFixed(2)}`,
      '',
      IS_TEST_MODE ? '\n⚠️ TEST EVENT — Do not action this event' : '',
    ].filter(l => l !== null).join('\n');
  }

  // ─── BUILD EVENT DATES ────────────────────────────────────────────────────

  _buildEventDates(order, calculatedData) {
    if (order.eventType === 'SPACE_RENTAL' && calculatedData?.spaceRental?.startISO) {
      const sr = calculatedData.spaceRental;
      return {
        start: { dateTime: sr.startISO, timeZone: 'America/Chicago' },
        end:   { dateTime: sr.endISO || new Date(new Date(sr.startISO).getTime() + 3600000).toISOString(), timeZone: 'America/Chicago' },
      };
    }

    const start = new Date(order.estimatedFulfillmentDate);
    const end   = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      start: { dateTime: start.toISOString(), timeZone: 'America/Chicago' },
      end:   { dateTime: end.toISOString(),   timeZone: 'America/Chicago' },
    };
  }

  // ─── DRIVE: UPLOAD PDF ────────────────────────────────────────────────────

  async uploadPdfToDrive(pdfBuffer, filename) {
    const drive    = await this._getDrive();
    const tmpPath  = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tmpPath, pdfBuffer);

    try {
      const response = await drive.files.create({
        requestBody: {
          name:    filename,
          parents: [DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: 'application/pdf',
          body:     fs.createReadStream(tmpPath),
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      await drive.permissions.create({
        fileId:      response.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });

      return {
        fileId:      response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  // ─── CALENDAR: CREATE EVENT ───────────────────────────────────────────────
  // labelsPdf / labelsPdfName son opcionales — solo para Personal Box

  async createEvent(order, pdfBuffer, pdfFilename, calculatedData, labelsPdf = null, labelsPdfName = null) {
    const calendarId = this._getCalendarId(order.storeCode);
    if (!calendarId) {
      console.log(`⚠️  No calendar configured for store ${order.storeCode} — skipping`);
      return null;
    }

    const cal   = await this._getCal();
    const dates = this._buildEventDates(order, calculatedData);

    // Subir fulfillment sheet
    const attachments = [];
    if (pdfBuffer && pdfFilename) {
      try {
        const driveFile = await this.uploadPdfToDrive(pdfBuffer, pdfFilename);
        console.log(`📎 Fulfillment PDF uploaded: ${driveFile.webViewLink}`);
        attachments.push({
          fileUrl:  driveFile.webViewLink,
          title:    pdfFilename,
          mimeType: 'application/pdf',
        });
      } catch (err) {
        console.error('❌ Fulfillment PDF upload failed:', err.message);
      }
    }

    // Subir labels si existen (Personal Box)
    if (labelsPdf && labelsPdfName) {
      try {
        const labelsFile = await this.uploadPdfToDrive(labelsPdf, labelsPdfName);
        console.log(`🏷️  Labels PDF uploaded: ${labelsFile.webViewLink}`);
        attachments.push({
          fileUrl:  labelsFile.webViewLink,
          title:    labelsPdfName,
          mimeType: 'application/pdf',
        });
      } catch (err) {
        console.error('❌ Labels PDF upload failed:', err.message);
      }
    }

    const eventBody = {
      summary:     this._buildEventTitle(order),
      description: this._buildDescription(order),
      start:       dates.start,
      end:         dates.end,
      location:    order.deliveryAddress || '',
      attachments,
    };

    const response = await cal.events.insert({
      calendarId,
      requestBody:         eventBody,
      supportsAttachments: true,
    });

    console.log(`✅ Calendar event created: ${response.data.htmlLink}`);
    return {
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
    };
  }

  // ─── CALENDAR: UPDATE EVENT ───────────────────────────────────────────────

  async updateEvent(order, googleEventId, pdfBuffer, pdfFilename, calculatedData, labelsPdf = null, labelsPdfName = null) {
    const calendarId = this._getCalendarId(order.storeCode);
    if (!calendarId || !googleEventId) return null;

    const cal   = await this._getCal();
    const dates = this._buildEventDates(order, calculatedData);

    // Traer attachments existentes — filtrar PDFs viejos de fulfillment sheets
    // Solo se mantiene el último PDF generado por tipo
    const existing            = await cal.events.get({ calendarId, eventId: googleEventId });
    const FULFILLMENT_PATTERNS = ['_BirdBox_', '_TacoBar_', '_PersonalBox_', '_NeedsReview_', '_Fooda_', '_SpaceRental_', 'ManualSheet_'];
    const existingAttachments = (existing.data.attachments || []).filter(a =>
      !FULFILLMENT_PATTERNS.some(p => (a.title || '').includes(p))
    );

    const attachments = [...existingAttachments];

    // Subir nuevo fulfillment sheet
    if (pdfBuffer && pdfFilename) {
      try {
        const driveFile = await this.uploadPdfToDrive(pdfBuffer, pdfFilename);
        console.log(`📎 Fulfillment PDF uploaded: ${driveFile.webViewLink}`);
        attachments.push({
          fileUrl:  driveFile.webViewLink,
          title:    pdfFilename,
          mimeType: 'application/pdf',
        });
      } catch (err) {
        console.error('❌ Fulfillment PDF upload failed:', err.message);
      }
    }

    // Subir labels si existen (Personal Box)
    if (labelsPdf && labelsPdfName) {
      try {
        const labelsFile = await this.uploadPdfToDrive(labelsPdf, labelsPdfName);
        console.log(`🏷️  Labels PDF uploaded: ${labelsFile.webViewLink}`);
        attachments.push({
          fileUrl:  labelsFile.webViewLink,
          title:    labelsPdfName,
          mimeType: 'application/pdf',
        });
      } catch (err) {
        console.error('❌ Labels PDF upload failed:', err.message);
      }
    }

    const eventBody = {
      summary:     this._buildEventTitle(order),
      description: this._buildDescription(order),
      start:       dates.start,
      end:         dates.end,
      location:    order.deliveryAddress || '',
      attachments,
    };

    const response = await cal.events.update({
      calendarId,
      eventId:             googleEventId,
      requestBody:         eventBody,
      supportsAttachments: true,
    });

    console.log(`✅ Calendar event updated: ${response.data.htmlLink}`);
    return {
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
    };
  }

  // ─── CALENDAR: DELETE EVENT ───────────────────────────────────────────────

  async deleteEvent(storeCode, googleEventId) {
    const calendarId = this._getCalendarId(storeCode);
    if (!calendarId || !googleEventId) return;
    const cal = await this._getCal();
    await cal.events.delete({ calendarId, eventId: googleEventId });
    console.log(`🗑️  Calendar event deleted: ${googleEventId}`);
  }
}

module.exports = GoogleCalendarService;