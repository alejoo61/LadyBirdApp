require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./database/init");

// Toast Services
const ToastAuthService = require("./services/ToastAuthService");
const ToastApiClient = require("./services/ToastApiClient");
const ToastSyncService = require("./services/ToastSyncService");

// Repositories
const StoreRepository = require("./repositories/StoreRepository");
const EquipmentRepository = require("./repositories/EquipmentRepository");

// Services
const StoreService = require("./services/StoreService");
const EquipmentService = require("./services/EquipmentService");

// Controllers
const StoreController = require("./controllers/StoreController");
const EquipmentController = require("./controllers/EquipmentController");

// Toast DI
const toastAuthService = new ToastAuthService();
const toastApiClient = new ToastApiClient(toastAuthService);
const toastSyncService = new ToastSyncService(toastApiClient, pool);
const ToastMenuSyncService = require('./services/ToastMenuSyncService');
const toastMenuSyncService = new ToastMenuSyncService(toastApiClient, pool);

// Caterings Orders
const CateringOrderRepository = require("./repositories/CateringOrderRepository");
const CateringOrderService = require("./services/CateringOrderService");
const CateringOrderController = require("./controllers/CateringOrderController");


//Ingredients
const IngredientFormulaRepository = require("./repositories/IngredientFormulaRepository");
const IngredientFormulaService = require("./services/IngredientFormulaService");
const IngredientFormulaController = require("./controllers/IngredientFormulaController");

// Fulfillment Sheet
const FulfillmentSheetCalculator = require("./services/FulfillmentSheetCalculator");
const FulfillmentSheetGenerator = require("./services/FulfillmentSheetGenerator");

// Menu Items
const MenuItemRepository  = require('./repositories/MenuItemRepository');
const MenuItemController  = require('./controllers/MenuItemController');
const menuItemRepository  = new MenuItemRepository(pool);
const menuItemController  = new MenuItemController(menuItemRepository);

const app = express();
const PORT = process.env.PORT || 3001;
const cron = require("node-cron");

// Middlewares
app.use(cors());
app.use(express.json());

// DI
const cateringOrderRepository = new CateringOrderRepository(pool);
const cateringOrderService = new CateringOrderService(cateringOrderRepository);
const cateringOrderController = new CateringOrderController(
  cateringOrderService,
);

const ingredientFormulaRepository = new IngredientFormulaRepository(pool);
const ingredientFormulaService = new IngredientFormulaService(
  ingredientFormulaRepository,
);
const ingredientFormulaController = new IngredientFormulaController(
  ingredientFormulaService,
);

const fulfillmentCalculator = new FulfillmentSheetCalculator(
  ingredientFormulaRepository,
  pool,
);
const fulfillmentGenerator = new FulfillmentSheetGenerator();

// Dependency Injection Setup
const storeRepository = new StoreRepository(pool);
const equipmentRepository = new EquipmentRepository(pool);

const storeService = new StoreService(storeRepository);
const equipmentService = new EquipmentService(
  equipmentRepository,
  storeRepository,
);

