// src/services/AuditService.js

// Campos que se trackean en ediciones manuales con sus labels legibles
const TRACKED_FIELDS = [
  { key: 'clientName',               label: 'Client Name'       },
  { key: 'clientEmail',              label: 'Email'             },
  { key: 'clientPhone',              label: 'Phone'             },
  { key: 'storeId',                  label: 'Store'             },
  { key: 'eventType',                label: 'Event Type'        },
  { key: 'status',                   label: 'Status'            },
  { key: 'paymentStatus',            label: 'Payment Status'    },
  { key: 'estimatedFulfillmentDate', label: 'Event Date'        },
  { key: 'deliveryMethod',           label: 'Delivery Method'   },
  { key: 'deliveryAddress',          label: 'Delivery Address'  },
  { key: 'deliveryNotes',            label: 'Delivery Notes'    },
  { key: 'guestCount',               label: 'Guest Count'       },
  { key: 'totalAmount',              label: 'Total Amount'      },
  { key: 'overrideNotes',            label: 'Internal Notes'    },
];

class AuditService {
  constructor(auditRepository) {
    this.repo = auditRepository;
  }

  // ─── MÉTODOS DE LOGGING ───────────────────────────────────────────────────

  async logOrderCreated(orderId, actor, orderData) {
    return this._log({
      orderId,
      action:   'ORDER_CREATED',
      actor,
      changes:  null,
      metadata: {
        eventType:     orderData.eventType,
        clientName:    orderData.clientName,
        guestCount:    orderData.guestCount,
        totalAmount:   orderData.totalAmount,
        deliveryMethod: orderData.deliveryMethod,
      },
    });
  }

  async logStatusChange(orderId, actor, before, after) {
    return this._log({
      orderId,
      action:  'STATUS_CHANGE',
      actor,
      changes: {
        status: { before, after },
      },
    });
  }

  async logPaymentChange(orderId, actor, before, after) {
    return this._log({
      orderId,
      action:  'PAYMENT_CHANGE',
      actor,
      changes: {
        paymentStatus: { before, after },
      },
    });
  }

  /**
   * Compara before y after y registra solo los campos que cambiaron.
   * beforeOrder: el objeto de orden ANTES del cambio (entity o DTO)
   * afterData: el body del request (campos que se intentó cambiar)
   */
  async logManualEdit(orderId, actor, beforeOrder, afterData) {
    const changes = {};

    for (const { key, label } of TRACKED_FIELDS) {
      const before = beforeOrder[key];
      const after  = afterData[key];

      // Solo registrar si el campo viene en afterData y cambió
      if (after === undefined) continue;
      if (String(before ?? '') === String(after ?? '')) continue;

      changes[label] = {
        before: before ?? null,
        after:  after  ?? null,
      };
    }

    if (Object.keys(changes).length === 0) return null; // nada cambió

    return this._log({
      orderId,
      action:  'MANUAL_EDIT',
      actor,
      changes,
    });
  }

  async logPdfGenerated(orderId, actor, pdfVersion) {
    return this._log({
      orderId,
      action:   'PDF_GENERATED',
      actor,
      changes:  null,
      metadata: { pdfVersion },
    });
  }

  async logCalendarSynced(orderId, actor, calendarEventId) {
    return this._log({
      orderId,
      action:   'CALENDAR_SYNCED',
      actor,
      changes:  null,
      metadata: { calendarEventId },
    });
  }

  async logToastSync(orderId) {
    return this._log({
      orderId,
      action: 'TOAST_SYNC',
      actor:  'system',
    });
  }

  // ─── QUERIES ──────────────────────────────────────────────────────────────

  async getByOrderId(orderId) {
    const rows = await this.repo.findByOrderId(orderId);
    return rows.map(r => this._format(r));
  }

  async getAll(filters = {}) {
    const rows = await this.repo.findAll(filters);
    return rows.map(r => this._format(r));
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  async _log({ orderId, action, actor, changes, metadata }) {
    try {
      return await this.repo.create({ orderId, action, actor, changes, metadata });
    } catch (err) {
      // No fallar si el audit log falla — es secundario
      console.error(`⚠️  AuditService._log failed [${action}]:`, err.message);
      return null;
    }
  }

  _format(row) {
    return {
      id:          row.id,
      orderId:     row.order_id,
      action:      row.action,
      actionLabel: this._actionLabel(row.action),
      actor:       row.actor,
      changes:     row.changes  || null,
      metadata:    row.metadata || null,
      createdAt:   row.created_at,
      // Joined fields (solo en getAll)
      clientName:    row.client_name    || null,
      displayNumber: row.display_number || null,
    };
  }

  _actionLabel(action) {
    const labels = {
      ORDER_CREATED:   'Order Created',
      STATUS_CHANGE:   'Status Changed',
      PAYMENT_CHANGE:  'Payment Updated',
      MANUAL_EDIT:     'Manually Edited',
      PDF_GENERATED:   'PDF Generated',
      CALENDAR_SYNCED: 'Calendar Synced',
      TOAST_SYNC:      'Synced from Toast',
    };
    return labels[action] || action;
  }
}

module.exports = AuditService;