const Store = require('../entities/Store');

class StoreMapper {
  // Database row to Entity
  static toDomain(row) {
    if (!row) return null;
    
    return new Store({
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
      isActive: row.is_active,
      createdAt: row.created_at
    });
  }

  // Entity to Database row
  static toPersistence(store) {
    return {
      id: store.id,
      code: store.code,
      name: store.name,
      timezone: store.timezone,
      is_active: store.isActive,
      created_at: store.createdAt
    };
  }

  // Entity to API response
  static toDTO(store) {
    return {
      id: store.id,
      code: store.code,
      name: store.name,
      timezone: store.timezone,
      isActive: store.isActive,
      createdAt: store.createdAt,
      displayName: store.getDisplayName()
    };
  }

  // Multiple entities to DTOs
  static toDTOList(stores) {
    return stores.map(store => this.toDTO(store));
  }
}

module.exports = StoreMapper;