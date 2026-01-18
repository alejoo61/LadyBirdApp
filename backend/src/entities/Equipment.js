// src/entities/Equipment.js
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
    qrCodeText, // Nuevo campo
    createdAt,
    store // Relación cargada
  }) {
    this.id = id;
    this.storeId = storeId;
    this.equipmentCode = equipmentCode;
    this.type = type;
    this.name = name;
    this.yearCode = yearCode;
    this.seq = seq;
    this.isDown = isDown;
    this.qrCodeText = qrCodeText;
    this.createdAt = createdAt;
    this.store = store;
  }

  // Lógica para obtener las iniciales (Ej: "Tortilla Press" -> "TP")
  static calculateInitials(name) {
    if (!name) return 'XX';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Genera el código final: 12S-TP-99-01
  static generateFormattedCode(storeCode, initials, year, sequence) {
    const formattedSeq = String(sequence).padStart(2, '0');
    // Tomamos los últimos 2 dígitos del año si es necesario
    const shortYear = String(year).slice(-2);
    return `${storeCode}-${initials}-${shortYear}-${formattedSeq}`;
  }

  getStatus() {
    return this.isDown ? 'DOWN' : 'OPERATIONAL';
  }

  getFullName() {
    return `${this.equipmentCode} - ${this.name}`;
  }
}

module.exports = Equipment;