// src/routes/maintenance.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (pool) => {
  // GET /api/maintenance — listar todas las requests
  router.get('/', async (req, res) => {
    try {
      const { storeId, status, urgency } = req.query;
      let query = `
        SELECT
          mr.*,
          e.equipment_code, e.name as equipment_name, e.type as equipment_type,
          s.name as store_name, s.code as store_code
        FROM maintenance_requests mr
        LEFT JOIN equipment e ON mr.equipment_id = e.id
        LEFT JOIN stores    s ON mr.store_id     = s.id
        WHERE 1=1
      `;
      const params = [];
      if (storeId) { params.push(storeId);  query += ` AND mr.store_id = $${params.length}`; }
      if (status)  { params.push(status);   query += ` AND mr.status = $${params.length}`;   }
      if (urgency) { params.push(urgency);  query += ` AND mr.urgency = $${params.length}`;  }
      query += ' ORDER BY mr.created_at DESC';

      const result = await pool.query(query, params);
      res.json({
        success: true,
        data: result.rows.map(r => ({
          id:               r.id,
          equipmentId:      r.equipment_id,
          storeId:          r.store_id,
          urgency:          r.urgency,
          status:           r.status,
          description:      r.description,
          photoUrls:        r.photo_urls,
          requestedByEmail: r.requested_by_email,
          assignedGmEmail:  r.assigned_gm_email,
          createdAt:        r.created_at,
          updatedAt:        r.updated_at,
          equipment: r.equipment_code ? {
            equipmentCode: r.equipment_code,
            name:          r.equipment_name,
            type:          r.equipment_type,
          } : null,
          store: r.store_name ? {
            name: r.store_name,
            code: r.store_code,
          } : null,
        })),
      });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // POST /api/maintenance — crear nueva request (desde QR page)
  router.post('/', async (req, res) => {
    try {
      const { equipmentId, storeId, urgency, description, requestedByEmail } = req.body;
      if (!equipmentId || !storeId || !description || !requestedByEmail)
        return res.status(400).json({ success: false, error: 'equipmentId, storeId, description and requestedByEmail are required' });

      const result = await pool.query(`
        INSERT INTO maintenance_requests
          (equipment_id, store_id, urgency, description, requested_by_email)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [equipmentId, storeId, urgency || 'medium', description, requestedByEmail]);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // PATCH /api/maintenance/:id/status — actualizar status
  router.patch('/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const valid = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
      if (!valid.includes(status))
        return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${valid.join(', ')}` });

      const result = await pool.query(`
        UPDATE maintenance_requests
        SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *
      `, [status, req.params.id]);

      if (!result.rows[0])
        return res.status(404).json({ success: false, error: 'Maintenance request not found' });

      res.json({ success: true, data: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  return router;
};