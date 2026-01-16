const EquipmentMapper = require('../mappers/EquipmentMapper');

class EquipmentController {
  constructor(equipmentService) {
    this.equipmentService = equipmentService;
  }

  async getAll(req, res) {
    try {
      const { storeId, type, isDown } = req.query;
      
      const equipment = await this.equipmentService.getAllEquipment({
        storeId,
        type,
        isDown,
        includeStore: true
      });

      res.json({
        success: true,
        data: EquipmentMapper.toDTOList(equipment),
        count: equipment.length,
        filters: { storeId, type, isDown }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.getEquipmentById(id);

      res.json({
        success: true,
        data: EquipmentMapper.toDTO(equipment)
      });
    } catch (error) {
      const statusCode = error.message === 'Equipment not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async getByStore(req, res) {
    try {
      const { storeId } = req.params;
      const equipment = await this.equipmentService.getEquipmentByStore(storeId);

      res.json({
        success: true,
        data: EquipmentMapper.toDTOList(equipment),
        count: equipment.length,
        storeId
      });
    } catch (error) {
      const statusCode = error.message === 'Store not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTypes(req, res) {
    try {
      const types = await this.equipmentService.getEquipmentTypes();

      res.json({
        success: true,
        data: types,
        count: types.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async create(req, res) {
    try {
      const equipment = await this.equipmentService.createEquipment(req.body);

      res.status(201).json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment created successfully'
      });
    } catch (error) {
      const statusCode = error.message.includes('required') || error.message.includes('not found') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.updateEquipment(id, req.body);

      res.json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment updated successfully'
      });
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await this.equipmentService.deleteEquipment(id);

      res.json({
        success: true,
        message: 'Equipment deleted successfully'
      });
    } catch (error) {
      const statusCode = error.message === 'Equipment not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async markAsDown(req, res) {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.markEquipmentAsDown(id);

      res.json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment marked as down'
      });
    } catch (error) {
      const statusCode = error.message === 'Equipment not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async markAsOperational(req, res) {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.markEquipmentAsOperational(id);

      res.json({
        success: true,
        data: EquipmentMapper.toDTO(equipment),
        message: 'Equipment marked as operational'
      });
    } catch (error) {
      const statusCode = error.message === 'Equipment not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = EquipmentController;