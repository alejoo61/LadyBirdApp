require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'ladybird_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const initDB = async () => {
  try {

    // ─── 1. usuarios ──────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id          SERIAL PRIMARY KEY,
        usuario     VARCHAR(255) UNIQUE NOT NULL,
        contrasena  VARCHAR(255) NOT NULL,
        creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ usuarios');

    // ─── 2. stores ────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code                   TEXT UNIQUE NOT NULL,
        name                   TEXT NOT NULL,
        timezone               TEXT DEFAULT 'America/Chicago',
        is_active              BOOLEAN DEFAULT true,
        emails                 TEXT,
        toast_restaurant_guid  TEXT UNIQUE,
        created_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ stores');

    // ─── 3. equipment ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
        equipment_code  TEXT UNIQUE NOT NULL,
        type            TEXT NOT NULL,
        name            TEXT NOT NULL,
        year_code       TEXT NOT NULL,
        seq             INTEGER NOT NULL,
        is_down         BOOLEAN DEFAULT false,
        qr_code_text    TEXT,
        deleted_at      TIMESTAMPTZ DEFAULT NULL,
        created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ equipment');

    // ─── 4. equipment_transfer_history ────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_transfer_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id    UUID REFERENCES equipment(id) ON DELETE CASCADE,
        from_store_id   UUID REFERENCES stores(id),
        to_store_id     UUID REFERENCES stores(id),
        transferred_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        reason          TEXT DEFAULT 'Transferencia de sucursal'
      )
    `);
    console.log('✅ equipment_transfer_history');

    // ─── 5. Enums mantenimiento ───────────────────────────────────────────────
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE request_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ─── 6. maintenance_requests ──────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id          UUID REFERENCES equipment(id) ON DELETE CASCADE,
        store_id              UUID REFERENCES stores(id) ON DELETE CASCADE,
        urgency               urgency NOT NULL DEFAULT 'medium',
        status                request_status NOT NULL DEFAULT 'pending',
        description           TEXT NOT NULL,
        photo_urls            TEXT[],
        requested_by_email    TEXT NOT NULL,
        assigned_gm_email     TEXT,
        notified_agm_email    TEXT,
        due_at                TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ maintenance_requests');

    // ─── 7. toast_orders ──────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toast_orders (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
        toast_order_guid  TEXT UNIQUE NOT NULL,
        raw_payload       JSONB NOT NULL,
        order_date        TIMESTAMPTZ,
        sync_status       TEXT DEFAULT 'pending',
        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ toast_orders');

    // ─── 8. catering_orders ───────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catering_orders (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id                    UUID REFERENCES stores(id) ON DELETE SET NULL,
        toast_order_id              UUID REFERENCES toast_orders(id) ON DELETE SET NULL,
        toast_order_guid            TEXT UNIQUE NOT NULL,
        display_number              TEXT,
        event_type                  TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
        status                      TEXT NOT NULL DEFAULT 'pending',

        client_name                 TEXT,
        client_email                TEXT,
        client_phone                TEXT,

        order_date                  TIMESTAMPTZ,
        estimated_fulfillment_date  TIMESTAMPTZ,
        business_date               INTEGER,

        delivery_method             TEXT DEFAULT 'PICKUP',
        delivery_address            TEXT,
        delivery_notes              TEXT,
        driver_name                 TEXT,

        parsed_data                 JSONB,
        guest_count                 INTEGER,
        total_amount                NUMERIC(10,2),

        override_data               JSONB DEFAULT '{}',
        override_notes              TEXT,

        payment_status              TEXT DEFAULT 'OPEN',
        is_manually_edited          BOOLEAN DEFAULT false,

        created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ catering_orders');

    // ─── 9. ingredient_formulas ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_formulas (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name              TEXT NOT NULL,
        canonical_name    TEXT,
        category          TEXT NOT NULL,
        amount_per_person NUMERIC(10,4) NOT NULL DEFAULT 0,
        unit              TEXT NOT NULL DEFAULT 'ozm',
        utensil           TEXT,
        small_package     TEXT,
        small_package_max INTEGER,
        large_package     TEXT,
        large_package_max INTEGER,
        temp_type         TEXT DEFAULT 'cold',
        event_type        TEXT,
        event_types       TEXT[] DEFAULT '{}',
        is_active         BOOLEAN DEFAULT true,
        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ingredient_formula_unique UNIQUE (canonical_name, event_type)
      )
    `);
    console.log('✅ ingredient_formulas');

    // ─── 10. ingredient_aliases ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_aliases (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        canonical_name TEXT NOT NULL,
        alias          TEXT NOT NULL,
        created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(alias)
      )
    `);
    console.log('✅ ingredient_aliases');

    // ─── 11. menu_items ───────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT UNIQUE NOT NULL,
        category    TEXT NOT NULL DEFAULT 'menu_item',
        event_types TEXT[] DEFAULT '{}',
        description TEXT,
        price       NUMERIC(10,2) DEFAULT 0,
        is_active   BOOLEAN DEFAULT true,
        sort_order  INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ menu_items');

    // ─── MIGRATIONS (idempotentes) ────────────────────────────────────────────
    // Agregar columnas que pueden faltar en DBs existentes
    const migrations = [
      `ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'OPEN'`,
      `ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT false`,
      `ALTER TABLE ingredient_formulas ADD COLUMN IF NOT EXISTS canonical_name TEXT`,
      `ALTER TABLE ingredient_formulas ADD COLUMN IF NOT EXISTS event_type TEXT`,
      `ALTER TABLE stores ADD COLUMN IF NOT EXISTS toast_restaurant_guid TEXT`,
    ];

    for (const migration of migrations) {
      try {
        await pool.query(migration);
      } catch (err) {
        // Ignorar errores de columnas ya existentes
        if (!err.message.includes('already exists')) {
          console.warn('⚠️  Migration warning:', err.message);
        }
      }
    }
    console.log('✅ Migrations aplicadas');

    // ─── SEED STORES ──────────────────────────────────────────────────────────
    const storesCount = await pool.query('SELECT COUNT(*) FROM stores');
    if (parseInt(storesCount.rows[0].count) === 0) {
      console.log('📝 Insertando stores...');
      await pool.query(`
        INSERT INTO stores (code, name, timezone, is_active, emails, toast_restaurant_guid)
        VALUES
          ('001', 'Ladybird Taco - 12 South',  'America/Chicago',  true, '', '412d1371-6225-4bb2-8cdc-9dca897f9a6a'),
          ('002', 'Ladybird Taco - Mtn Brook',  'America/Chicago',  true, '', 'cf9c2958-35bd-4c80-b113-3608fab70776'),
          ('003', 'Ladybird Taco - Inglewood',  'America/Chicago',  true, '', 'cc944a98-c4ab-4ec2-b122-d60059b1fb89'),
          ('004', 'Ladybird Taco - Gulch',      'America/Chicago',  true, '', '93edfab9-460c-4275-8ec5-8b21ba200a9f'),
          ('005', 'Ladybird Taco - Dilworth',   'America/New_York', true, '', 'c11b3f26-dd57-446f-8b5c-a41ebee6a724')
        ON CONFLICT (code) DO UPDATE SET
          toast_restaurant_guid = EXCLUDED.toast_restaurant_guid,
          name                  = EXCLUDED.name
      `);
      console.log('✅ Stores insertados');
    }

    // ─── SEED INGREDIENT FORMULAS ─────────────────────────────────────────────
    const formulasCount = await pool.query(
      `SELECT COUNT(*) FROM ingredient_formulas WHERE event_type IS NOT NULL`
    );
    if (parseInt(formulasCount.rows[0].count) === 0) {
      console.log('📝 Insertando fórmulas base...');
      await pool.query(`
        INSERT INTO ingredient_formulas
          (name, canonical_name, category, amount_per_person, unit, utensil,
           small_package, small_package_max, large_package, large_package_max,
           temp_type, event_type, is_active)
        VALUES
          -- TACO BAR — PROTEINS
          ('Salsa Verde Braised Chicken', 'Salsa Verde Braised Chicken', 'protein', 3.4,  'ozm',   'Spoon Serving', 'Double Half Pan', 80,  'Full Pan', 140, 'hot',  'TACO_BAR',    true),
          ('House-smoked Brisket',        'House-smoked Brisket',        'protein', 2.7,  'ozm',   'Tongs Large',   'Half Pan',        60,  'Full Pan', 140, 'hot',  'TACO_BAR',    true),
          ('Chorizo',                     'Chorizo',                     'protein', 1.6,  'ozm',   'Spoon Serving', 'Half Pan',        80,  'Full Pan', null,'hot',  'TACO_BAR',    true),
          ('Adobo Chicken',               'Adobo Chicken',               'protein', 3.4,  'ozm',   'Spoon Serving', 'Half Pan',        80,  'Full Pan', 140, 'hot',  'TACO_BAR',    true),
          ('Tenderbelly Bacon',           'Tenderbelly Bacon',           'protein', 1.6,  'slice', 'Tongs Large',   'Half Pan',        60,  'Full Pan', 120, 'hot',  'TACO_BAR',    true),
          ('Egg',                         'Egg',                         'protein', 2.9,  'ozm',   'Spoon Serving', 'Half Pan',        80,  'Full Pan', 120, 'hot',  'TACO_BAR',    true),

          -- TACO BAR — TOPPINGS
          ('Black Beans',    'Black Beans',    'topping', 1.5, 'ozm',   'Spoon Serving', 'Third Pan',      40, 'Half Pan',  60,  'hot',  'TACO_BAR', true),
          ('Rajas',          'Rajas',          'topping', 1.4, 'ozm',   'Tongs Large',   'Third Pan',      30, 'Full Pan',  50,  'hot',  'TACO_BAR', true),
          ('Sliced Avocado', 'Sliced Avocado', 'topping', 3.0, 'slice', 'Tongs Small',   'Third Pan',      50, 'Half Pan',  100, 'cold', 'TACO_BAR', true),
          ('Pico De Gallo',  'Pico De Gallo',  'topping', 1.1, 'ozm',   'Spoon Serving', '32 oz deli cup', 30, 'Half Pan',  50,  'cold', 'TACO_BAR', true),
          ('Shredded Cheese','Shredded Cheese','topping', 0.6, 'ozm',   'Tongs Small',   '32 oz deli cup', 15, 'Third Pan', 30,  'cold', 'TACO_BAR', true),
          ('Cotija',         'Cotija',         'topping', 0.2, 'ozm',   'Spoon Small',   '32 oz deli cup', 15, 'Third Pan', 20,  'cold', 'TACO_BAR', true),
          ('Cabbage',        'Cabbage',        'topping', 0.6, 'ozm',   'Tongs Small',   '32 oz deli cup', 15, 'Full Pan',  50,  'cold', 'TACO_BAR', true),
          ('Pickled Onions', 'Pickled Onions', 'topping', 0.5, 'ozm',   'Tongs Small',   '32 oz deli cup', 20, 'Third Pan', 40,  'cold', 'TACO_BAR', true),
          ('Crispy Potato',  'Crispy Potato',  'topping', 0.6, 'ozm',   'Spoon Serving', '32 oz deli cup', 15, 'Full Pan',  80,  'dry',  'TACO_BAR', true),
          ('Pepitas',        'Pepitas',        'topping', 0.4, 'ozm',   'Spoon Small',   '32 oz deli cup', 20, 'Third Pan', 40,  'dry',  'TACO_BAR', true),
          ('Radish',         'Radish',         'topping', 6.0, 'slice', 'Spoon Small',   '32 oz deli cup', 20, 'Third Pan', 35,  'cold', 'TACO_BAR', true),

          -- TACO BAR — SALSAS
          ('Patron',      'Patron',      'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'TACO_BAR', true),
          ('Salsa Verde', 'Salsa Verde', 'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'TACO_BAR', true),
          ('Salsa Roja',  'Salsa Roja',  'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'TACO_BAR', true),

          -- TACO BAR — TORTILLAS
          ('Flour Tortillas', 'Flour Tortillas', 'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 60, 'Full Pan', 160, 'hot', 'TACO_BAR', true),
          ('Corn Tortillas',  'Corn Tortillas',  'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 30, 'Full Pan', 80,  'hot', 'TACO_BAR', true),

          -- TACO BAR — SNACKS
          ('Queso', 'Queso', 'snack', 2.15, 'ozm',      'Ladle',         'Third Pan', 80, 'Half Pan', 140, 'hot',  'TACO_BAR', true),
          ('Guac',  'Guac',  'snack', 2.15, 'ozm',      'Spoon Serving', 'Third Pan', 60, 'Half Pan', 130, 'cold', 'TACO_BAR', true),
          ('Chips', 'Chips', 'snack', 0.05, 'Full Pan', 'Tongs Large',   null,        1,  null,       null,'dry',  'TACO_BAR', true),

          -- BIRD BOX — SALSAS & TORTILLAS
          ('Patron',      'Patron',      'salsa',    1.0, 'oz-fl', 'Ladle',      '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'BIRD_BOX', true),
          ('Salsa Verde', 'Salsa Verde', 'salsa',    1.0, 'oz-fl', 'Ladle',      '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'BIRD_BOX', true),
          ('Salsa Roja',  'Salsa Roja',  'salsa',    1.0, 'oz-fl', 'Ladle',      '6 oz cup', 12, '32 oz deli cup', null, 'cold', 'BIRD_BOX', true),
          ('Flour Tortillas', 'Flour Tortillas', 'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 60, 'Full Pan', 160, 'hot', 'BIRD_BOX', true),
          ('Corn Tortillas',  'Corn Tortillas',  'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 30, 'Full Pan', 80,  'hot', 'BIRD_BOX', true),

          -- PERSONAL BOX — TORTILLAS
          ('Flour Tortillas', 'Flour Tortillas', 'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 60, 'Full Pan', 160, 'hot', 'PERSONAL_BOX', true),
          ('Corn Tortillas',  'Corn Tortillas',  'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 30, 'Full Pan', 80,  'hot', 'PERSONAL_BOX', true),

          -- PAPER GOODS (defaults)
          ('Plates',           'Plates',           'paper', 1,   'each', null, null, null, null, null, 'dry', 'TACO_BAR',    true),
          ('Napkins',          'Napkins',          'paper', 2,   'each', null, null, null, null, null, 'dry', 'TACO_BAR',    true),
          ('Forks',            'Forks',            'paper', 1,   'each', null, null, null, null, null, 'dry', 'TACO_BAR',    true),
          ('Serving Utensils', 'Serving Utensils', 'paper', 0.1, 'each', null, null, null, null, null, 'dry', 'TACO_BAR',    true),
          ('Taco Boats',       'Taco Boats',       'paper', 3,   'each', null, null, null, null, null, 'dry', 'TACO_BAR',    true),
          ('Plates',           'Plates',           'paper', 1,   'each', null, null, null, null, null, 'dry', 'BIRD_BOX',    true),
          ('Napkins',          'Napkins',          'paper', 2,   'each', null, null, null, null, null, 'dry', 'BIRD_BOX',    true),
          ('Forks',            'Forks',            'paper', 1,   'each', null, null, null, null, null, 'dry', 'BIRD_BOX',    true),
          ('Taco Boats',       'Taco Boats',       'paper', 2,   'each', null, null, null, null, null, 'dry', 'BIRD_BOX',    true),
          ('Plates',           'Plates',           'paper', 1,   'each', null, null, null, null, null, 'dry', 'PERSONAL_BOX',true),
          ('Napkins',          'Napkins',          'paper', 2,   'each', null, null, null, null, null, 'dry', 'PERSONAL_BOX',true),
          ('Forks',            'Forks',            'paper', 1,   'each', null, null, null, null, null, 'dry', 'PERSONAL_BOX',true),
          ('Taco Boats',       'Taco Boats',       'paper', 2,   'each', null, null, null, null, null, 'dry', 'PERSONAL_BOX',true)

        ON CONFLICT (canonical_name, event_type) DO NOTHING
      `);
      console.log('✅ Fórmulas base insertadas');
    }

    // ─── SEED INGREDIENT ALIASES ──────────────────────────────────────────────
    const aliasesCount = await pool.query('SELECT COUNT(*) FROM ingredient_aliases');
    if (parseInt(aliasesCount.rows[0].count) === 0) {
      console.log('📝 Insertando aliases base...');
      await pool.query(`
        INSERT INTO ingredient_aliases (canonical_name, alias) VALUES
          ('Salsa Verde Braised Chicken', 'Salsa Verde Braised Chicken (taco bar)'),
          ('Salsa Verde Braised Chicken', 'Salsa Verde Braised Chicken (Taco Bar)'),
          ('House-smoked Brisket',        'House-smoked Brisket (taco bar)'),
          ('House-smoked Brisket',        'House-Smoked Brisket (Taco Bar)'),
          ('House-smoked Brisket',        'House-smoked Brisket (+premium)'),
          ('Adobo Chicken',               'Adobo Chicken (taco bar)'),
          ('Adobo Chicken',               'Adobo Chicken (Taco Bar)'),
          ('Chorizo',                     'Chorizo (taco bar)'),
          ('Chorizo',                     'Chorizo (Taco Bar)'),
          ('Tenderbelly Bacon',           'Tenderbelly Bacon (taco bar)'),
          ('Tenderbelly Bacon',           'Tenderbelly Bacon (Taco Bar)'),
          ('Egg',                         'Egg (taco bar)'),
          ('Egg',                         'Egg (Taco Bar)'),
          ('Egg',                         'Eggs (taco bar)'),
          ('Black Beans',                 'Black Beans (taco bar)'),
          ('Black Beans',                 'Black Beans (Taco Bar)'),
          ('Rajas',                       'Rajas (taco bar)'),
          ('Rajas',                       'Rajas (Taco Bar)'),
          ('Sliced Avocado',              'Sliced Avocado (taco bar)'),
          ('Sliced Avocado',              'Sliced Avocado (Taco Bar)'),
          ('Pico De Gallo',               'Pico De Gallo (taco bar)'),
          ('Pico De Gallo',               'Pico de Gallo (Taco Bar)'),
          ('Shredded Cheese',             'Monterrey Jack Cheese (taco bar)'),
          ('Shredded Cheese',             'Monterrey Jack Cheese (Taco Bar)'),
          ('Shredded Cheese',             'Shredded Cabbage (taco bar)'),
          ('Cotija',                      'Cotija (taco bar)'),
          ('Cotija',                      'Cotija (Taco Bar)'),
          ('Pickled Onions',              'Pickled Red Onion (taco bar)'),
          ('Pickled Onions',              'Pickled Red Onion (Taco Bar)'),
          ('Crispy Potato',               'Potato (taco bar)'),
          ('Crispy Potato',               'Crispy Potato (Taco Bar)'),
          ('Queso',                       'Queso (taco bar)'),
          ('Queso',                       'Queso (Taco Bar)'),
          ('Guac',                        'Guac (taco bar)'),
          ('Guac',                        'Guacamole (Taco Bar)'),
          ('Salsa Roja',                  'Salsa Roja (mild)'),
          ('Salsa Roja',                  'Salsa Roja (Mild)'),
          ('Salsa Verde',                 'Verde (mild-med)'),
          ('Salsa Verde',                 'Salsa Verde (Mild-Med)'),
          ('Patron',                      'Patron (spicy)'),
          ('Patron',                      'Patron (Spicy)'),
          ('Flour Tortillas',             'Flour Tortillas (catering)'),
          ('Flour Tortillas',             'Housemade Flour Tortilla'),
          ('Flour Tortillas',             'Housemade Flour Tortillas'),
          ('Corn Tortillas',              'Corn Tortillas (catering)'),
          ('Corn Tortillas',              'Housemade Corn Tortillas')
        ON CONFLICT (alias) DO NOTHING
      `);
      console.log('✅ Aliases base insertados');
    }

    console.log('\n🎉 Base de datos inicializada correctamente\n');

  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
};

initDB();

module.exports = pool;