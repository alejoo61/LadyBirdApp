// scripts/cleanTestCalendarEvents.js
// Uso: node scripts/cleanTestCalendarEvents.js --dry-run   (solo lista, no borra)
//       node scripts/cleanTestCalendarEvents.js --delete    (borra después de confirmación)

require('dotenv').config({ path: '../backend/.env' });

const { google } = require('googleapis');
const path       = require('path');
const fs         = require('fs');
const readline   = require('readline');
const { Pool }   = require('pg');

const CALENDAR_ID     = 'c_5180aeb27d1682079c6843eb35a504b01f692ef32de39acf7274f4a93ec7414b@group.calendar.google.com';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '../backend/google-credentials.json');

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--delete');
const isDelete = process.argv.includes('--delete');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

async function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientOptions: { subject: 'catering@ladybirdtaco.com' },
  });
}

async function listTestEvents(cal) {
  const testEvents = [];
  let pageToken    = null;

  console.log('\n🔍 Buscando eventos [TEST] en el calendario...\n');

  do {
    const response = await cal.events.list({
      calendarId:   CALENDAR_ID,
      maxResults:   250,
      singleEvents: true,
      orderBy:      'startTime',
      pageToken:    pageToken || undefined,
    });

    const events = response.data.items || [];

    for (const event of events) {
      const title = event.summary || '';
      if (title.startsWith('[TEST]')) {
        testEvents.push({
          id:    event.id,
          title,
          start: event.start?.dateTime || event.start?.date,
        });
      }
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return testEvents;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧹 Ladybird Calendar Cleaner');
  console.log(isDryRun ? '📋 MODO: DRY RUN (solo lista, no borra)' : '🗑️  MODO: DELETE');
  console.log('='.repeat(60));

  const auth = await getAuth();
  const cal  = google.calendar({ version: 'v3', auth });

  const testEvents = await listTestEvents(cal);

  if (testEvents.length === 0) {
    console.log('✅ No se encontraron eventos [TEST]. El calendario está limpio.');
    await pool.end();
    return;
  }

  console.log(`\n📋 Se encontraron ${testEvents.length} eventos [TEST]:\n`);
  testEvents.forEach((e, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. [${e.start?.slice(0, 10)}] ${e.title}`);
  });

  if (isDryRun) {
    console.log('\n✅ Dry run completo. Para borrar, corré: node cleanTestCalendarEvents.js --delete');
    await pool.end();
    return;
  }

  // Confirmación explícita antes de borrar
  console.log('\n⚠️  ATENCIÓN: Estás a punto de borrar estos eventos del calendario.');
  console.log('   Los eventos SIN [TEST] NO serán tocados.');
  const answer = await confirm('\n¿Confirmar borrado? Escribí "borrar" para continuar: ');

  if (answer !== 'borrar') {
    console.log('\n❌ Cancelado. No se borró nada.');
    await pool.end();
    return;
  }

  console.log('\n🗑️  Borrando eventos...\n');
  let deleted = 0;
  let errors  = 0;

  for (const event of testEvents) {
    try {
      await cal.events.delete({ calendarId: CALENDAR_ID, eventId: event.id });
      console.log(`  ✅ Borrado: ${event.title}`);
      deleted++;
    } catch (err) {
      console.error(`  ❌ Error borrando "${event.title}": ${err.message}`);
      errors++;
    }
  }

  // Limpiar google_event_id en la DB para los eventos borrados
  console.log('\n🔧 Limpiando google_event_id en la DB...');
  await pool.query(`
    UPDATE catering_orders
    SET google_event_id = NULL,
        calendar_needs_update = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE store_id = '31c7d0fc-f01c-47d2-8cd8-46ed3e2fdb2a'
      AND toast_order_guid NOT LIKE 'MANUAL-%'
  `);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Limpieza completa:`);
  console.log(`   Eventos borrados: ${deleted}`);
  console.log(`   Errores:          ${errors}`);
  console.log(`   DB actualizada:   google_event_id = NULL para todas las órdenes`);
  console.log(`${'='.repeat(60)}\n`);

  await pool.end();
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  pool.end();
  process.exit(1);
});