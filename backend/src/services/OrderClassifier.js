// src/services/OrderClassifier.js

const CATERING_DINING_OPTION_GUIDS = [
  'a0a4eb42-b468-42c3-a2ee-0e15b5af009f',
  'ae4ad87f-6b5f-420d-8f18-ead05bed9069',
];

const CATERING_SOURCES = ['Catering Online Ordering', 'Invoice'];

const EVENT_TYPE_KEYWORDS = {
  TACO_BAR:     ['build your own taco bar', 'taco bar'],
  BIRD_BOX:     ["breakfast 'bird box", "lunch 'bird box", "build your own 'bird box", 'bird box'],
  PERSONAL_BOX: ["personal breakfast 'bird box", "personal lunch 'bird box", "byo personal 'bird box"],
  FOODA:        ['fooda'],
};

class OrderClassifier {

  isCatering(rawOrder) {
    if (rawOrder.voided === true) return false;

    const isCateringDiningOption = CATERING_DINING_OPTION_GUIDS.includes(
      rawOrder.diningOption?.guid
    );
    const isCateringSource = CATERING_SOURCES.includes(rawOrder.source);

    return isCateringDiningOption || isCateringSource;
  }

  classifyEventType(rawOrder) {
    const allText = this._extractAllText(rawOrder).toLowerCase();
    for (const [eventType, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
      if (keywords.some(kw => allText.includes(kw))) return eventType;
    }
    return 'NEEDS_REVIEW';
  }

  classify(rawOrder) {
    if (!this.isCatering(rawOrder)) return null;
    return this.classifyEventType(rawOrder);
  }

  getPaymentStatus(rawOrder) {
    return rawOrder.checks?.[0]?.paymentStatus || 'OPEN';
  }

  _extractAllText(rawOrder) {
    const parts = [];
    for (const check of rawOrder.checks || []) {
      for (const selection of check.selections || []) {
        parts.push(selection.displayName || '');
      }
    }
    return parts.join(' ');
  }
}

module.exports = OrderClassifier;