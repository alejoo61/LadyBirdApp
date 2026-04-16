// src/services/ToastMenuSyncService.js

const CATERING_MENU_NAMES = [
  'catering menu',
  'catering internal menu',
];

const GROUP_TO_EVENT_TYPES = {
  'taco bar':              ['TACO_BAR'],
  'taco bar (copy)':       ['TACO_BAR'],
  "'bird boxes":           ['BIRD_BOX'],
  "'bird boxes (copy)":    ['BIRD_BOX'],
  "personal 'bird box":    ['PERSONAL_BOX'],
  'personal bird box':     ['PERSONAL_BOX'],
  'fooda*':                ['FOODA'],
  'ez cater/relish':       ['TACO_BAR', 'BIRD_BOX', 'PERSONAL_BOX'],
  'snacks':                ['TACO_BAR', 'BIRD_BOX'],
  'snacks (copy)':         ['TACO_BAR', 'BIRD_BOX'],
  'fresh salads':          ['TACO_BAR'],
  'fresh salads (copy)':   ['TACO_BAR'],
};

const MOD_GROUP_RULES = [
  { match: /taco bar protein/i,                          category: 'protein',     eventTypes: ['TACO_BAR']             },
  { match: /additional taco bar protein/i,               category: 'protein',     eventTypes: ['TACO_BAR']             },
  { match: /taco bar toppings/i,                         category: 'topping',     eventTypes: ['TACO_BAR']             },
  { match: /taco bar snacks/i,                           category: 'snack',       eventTypes: ['TACO_BAR']             },
  { match: /taco bar salsas/i,                           category: 'salsa',       eventTypes: ['TACO_BAR']             },
  { match: /taco bar paper|paper goods/i,                category: 'paper',       eventTypes: ['TACO_BAR']             },
  { match: /taco bar tortilla/i,                         category: 'tortilla',    eventTypes: ['TACO_BAR']             },
  { match: /bird box.*combo/i,                           category: 'combo',       eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*size/i,                            category: 'size',        eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*tortilla/i,                        category: 'tortilla',    eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*paper/i,                           category: 'paper',       eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*chip/i,                            category: 'chips_salsa', eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*salsa/i,                           category: 'salsa',       eventTypes: ['BIRD_BOX']             },
  { match: /bird box.*protein/i,                         category: 'protein',     eventTypes: ['BIRD_BOX']             },
  { match: /personal.*combo|combo.*personal/i,           category: 'combo',       eventTypes: ['PERSONAL_BOX']         },
  { match: /personal.*tortilla/i,                        category: 'tortilla',    eventTypes: ['PERSONAL_BOX']         },
  { match: /personal.*paper/i,                           category: 'paper',       eventTypes: ['PERSONAL_BOX']         },
  { match: /^tortillas$/i,                               category: 'tortilla',    eventTypes: null                     },
  { match: /^salsas$/i,                                  category: 'salsa',       eventTypes: null                     },
  { match: /^proteins?$/i,                               category: 'protein',     eventTypes: null                     },
  { match: /^toppings?$/i,                               category: 'topping',     eventTypes: null                     },
  { match: /^snacks?$/i,                                 category: 'snack',       eventTypes: null                     },
  { match: /catering creamer/i,                          category: 'creamer',     eventTypes: ['BIRD_BOX', 'TACO_BAR'] },
  { match: /salsa.*catering|catering.*salsa/i,           category: 'salsa',       eventTypes: ['TACO_BAR']             },
  { match: /would you like.*paper|paper.*napkin/i,       category: 'paper',       eventTypes: null                     },
];

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
        console.error(`❌ Error syncing ${store.code}:`, error.message);
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

    const modGroups = menuData.modifierGroupReferences  || {};
    const modOpts   = menuData.modifierOptionReferences || {};
    const items     = this._extractCateringItems(menuData.menus, modGroups, modOpts);

    let synced = 0;
    for (const item of items) {
      try {
        await this._upsertMenuItem(item);
        synced++;
      } catch (err) {
        console.error(`❌ Error upserting "${item.name}":`, err.message);
      }
    }

    console.log(`✅ ${store.name}: ${synced} catering items synced`);
    return { synced };
  }

  // ─── EXTRACCIÓN ───────────────────────────────────────────────────────────

  _extractCateringItems(menus, modGroups, modOpts) {
    const itemMap = new Map();

    for (const menu of menus) {
      const isCateringMenu = CATERING_MENU_NAMES.some(n =>
        menu.name?.toLowerCase().includes(n)
      );

      for (const group of menu.menuGroups || []) {
        this._processGroup(group, isCateringMenu, modGroups, modOpts, itemMap);
      }
    }

    return Array.from(itemMap.values());
  }

  _processGroup(group, isCateringMenu, modGroups, modOpts, itemMap, parentEventTypes = null) {
    const groupNameLc     = (group.name || '').toLowerCase();
    const groupEventTypes = parentEventTypes
      || this._getEventTypesForGroup(groupNameLc)
      || (isCateringMenu ? [] : []);

    for (const item of group.menuItems || []) {
      const category = this._getCategoryForGroup(groupNameLc) || 'menu_item';
      const entry = {
        toastGuid:  item.guid,
        name:       item.name,
        category,
        price:      item.price || 0,
        eventTypes: isCateringMenu ? groupEventTypes : [],
      };

      this._mergeItem(itemMap, entry);

      if (isCateringMenu) {
        this._extractModifiersFromItem(item, modGroups, modOpts, itemMap, groupEventTypes);
      }
    }

    for (const sub of group.menuGroups || []) {
      this._processGroup(sub, isCateringMenu, modGroups, modOpts, itemMap, groupEventTypes);
    }
  }

  _extractModifiersFromItem(item, modGroups, modOpts, itemMap, itemEventTypes) {
    for (const modGroupRef of item.modifierGroupReferences || []) {
      const modGroup = modGroups[String(modGroupRef)];
      if (!modGroup) continue;

      const modGroupName = modGroup.name || '';
      let { category, eventTypes } = this._classifyModGroup(modGroupName);

      if (!eventTypes) eventTypes = itemEventTypes;

      for (const optRef of modGroup.modifierOptionReferences || []) {
        const opt = modOpts[String(optRef)];
        if (!opt?.name) continue;

        const nameLc = opt.name.toLowerCase();
        if (
          nameLc.startsWith('no ') ||
          nameLc.startsWith('no,') ||
          nameLc === 'no snacks' ||
          nameLc === 'no protein'
        ) continue;

        const entry = {
          toastGuid:  opt.guid,
          name:       opt.name,
          category:   category || 'modifier',
          price:      opt.price || 0,
          eventTypes: eventTypes || [],
        };

        this._mergeItem(itemMap, entry);
      }
    }
  }

  // ─── MERGE ────────────────────────────────────────────────────────────────

  _mergeItem(itemMap, entry) {
    // Usar lowercase como key para evitar duplicados por capitalización
    const key = entry.name.toLowerCase();
    if (itemMap.has(key)) {
      const existing = itemMap.get(key);
      existing.eventTypes = [...new Set([...existing.eventTypes, ...entry.eventTypes])];
      if (entry.price > existing.price) existing.price = entry.price;
      if (entry.category !== 'modifier' && existing.category === 'modifier') {
        existing.category = entry.category;
      }
    } else {
      itemMap.set(key, { ...entry });
    }
  }

  // ─── CLASIFICACIÓN ────────────────────────────────────────────────────────

  _getEventTypesForGroup(groupNameLc) {
    for (const [key, types] of Object.entries(GROUP_TO_EVENT_TYPES)) {
      if (groupNameLc.includes(key)) return types;
    }
    return null;
  }

  _getCategoryForGroup(groupNameLc) {
    if (groupNameLc.includes('taco bar'))  return 'menu_item';
    if (groupNameLc.includes('bird box'))  return 'menu_item';
    if (groupNameLc.includes('personal'))  return 'menu_item';
    if (groupNameLc.includes('snack'))     return 'snack';
    if (groupNameLc.includes('salad'))     return 'menu_item';
    if (groupNameLc.includes('fooda'))     return 'menu_item';
    return null;
  }

  _classifyModGroup(modGroupName) {
    for (const rule of MOD_GROUP_RULES) {
      if (rule.match.test(modGroupName)) {
        return { category: rule.category, eventTypes: rule.eventTypes };
      }
    }
    const n = modGroupName.toLowerCase();
    if (n.includes('taco bar'))  return { category: 'modifier', eventTypes: ['TACO_BAR']     };
    if (n.includes('bird box'))  return { category: 'modifier', eventTypes: ['BIRD_BOX']     };
    if (n.includes('personal'))  return { category: 'modifier', eventTypes: ['PERSONAL_BOX'] };
    return { category: 'modifier', eventTypes: null };
  }

  // ─── UPSERT ───────────────────────────────────────────────────────────────

  async _upsertMenuItem(item) {
    await this.pool.query(`
      INSERT INTO menu_items (name, category, event_types, price, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (LOWER(name)) DO UPDATE SET
        category    = EXCLUDED.category,
        event_types = EXCLUDED.event_types,
        price       = EXCLUDED.price,
        updated_at  = CURRENT_TIMESTAMP
    `, [
      item.name,
      item.category,
      item.eventTypes,
      item.price,
    ]);
  }
}

module.exports = ToastMenuSyncService;