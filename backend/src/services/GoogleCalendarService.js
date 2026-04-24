// src/services/GoogleCalendarService.js
const { google } = require('googleapis');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');

// Calendar IDs por store code
const STORE_CALENDARS = {
  '002': 'c_5180aeb27d1682079c6843eb35a504b01f692ef32de39acf7274f4a93ec7414b@group.calendar.google.com',
  // Agregar otros stores cuando estén listos:
  // '001': 'xxx@group.calendar.google.com',
  // '003': 'xxx@group.calendar.google.com',
  // '004': 'xxx@group.calendar.google.com',
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
        subject: 'catering@ladybird.com',
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

  // ─── BUILD EVENT ──────────────────────────────────────────────────────────

  _buildEventTitle(order) {
    const status = (order.status || 'pending').toUpperCase();
    const method = order.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Pickup';
    const name   = order.clientName || 'Unknown';
    const prefix = IS_TEST_MODE ? '[TEST] ' : '';
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

  _buildEventDates(order) {
    const start = new Date(order.estimatedFulfillmentDate);
    const end   = new Date(start.getTime() + 60 * 60 * 1000); // +1 hora
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

      // Hacer el archivo accesible para cualquiera con el link
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

  async createEvent(order, pdfBuffer, pdfFilename) {
    const calendarId = this._getCalendarId(order.storeCode);
    if (!calendarId) {
      console.log(`⚠️  No calendar configured for store ${order.storeCode} — skipping`);
      return null;
    }

    const cal   = await this._getCal();
    const dates = this._buildEventDates(order);

    // 1. Subir PDF a Drive
    let driveFile = null;
    if (pdfBuffer && pdfFilename) {
      try {
        driveFile = await this.uploadPdfToDrive(pdfBuffer, pdfFilename);
        console.log(`📎 PDF uploaded to Drive: ${driveFile.webViewLink}`);
      } catch (err) {
        console.error('❌ Drive upload failed:', err.message);
      }
    }

    // 2. Crear evento
    const eventBody = {
      summary:     this._buildEventTitle(order),
      description: this._buildDescription(order),
      start:       dates.start,
      end:         dates.end,
      location:    order.deliveryAddress || '',
      attachments: driveFile ? [{
        fileUrl:  driveFile.webViewLink,
        title:    pdfFilename,
        mimeType: 'application/pdf',
      }] : [],
    };

    const response = await cal.events.insert({
      calendarId,
      requestBody:        eventBody,
      supportsAttachments: true,
    });

    console.log(`✅ Calendar event created: ${response.data.htmlLink}`);
    return {
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
      driveFile,
    };
  }

  // ─── CALENDAR: UPDATE EVENT ───────────────────────────────────────────────

  async updateEvent(order, googleEventId, pdfBuffer, pdfFilename) {
    const calendarId = this._getCalendarId(order.storeCode);
    if (!calendarId || !googleEventId) return null;

    const cal   = await this._getCal();
    const dates = this._buildEventDates(order);

    // Subir nuevo PDF si viene
    let driveFile = null;
    if (pdfBuffer && pdfFilename) {
      try {
        driveFile = await this.uploadPdfToDrive(pdfBuffer, pdfFilename);
      } catch (err) {
        console.error('❌ Drive upload failed:', err.message);
      }
    }

    // Obtener attachments existentes
    const existing = await cal.events.get({ calendarId, eventId: googleEventId });
    const existingAttachments = existing.data.attachments || [];

    const eventBody = {
      summary:     this._buildEventTitle(order),
      description: this._buildDescription(order),
      start:       dates.start,
      end:         dates.end,
      location:    order.deliveryAddress || '',
      attachments: driveFile
        ? [...existingAttachments, {
            fileUrl:  driveFile.webViewLink,
            title:    pdfFilename,
            mimeType: 'application/pdf',
          }]
        : existingAttachments,
    };

    const response = await cal.events.update({
      calendarId,
      eventId:            googleEventId,
      requestBody:        eventBody,
      supportsAttachments: true,
    });

    console.log(`✅ Calendar event updated: ${response.data.htmlLink}`);
    return {
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
      driveFile,
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