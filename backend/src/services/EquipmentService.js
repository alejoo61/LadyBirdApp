// src/services/EquipmentService.js
const Equipment = require('../entities/Equipment');

class EquipmentService {
  constructor(equipmentRepository, storeRepository) {
    this.equipmentRepository = equipmentRepository;
    this.storeRepository = storeRepository;
  }

  async getAllEquipment(filters = {}) {
    const processedFilters = {
      storeId: filters.storeId || null,
      type: filters.type || null,
      isDown: filters.isDown === 'true' || filters.isDown === true
    };
    return await this.equipmentRepository.findAll(processedFilters, true);
  }

  async getEquipmentById(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const equipment = await this.equipmentRepository.findById(cleanId, true);
    if (!equipment) throw new Error('Equipment not found');
    return equipment;
  }

  async createEquipment(equipmentData) {
    const { storeId, name, yearCode, type } = equipmentData;

    if (!storeId || !name || !yearCode || !type) {
      throw new Error('storeId, name, yearCode, and type are required');
    }

    const store = await this.storeRepository.findById(storeId);
    if (!store) throw new Error('Store not found');

    const initials = Equipment.calculateInitials(name);
    const maxSeq = await this.equipmentRepository.getMaxSequenceInStore(storeId, initials);
    const nextSeq = maxSeq + 1;

    const generatedCode = Equipment.generateFormattedCode(store.code, initials, yearCode, nextSeq);

    const finalData = {
      ...equipmentData,
      equipmentCode: generatedCode,
      seq: nextSeq,
      qrCodeText: `LADYBIRD-EQ:${generatedCode}` 
    };

    const created = await this.equipmentRepository.create(finalData);
    return await this.getEquipmentById(created.id);
  }

  /**
   * ACTUALIZAR EQUIPO (Corregido para evitar nulos)
   */
  async updateEquipment(id, equipmentData) {
    const existing = await this.getEquipmentById(id);
    
    // 1. Empezamos con los datos que ya existen para no enviar NULOS a la DB
    let dataToUpdate = {
      storeId: equipmentData.storeId || existing.storeId,
      name: equipmentData.name || existing.name,
      type: equipmentData.type || existing.type,
      yearCode: equipmentData.yearCode || existing.yearCode,
      isDown: equipmentData.isDown !== undefined ? equipmentData.isDown : existing.isDown,
      // Estos campos se mantienen a menos que haya transferencia
      equipmentCode: existing.equipmentCode,
      seq: existing.seq,
      qrCodeText: existing.qrCodeText
    };

    // 2. Si detectamos transferencia de tienda, REGENERAMOS el código
    if (equipmentData.storeId && equipmentData.storeId !== existing.storeId) {
      const newStore = await this.storeRepository.findById(equipmentData.storeId);
      if (!newStore) throw new Error('New Store not found');

      // Registrar historial
      await this.equipmentRepository.logTransfer(existing.id, existing.storeId, equipmentData.storeId);

      // Calcular nueva nomenclatura
      const initials = Equipment.calculateInitials(dataToUpdate.name);
      const maxSeq = await this.equipmentRepository.getMaxSequenceInStore(equipmentData.storeId, initials);
      const nextSeq = maxSeq + 1;

      dataToUpdate.equipmentCode = Equipment.generateFormattedCode(
        newStore.code, 
        initials, 
        dataToUpdate.yearCode, 
        nextSeq
      );
      dataToUpdate.seq = nextSeq;
      dataToUpdate.qrCodeText = `LADYBIRD-EQ:${dataToUpdate.equipmentCode}`;
    }

    // 3. Enviamos el objeto completo (sin nulos) al repositorio
    const updated = await this.equipmentRepository.update(id, dataToUpdate);
    return await this.getEquipmentById(updated.id);
  }

  async markEquipmentStatus(id, isDown) {
    const equipment = await this.getEquipmentById(id);
    // Usamos el ID limpio y solo actualizamos el campo necesario
    const updated = await this.equipmentRepository.update(equipment.id, { 
      ...equipment, 
      isDown 
    });
    return await this.getEquipmentById(updated.id);
  }

  async deleteEquipment(id) {
    const equipment = await this.getEquipmentById(id);
    return await this.equipmentRepository.delete(equipment.id);
  }

  async getEquipmentTypes() {
    return await this.equipmentRepository.getTypes();
  }
}

module.exports = EquipmentService;