// src/controllers/EquipmentController.js
const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentController {
  constructor(equipmentService) {
    this.equipmentService = equipmentService;
  }

  // Usar funciones de flecha para mantener el contexto de 'this'
  getAll = async (req, res) => {
    try {
      const equipment = await this.equipmentService.getAllEquipment(req.query);
      res.json({
        success: true,
        data: EquipmentMapper.toDTOList(equipment),
        count: equipment.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getTypes = async (req, res) => {
    try {
      const types = await this.equipmentService.getEquipmentTypes();
      res.json({ success: true, data: types });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  create = async (req, res) => {
    try {
      const equipment = await this.equipmentService.createEquipment(req.body);
      res.status(201).json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment created successfully'
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.updateEquipment(id, req.body);
      res.json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment updated successfully'
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;
      await this.equipmentService.deleteEquipment(id);
      res.json({ success: true, message: 'Equipment deleted successfully' });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  };

  markAsDown = async (req, res) => {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.markEquipmentStatus(id, true);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  markAsOperational = async (req, res) => {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.markEquipmentStatus(id, false);
      res.json({ success: true, data: EquipmentMapper.toDTO(equipment) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };
}

module.exports = EquipmentController;