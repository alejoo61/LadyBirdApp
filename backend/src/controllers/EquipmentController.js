// src/controllers/EquipmentController.js
const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentController {
  constructor(equipmentService) {
    this.equipmentService = equipmentService;
  }

  getAll = async (req, res) => {
    try {
      const equipment = await this.equipmentService.getAllEquipment(req.query);
      res.json({ success: true, data: EquipmentMapper.toDTOList(equipment), count: equipment.length });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  };

  getTypes = async (req, res) => {
    try {
      const types = await this.equipmentService.getEquipmentTypes();
      res.json({ success: true, data: types });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  };

  getById = async (req, res) => {
    try {
      const equipment = await this.equipmentService.getEquipmentById(req.params.id);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment) });
    } catch (e) { res.status(404).json({ success: false, error: e.message }); }
  };

  // GET /api/equipment/qr/:code — público, usado por el QR scanner
  getByCode = async (req, res) => {
    try {
      const equipment = await this.equipmentService.getEquipmentByCode(req.params.code);
      const dto = EquipmentMapper.toDTO(equipment);
      // Incluir emails de la tienda para pre-poblar el formulario
      dto.storeEmails = equipment.storeEmails || '';
      res.json({ success: true, data: dto });
    } catch (e) { res.status(404).json({ success: false, error: e.message }); }
  };

  create = async (req, res) => {
    try {
      const equipment = await this.equipmentService.createEquipment(req.body);
      res.status(201).json({ success: true, data: EquipmentMapper.toDTO(equipment), message: 'Equipment created successfully' });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  // POST /api/equipment/batch — crea N equipos del mismo tipo
  createBatch = async (req, res) => {
    try {
      const equipment = await this.equipmentService.createBatch(req.body);
      res.status(201).json({
        success: true,
        data:    EquipmentMapper.toDTOList(equipment),
        count:   equipment.length,
        message: `${equipment.length} equipment items created successfully`,
      });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  update = async (req, res) => {
    try {
      const equipment = await this.equipmentService.updateEquipment(req.params.id, req.body);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment), message: 'Equipment updated successfully' });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  delete = async (req, res) => {
    try {
      await this.equipmentService.deleteEquipment(req.params.id);
      res.json({ success: true, message: 'Equipment deleted successfully' });
    } catch (e) { res.status(404).json({ success: false, error: e.message }); }
  };

  markAsDown = async (req, res) => {
    try {
      const equipment = await this.equipmentService.markEquipmentStatus(req.params.id, true);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment) });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  markAsOperational = async (req, res) => {
    try {
      const equipment = await this.equipmentService.markEquipmentStatus(req.params.id, false);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment) });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  // POST /api/equipment/:id/transfer
  transfer = async (req, res) => {
    try {
      const { toStoreId, isTemporary, returnDate, reason, transferredBy } = req.body;
      const equipment = await this.equipmentService.transferEquipment(req.params.id, {
        toStoreId, isTemporary, returnDate, reason, transferredBy,
      });
      res.json({
        success: true,
        data:    EquipmentMapper.toDTO(equipment),
        message: isTemporary ? 'Equipment loaned successfully' : 'Equipment transferred successfully',
      });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  };

  // GET /api/equipment/:id/history
  getHistory = async (req, res) => {
    try {
      const history = await this.equipmentService.getTransferHistory(req.params.id);
      res.json({ success: true, data: history, count: history.length });
    } catch (e) { res.status(404).json({ success: false, error: e.message }); }
  };
}

module.exports = EquipmentController;