const storeController = new StoreController(storeService);
const equipmentController = new EquipmentController(equipmentService);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "LadyBird API - Backend running with PostgreSQL",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ============= AUTHENTICATION ROUTES =============
app.post("/api/auth/registro", async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res
      .status(400)
      .json({ error: "Usuario y contraseña son requeridos" });
  }

  if (contrasena.length < 6) {
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const userExists = await pool.query(
      "SELECT * FROM usuarios WHERE usuario = $1",
      [usuario],
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    const result = await pool.query(
      "INSERT INTO usuarios (usuario, contrasena) VALUES ($1, $2) RETURNING id, usuario",
      [usuario, contrasena],
    );

    res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      usuario: result.rows[0],
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res
      .status(400)
      .json({ error: "Usuario y contraseña son requeridos" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE usuario = $1 AND contrasena = $2",
      [usuario, contrasena],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos" });
    }

    const user = result.rows[0];
    res.json({
      mensaje: "Login exitoso",
      usuario: {
        id: user.id,
        usuario: user.usuario,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ============= STORE ROUTES =============
app.get("/api/stores", (req, res) => storeController.getAll(req, res));
app.get("/api/stores/:id", (req, res) => storeController.getById(req, res));
app.post("/api/stores", (req, res) => storeController.create(req, res));
app.put("/api/stores/:id", (req, res) => storeController.update(req, res));
app.delete("/api/stores/:id", (req, res) => storeController.delete(req, res));

// ============= EQUIPMENT ROUTES =============
app.get("/api/equipment", (req, res) => equipmentController.getAll(req, res));
app.get("/api/equipment/types", (req, res) =>
  equipmentController.getTypes(req, res),
);
app.get("/api/equipment/:id", (req, res) =>
  equipmentController.getById(req, res),
);
app.get("/api/stores/:storeId/equipment", (req, res) =>
  equipmentController.getByStore(req, res),
);
app.post("/api/equipment", (req, res) => equipmentController.create(req, res));
app.put("/api/equipment/:id", (req, res) =>
  equipmentController.update(req, res),
);
app.delete("/api/equipment/:id", (req, res) =>
  equipmentController.delete(req, res),
);
app.patch("/api/equipment/:id/mark-down", (req, res) =>
  equipmentController.markAsDown(req, res),
);
app.patch("/api/equipment/:id/mark-operational", (req, res) =>
  equipmentController.markAsOperational(req, res),
);

// ============= TOAST ROUTES =============

// Sync reciente — para el cron (últimos 30 min por defecto)
app.post("/api/toast/sync", async (req, res) => {
  try {
    const { minutesBack = 30 } = req.body;
    const results = await toastSyncService.syncAll({ minutesBack });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync histórico — para poblar la BD inicialmente
app.post("/api/toast/sync/historical", async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;
    const results = await toastSyncService.syncAll({
      historical: true,
      daysBack,
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync histórico por store
app.post("/api/toast/sync/historical/:storeCode", async (req, res) => {
  try {
    const { storeCode } = req.params;
    const { daysBack = 7 } = req.body;

    const storeResult = await pool.query(
      "SELECT * FROM stores WHERE code = $1 AND toast_restaurant_guid IS NOT NULL",
      [storeCode.toUpperCase()],
    );

    if (storeResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: `Store ${storeCode} not found` });
    }

    const result = await toastSyncService.syncStore(storeResult.rows[0], {
      historical: true,
      daysBack,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/toast/orders", async (req, res) => {
  try {
    const { storeId, syncStatus, limit = 50 } = req.query;
    let query = "SELECT * FROM toast_orders WHERE 1=1";
    const params = [];

    if (storeId) {
      params.push(storeId);
      query += ` AND store_id = $${params.length}`;
    }
    if (syncStatus) {
      params.push(syncStatus);
      query += ` AND sync_status = $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY order_date DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post('/api/toast/sync/menu', async (req, res) => {
  try {
    const results = await toastMenuSyncService.syncMenusForAllStores();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= CATERING ORDER ROUTES =============
app.get("/api/catering/orders", (req, res) =>
  cateringOrderController.getAll(req, res),
);
app.get("/api/catering/orders/:id", (req, res) =>
  cateringOrderController.getById(req, res),
);
app.post("/api/catering/orders", (req, res) =>
  cateringOrderController.createManual(req, res),
);
app.patch("/api/catering/orders/:id/status", (req, res) =>
  cateringOrderController.updateStatus(req, res),
);
app.patch("/api/catering/orders/:id/override", (req, res) =>
  cateringOrderController.updateOverride(req, res),
);
app.patch('/api/catering/orders/:id/payment-status', 
  (req, res) => cateringOrderController.overridePaymentStatus(req, res)
);
app.patch('/api/catering/orders/:id/manual', (req, res) =>
  cateringOrderController.updateManual(req, res)
);

// ============= INGREDIENT FORMULA ROUTES =============
app.get("/api/formulas", (req, res) =>
  ingredientFormulaController.getAll(req, res),
);
app.get("/api/formulas/:id", (req, res) =>
  ingredientFormulaController.getById(req, res),
);
app.post("/api/formulas", (req, res) =>
  ingredientFormulaController.create(req, res),
);
app.put("/api/formulas/:id", (req, res) =>
  ingredientFormulaController.update(req, res),
);
app.delete("/api/formulas/:id", (req, res) =>
  ingredientFormulaController.delete(req, res),
);

// ============= FULFILLMENT SHEET =============
app.post('/api/catering/orders/:id/fulfillment-sheet', async (req, res) => {
  try {
    const order = await cateringOrderService.getOrderById(req.params.id);

    const storeResult = await pool.query(
      'SELECT name, code FROM stores WHERE id = $1',
      [order.storeId]
    );
    order.storeName = storeResult.rows[0]?.name || '';
    order.storeCode = storeResult.rows[0]?.code || '';

    if (!order.items || order.items.length === 0) {
      order.items = order.parsedData?.items || [];
    }

    const calculatedData = await fulfillmentCalculator.calculate(order);

    // Pasar isManuallyEdited al header del PDF
    calculatedData.header.isManuallyEdited = order.isManuallyEdited || false;

    const pdf     = await fulfillmentGenerator.generate(calculatedData);
    const pdfName = fulfillmentGenerator.buildFilename(order, order.storeCode);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${pdfName}"`,
      'Content-Length':      pdf.length,
    });
    res.send(pdf);
  } catch (error) {
    console.error('❌ Fulfillment sheet error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ MENU ITEM ROUTES =============
app.get('/api/menu-items',                    (req, res) => menuItemController.getAll(req, res));
app.get('/api/menu-items/event/:eventType',   (req, res) => menuItemController.getByEventType(req, res));
app.post('/api/menu-items',                   (req, res) => menuItemController.create(req, res));
app.put('/api/menu-items/:id',                (req, res) => menuItemController.update(req, res));
app.delete('/api/menu-items/:id',             (req, res) => menuItemController.delete(req, res));

// TEMP — test PDF en browser
app.get(
  "/api/catering/orders/:id/fulfillment-sheet/preview",
  async (req, res) => {
    try {
      const order = await cateringOrderService.getOrderById(req.params.id);

      const storeResult = await pool.query(
        "SELECT name, code FROM stores WHERE id = $1",
        [order.storeId],
      );
      order.storeName = storeResult.rows[0]?.name || "";
      order.storeCode = storeResult.rows[0]?.code || "";

      if (!order.items || order.items.length === 0) {
        order.items = order.parsedData?.items || [];
      }

      const calculatedData = await fulfillmentCalculator.calculate(order);
      const pdf = await fulfillmentGenerator.generate(calculatedData);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Content-Length": pdf.length,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      res.end(pdf, "binary");
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Start server
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 LadyBird API Server`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🐘 Database: PostgreSQL (${process.env.DB_NAME})`);
  console.log(`${"=".repeat(60)}`);
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
  console.log(`\n${"=".repeat(60)}\n`);
  console.log(`\n🍞 Toast:`);
  console.log(`   POST   /api/toast/sync`);
  console.log(`   POST   /api/toast/sync/:storeCode`);
  console.log(`   GET    /api/toast/orders`);
});

// ============= POLLING AUTOMÁTICO =============
// Corre cada 15 minutos — sincroniza los últimos 30 min de cada store
cron.schedule("*/15 * * * *", async () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Auto-sync iniciado...`);
  try {
    const results = await toastSyncService.syncAll({ minutesBack: 30 });
    const totalCatering = results.reduce(
      (sum, r) => sum + (r.catering || 0),
      0,
    );
    if (totalCatering > 0) {
      console.log(`🍽️  ${totalCatering} nuevas órdenes de catering detectadas`);
    }
    console.log(`✅ Auto-sync completo`);
  } catch (error) {
    console.error(`❌ Auto-sync error:`, error.message);
  }
});

console.log("⏰ Polling activo — sync cada 15 minutos");
