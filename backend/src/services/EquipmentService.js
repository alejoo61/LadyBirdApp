// src/services/EquipmentService.js
const Equipment = require('../entities/Equipment');

class EquipmentService {
  constructor(equipmentRepository, storeRepository) {
    this.equipmentRepository = equipmentRepository;
    this.storeRepository     = storeRepository;
  }

  async getAllEquipment(filters = {}) {
    return await this.equipmentRepository.findAll({
      storeId: filters.storeId || null,
      type:    filters.type    || null,
      isDown:  filters.isDown === 'true' || filters.isDown === true,
    });
  }

  async getEquipmentById(id) {
    const cleanId = (typeof id === 'object' && id !== null) ? id.id : id;
    const equipment = await this.equipmentRepository.findById(cleanId);
    if (!equipment) throw new Error('Equipment not found');
    return equipment;
  }

  async getEquipmentByCode(code) {
    const equipment = await this.equipmentRepository.findByCode(code);
    if (!equipment) throw new Error('Equipment not found');
    return equipment;
  }

  // ── CREAR EQUIPO ──────────────────────────────────────────────────────────
  async createEquipment(data) {
    const { storeId, name, yearCode, type } = data;
    if (!storeId || !name || !yearCode || !type)
      throw new Error('storeId, name, yearCode, and type are required');

    const store = await this.storeRepository.findById(storeId);
    if (!store) throw new Error('Store not found');

    // Usar typeCode del catálogo si está disponible, sino calcular del nombre
    const initials = data.typeCode || Equipment.calculateInitials(name);
    const maxSeq   = await this.equipmentRepository.getMaxSequenceInStore(storeId, initials);
    const nextSeq  = maxSeq + 1;
    const eqCode   = Equipment.generateFormattedCode(store.code, initials, yearCode, nextSeq);

    const created = await this.equipmentRepository.create({
      ...data,
      equipmentCode: eqCode,
      seq:           nextSeq,
      qrCodeText:    `LADYBIRD-EQ:${eqCode}`,
    });
    return await this.getEquipmentById(created.id);
  }

  // ── BATCH CREATION ────────────────────────────────────────────────────────
  // Crea N equipos del mismo tipo en una tienda
  async createBatch({ storeId, name, type, typeCode, yearCode, quantity }) {
    if (!storeId || !name || !type || !yearCode || !quantity)
      throw new Error('storeId, name, type, yearCode, and quantity are required');
    if (quantity < 1 || quantity > 50)
      throw new Error('Quantity must be between 1 and 50');

    const store = await this.storeRepository.findById(storeId);
    if (!store) throw new Error('Store not found');

    const initials = typeCode || Equipment.calculateInitials(name);
    let maxSeq     = await this.equipmentRepository.getMaxSequenceInStore(storeId, initials);

    const created = [];
    for (let i = 0; i < quantity; i++) {
      const nextSeq = ++maxSeq;
      const code    = Equipment.generateFormattedCode(store.code, initials, yearCode, nextSeq);
      const eq      = await this.equipmentRepository.create({
        storeId, name, type, yearCode,
        equipmentCode: code,
        seq:           nextSeq,
        qrCodeText:    `LADYBIRD-EQ:${code}`,
        isDown:        false,
      });
      created.push(await this.getEquipmentById(eq.id));
    }
    return created;
  }

  // ── TRANSFER ──────────────────────────────────────────────────────────────
  // Transfiere un equipo a otra tienda (temporal o definitivo)
  async transferEquipment(id, { toStoreId, isTemporary = false, returnDate, reason, transferredBy }) {
    if (!toStoreId) throw new Error('toStoreId is required');

    const equipment = await this.getEquipmentById(id);
    const toStore   = await this.storeRepository.findById(toStoreId);
    if (!toStore) throw new Error('Destination store not found');

    const fromStoreId = equipment.storeId;

    // Registrar historial
    await this.equipmentRepository.logTransfer(equipment.id, fromStoreId, toStoreId, {
      isTemporary,
      returnDate: returnDate || null,
      reason:     reason || (isTemporary ? 'Temporary loan' : 'Permanent transfer'),
      transferredBy: transferredBy || null,
    });

    // Si es definitivo, actualizar store_id y regenerar código
    if (!isTemporary) {
      const initials = Equipment.calculateInitials(equipment.name);
      const maxSeq   = await this.equipmentRepository.getMaxSequenceInStore(toStoreId, initials);
      const nextSeq  = maxSeq + 1;
      const newCode  = Equipment.generateFormattedCode(toStore.code, initials, equipment.yearCode, nextSeq);

      await this.equipmentRepository.update(equipment.id, {
        ...equipment,
        storeId:       toStoreId,
        equipmentCode: newCode,
        seq:           nextSeq,
        qrCodeText:    `LADYBIRD-EQ:${newCode}`,
      });
    }

    return await this.getEquipmentById(equipment.id);
  }

  // ── HISTORIAL ─────────────────────────────────────────────────────────────
  async getTransferHistory(id) {
    await this.getEquipmentById(id); // Valida que existe
    return await this.equipmentRepository.getHistory(id);
  }

  // ── ACTUALIZAR ────────────────────────────────────────────────────────────
  async updateEquipment(id, data) {
    const existing = await this.getEquipmentById(id);

    let dataToUpdate = {
      storeId:       data.storeId       || existing.storeId,
      name:          data.name          || existing.name,
      type:          data.type          || existing.type,
      yearCode:      data.yearCode      || existing.yearCode,
      isDown:        data.isDown !== undefined ? data.isDown : existing.isDown,
      equipmentCode: existing.equipmentCode,
      seq:           existing.seq,
      qrCodeText:    existing.qrCodeText,
    };

    // Si cambia de tienda → transferencia definitiva automática
    if (data.storeId && data.storeId !== existing.storeId) {
      return await this.transferEquipment(id, { toStoreId: data.storeId, isTemporary: false });
    }

    const updated = await this.equipmentRepository.update(id, dataToUpdate);
    return await this.getEquipmentById(updated.id);
  }

  async markEquipmentStatus(id, isDown) {
    const equipment = await this.getEquipmentById(id);
    await this.equipmentRepository.update(equipment.id, { ...equipment, isDown });
    return await this.getEquipmentById(equipment.id);
  }

  async deleteEquipment(id) {
    const equipment = await this.getEquipmentById(id);
    return await this.equipmentRepository.delete(equipment.id);
  }

  async getEquipmentTypes() {
    return await this.equipmentRepository.getTypes();
  }

  async getEquipmentTypeCatalog() {
    return await this.equipmentRepository.getEquipmentTypeCatalog();
  }
}

module.exports = EquipmentService;