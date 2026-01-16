class StoreService {
  constructor(storeRepository) {
    this.storeRepository = storeRepository;
  }

  async getAllStores() {
    return await this.storeRepository.findAll();
  }

  async getActiveStores() {
    return await this.storeRepository.findActive();
  }

  async getStoreById(id) {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new Error('Store not found');
    }
    return store;
  }

  async createStore(storeData) {
    // Validate required fields
    if (!storeData.code || !storeData.name) {
      throw new Error('Code and name are required');
    }

    // Check if code already exists
    const existingStore = await this.storeRepository.findByCode(storeData.code);
    if (existingStore) {
      throw new Error('Store code already exists');
    }

    return await this.storeRepository.create(storeData);
  }

  async updateStore(id, storeData) {
    // Check if store exists
    const existingStore = await this.storeRepository.findById(id);
    if (!existingStore) {
      throw new Error('Store not found');
    }

    // Check if new code conflicts with another store
    if (storeData.code && storeData.code !== existingStore.code) {
      const storeWithCode = await this.storeRepository.findByCode(storeData.code);
      if (storeWithCode && storeWithCode.id !== id) {
        throw new Error('Store code already exists');
      }
    }

    return await this.storeRepository.update(id, storeData);
  }

  async deleteStore(id) {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new Error('Store not found');
    }

    return await this.storeRepository.delete(id);
  }
}

module.exports = StoreService;