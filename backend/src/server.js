require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const pool    = require('./database/init');

// ─── Repositories ─────────────────────────────────────────────────────────
const StoreRepository             = require('./repositories/StoreRepository');
const EquipmentRepository         = require('./repositories/EquipmentRepository');
const CateringOrderRepository     = require('./repositories/CateringOrderRepository');
const IngredientFormulaRepository = require('./repositories/IngredientFormulaRepository');
const MenuItemRepository          = require('./repositories/MenuItemRepository');
const AuditRepository             = require('./repositories/AuditRepository');

// ─── Services ─────────────────────────────────────────────────────────────
const StoreService             = require('./services/StoreService');
const EquipmentService         = require('./services/EquipmentService');
const CateringOrderService     = require('./services/CateringOrderService');
const IngredientFormulaService = require('./services/IngredientFormulaService');
const FulfillmentSheetCalculator = require('./services/FulfillmentSheetCalculator');
const FulfillmentSheetGenerator  = require('./services/FulfillmentSheetGenerator');
const GoogleCalendarService      = require('./services/GoogleCalendarService');
const AuditService               = require('./services/AuditService');
const ToastAuthService           = require('./services/ToastAuthService');
const ToastApiClient             = require('./services/ToastApiClient');
const ToastSyncService           = require('./services/ToastSyncService');
const ToastMenuSyncService       = require('./services/ToastMenuSyncService');

// ─── Controllers ──────────────────────────────────────────────────────────
const StoreController             = require('./controllers/StoreController');
const EquipmentController         = require('./controllers/EquipmentController');
const CateringOrderController     = require('./controllers/CateringOrderController');
const IngredientFormulaController = require('./controllers/IngredientFormulaController');
const MenuItemController          = require('./controllers/MenuItemController');
const AuditController             = require('./controllers/AuditController');

// ─── Routes ───────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth.routes');
const storesRoutes    = require('./routes/stores.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const toastRoutes     = require('./routes/toast.routes');
const formulasRoutes  = require('./routes/formulas.routes');
const menuRoutes      = require('./routes/menu.routes');
const auditRoutes     = require('./routes/audit.routes');
const cateringRoutes  = require('./routes/catering.routes');

// ─── Dependency Injection ─────────────────────────────────────────────────

const auditRepository = new AuditRepository(pool);
const auditService    = new AuditService(auditRepository);
const auditController = new AuditController(auditService);

const cateringOrderRepository = new CateringOrderRepository(pool);
const cateringOrderService    = new CateringOrderService(cateringOrderRepository);
const cateringOrderController = new CateringOrderController(cateringOrderService, auditService);

const ingredientFormulaRepository = new IngredientFormulaRepository(pool);
const ingredientFormulaService    = new IngredientFormulaService(ingredientFormulaRepository);
const ingredientFormulaController = new IngredientFormulaController(ingredientFormulaService);

const fulfillmentCalculator = new FulfillmentSheetCalculator(ingredientFormulaRepository, pool);
const fulfillmentGenerator  = new FulfillmentSheetGenerator();
const googleCalendarService = new GoogleCalendarService();

const toastAuthService     = new ToastAuthService();
const toastApiClient       = new ToastApiClient(toastAuthService);
const toastMenuSyncService = new ToastMenuSyncService(toastApiClient, pool);
const toastSyncService     = new ToastSyncService(
  toastApiClient, pool,
  fulfillmentCalculator, fulfillmentGenerator,
  googleCalendarService, auditService,
);

const storeRepository     = new StoreRepository(pool);
const equipmentRepository = new EquipmentRepository(pool);
const storeService        = new StoreService(storeRepository);
const equipmentService    = new EquipmentService(equipmentRepository, storeRepository);
const storeController     = new StoreController(storeService);
const equipmentController = new EquipmentController(equipmentService);

const menuItemRepository = new MenuItemRepository(pool);
const menuItemController = new MenuItemController(menuItemRepository);

// ─── App ──────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({
  message:   'LadyBird API - Backend running with PostgreSQL',
  timestamp: new Date().toISOString(),
  version:   '1.0.0',
}));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes(pool));
app.use('/api/stores',         storesRoutes(storeController));
app.use('/api/equipment',      equipmentRoutes(equipmentController));
app.use('/api/toast',          toastRoutes(pool, toastSyncService, toastMenuSyncService));
app.use('/api/formulas',       formulasRoutes(ingredientFormulaController));
app.use('/api/menu-items',     menuRoutes(menuItemController));
app.use('/api/audit',          auditRoutes(auditController));
app.use('/api/catering/orders', cateringRoutes(
  pool,
  cateringOrderController,
  cateringOrderService,
  auditService,
  fulfillmentCalculator,
  fulfillmentGenerator,
  googleCalendarService,
  toastSyncService,
));

// ─── Store equipment route (nested) ───────────────────────────────────────
app.get('/api/stores/:storeId/equipment', (req, res) => equipmentController.getByStore(req, res));

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 LadyBird API Server — http://localhost:${PORT}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🔐 Auth:      POST /api/auth/registro | /api/auth/login`);
  console.log(`🏪 Stores:    GET/POST/PUT/DELETE /api/stores`);
  console.log(`🔧 Equipment: GET/POST/PUT/DELETE /api/equipment`);
  console.log(`🍞 Toast:     POST /api/toast/sync | /sync/historical | /sync/menu`);
  console.log(`🌮 Orders:    GET/POST/PATCH /api/catering/orders`);
  console.log(`📋 Formulas:  GET/POST/PUT/DELETE /api/formulas`);
  console.log(`📄 PDF:       POST /api/catering/orders/:id/fulfillment-sheet`);
  console.log(`🍽️  Menu:      GET/POST/PUT/DELETE /api/menu-items`);
  console.log(`📊 Audit:     GET /api/audit | /api/audit/orders/:orderId`);
  console.log(`${'='.repeat(60)}\n`);
});

// ─── Auto-sync polling ────────────────────────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Auto-sync iniciado...`);
  try {
    const results       = await toastSyncService.syncAll({ minutesBack: 30 });
    const totalCatering = results.reduce((sum, r) => sum + (r.catering || 0), 0);
    if (totalCatering > 0)
      console.log(`🍽️  ${totalCatering} nuevas órdenes detectadas`);
    console.log('✅ Auto-sync completo');
  } catch (error) {
    console.error('❌ Auto-sync error:', error.message);
  }
});

console.log('⏰ Polling activo — sync cada 15 minutos');