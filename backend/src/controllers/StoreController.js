// src/controllers/StoreController.js
const StoreMapper = require('../mappers/StoreMapper');

class StoreController {
  constructor(storeService) {
    this.storeService = storeService;
  }

  async getAll(req, res) {
    try {
      // MEJORA: Pasamos todo el objeto query al service.
      // Esto permite filtrar por ?active=true o cualquier otro filtro futuro.
      const stores = await this.storeService.getAllStores(req.query);

      res.json({
        success: true,
        data: StoreMapper.toDTOList(stores),
        count: stores.length
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
      const store = await this.storeService.getStoreById(id);

      res.json({
        success: true,
        data: StoreMapper.toDTO(store)
      });
    } catch (error) {
      const statusCode = error.message === 'Store not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async create(req, res) {
    try {
      // El Service se encarga de validar duplicados y campos obligatorios
      const store = await this.storeService.createStore(req.body);

      res.status(201).json({
        success: true,
        data: StoreMapper.toDTO(store),
        message: 'Store created successfully'
      });
    } catch (error) {
      // Manejamos errores de validación (400) o de servidor (500)
      const statusCode = error.message.includes('required') || error.message.includes('exists') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const store = await this.storeService.updateStore(id, req.body);

      res.json({
        success: true,
        data: StoreMapper.toDTO(store),
        message: 'Store updated successfully'
      });
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 
                        error.message.includes('exists') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await this.storeService.deleteStore(id);

      res.json({
        success: true,
        message: 'Store deleted successfully'
      });
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = StoreController;