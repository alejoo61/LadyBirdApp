class Equipment {
  constructor({
    id,
    storeId,
    equipmentCode,
    type,
    name,
    yearCode,
    seq,
    isDown,
    createdAt,
    // Relations
    store
  }) {
    this.id = id;
    this.storeId = storeId;
    this.equipmentCode = equipmentCode;
    this.type = type;
    this.name = name;
    this.yearCode = yearCode;
    this.seq = seq;
    this.isDown = isDown;
    this.createdAt = createdAt;
    
    // Relations
    this.store = store;
  }

  // Business logic methods
  getStatus() {
    return this.isDown ? 'DOWN' : 'OPERATIONAL';
  }

  getFullName() {
    return `${this.equipmentCode} - ${this.name}`;
  }

  needsMaintenance() {
    return this.isDown;
  }
}

module.exports = Equipment;