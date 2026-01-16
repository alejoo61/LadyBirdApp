class EquipmentService {
  constructor(equipmentRepository, storeRepository) {
    this.equipmentRepository = equipmentRepository;
    this.storeRepository = storeRepository;
  }

  async getAllEquipment(filters = {}) {
    // 1. Limpiamos y preparamos los filtros (esto hace que se puedan combinar)
    const processedFilters = {
      storeId: filters.storeId || null,
      type: filters.type || null,
      isDown: filters.isDown === 'true' || filters.isDown === true
    };

    // 2. Delegamos la complejidad al repositorio. 
    // No importa si vienen 1 o 5 filtros, el repositorio se encarga.
    return await this.equipmentRepository.findAll(processedFilters, true);
  }

  async getEquipmentById(id) {
    const equipment = await this.equipmentRepository.findById(id, true);
    if (!equipment) throw new Error('Equipment not found');
    return equipment;
  }

  async createEquipment(equipmentData) {
    // Validaciones de negocio (Obligatorias)
    const { storeId, equipmentCode, type, name } = equipmentData;
    if (!storeId || !equipmentCode || !type || !name) {
      throw new Error('storeId, equipmentCode, type, and name are required');
    }

    // Validar integridad (¿Existe la tienda?)
    const store = await this.storeRepository.findById(storeId);
    if (!store) throw new Error('Store not found');

    // Crear y devolver la entidad completa
    const id = await this.equipmentRepository.create(equipmentData);
    return await this.equipmentRepository.findById(id, true);
  }

  async updateEquipment(id, equipmentData) {
    // 1. ¿Existe el equipo?
    const existing = await this.getEquipmentById(id);

    // 2. ¿Si cambia de tienda, la nueva tienda existe?
    if (equipmentData.storeId && equipmentData.storeId !== existing.storeId) {
      const store = await this.storeRepository.findById(equipmentData.storeId);
      if (!store) throw new Error('Store not found');
    }

    await this.equipmentRepository.update(id, equipmentData);
    return await this.equipmentRepository.findById(id, true);
  }

  async markEquipmentStatus(id, isDown) {
    const equipment = await this.getEquipmentById(id);
    
    // Aquí usamos la lógica de la entidad si fuera necesario
    // pero para persistir, simplemente actualizamos el flag
    await this.equipmentRepository.update(id, { isDown });
    
    return await this.equipmentRepository.findById(id, true);
  }

  async deleteEquipment(id) {
    await this.getEquipmentById(id); // Valida existencia
    return await this.equipmentRepository.delete(id);
  }

  async getEquipmentTypes() {
    return await this.equipmentRepository.getTypes();
  }
}

module.exports = EquipmentService;