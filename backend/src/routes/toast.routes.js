// src/routes/toast.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (pool, toastSyncService, toastMenuSyncService, kitchenFinishTimeService) => {

  router.post('/sync', async (req, res) => {
    try {
      const { minutesBack = 30 } = req.body;
      const results = await toastSyncService.syncAll({ minutesBack });
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/sync/historical', async (req, res) => {
    try {
      const { daysBack = 7 } = req.body;
      const results = await toastSyncService.syncAll({ historical: true, daysBack });
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/sync/historical/:storeCode', async (req, res) => {
    try {
      const { storeCode } = req.params;
      const { daysBack = 7 } = req.body;
      const storeResult = await pool.query(
        'SELECT * FROM stores WHERE code = $1 AND toast_restaurant_guid IS NOT NULL',
        [storeCode.toUpperCase()]
      );
      if (storeResult.rows.length === 0)
        return res.status(404).json({ success: false, error: `Store ${storeCode} not found` });
      const result = await toastSyncService.syncStore(storeResult.rows[0], { historical: true, daysBack });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/orders', async (req, res) => {
    try {
      const { storeId, syncStatus, limit = 50 } = req.query;
      let query = 'SELECT * FROM toast_orders WHERE 1=1';
      const params = [];
      if (storeId)    { params.push(storeId);    query += ` AND store_id = $${params.length}`; }
      if (syncStatus) { params.push(syncStatus); query += ` AND sync_status = $${params.length}`; }
      params.push(parseInt(limit));
      query += ` ORDER BY order_date DESC LIMIT $${params.length}`;
      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/sync/menu', async (req, res) => {
    try {
      const results = await toastMenuSyncService.syncMenusForAllStores();
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ─── Kitchen Finish Time manual trigger ───────────────────────────────────
  // Calcula kitchen_finish_time para todas las órdenes futuras que aún no lo tienen
  router.post('/sync/kitchen-finish', async (req, res) => {
    try {
      if (!kitchenFinishTimeService) {
        return res.status(503).json({ success: false, error: 'KitchenFinishTimeService not available' });
      }
      const results  = await kitchenFinishTimeService.calculatePending();
      const ok       = results.filter(r => r.kitchenFinishTime).length;
      const failed   = results.filter(r => r.error).length;
      const skipped  = results.filter(r => r.error === 'max_attempts_reached').length;
      res.json({
        success: true,
        data: { total: results.length, calculated: ok, failed, skipped, results },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};