const Store = require('../entities/Store');

class StoreMapper {
  static toDomain(row) {
    if (!row) return null;
    return new Store({
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
      isActive: row.is_active,
      emails: row.emails, // Recibe el string de la DB
      createdAt: row.created_at
    });
  }

  static toDTO(store) {
    if (!store) return null;
    const entity = store instanceof Store ? store : this.toDomain(store);

    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      timezone: entity.timezone,
      isActive: entity.isActive,
      emails: entity.getEmailList(), // Enviamos un Array ['a@a.com', 'b@b.com']
      status: entity.getStatus(),
      displayName: entity.getDisplayName(),
      createdAt: entity.createdAt
    };
  }

  static toDTOList(stores) {
    if (!Array.isArray(stores)) return [];
    return stores.map(s => this.toDTO(s));
  }
}

module.exports = StoreMapper;