// src/services/StoreService.js

class StoreService {
  constructor(storeRepository) {
    this.storeRepository = storeRepository;
  }

  // MEJORA: Unificamos los filtros para que sea escalable
  async getAllStores(filters = {}) {
    // Si el frontend envía ?active=true, usamos findActive, si no, traemos todas.
    if (filters.active === true || filters.active === 'true') {
      return await this.storeRepository.findActive();
    }
    return await this.storeRepository.findAll();
  }

  async getStoreById(id) {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new Error('Store not found');
    }
    return store;
  }

  async createStore(storeData) {
    // 1. Validaciones básicas
    if (!storeData.code || !storeData.name) {
      throw new Error('Code and name are required');
    }

    // 2. MEJORA: Normalizamos el código (Mayúsculas y sin espacios)
    const normalizedCode = storeData.code.trim().toUpperCase();

    // 3. Verificar si el código ya existe
    const existingStore = await this.storeRepository.findByCode(normalizedCode);
    if (existingStore) {
      throw new Error(`The store code "${normalizedCode}" already exists`);
    }

    // 4. Guardamos con el código limpio
    return await this.storeRepository.create({
      ...storeData,
      code: normalizedCode
    });
  }

  async updateStore(id, storeData) {
    // 1. Verificar existencia
    const existingStore = await this.getStoreById(id);

    // 2. Si se intenta cambiar el código, normalizar y verificar disponibilidad
    if (storeData.code) {
      const normalizedCode = storeData.code.trim().toUpperCase();
      
      if (normalizedCode !== existingStore.code) {
        const storeWithCode = await this.storeRepository.findByCode(normalizedCode);
        if (storeWithCode) {
          throw new Error('The new store code already exists');
        }
        storeData.code = normalizedCode;
      }
    }

    return await this.storeRepository.update(id, storeData);
  }

  async deleteStore(id) {
    // Usamos el método interno para validar existencia antes de borrar
    await this.getStoreById(id);
    return await this.storeRepository.delete(id);
  }
}

module.exports = StoreService;