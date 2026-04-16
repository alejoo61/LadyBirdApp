// src/services/FulfillmentSheetGenerator.js
const puppeteer          = require('puppeteer');
const path               = require('path');
const fs                 = require('fs');
const os                 = require('os');
const TacoBarGenerator   = require('./generators/TacoBarGenerator');
const BirdBoxGenerator   = require('./generators/BirdBoxGenerator');
const PersonalBoxGenerator = require('./generators/PersonalBoxGenerator');
const FoodaGenerator     = require('./generators/FoodaGenerator');

const GENERATORS = {
  TACO_BAR:     new TacoBarGenerator(),
  BIRD_BOX:     new BirdBoxGenerator(),
  PERSONAL_BOX: new PersonalBoxGenerator(),
  FOODA:        new FoodaGenerator(),
};

class FulfillmentSheetGenerator {

  async generate(calculatedData) {
    const { header } = calculatedData;
    const generator  = GENERATORS[header.eventType] || GENERATORS.TACO_BAR;
    const html       = generator.build(calculatedData);

    const tmpPath = path.join(os.tmpdir(), `fulfillment-${Date.now()}.pdf`);
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

  buildFilename(order, storeCode) {
    const eventTypeCode = {
      TACO_BAR:     'TacoBar',
      BIRD_BOX:     'BirdBox',
      PERSONAL_BOX: 'PersonalBox',
      FOODA:        'Fooda',
      NEEDS_REVIEW: 'NeedsReview',
    }[order.eventType] || order.eventType || 'Unknown';

    const store      = (storeCode || 'LB').replace(/\s/g, '');
    const clientSlug = (order.clientName || 'unknown')
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 25);
    const version    = order.pdfVersion || 1;

    return `${store}_${clientSlug}_${eventTypeCode}_V${version}.pdf`;
  }
}

module.exports = FulfillmentSheetGenerator;