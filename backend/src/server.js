require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./database/init');

// Repositories
const StoreRepository = require('./repositories/StoreRepository');
const EquipmentRepository = require('./repositories/EquipmentRepository');

// Services
const StoreService = require('./services/StoreService');
const EquipmentService = require('./services/EquipmentService');

// Controllers
const StoreController = require('./controllers/StoreController');
const EquipmentController = require('./controllers/EquipmentController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Dependency Injection Setup
const storeRepository = new StoreRepository(pool);
const equipmentRepository = new EquipmentRepository(pool);

const storeService = new StoreService(storeRepository);
const equipmentService = new EquipmentService(equipmentRepository, storeRepository);

const storeController = new StoreController(storeService);
const equipmentController = new EquipmentController(equipmentService);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'LadyBird API - Backend running with PostgreSQL', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============= AUTHENTICATION ROUTES =============
app.post('/api/auth/registro', async (req, res) => {
  const { usuario, contrasena } = req.body;
  
  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const userExists = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1',
      [usuario]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const result = await pool.query(
      'INSERT INTO usuarios (usuario, contrasena) VALUES ($1, $2) RETURNING id, usuario',
      [usuario, contrasena]
    );
    
    res.status(201).json({ 
      mensaje: 'Usuario registrado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { usuario, contrasena } = req.body;
  
  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1 AND contrasena = $2',
      [usuario, contrasena]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];
    res.json({ 
      mensaje: 'Login exitoso',
      usuario: {
        id: user.id,
        usuario: user.usuario
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============= STORE ROUTES =============
app.get('/api/stores', (req, res) => storeController.getAll(req, res));
app.get('/api/stores/:id', (req, res) => storeController.getById(req, res));
app.post('/api/stores', (req, res) => storeController.create(req, res));
app.put('/api/stores/:id', (req, res) => storeController.update(req, res));
app.delete('/api/stores/:id', (req, res) => storeController.delete(req, res));

// ============= EQUIPMENT ROUTES =============
app.get('/api/equipment', (req, res) => equipmentController.getAll(req, res));
app.get('/api/equipment/types', (req, res) => equipmentController.getTypes(req, res));
app.get('/api/equipment/:id', (req, res) => equipmentController.getById(req, res));
app.get('/api/stores/:storeId/equipment', (req, res) => equipmentController.getByStore(req, res));
app.post('/api/equipment', (req, res) => equipmentController.create(req, res));
app.put('/api/equipment/:id', (req, res) => equipmentController.update(req, res));
app.delete('/api/equipment/:id', (req, res) => equipmentController.delete(req, res));
app.patch('/api/equipment/:id/mark-down', (req, res) => equipmentController.markAsDown(req, res));
app.patch('/api/equipment/:id/mark-operational', (req, res) => equipmentController.markAsOperational(req, res));

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 LadyBird API Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🐘 Database: PostgreSQL (${process.env.DB_NAME})`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📋 Available Endpoints:\n`);
  console.log(`🔐 Authentication:`);
  console.log(`   POST   /api/auth/registro`);
  console.log(`   POST   /api/auth/login`);
  console.log(`\n🏪 Stores:`);
  console.log(`   GET    /api/stores`);
  console.log(`   GET    /api/stores/:id`);
  console.log(`   POST   /api/stores`);
  console.log(`   PUT    /api/stores/:id`);
  console.log(`   DELETE /api/stores/:id`);
  console.log(`\n🔧 Equipment:`);
  console.log(`   GET    /api/equipment`);
  console.log(`   GET    /api/equipment/types`);
  console.log(`   GET    /api/equipment/:id`);
  console.log(`   GET    /api/stores/:storeId/equipment`);
  console.log(`   POST   /api/equipment`);
  console.log(`   PUT    /api/equipment/:id`);
  console.log(`   DELETE /api/equipment/:id`);
  console.log(`   PATCH  /api/equipment/:id/mark-down`);
  console.log(`   PATCH  /api/equipment/:id/mark-operational`);
  console.log(`\n${'='.repeat(60)}\n`);
});