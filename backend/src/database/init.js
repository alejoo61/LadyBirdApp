const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "ladybird_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

const initDB = async () => {
  try {
    // 1. Tabla usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(255) UNIQUE NOT NULL,
        contrasena VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla usuarios confirmada");

    // 2. Tabla stores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        timezone TEXT DEFAULT 'America/New_York',
        is_active BOOLEAN DEFAULT true,
        emails TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla stores confirmada");

    // 3. Tabla equipment
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        equipment_code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        year_code TEXT NOT NULL,
        seq INTEGER NOT NULL,
        is_down BOOLEAN DEFAULT false,
        qr_code_text TEXT,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla equipment confirmada");

    // 4. Tabla equipment_transfer_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_transfer_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
        from_store_id UUID REFERENCES stores(id),
        to_store_id UUID REFERENCES stores(id),
        transferred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        reason TEXT DEFAULT 'Transferencia de sucursal'
      )
    `);
    console.log("✅ Tabla equipment_transfer_history confirmada");

    // 5. Enums para mantenimiento
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE request_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 6. Tabla maintenance_requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        urgency urgency NOT NULL DEFAULT 'medium',
        status request_status NOT NULL DEFAULT 'pending',
        description TEXT NOT NULL,
        photo_urls TEXT[],
        requested_by_email TEXT NOT NULL,
        assigned_gm_email TEXT,
        notified_agm_email TEXT,
        due_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla maintenance_requests confirmada");

    // 7. Migration: toast_restaurant_guid en stores
    await pool.query(`
      ALTER TABLE stores
      ADD COLUMN IF NOT EXISTS toast_restaurant_guid TEXT UNIQUE
    `);
    console.log("✅ Column toast_restaurant_guid confirmada en stores");

    // 8. Tabla toast_orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toast_orders (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id         UUID REFERENCES stores(id) ON DELETE SET NULL,
        toast_order_guid TEXT UNIQUE NOT NULL,
        raw_payload      JSONB NOT NULL,
        order_date       TIMESTAMPTZ,
        sync_status      TEXT DEFAULT 'pending',
        created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla toast_orders confirmada");

    // 9. Tabla catering_orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catering_orders (
        id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id                   UUID REFERENCES stores(id) ON DELETE SET NULL,
        toast_order_id             UUID REFERENCES toast_orders(id) ON DELETE SET NULL,
        toast_order_guid           TEXT UNIQUE NOT NULL,
        display_number             TEXT,
        event_type                 TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
        status                     TEXT NOT NULL DEFAULT 'pending',

        client_name                TEXT,
        client_email               TEXT,
        client_phone               TEXT,

        order_date                 TIMESTAMPTZ,
        estimated_fulfillment_date TIMESTAMPTZ,
        business_date              INTEGER,

        delivery_method            TEXT DEFAULT 'PICKUP',
        delivery_address           TEXT,
        delivery_notes             TEXT,
        driver_name                TEXT,

        parsed_data                JSONB,
        guest_count                INTEGER,
        total_amount               NUMERIC(10,2),

        override_data              JSONB DEFAULT '{}',
        override_notes             TEXT,

        created_at                 TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at                 TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla catering_orders confirmada");

    // 10. Tabla ingredient_formulas
await pool.query(`
  CREATE TABLE IF NOT EXISTS ingredient_formulas (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL,
    category           TEXT NOT NULL,
    amount_per_person  NUMERIC(10,4) NOT NULL DEFAULT 0,
    unit               TEXT NOT NULL DEFAULT 'ozm',
    utensil            TEXT,
    small_package      TEXT,
    small_package_max  INTEGER,
    large_package      TEXT,
    large_package_max  INTEGER,
    temp_type          TEXT DEFAULT 'cold',
    event_types        TEXT[] DEFAULT '{}',
    is_active          BOOLEAN DEFAULT true,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✅ Tabla ingredient_formulas confirmada');

// Seed inicial de fórmulas
const formulasCount = await pool.query('SELECT COUNT(*) FROM ingredient_formulas');
if (parseInt(formulasCount.rows[0].count) === 0) {
  console.log('📝 Insertando fórmulas base...');
  await pool.query(`
    INSERT INTO ingredient_formulas
      (name, category, amount_per_person, unit, utensil, small_package, small_package_max, large_package, large_package_max, temp_type, event_types)
    VALUES
      -- PROTEINS
      ('Salsa Verde Braised Chicken', 'protein', 3.4, 'ozm', 'Spoon Serving', 'Double Half Pan', 80, 'Full Pan', 140, 'hot', ARRAY['TACO_BAR']),
      ('House-smoked Brisket',        'protein', 2.7, 'ozm', 'Tongs Large',   'Half Pan',        60, 'Full Pan', 140, 'hot', ARRAY['TACO_BAR']),
      ('Chorizo',                     'protein', 1.6, 'ozm', 'Spoon Serving', 'Half Pan',        80, 'Full Pan', null, 'hot', ARRAY['TACO_BAR']),
      ('Adobo Chicken',               'protein', 3.4, 'ozm', 'Spoon Serving', 'Half Pan',        80, 'Full Pan', 140,  'hot', ARRAY['TACO_BAR']),
      ('Tenderbelly Bacon',           'protein', 1.6, 'slice','Tongs Large',  'Half Pan',        60, 'Full Pan', 120,  'hot', ARRAY['TACO_BAR']),
      ('Egg',                         'protein', 2.9, 'ozm', 'Spoon Serving', 'Half Pan',        80, 'Full Pan', 120,  'hot', ARRAY['TACO_BAR']),

      -- TOPPINGS
      ('Black Beans',       'topping', 1.5, 'ozm',   'Spoon Serving', 'Third Pan', 40,  'Half Pan',  60,  'hot',  ARRAY['TACO_BAR']),
      ('Rajas',             'topping', 1.4, 'ozm',   'Tongs Large',   'Third Pan', 30,  'Full Pan',  50,  'hot',  ARRAY['TACO_BAR']),
      ('Sliced Avocado',    'topping', 3.0, 'slice', 'Tongs Small',   'Third Pan', 50,  'Half Pan',  100, 'cold', ARRAY['TACO_BAR']),
      ('Pico De Gallo',     'topping', 1.1, 'ozm',   'Spoon Serving', '32 oz deli cup', 30, 'Half Pan', 50, 'cold', ARRAY['TACO_BAR']),
      ('Shredded Cheese',   'topping', 0.6, 'ozm',   'Tongs Small',   '32 oz deli cup', 15, 'Third Pan', 30, 'cold', ARRAY['TACO_BAR']),
      ('Cotija',            'topping', 0.2, 'ozm',   'Spoon Small',   '32 oz deli cup', 15, 'Third Pan', 20, 'cold', ARRAY['TACO_BAR']),
      ('Cabbage',           'topping', 0.6, 'ozm',   'Tongs Small',   '32 oz deli cup', 15, 'Full Pan',  50, 'cold', ARRAY['TACO_BAR']),
      ('Pickled Onions',    'topping', 0.5, 'ozm',   'Tongs Small',   '32 oz deli cup', 20, 'Third Pan', 40, 'cold', ARRAY['TACO_BAR']),
      ('Crispy Potato',     'topping', 0.6, 'ozm',   'Spoon Serving', '32 oz deli cup', 15, 'Full Pan',  80, 'dry',  ARRAY['TACO_BAR']),
      ('Pepitas',           'topping', 0.4, 'ozm',   'Spoon Small',   '32 oz deli cup', 20, 'Third Pan', 40, 'dry',  ARRAY['TACO_BAR']),
      ('Radish',            'topping', 6.0, 'slice', 'Spoon Small',   '32 oz deli cup', 20, 'Third Pan', 35, 'cold', ARRAY['TACO_BAR']),

      -- SALSAS
      ('Patron',      'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', ARRAY['TACO_BAR', 'BIRD_BOX']),
      ('Salsa Verde', 'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', ARRAY['TACO_BAR', 'BIRD_BOX']),
      ('Salsa Roja',  'salsa', 1.0, 'oz-fl', 'Ladle', '6 oz cup', 12, '32 oz deli cup', null, 'cold', ARRAY['TACO_BAR', 'BIRD_BOX']),

      -- TORTILLAS
      ('Flour Tortillas', 'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 60, 'Full Pan', 160, 'hot', ARRAY['TACO_BAR']),
      ('Corn Tortillas',  'tortilla', 2.0, 'each', 'Tongs Small', 'Half Pan', 30, 'Full Pan', 80,  'hot', ARRAY['TACO_BAR']),

      -- SNACKS
      ('Queso',  'snack', 2.15, 'ozm', 'Ladle',          'Third Pan', 80,  'Half Pan', 140, 'hot',  ARRAY['TACO_BAR']),
      ('Guac',   'snack', 2.15, 'ozm', 'Spoon Serving',  'Third Pan', 60,  'Half Pan', 130, 'cold', ARRAY['TACO_BAR']),
      ('Chips',  'snack', 0.05, 'Full Pan', 'Tongs Large', null, 1, 'Full Pan', null, 'dry', ARRAY['TACO_BAR'])
  `);
  console.log('✅ Fórmulas base insertadas');
}

    console.log("\n🎉 Estructura de base de datos actualizada con éxito\n");

    await insertDummyData();
  } catch (error) {
    console.error("❌ Error al inicializar la base de datos:", error);
  }
};

