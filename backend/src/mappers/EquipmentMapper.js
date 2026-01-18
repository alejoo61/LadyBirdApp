const Equipment = require('../entities/Equipment');
const StoreMapper = require('./StoreMapper');

class EquipmentMapper {
  static toDomain(row, storeData = null) {
    if (!row) return null;
    
    return new Equipment({
      id: row.id,
      storeId: row.store_id,
      equipmentCode: row.equipment_code,
      type: row.type,
      name: row.name,
      yearCode: row.year_code,
      seq: row.seq,
      isDown: row.is_down,
      createdAt: row.created_at,
      qrCodeText: row.qr_code_text,
      store: storeData ? StoreMapper.toDomain(storeData) : null
    });
  }

  static toDTO(equipment) {
    if (!equipment) return null;

    // Forzamos que sea una instancia de la entidad para tener los métodos getStatus()
    const entity = equipment instanceof Equipment ? equipment : this.toDomain(equipment, equipment.store);

    return {
      id: entity.id,
      storeId: entity.storeId,
      equipmentCode: entity.equipmentCode,
      type: entity.type,
      name: entity.name,
      yearCode: entity.yearCode,
      seq: entity.seq,
      isDown: entity.isDown,
      status: entity.getStatus(), // Funciona porque es una Entidad
      fullName: entity.getFullName(), // Funciona porque es una Entidad
      createdAt: entity.createdAt,
      store: entity.store ? StoreMapper.toDTO(entity.store) : null
    };
  }

  static toDTOList(equipments) {
    if (!Array.isArray(equipments)) return [];
    return equipments.map(e => this.toDTO(e));
  }
}

module.exports = EquipmentMapper;