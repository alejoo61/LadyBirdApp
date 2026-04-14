// src/services/ToastMenuSyncService.js

class ToastMenuSyncService {
  constructor(toastApiClient, pool) {
    this.toastApiClient = toastApiClient;
    this.pool           = pool;
  }

  async syncMenusForAllStores() {
    const stores = await this.pool.query(`
      SELECT id, name, code, toast_restaurant_guid 
      FROM stores 
      WHERE toast_restaurant_guid IS NOT NULL AND is_active = true
    `);

    const results = [];
    for (const store of stores.rows) {
      try {
        const result = await this.syncMenuForStore(store);
        results.push({ store: store.code, ...result });
      } catch (error) {
        results.push({ store: store.code, error: error.message });
      }
    }
    return results;
  }

  async syncMenuForStore(store) {
    console.log(`🍽️  Syncing menu for ${store.name}...`);

    const menuData = await this.toastApiClient.get(
      '/menus/v2/menus',
      store.toast_restaurant_guid
    );

    if (!menuData?.menus) return { synced: 0 };

    const items     = this._extractMenuItems(menuData);
    const modifiers = this._extractModifiers(menuData);
    const allItems  = [...items, ...modifiers];

    let synced = 0;
    for (const item of allItems) {
      try {
        await this._upsertMenuItem(item);
        synced++;
      } catch (err) {
        console.error(`❌ Error upserting ${item.name}:`, err.message);
      }
    }

    console.log(`✅ ${store.name}: ${synced} menu items synced`);
    return { synced };
  }

  _extractMenuItems(menuData) {
    const items = [];
    for (const menu of menuData.menus || []) {
      for (const group of menu.menuGroups || []) {
        this._extractFromGroup(group, items);
      }
    }
    return items;
  }

  _extractFromGroup(group, items) {
    for (const item of group.menuItems || []) {
      items.push({
        toastGuid: item.guid,
        name:      item.name,
        category:  'menu_item',
        price:     item.price || 0,
        source:    'toast',
      });
    }
    // Subgroups
    for (const subgroup of group.menuGroups || []) {
      this._extractFromGroup(subgroup, items);
    }
  }

  _extractModifiers(menuData) {
    const modifiers = [];
    const modRefs   = menuData.modifierOptionReferences || {};

    for (const key of Object.keys(modRefs)) {
      const mod = modRefs[key];
      if (!mod?.name) continue;
      modifiers.push({
        toastGuid: mod.guid,
        name:      mod.name,
        category:  'modifier',
        price:     mod.price || 0,
        source:    'toast',
      });
    }
    return modifiers;
  }

  async _upsertMenuItem(item) {
    // Actualizar precio si ya existe por nombre, sino insertar
    await this.pool.query(`
      INSERT INTO menu_items (name, category, event_types, price, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (name) DO UPDATE SET
        price      = EXCLUDED.price,
        updated_at = CURRENT_TIMESTAMP
    `, [
      item.name,
      item.category,
      [],
      item.price,
    ]);
  }
}

module.exports = ToastMenuSyncService;