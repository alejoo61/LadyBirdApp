const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ladybird_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Crear tablas si no existen
const initDB = async () => {
  try {
    // Tabla usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(255) UNIQUE NOT NULL,
        contrasena VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla usuarios creada');

    // Tabla stores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        timezone TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla stores creada');

    // Tabla equipment
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        equipment_code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        year_code TEXT,
        seq INTEGER,
        is_down BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla equipment creada');

    // Crear tipo ENUM para urgency
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Crear tipo ENUM para request_status
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE request_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Tabla maintenance_requests
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
    console.log('✅ Tabla maintenance_requests creada');

    console.log('\n🎉 Todas las tablas creadas exitosamente en PostgreSQL\n');

    // Insertar datos dummy
    await insertDummyData();
  } catch (error) {
    console.error('❌ Error al crear tablas:', error);
  }
};

// Función para insertar datos dummy
const insertDummyData = async () => {
  try {
    // Verificar si ya hay datos
    const storesCount = await pool.query('SELECT COUNT(*) FROM stores');
    if (parseInt(storesCount.rows[0].count) > 0) {
    console.log('ℹ️  Dummy data already exists, skipping insertion...\n');
      return;
    }

    console.log('📝 Inserting dummy data...\n');

    // Insert stores
    const store1 = await pool.query(`
      INSERT INTO stores (code, name, timezone, is_active)
      VALUES ('ST001', 'Downtown Store', 'America/New_York', true)
      RETURNING id
    `);
    const store2 = await pool.query(`
      INSERT INTO stores (code, name, timezone, is_active)
      VALUES ('ST002', 'Northside Store', 'America/Chicago', true)
      RETURNING id
    `);
    const store3 = await pool.query(`
      INSERT INTO stores (code, name, timezone, is_active)
      VALUES ('ST003', 'Westside Store', 'America/Los_Angeles', false)
      RETURNING id
    `);
    console.log('✅ 3 stores inserted');

    const storeId1 = store1.rows[0].id;
    const storeId2 = store2.rows[0].id;
    const storeId3 = store3.rows[0].id;

    // Insert equipment
    const eq1 = await pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
      VALUES ($1, 'EQ-HVAC-001', 'HVAC', 'Main Air Conditioning Unit', '2023', 1, false)
      RETURNING id
    `, [storeId1]);

    const eq2 = await pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
      VALUES ($1, 'EQ-FRIDGE-001', 'Refrigeration', 'Walk-in Freezer #1', '2022', 2, false)
      RETURNING id
    `, [storeId1]);

    const eq3 = await pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
      VALUES ($1, 'EQ-ELEC-001', 'Electrical', 'Main Electrical Panel', '2021', 1, true)
      RETURNING id
    `, [storeId2]);

    const eq4 = await pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
      VALUES ($1, 'EQ-HVAC-002', 'HVAC', 'Secondary AC Unit', '2023', 2, false)
      RETURNING id
    `, [storeId2]);

    const eq5 = await pool.query(`
      INSERT INTO equipment (store_id, equipment_code, type, name, year_code, seq, is_down)
      VALUES ($1, 'EQ-PUMP-001', 'Plumbing', 'Main Water Pump', '2020', 1, false)
      RETURNING id
    `, [storeId3]);

    console.log('✅ 5 equipment items inserted');

    const equipmentId1 = eq1.rows[0].id;
    const equipmentId2 = eq2.rows[0].id;
    const equipmentId3 = eq3.rows[0].id;
    const equipmentId4 = eq4.rows[0].id;
    const equipmentId5 = eq5.rows[0].id;

    // Insert maintenance_requests
    await pool.query(`
      INSERT INTO maintenance_requests 
      (equipment_id, store_id, urgency, status, description, photo_urls, requested_by_email, assigned_gm_email, due_at)
      VALUES 
      ($1, $2, 'high', 'pending', 'AC unit not cooling properly, room temperature at 82°F', 
       ARRAY['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'], 
       'manager1@ladybird.com', NULL, NOW() + INTERVAL '2 days'),
      
      ($3, $4, 'critical', 'assigned', 'Walk-in freezer losing temperature, risk of product spoilage', 
       ARRAY['https://example.com/photo3.jpg'], 
       'manager1@ladybird.com', 'supervisor@ladybird.com', NOW() + INTERVAL '6 hours'),
      
      ($5, $6, 'high', 'in_progress', 'Electrical panel making strange noises and sparking', 
       ARRAY['https://example.com/photo4.jpg', 'https://example.com/photo5.jpg'], 
       'manager2@ladybird.com', 'electrician@ladybird.com', NOW() + INTERVAL '1 day'),
      
      ($7, $8, 'medium', 'completed', 'AC unit requires preventive maintenance', 
       ARRAY[]::text[], 
       'manager2@ladybird.com', 'technician1@ladybird.com', NOW() - INTERVAL '1 day'),
      
      ($9, $10, 'low', 'pending', 'Water pump making slight noise, check bearings', 
       ARRAY['https://example.com/photo6.jpg'], 
       'manager3@ladybird.com', NULL, NOW() + INTERVAL '7 days'),
      
      ($11, $12, 'medium', 'assigned', 'Review electrical panel connections', 
       ARRAY[]::text[], 
       'manager2@ladybird.com', 'electrician@ladybird.com', NOW() + INTERVAL '3 days')
    `, [
      equipmentId1, storeId1,
      equipmentId2, storeId1,
      equipmentId3, storeId2,
      equipmentId4, storeId2,
      equipmentId5, storeId3,
      equipmentId3, storeId2
    ]);

    console.log('✅ 6 maintenance requests inserted');
    console.log('\n🎉 Dummy data inserted successfully!\n');

  } catch (error) {
    console.error('❌ Error inserting dummy data:', error);
  }
};

initDB();

module.exports = pool;