const insertDummyData = async () => {
  try {
    const storesCount = await pool.query("SELECT COUNT(*) FROM stores");
    if (parseInt(storesCount.rows[0].count) > 0) {
      console.log("ℹ️  Los datos ya existen, saltando inserción...");
      return;
    }

    console.log("📝 Insertando stores reales de Ladybird...");

    await pool.query(`
      INSERT INTO stores (code, name, timezone, is_active, emails, toast_restaurant_guid)
      VALUES
        ('0014', 'Ladybird Taco - 12 South',  'America/Chicago',  true, '', '412d1371-6225-4bb2-8cdc-9dca897f9a6a'),
        ('0049', 'Ladybird Taco - Gulch',      'America/Chicago',  true, '', '93edfab9-460c-4275-8ec5-8b21ba200a9f'),
        ('005C', 'Ladybird Taco - Dilworth',   'America/New_York', true, '', 'c11b3f26-dd57-446f-8b5c-a41ebee6a724'),
        ('003C', 'Ladybird Taco - Inglewood',  'America/Chicago',  true, '', 'cc944a98-c4ab-4ec2-b122-d60059b1fb89'),
        ('002C', 'Ladybird Taco - Mtn Brook',  'America/Chicago',  true, '', 'cf9c2958-35bd-4c80-b113-3608fab70776')
      ON CONFLICT (code) DO UPDATE
        SET toast_restaurant_guid = EXCLUDED.toast_restaurant_guid
    `);

    console.log("✅ Stores insertados correctamente");
  } catch (error) {
    console.error("❌ Error al insertar datos:", error);
  }
};

initDB();

module.exports = pool;