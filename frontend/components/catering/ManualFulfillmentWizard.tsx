'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Trash2, ChevronRight, ChevronLeft,
  FileText, ClipboardList, Coffee, UtensilsCrossed,
} from 'lucide-react';
import type { Store } from '@/services/api/storesApi';
import type { CateringOrder } from '@/services/api/cateringApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'TACO_BAR' | 'BIRD_BOX' | 'PERSONAL_BOX' | 'INDIVIDUAL_TACOS' | 'SALADS';

interface TacoBarConfig {
  guestCount: number;
  proteins:   string[];
  toppings:   string[];
  salsas:     string[];
  tortilla:   string;
  extras:     string[];
}

interface BirdBoxConfig {
  tacoCount:     number;
  tacos:         string[];
  tortilla:      string;
  chipsIncluded: boolean;
  paperItems:    boolean;
  mealType:      'breakfast' | 'lunch' | 'all';
}

interface PersonalBoxConfig {
  quantity: number;
  tacos:    { name: string; tortilla: string }[];
  salsa:    string;
  mealType: 'breakfast' | 'lunch' | 'all';
}

interface IndividualTacosConfig {
  tacos: { name: string; quantity: number; tortilla: string }[];
}

interface SaladsConfig {
  salads: { name: string; quantity: number; protein: string }[];
}

interface EventBlock {
  id:              string;
  type:            EventType;
  tacoBar?:        TacoBarConfig;
  birdBox?:        BirdBoxConfig;
  personalBox?:    PersonalBoxConfig;
  individualTacos?: IndividualTacosConfig;
  salads?:         SaladsConfig;
}

interface DrinkItem {
  name:       string;
  quantity:   number;
  creamers?:  string[];
  wantsCups?: boolean;
}

interface AddonItem {
  name:     string;
  quantity: number;
}

interface ExtrasItem {
  name:     string;
  quantity: number;
  category: 'equipment' | 'space_rental' | 'kids';
}

// ─── Menu items por categoría (viene del API) ─────────────────────────────────
type ByCategory = Record<string, string[]>;

interface WizardProps {
  stores:        Store[];
  onClose:       () => void;
  onSuccess?:    () => void;
  editingOrder?: CateringOrder;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRINKS_FALLBACK    = ["Drip Coffee - 96oz", "Watermelon Aqua Fresca", "Lavender Limeade (1/2 Gal)", "Hibiscus Tea (1/2 Gal)", "Iced Coffee", "Half & Half (1/2 Gal)"];
const ADDONS             = ["Chips & Salsa", "Chips & Guacamole", "Chips & Queso", "Bunuelos (serves 10)"];
const BB_TACO_COUNTS     = [30, 40, 50];

const EQUIPMENT_ITEMS = [
  "Chafing dishes, Sternos, Serving Utensils",
  "Sternos Only",
  "Hot Box Rental (refundable deposit)",
  "Branded Catering Tent Rental (refundable deposit)",
];
const SPACE_RENTAL_ITEMS = [
  "Space Rental (2-HR) with food",
  "Space Rental (2-HR) without food",
  "Space Rental - Additional Hour",
];
const KIDS_ITEMS = [
  "Kids' Bean & Cheese Taco",
  "Kids' Cheese Quesadilla",
  "Kids' Special",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function normalizeTortillas(rawTortillas: string[]): string[] {
  const seen   = new Set<string>();
  const result: string[] = [];
  for (const t of rawTortillas) {
    const lc = t.toLowerCase();
    let canonical: string;
    if (lc.includes('50/50') || (lc.includes('50') && lc.includes('corn'))) {
      canonical = '50/50 Flour/Corn';
    } else if (lc.includes('corn')) {
      canonical = 'Corn Tortillas';
    } else if (lc.includes('flour')) {
      canonical = 'Flour Tortillas';
    } else {
      canonical = t;
    }
    if (!seen.has(canonical)) { seen.add(canonical); result.push(canonical); }
  }
  const order = ['Flour Tortillas', 'Corn Tortillas', '50/50 Flour/Corn'];
  return result.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function buildItems(events: EventBlock[], drinks: DrinkItem[], addons: AddonItem[], extras: ExtrasItem[] = []) {
  const items: object[] = [];

  for (const ev of events) {
    if (ev.type === 'TACO_BAR' && ev.tacoBar) {
      const tb = ev.tacoBar;
      const q  = tb.guestCount;
      const modifiers = [
        ...tb.proteins.map(p => ({ displayName: p, quantity: q, price: 0 })),
        ...tb.toppings.map(t => ({ displayName: t, quantity: q, price: 0 })),
        ...tb.salsas.map(s   => ({ displayName: s, quantity: q, price: 0 })),
        { displayName: tb.tortilla, quantity: q, price: 0 },
        ...tb.extras.map(e   => ({ displayName: e, quantity: q, price: 0 })),
      ];
      items.push({ guid: uid(), displayName: 'Build Your Own Taco Bar', quantity: q, price: 0, modifiers });
    }

    if (ev.type === 'BIRD_BOX' && ev.birdBox) {
      const bb      = ev.birdBox;
      const name    = bb.mealType === 'breakfast' ? "Breakfast 'Bird Box" : bb.mealType === 'lunch' ? "Lunch 'Bird Box" : "Build Your Own 'Bird Box";
      const sizeLabel = bb.mealType === 'breakfast'
        ? `Breakfast 'Bird Box - ${bb.tacoCount} Tacos`
        : bb.mealType === 'lunch'
          ? `Lunch 'Bird Box - ${bb.tacoCount} Tacos`
          : `BYO 'Bird Box - ${bb.tacoCount} Tacos`;
      const modifiers = [
        { displayName: sizeLabel, quantity: 1, price: 0 },
        ...bb.tacos.map(t => ({ displayName: t, quantity: 1, price: 0 })),
        { displayName: bb.tortilla, quantity: 1, price: 0 },
        { displayName: bb.chipsIncluded ? "Yes! I would like the included chips & salsa" : "Nope! I do NOT want the included chips & salsa", quantity: 1, price: 0 },
        { displayName: bb.paperItems   ? "Yes, I want paper items" : "No, I do not want paper items", quantity: 1, price: 0 },
      ];
      items.push({ guid: uid(), displayName: name, quantity: 1, price: 0, modifiers });
    }

    if (ev.type === 'PERSONAL_BOX' && ev.personalBox) {
      const pb   = ev.personalBox;
      const name = pb.mealType === 'breakfast' ? "Personal Breakfast 'Bird Box" : pb.mealType === 'lunch' ? "Personal Lunch 'Bird Box" : "BYO Personal 'Bird Box";
      for (let i = 0; i < pb.quantity; i++) {
        const tacoModifiers     = pb.tacos.map(t => ({ displayName: t.name, quantity: 1, price: 0 }));
        const tortillaModifiers = [...new Set(pb.tacos.map(t => t.tortilla))].map(t => ({ displayName: t, quantity: 1, price: 0 }));
        const modifiers = [...tacoModifiers, ...tortillaModifiers, { displayName: pb.salsa, quantity: 1, price: 0 }];
        items.push({ guid: uid(), displayName: name, quantity: 1, price: 0, modifiers });
      }
    }

    if (ev.type === 'INDIVIDUAL_TACOS' && ev.individualTacos) {
      for (const taco of ev.individualTacos.tacos) {
        const modifiers = taco.tortilla ? [{ displayName: taco.tortilla, quantity: taco.quantity, price: 0 }] : [];
        items.push({ guid: uid(), displayName: taco.name, quantity: taco.quantity, price: 0, modifiers });
      }
    }

    if (ev.type === 'SALADS' && ev.salads) {
      for (const salad of ev.salads.salads) {
        const modifiers = salad.protein ? [{ displayName: salad.protein, quantity: 1, price: 0 }] : [];
        items.push({ guid: uid(), displayName: salad.name, quantity: salad.quantity, price: 0, modifiers });
      }
    }
  }

  for (const d of drinks) {
    const modifiers: object[] = [];
    if (d.creamers?.length) d.creamers.forEach(c => modifiers.push({ displayName: c, quantity: 1, price: 0 }));
    if (d.wantsCups)        modifiers.push({ displayName: 'Yes, I want cups and lids included', quantity: 1, price: 0 });
    items.push({ guid: uid(), displayName: d.name, quantity: d.quantity, price: 0, modifiers });
  }

  for (const a of addons) {
    items.push({ guid: uid(), displayName: a.name, quantity: a.quantity, price: 0, modifiers: [] });
  }

  for (const e of extras) {
    items.push({ guid: uid(), displayName: e.name, quantity: e.quantity, price: 0, modifiers: [] });
  }

  return items;
}

// ─── Module-level cache — persiste entre renders, nunca se resetea ────────────
// FIX RAIZ: cada EventEditor instanciaba su propio useMenuItems con useState local.
// Cuando uno de ellos terminaba el fetch y hacía setState, React re-renderizaba
// ese EventEditor — y si en ese momento el usuario tenía items seleccionados en
// OTRO EventEditor, el re-render del primero podía interferir con el estado del
// padre (events array) dejando los valores anteriores del render stale.
//
// Con el cache a nivel módulo:
// - El fetch se hace UNA sola vez por eventType en toda la vida de la app
// - Todas las instancias de EventEditor comparten el mismo resultado
// - No hay setState async que pueda corromper el estado del padre

type MenuItem = import('@/services/api/menuApi').MenuItem;

const menuCache: Record<string, MenuItem[]>          = {};
const menuLoading: Record<string, boolean>           = {};
const menuListeners: Record<string, Array<() => void>> = {};

function fetchMenuItems(eventType: string): Promise<MenuItem[]> {
  if (menuCache[eventType])  return Promise.resolve(menuCache[eventType]);
  if (menuLoading[eventType]) {
    // Ya hay un fetch en vuelo — devolver una promise que resuelve cuando termine
    return new Promise(resolve => {
      if (!menuListeners[eventType]) menuListeners[eventType] = [];
      menuListeners[eventType].push(() => resolve(menuCache[eventType]));
    });
  }

  menuLoading[eventType] = true;
  return import('@/services/api/menuApi')
    .then(({ menuApi }) => menuApi.getForOrderCreation(eventType))
    .then(res => {
      menuCache[eventType]   = res.data.data;
      menuLoading[eventType] = false;
      // Notificar a todos los que esperaban
      (menuListeners[eventType] || []).forEach(fn => fn());
      menuListeners[eventType] = [];
      return menuCache[eventType];
    })
    .catch(err => {
      menuLoading[eventType] = false;
      console.error('menuApi error:', err);
      return [];
    });
}

function useMenuItems(eventType: string) {
  // Estado inicializado directamente desde cache si ya existe — evita el
  // "setState synchronously within an effect" warning de React.
  // El useState lazy initializer corre solo en el primer render, sin effect.
  const [items, setItems]     = useState<MenuItem[]>(() => menuCache[eventType] || []);
  const [loading, setLoading] = useState<boolean>(() => !menuCache[eventType]);

  useEffect(() => {
    // Cache hit: no hay nada que hacer — el estado ya fue inicializado correctamente
    // con el lazy initializer arriba. Evitamos llamar setState dentro del effect
    // para no triggear cascading renders (eslint react-hooks/exhaustive-deps warning).
    if (menuCache[eventType]) return;

    // Cache miss: fetch y actualizar cuando llegue la respuesta
    fetchMenuItems(eventType).then(data => {
      setItems(data);
      setLoading(false);
    });
  }, [eventType]);

  const byCategory = items.reduce<ByCategory>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item.name);
    return acc;
  }, {});

  return { byCategory, loading };
}

// ─── shared pill button class ─────────────────────────────────────────────────

const pillCls = (active: boolean) =>
  `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
    active
      ? 'bg-night text-bone border-night'
      : 'bg-bone text-night/50 border-transparent hover:border-night/20'
  }`;

// ─── Sub-forms — reciben byCategory como prop, SIN fetch propio ──────────────

function TacoBarForm({
  value,
  onChange,
  byCategory,
  loading,
}: {
  value:       TacoBarConfig;
  onChange:    (v: TacoBarConfig) => void;
  byCategory:  ByCategory;
  loading:     boolean;
}) {
  const proteins  = byCategory['protein']  || [];
  const toppings  = byCategory['topping']  || [];
  const salsas    = byCategory['salsa']    || [];
  const tortillas = byCategory['tortilla'] || [];
  const snacks    = byCategory['snack']    || [];
  const papers    = byCategory['paper']    || [];
  const extras    = [
    ...snacks,
    ...papers.filter(p => p.toLowerCase().includes('paper') || p.toLowerCase().includes('goods')),
  ];

  // FIX: usamos el value de la prop directamente — onChange siempre recibe
  // el spread de value fresco porque el padre (EventEditor) lo pasa via ref.
  const toggle = (field: 'proteins' | 'toppings' | 'salsas' | 'extras', item: string) => {
    const arr = value[field];
    onChange({
      ...value,
      [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item],
    });
  };

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Guest Count</label>
        <input
          type="number" min={1} value={value.guestCount}
          onChange={e => onChange({ ...value, guestCount: parseInt(e.target.value) || 1 })}
          className="w-24 px-3 py-2 bg-bone rounded-xl text-sm font-black text-night outline-none"
        />
      </div>

      {([
        ['Proteins', 'proteins', proteins],
        ['Toppings', 'toppings', toppings],
        ['Salsas',   'salsas',   salsas  ],
        ['Extras',   'extras',   extras  ],
      ] as [string, 'proteins'|'toppings'|'salsas'|'extras', string[]][]).map(([label, field, opts]) => (
        <div key={field}>
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">{label}</label>
          <div className="flex flex-wrap gap-2">
            {opts.map(o => (
              <button key={o} type="button" onClick={() => toggle(field, o)} className={pillCls(value[field].includes(o))}>
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tortilla</label>
        <div className="flex flex-wrap gap-2">
          {tortillas.map(t => (
            <button key={t} type="button" onClick={() => onChange({ ...value, tortilla: t })} className={pillCls(value.tortilla === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BirdBoxForm({
  value,
  onChange,
  byCategory,
  loading,
}: {
  value:      BirdBoxConfig;
  onChange:   (v: BirdBoxConfig) => void;
  byCategory: ByCategory;
  loading:    boolean;
}) {
  const allCombos    = byCategory['individual_taco'] || [];
  const rawTortillas = byCategory['tortilla']        || [];
  const tortillas    = normalizeTortillas(rawTortillas);

  const toggle = (taco: string) => onChange({
    ...value,
    tacos: value.tacos.includes(taco) ? value.tacos.filter(t => t !== taco) : [...value.tacos, taco],
  });

  const tacoOpts = allCombos.filter(c => {
    if (value.mealType === 'all') return true;
    const match = c.match(/^#(\d+)/);
    if (!match) return true;
    const num = parseInt(match[1]);
    return value.mealType === 'breakfast' ? num <= 6 : num > 6;
  });

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Meal Type</label>
        <div className="flex gap-2">
          {(['breakfast', 'lunch', 'all'] as const).map(m => (
            <button key={m} type="button" onClick={() => onChange({ ...value, mealType: m, tacos: [] })} className={pillCls(value.mealType === m)}>
              {m === 'all' ? 'All Tacos' : m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Taco Count</label>
        <div className="flex gap-2">
          {BB_TACO_COUNTS.map(n => (
            <button key={n} type="button" onClick={() => onChange({ ...value, tacoCount: n })} className={pillCls(value.tacoCount === n)}>
              {n} tacos
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tacos</label>
        <div className="flex flex-wrap gap-2">
          {tacoOpts.length > 0
            ? tacoOpts.map(t => (
                <button key={t} type="button" onClick={() => toggle(t)} className={pillCls(value.tacos.includes(t))}>
                  {t}
                </button>
              ))
            : <span className="text-[11px] text-night/30 italic">No combos found for {value.mealType}</span>
          }
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tortilla</label>
        <div className="flex flex-wrap gap-2">
          {tortillas.map(t => (
            <button key={t} type="button" onClick={() => onChange({ ...value, tortilla: t })} className={pillCls(value.tortilla === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={value.chipsIncluded} onChange={e => onChange({ ...value, chipsIncluded: e.target.checked })} className="accent-night" />
          <span className="text-[11px] font-black uppercase tracking-widest text-night/60">Chips & Salsa</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={value.paperItems} onChange={e => onChange({ ...value, paperItems: e.target.checked })} className="accent-night" />
          <span className="text-[11px] font-black uppercase tracking-widest text-night/60">Paper Items</span>
        </label>
      </div>
    </div>
  );
}

function PersonalBoxForm({
  value,
  onChange,
  byCategory,
  loading,
}: {
  value:      PersonalBoxConfig;
  onChange:   (v: PersonalBoxConfig) => void;
  byCategory: ByCategory;
  loading:    boolean;
}) {
  const allCombos    = byCategory['individual_taco'] || [];
  const rawTortillas = byCategory['tortilla']        || [];
  const salsas       = byCategory['salsa']           || [];
  const tortillas    = normalizeTortillas(rawTortillas);

  const tacoOpts = allCombos.filter(c => {
    if (value.mealType === 'all') return true;
    const match = c.match(/^#(\d+)/);
    if (!match) return true;
    const num = parseInt(match[1]);
    return value.mealType === 'breakfast' ? num <= 6 : num > 6;
  });

  const toggleTaco = (name: string) => {
    const exists = value.tacos.find(t => t.name === name);
    onChange({
      ...value,
      tacos: exists
        ? value.tacos.filter(t => t.name !== name)
        : [...value.tacos, { name, tortilla: tortillas[0] || '' }],
    });
  };

  const setTortilla = (tacoName: string, tortilla: string) => {
    onChange({ ...value, tacos: value.tacos.map(t => t.name === tacoName ? { ...t, tortilla } : t) });
  };

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Meal Type</label>
          <div className="flex gap-2">
            {(['breakfast', 'lunch', 'all'] as const).map(m => (
              <button key={m} type="button" onClick={() => onChange({ ...value, mealType: m, tacos: [] })} className={pillCls(value.mealType === m)}>
                {m === 'all' ? 'All Tacos' : m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Boxes</label>
          <input
            type="number" min={1} value={value.quantity}
            onChange={e => onChange({ ...value, quantity: parseInt(e.target.value) || 1 })}
            className="w-20 px-3 py-2 bg-bone rounded-xl text-sm font-black text-night outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tacos (select all that apply)</label>
        <div className="flex flex-wrap gap-2">
          {tacoOpts.length > 0
            ? tacoOpts.map(t => (
                <button key={t} type="button" onClick={() => toggleTaco(t)} className={pillCls(!!value.tacos.find(x => x.name === t))}>
                  {t}
                </button>
              ))
            : <span className="text-[11px] text-night/30 italic">No combos found for {value.mealType}</span>
          }
        </div>
      </div>

      {value.tacos.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block">Tortilla per Taco</label>
          {value.tacos.map(taco => (
            <div key={taco.name} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-night/60 w-48 truncate">{taco.name}</span>
              <div className="flex gap-2">
                {tortillas.map(tort => (
                  <button key={tort} type="button" onClick={() => setTortilla(taco.name, tort)} className={pillCls(taco.tortilla === tort)}>
                    {tort}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Salsa</label>
        <div className="flex flex-wrap gap-2">
          {salsas.map(s => (
            <button key={s} type="button" onClick={() => onChange({ ...value, salsa: s })} className={pillCls(value.salsa === s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IndividualTacosForm({
  value,
  onChange,
  byCategory,
  loading,
}: {
  value:      IndividualTacosConfig;
  onChange:   (v: IndividualTacosConfig) => void;
  byCategory: ByCategory;
  loading:    boolean;
}) {
  const allCombos = byCategory['individual_taco'] || [];
  const tortillas = byCategory['tortilla']        || [];

  const toggleTaco = (name: string) => {
    const exists = value.tacos.find(t => t.name === name);
    onChange({
      tacos: exists
        ? value.tacos.filter(t => t.name !== name)
        : [...value.tacos, { name, quantity: 1, tortilla: tortillas[0] || '' }],
    });
  };

  const updateTaco = (name: string, field: 'quantity' | 'tortilla', val: string | number) => {
    onChange({ tacos: value.tacos.map(t => t.name === name ? { ...t, [field]: val } : t) });
  };

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading combos...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Select Combos</label>
        <div className="flex flex-wrap gap-2">
          {allCombos.map(c => (
            <button key={c} type="button" onClick={() => toggleTaco(c)} className={pillCls(!!value.tacos.find(t => t.name === c))}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {value.tacos.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block">Qty & Tortilla</label>
          {value.tacos.map(taco => (
            <div key={taco.name} className="flex items-center gap-3 py-1">
              <span className="text-[11px] font-bold text-night/70 flex-1 truncate">{taco.name}</span>
              <input
                type="number" min={1} value={taco.quantity}
                onChange={e => updateTaco(taco.name, 'quantity', parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
              />
              <div className="flex gap-1">
                {tortillas.map(t => (
                  <button key={t} type="button" onClick={() => updateTaco(taco.name, 'tortilla', t)} className={pillCls(taco.tortilla === t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaladsForm({
  value,
  onChange,
  byCategory,
  loading,
}: {
  value:      SaladsConfig;
  onChange:   (v: SaladsConfig) => void;
  byCategory: ByCategory;
  loading:    boolean;
}) {
  const saladsIndividual = byCategory['salad']     || [];
  const saladsGrouped    = (byCategory['menu_item'] || []).filter(i => i.toLowerCase().includes('salad'));
  const allSaladsMenu    = [
    ...saladsIndividual,
    ...saladsGrouped.filter(s => s.toLowerCase().includes('small')),
    ...saladsGrouped.filter(s => s.toLowerCase().includes('large')),
  ];
  const proteins = ['Salsa Verde Braised Chicken', 'House-smoked Brisket', 'Chorizo', 'Without Protein'];

  const toggleSalad = (name: string) => {
    const exists = value.salads.find(s => s.name === name);
    onChange({
      salads: exists
        ? value.salads.filter(s => s.name !== name)
        : [...value.salads, { name, quantity: 1, protein: '' }],
    });
  };

  const updateSalad = (name: string, field: 'quantity' | 'protein', val: string | number) => {
    onChange({ salads: value.salads.map(s => s.name === name ? { ...s, [field]: val } : s) });
  };

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading salads...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Select Salads</label>
        <div className="flex flex-wrap gap-2">
          {allSaladsMenu.map(s => (
            <button key={s} type="button" onClick={() => toggleSalad(s)} className={pillCls(!!value.salads.find(x => x.name === s))}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {value.salads.length > 0 && (
        <div className="space-y-3">
          {value.salads.map(salad => (
            <div key={salad.name} className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-night/70 flex-1 truncate">{salad.name}</span>
                <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                <input
                  type="number" min={1} value={salad.quantity}
                  onChange={e => updateSalad(salad.name, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
                />
              </div>
              <div className="flex flex-wrap gap-2 pl-2">
                {proteins.map(p => (
                  <button key={p} type="button" onClick={() => updateSalad(salad.name, 'protein', p)} className={pillCls(salad.protein === p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Event Block Editor ───────────────────────────────────────────────────────
// FIX: useMenuItems se llama AQUÍ (nivel EventEditor), no dentro de cada sub-form.
// Los sub-forms reciben byCategory como prop → ningún fetch ocurre dentro de ellos
// → sus onChange nunca quedan closureados sobre state stale.

function EventEditor({
  ev,
  onChange,
  onRemove,
}: {
  ev:       EventBlock;
  onChange: (v: EventBlock) => void;
  onRemove: () => void;
}) {
  // FIX: ref para garantizar que onChange siempre trabaja con el ev más reciente,
  // incluso si el fetch de useMenuItems dispara un re-render entre clicks del usuario.
  const evRef = useRef(ev);
  useEffect(() => { evRef.current = ev; }, [ev]);

  // FIX: pre-cargar los 3 endpoints al montar — gracias al cache de módulo, cada
  // fetch se ejecuta una sola vez aunque haya N EventEditors en pantalla.
  // Cuando el usuario cambia de tab (BIRD_BOX → PERSONAL_BOX → TACO_BAR),
  // los datos ya están en cache → loading=false → byCategory nunca queda vacío
  // → los pills no se deseleccionan visualmente.
  const { byCategory: bcTacoBar,     loading: loadingTB } = useMenuItems('TACO_BAR');
  const { byCategory: bcBirdBox,     loading: loadingBB } = useMenuItems('BIRD_BOX');
  const { byCategory: bcPersonalBox, loading: loadingPB } = useMenuItems('PERSONAL_BOX');

  const byCategory =
    ev.type === 'BIRD_BOX'     ? bcBirdBox     :
    ev.type === 'PERSONAL_BOX' ? bcPersonalBox :
    bcTacoBar;

  const loading =
    ev.type === 'BIRD_BOX'     ? loadingBB :
    ev.type === 'PERSONAL_BOX' ? loadingPB :
    loadingTB;

  // Handlers que siempre leen evRef.current (no el ev closureado del render)
  const handleTacoBarChange     = (v: TacoBarConfig)       => onChange({ ...evRef.current, tacoBar: v });
  const handleBirdBoxChange     = (v: BirdBoxConfig)       => onChange({ ...evRef.current, birdBox: v });
  const handlePersonalBoxChange = (v: PersonalBoxConfig)   => onChange({ ...evRef.current, personalBox: v });
  const handleIndividualChange  = (v: IndividualTacosConfig) => onChange({ ...evRef.current, individualTacos: v });
  const handleSaladsChange      = (v: SaladsConfig)        => onChange({ ...evRef.current, salads: v });

  const defaultTacoBar:       TacoBarConfig         = { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] };
  const defaultBirdBox:       BirdBoxConfig         = { tacoCount: 30, tacos: [], tortilla: '', chipsIncluded: true, paperItems: true, mealType: 'breakfast' };
  const defaultPersonalBox:   PersonalBoxConfig     = { quantity: 1, tacos: [], salsa: '', mealType: 'breakfast' };
  const defaultIndividual:    IndividualTacosConfig  = { tacos: [] };
  const defaultSalads:        SaladsConfig           = { salads: [] };

  const setType = (type: EventType) => {
    onChange({
      ...evRef.current,
      type,
      tacoBar:         type === 'TACO_BAR'        ? defaultTacoBar      : undefined,
      birdBox:         type === 'BIRD_BOX'         ? defaultBirdBox      : undefined,
      personalBox:     type === 'PERSONAL_BOX'     ? defaultPersonalBox  : undefined,
      individualTacos: type === 'INDIVIDUAL_TACOS' ? defaultIndividual   : undefined,
      salads:          type === 'SALADS'           ? defaultSalads       : undefined,
    });
  };

  const typeCls = (t: EventType) =>
    `px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      ev.type === t ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

  return (
    <div className="border border-tumbleweed/40 rounded-2xl p-5 space-y-4 bg-bone/30">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {([
            ['TACO_BAR',        'Taco Bar'        ],
            ['BIRD_BOX',        "'Bird Box"       ],
            ['PERSONAL_BOX',    'Personal Box'    ],
            ['INDIVIDUAL_TACOS','Individual Tacos'],
            ['SALADS',          'Salads'          ],
          ] as [EventType, string][]).map(([t, label]) => (
            <button key={t} type="button" onClick={() => setType(t)} className={typeCls(t)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} className="text-night/30 hover:text-rose transition-colors ml-2 shrink-0">
          <Trash2 size={15} />
        </button>
      </div>

      {ev.type === 'TACO_BAR' && ev.tacoBar && (
        <TacoBarForm
          value={ev.tacoBar}
          onChange={handleTacoBarChange}
          byCategory={byCategory}
          loading={loading}
        />
      )}
      {ev.type === 'BIRD_BOX' && ev.birdBox && (
        <BirdBoxForm
          value={ev.birdBox}
          onChange={handleBirdBoxChange}
          byCategory={byCategory}
          loading={loading}
        />
      )}
      {ev.type === 'PERSONAL_BOX' && ev.personalBox && (
        <PersonalBoxForm
          value={ev.personalBox}
          onChange={handlePersonalBoxChange}
          byCategory={byCategory}
          loading={loading}
        />
      )}
      {ev.type === 'INDIVIDUAL_TACOS' && ev.individualTacos && (
        <IndividualTacosForm
          value={ev.individualTacos}
          onChange={handleIndividualChange}
          byCategory={byCategory}
          loading={loading}
        />
      )}
      {ev.type === 'SALADS' && ev.salads && (
        <SaladsForm
          value={ev.salads}
          onChange={handleSaladsChange}
          byCategory={byCategory}
          loading={loading}
        />
      )}
    </div>
  );
}

// ─── Drinks Section ───────────────────────────────────────────────────────────

function DrinksSection({
  drinks,
  setDrinks,
}: {
  drinks:    DrinkItem[];
  setDrinks: React.Dispatch<React.SetStateAction<DrinkItem[]>>;
}) {
  const { byCategory, loading } = useMenuItems('TACO_BAR');

  const drinkOpts   = byCategory['drink']?.length ? byCategory['drink'] : DRINKS_FALLBACK;
  const creamerOpts = [
    ...(byCategory['creamer']    || []),
    ...(byCategory['menu_item']  || []).filter(i => i === 'Local Whole Milk'),
  ];

  const isCoffee = (name: string) => name.toLowerCase().includes('coffee');

  const toggle = (name: string) => {
    const exists = drinks.find(d => d.name === name);
    if (exists) setDrinks(prev => prev.filter(d => d.name !== name));
    else        setDrinks(prev => [...prev, { name, quantity: 1, wantsCups: isCoffee(name), creamers: [] }]);
  };

  const update = (name: string, field: keyof DrinkItem, val: unknown) =>
    setDrinks(prev => prev.map(d => d.name === name ? { ...d, [field]: val } : d));

  const toggleCreamer = (drinkName: string, creamer: string) => {
    setDrinks(prev => prev.map(d => {
      if (d.name !== drinkName) return d;
      const current = d.creamers || [];
      return {
        ...d,
        creamers: current.includes(creamer)
          ? current.filter(c => c !== creamer)
          : [...current, creamer],
      };
    }));
  };

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading drinks...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Coffee size={14} className="text-night/40" />
        <span className="text-[10px] font-black uppercase tracking-widest text-night/40">Drinks</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {drinkOpts.map(d => (
          <button key={d} type="button" onClick={() => toggle(d)} className={pillCls(!!drinks.find(x => x.name === d))}>
            {d}
          </button>
        ))}
      </div>

      {drinks.map(d => (
        <div key={d.name} className="mb-4 p-3 bg-bone/50 rounded-xl border border-tumbleweed/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-bold text-night flex-1">{d.name}</span>
            <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
            <input
              type="number" min={1} value={d.quantity}
              onChange={e => update(d.name, 'quantity', parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-white rounded-lg text-xs font-black text-night outline-none text-center"
            />
          </div>

          {isCoffee(d.name) && (
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox" checked={d.wantsCups || false}
                onChange={e => update(d.name, 'wantsCups', e.target.checked)}
                className="accent-night"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-night/50">Cups & Lids</span>
            </label>
          )}

          {isCoffee(d.name) && creamerOpts.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-2">Creamers</p>
              <div className="flex flex-wrap gap-2">
                {creamerOpts.map(c => (
                  <button key={c} type="button" onClick={() => toggleCreamer(d.name, c)} className={pillCls((d.creamers || []).includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── parseParsedDataToWizardState ─────────────────────────────────────────────

interface WizardState {
  events: EventBlock[];
  drinks: DrinkItem[];
  addons: AddonItem[];
  extras: ExtrasItem[];
}

function parseParsedDataToWizardState(parsedData: Record<string, unknown> | null | undefined): WizardState {
  const items = (parsedData?.items as Array<{
    guid: string;
    displayName: string;
    quantity: number;
    price: number;
    modifiers: Array<{ displayName: string; quantity: number; price: number }>;
  }>) || [];

  const storedExtras = (parsedData?.extras as Array<{ displayName?: string; name?: string; quantity: number; category: string }>) || [];

  const events: EventBlock[] = [];
  const drinks: DrinkItem[]  = [];
  const addons: AddonItem[]  = [];
  const extras: ExtrasItem[] = storedExtras.map(e => ({
    name:     e.displayName || e.name || '',
    quantity: e.quantity || 1,
    category: e.category as ExtrasItem['category'],
  }));

  const PROTEIN_KEYWORDS  = ['adobo chicken', 'bacon', 'brisket', 'chorizo', 'eggs', 'salsa verde braised chicken', 'tenderbelly'];
  const TOPPING_KEYWORDS  = ['black beans', 'cotija', 'monterrey', 'pickled', 'pico', 'potato', 'rajas', 'shredded cabbage', 'sliced avocado'];
  const SALSA_KEYWORDS    = ['salsa roja', 'salsa verde', 'patron', 'verde (mild', 'roja (mild', 'chili de árbol', 'chili de arbol'];
  const DRINK_KEYWORDS    = ['coffee', 'agua fresca', 'limeade', 'lemonade', 'cold brew', 'watermelon', 'hibiscus', 'lavender', 'half & half', 'iced coffee', '1/2 gal', '½ gal', '96oz', '96 oz'];
  const EQUIPMENT_NAMES   = EQUIPMENT_ITEMS.map(e => e.toLowerCase());
  const SPACE_NAMES       = SPACE_RENTAL_ITEMS.map(e => e.toLowerCase());
  const KIDS_NAMES        = KIDS_ITEMS.map(e => e.toLowerCase());
  const ADDON_NAMES       = ADDONS.map(a => a.toLowerCase());

  const isDrink   = (name: string) => DRINK_KEYWORDS.some(k => name.toLowerCase().includes(k));
  const isEquip   = (name: string) => EQUIPMENT_NAMES.some(k => name.toLowerCase().includes(k));
  const isSpace   = (name: string) => SPACE_NAMES.some(k => name.toLowerCase() === k);
  const isKids    = (name: string) => KIDS_NAMES.some(k => name.toLowerCase() === k);
  const isAddon   = (name: string) => ADDON_NAMES.some(k => name.toLowerCase().includes(k));

  const isTacoBar     = (name: string) => name.toLowerCase().includes('taco bar');
  const isBirdBox     = (name: string) => name.toLowerCase().includes("bird box") && !name.toLowerCase().includes('personal');
  const isPersonalBox = (name: string) => name.toLowerCase().includes('personal') && name.toLowerCase().includes('bird box');

  const classifyTBMod = (modName: string): 'protein'|'topping'|'salsa'|'tortilla'|'extra'|'ignore' => {
    const lc = modName.toLowerCase();
    if (lc.includes('tortilla'))                           return 'tortilla';
    if (lc.includes('paper') || lc.includes('chip'))      return 'extra';
    if (lc.includes('no paper') || lc.includes('not needed')) return 'ignore';
    if (SALSA_KEYWORDS.some(k => lc.includes(k)))         return 'salsa';
    if (PROTEIN_KEYWORDS.some(k => lc.includes(k)))       return 'protein';
    if (TOPPING_KEYWORDS.some(k => lc.includes(k)))       return 'topping';
    return 'protein';
  };

  for (const item of items) {
    const nameLc = item.displayName.toLowerCase();
    const mods   = item.modifiers || [];

    if (isDrink(nameLc)) {
      const creamers  = mods.filter(m => {
        const lc = m.displayName.toLowerCase();
        return !lc.includes('cup') && !lc.includes('lid') && !lc.includes('no,') && !lc.includes('no i');
      }).map(m => m.displayName);
      const wantsCups = mods.some(m => m.displayName.toLowerCase().includes('yes') && m.displayName.toLowerCase().includes('cup'));
      drinks.push({ name: item.displayName, quantity: item.quantity, creamers, wantsCups });
      continue;
    }

    if (isEquip(nameLc)) {
      if (!extras.find(e => e.name === item.displayName))
        extras.push({ name: item.displayName, quantity: item.quantity, category: 'equipment' });
      continue;
    }

    if (isSpace(nameLc)) {
      if (!extras.find(e => e.name === item.displayName))
        extras.push({ name: item.displayName, quantity: item.quantity, category: 'space_rental' });
      continue;
    }

    if (isKids(nameLc)) {
      if (!extras.find(e => e.name === item.displayName))
        extras.push({ name: item.displayName, quantity: item.quantity, category: 'kids' });
      continue;
    }

    if (isTacoBar(nameLc)) {
      const proteins: string[] = [];
      const toppings: string[] = [];
      const salsas:   string[] = [];
      const tbExtras: string[] = [];
      let tortilla = '';
      for (const mod of mods) {
        const cat = classifyTBMod(mod.displayName);
        if (cat === 'protein')  proteins.push(mod.displayName);
        if (cat === 'topping')  toppings.push(mod.displayName);
        if (cat === 'salsa')    salsas.push(mod.displayName);
        if (cat === 'tortilla') tortilla = mod.displayName;
        if (cat === 'extra')    tbExtras.push(mod.displayName);
      }
      events.push({ id: uid(), type: 'TACO_BAR', tacoBar: { guestCount: item.quantity, proteins, toppings, salsas, tortilla, extras: tbExtras } });
      continue;
    }

    if (isBirdBox(nameLc)) {
      const sizeM       = mods.find(m => /\d+\s*tacos?/i.test(m.displayName));
      const tacoCount   = sizeM ? parseInt(sizeM.displayName.match(/(\d+)/)?.[1] || '30') : 30;
      const combos      = mods.filter(m => /^#\d+/.test(m.displayName.trim())).map(m => m.displayName);
      const tortillaMod = mods.find(m => m.displayName.toLowerCase().includes('tortilla'));
      const tortilla    = tortillaMod?.displayName || 'Flour Tortillas';
      const wantsChips  = mods.some(m => m.displayName.toLowerCase().includes('yes') && m.displayName.toLowerCase().includes('chip'));
      const wantsPaper  = mods.some(m => m.displayName.toLowerCase().includes('yes') && m.displayName.toLowerCase().includes('paper'));
      const hasBreakfast = combos.some(c => { const n = parseInt(c.match(/^#(\d+)/)?.[1] || '99'); return n <= 6; });
      const hasLunch     = combos.some(c => { const n = parseInt(c.match(/^#(\d+)/)?.[1] || '99'); return n > 6; });
      const mealType     = (hasBreakfast && hasLunch) ? 'all' : hasBreakfast ? 'breakfast' : 'lunch';
      events.push({ id: uid(), type: 'BIRD_BOX', birdBox: { tacoCount, tacos: combos, tortilla, chipsIncluded: wantsChips, paperItems: wantsPaper, mealType } });
      continue;
    }

    if (isPersonalBox(nameLc)) {
      const combos      = mods.filter(m => /^#\d+/.test(m.displayName.trim())).map(m => m.displayName);
      const tortillaMod = mods.find(m => m.displayName.toLowerCase().includes('tortilla'));
      const tortilla    = tortillaMod?.displayName || 'Flour Tortillas';
      const salsaMod    = mods.find(m => m.displayName.toLowerCase().match(/\.75 oz|roja|verde|patron|patrón/));
      const salsa       = salsaMod?.displayName || '';
      const mealType    = nameLc.includes('breakfast') ? 'breakfast' : 'lunch';
      const existingPB  = events.find(e => e.type === 'PERSONAL_BOX');
      if (existingPB && existingPB.personalBox) {
        existingPB.personalBox.quantity += item.quantity;
        for (const combo of combos) {
          if (!existingPB.personalBox.tacos.find(t => t.name === combo))
            existingPB.personalBox.tacos.push({ name: combo, tortilla });
        }
      } else {
        events.push({ id: uid(), type: 'PERSONAL_BOX', personalBox: { quantity: item.quantity, tacos: combos.map(c => ({ name: c, tortilla })), salsa, mealType } });
      }
      continue;
    }

    if (isAddon(nameLc) || mods.length === 0) {
      addons.push({ name: item.displayName, quantity: item.quantity });
      continue;
    }
  }

  return { events, drinks, addons, extras };
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ManualFulfillmentWizard({ stores, onClose, onSuccess, editingOrder }: WizardProps) {
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isEditMode = !!editingOrder;

  const _editDate = editingOrder?.estimatedFulfillmentDate
    ? new Date(editingOrder.estimatedFulfillmentDate).toLocaleDateString('en-CA')
    : '';
  const _editTime = editingOrder?.estimatedFulfillmentDate
    ? new Date(editingOrder.estimatedFulfillmentDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';
  const _editKitchenTime = editingOrder?.kitchenFinishTime
    ? new Date(editingOrder.kitchenFinishTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  const [storeId,          setStoreId]          = useState(editingOrder?.storeId || stores[0]?.id || '');
  const [clientName,       setClientName]       = useState(editingOrder?.clientName || '');
  const [clientPhone,      setClientPhone]      = useState(editingOrder?.clientPhone || '');
  const [clientEmail,      setClientEmail]      = useState(editingOrder?.clientEmail || '');
  const [eventDate,        setEventDate]        = useState(_editDate);
  // displayDate: lo que el usuario ve mientras tipea (libre). eventDate: YYYY-MM-DD para el backend.
  const [displayDate,      setDisplayDate]      = useState(
    _editDate ? _editDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1') : ''
  );
  const [eventTime,        setEventTime]        = useState(_editTime);
  const [deliveryMethod,   setDeliveryMethod]   = useState<'PICKUP'|'DELIVERY'>((editingOrder?.deliveryMethod as 'PICKUP'|'DELIVERY') || 'PICKUP');
  const [deliveryAddress,  setDeliveryAddress]  = useState(editingOrder?.deliveryAddress || '');
  const [deliveryNotes,    setDeliveryNotes]    = useState(editingOrder?.deliveryNotes || '');
  const [company,          setCompany]          = useState('');
  const [distanceMiles,    setDistanceMiles]    = useState<string>(editingOrder?.deliveryDistanceMiles != null ? String(editingOrder.deliveryDistanceMiles) : '');
  const [kitchenFinishTime,setKitchenFinishTime]= useState(_editKitchenTime);
  const [ezCaterCode,      setEzCaterCode]      = useState<string>((editingOrder?.parsedData?.ezCaterCode as string) || '');

  const _initialState = isEditMode && editingOrder?.parsedData
    ? parseParsedDataToWizardState(editingOrder.parsedData as Record<string, unknown>)
    : null;

  const [notes, setNotes] = useState<string>((isEditMode && editingOrder?.parsedData?.notes as string) || '');
  const [events, setEvents] = useState<EventBlock[]>(
    _initialState?.events.length
      ? _initialState.events
      : [{ id: uid(), type: 'TACO_BAR', tacoBar: { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] } }]
  );

  const [drinks, setDrinks] = useState<DrinkItem[]>(_initialState?.drinks || []);
  const [addons, setAddons] = useState<AddonItem[]>(_initialState?.addons || []);
  const [extras, setExtras] = useState<ExtrasItem[]>(_initialState?.extras || []);

  const addEvent = () => setEvents(prev => [...prev, {
    id: uid(), type: 'TACO_BAR',
    tacoBar: { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] },
  }]);

  // FIX: updateEvent usa functional updater → lee el state más reciente en el momento
  // que React procesa la actualización, no el del render donde se creó la función.
  const updateEvent = (id: string, ev: EventBlock) =>
    setEvents(prev => prev.map(e => e.id === id ? ev : e));

  const removeEvent = (id: string) =>
    setEvents(prev => prev.filter(e => e.id !== id));

  const totalGuests = events.reduce((acc, ev) => {
    if (ev.type === 'TACO_BAR')     return acc + (ev.tacoBar?.guestCount     || 0);
    if (ev.type === 'PERSONAL_BOX') return acc + (ev.personalBox?.quantity   || 0);
    return acc;
  }, 0);

  const toggleAddon = (name: string) => {
    const exists = addons.find(a => a.name === name);
    if (exists) setAddons(prev => prev.filter(a => a.name !== name));
    else        setAddons(prev => [...prev, { name, quantity: 1 }]);
  };

  const toggleExtra = (name: string, category: ExtrasItem['category']) => {
    const exists = extras.find(e => e.name === name);
    if (exists) setExtras(prev => prev.filter(e => e.name !== name));
    else        setExtras(prev => [...prev, { name, quantity: 1, category }]);
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const eventTypes = [...new Set(events.map(e => e.type))];
      const eventType  = eventTypes.length === 1 ? eventTypes[0] : 'PERSONAL_BOX';
      const effectiveGuestCount = totalGuests || 1;
      const items = buildItems(events, drinks, addons);

      const body = {
        storeId, clientName, clientPhone, clientEmail,
        company:           company || null,
        eventType,         guestCount: effectiveGuestCount,
        ezCaterCode:       ezCaterCode || null,
        deliveryMethod,
        deliveryAddress:   deliveryMethod === 'DELIVERY' ? deliveryAddress : null,
        deliveryNotes:     deliveryNotes || null,
        eventDate,         eventTime,
        kitchenFinishTime: kitchenFinishTime || null,
        distanceMiles:     distanceMiles ? parseFloat(distanceMiles) : null,
        items,
        notes:  notes || null,
        extras: extras.map(e => ({ displayName: e.name, quantity: e.quantity, price: 0, category: e.category, modifiers: [] })),
      };

      const apiUrl = isEditMode
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/catering/orders/${editingOrder!.id}/manual-fulfillment`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/catering/orders/manual-fulfillment`;

      const res = await fetch(apiUrl, {
        method:  isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${text.slice(0, 300)}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const slug = clientName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
      a.download = `ManualSheet_${slug}_${eventDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating PDF');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = storeId && clientName && eventDate &&
    (deliveryMethod === 'PICKUP' || deliveryAddress);
  const canProceedStep2 = events.length > 0;

  const inputCls = 'w-full px-4 py-2.5 bg-bone rounded-xl text-sm font-medium text-night outline-none placeholder:text-night/30';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-night/40 block mb-1.5';

  return (
    <div className="fixed inset-0 bg-night/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b border-tumbleweed/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <ClipboardList size={16} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="font-black text-night text-base">{isEditMode ? 'Edit Manual Sheet' : 'Fulfillment Sheet Builder'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-night/30">
                Step {step} of 3 — {step === 1 ? 'Order Info' : step === 2 ? 'Events' : 'Extras'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-night/30 hover:text-night transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-8 py-3 border-b border-tumbleweed/10 flex gap-2 shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-emerald-600' : 'bg-bone'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Store</label>
                  <select value={storeId} onChange={e => setStoreId(e.target.value)} className={inputCls}>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Client Name *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="615-000-0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Event Date *</label>
                  {/* displayDate: valor libre mientras el usuario tipea
                      eventDate:   YYYY-MM-DD que va al backend — solo se setea cuando el formato es válido */}
                  <input
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={displayDate}
                    onChange={e => {
                      const raw = e.target.value;
                      setDisplayDate(raw);  // siempre actualizar display — el usuario puede tipear libremente
                      // Parsear solo cuando el formato está completo
                      const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                      if (match) {
                        const m = match[1].padStart(2, '0');
                        const d = match[2].padStart(2, '0');
                        setEventDate(`${match[3]}-${m}-${d}`);
                      } else if (!raw) {
                        setEventDate('');
                      }
                    }}
                    onBlur={e => {
                      // Al salir: si el formato es válido pero eventDate aún no se seteó, parsearlo
                      const raw = e.target.value;
                      const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                      if (match) {
                        const m = match[1].padStart(2, '0');
                        const d = match[2].padStart(2, '0');
                        const iso = `${match[3]}-${m}-${d}`;
                        setEventDate(iso);
                        setDisplayDate(`${m}/${d}/${match[3]}`);  // normalizar display con ceros
                      }
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Event Time *</label>
                  <input type="text" value={eventTime} onChange={e => setEventTime(e.target.value)} placeholder="e.g. 2:30 PM" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Kitchen Finish Time</label>
                  <input type="text" value={kitchenFinishTime} onChange={e => setKitchenFinishTime(e.target.value)} placeholder="e.g. 1:45 PM" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Distance (miles)</label>
                  <input type="number" step="0.1" min="0" value={distanceMiles} onChange={e => setDistanceMiles(e.target.value)} placeholder="0.0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>EZ Cater Code</label>
                  <input type="text" value={ezCaterCode} onChange={e => setEzCaterCode(e.target.value)} placeholder="e.g. EZC-123456" className={inputCls} />
                  <p className="text-[9px] text-night/30 font-medium mt-1">Optional — only for EZ Cater orders</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Delivery Method</label>
                <div className="flex gap-2">
                  {(['PICKUP', 'DELIVERY'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setDeliveryMethod(m)}
                      className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                        deliveryMethod === m ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
                      }`}>
                      {m === 'PICKUP' ? '🏪 Pickup' : '🚗 Delivery'}
                    </button>
                  ))}
                </div>
              </div>

              {deliveryMethod === 'DELIVERY' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Delivery Address *</label>
                    <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Full address" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Delivery Notes</label>
                    <input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Instructions, gate code, etc." className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              {events.map(ev => (
                <EventEditor
                  key={ev.id}
                  ev={ev}
                  onChange={v => updateEvent(ev.id, v)}
                  onRemove={() => removeEvent(ev.id)}
                />
              ))}
              {/* Notas generales de la orden — arriba del Add Event para que sea siempre visible */}
              <div className="px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-1.5">
                  Order Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes, special instructions, etc."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-bone rounded-xl text-sm font-medium text-night outline-none placeholder:text-night/30 resize-none"
                />
              </div>

              <button type="button" onClick={addEvent}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-tumbleweed/40 text-[11px] font-black uppercase tracking-widest text-night/40 hover:border-emerald-400 hover:text-emerald-700 transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> Add Event
              </button>
              {totalGuests > 0 && (
                <p className="text-[11px] font-black text-night/40 text-right">{totalGuests} total guests</p>
              )}
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-6">
              <DrinksSection drinks={drinks} setDrinks={setDrinks} />

              {/* Add-ons */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Add-ons</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {ADDONS.map(a => (
                    <button key={a} type="button" onClick={() => toggleAddon(a)} className={pillCls(!!addons.find(x => x.name === a))}>
                      {a}
                    </button>
                  ))}
                </div>
                {addons.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{a.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={a.quantity}
                      onChange={e => setAddons(prev => prev.map((x, j) => j === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
                    />
                  </div>
                ))}
              </div>

              {/* Equipment */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Equipment</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {EQUIPMENT_ITEMS.map(e => (
                    <button key={e} type="button" onClick={() => toggleExtra(e, 'equipment')} className={pillCls(!!extras.find(x => x.name === e))}>
                      {e}
                    </button>
                  ))}
                </div>
                {extras.filter(e => e.category === 'equipment').map(e => (
                  <div key={e.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{e.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={e.quantity}
                      onChange={ev => setExtras(prev => prev.map(x => x.name === e.name ? { ...x, quantity: parseInt(ev.target.value) || 1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
                    />
                  </div>
                ))}
              </div>

              {/* Space Rental */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Space Rental</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SPACE_RENTAL_ITEMS.map(e => (
                    <button key={e} type="button" onClick={() => toggleExtra(e, 'space_rental')} className={pillCls(!!extras.find(x => x.name === e))}>
                      {e}
                    </button>
                  ))}
                </div>
                {extras.filter(e => e.category === 'space_rental').map(e => (
                  <div key={e.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{e.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={e.quantity}
                      onChange={ev => setExtras(prev => prev.map(x => x.name === e.name ? { ...x, quantity: parseInt(ev.target.value) || 1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
                    />
                  </div>
                ))}
              </div>

              {/* Kids Menu */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Coffee size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Kids Menu</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {KIDS_ITEMS.map(e => (
                    <button key={e} type="button" onClick={() => toggleExtra(e, 'kids')} className={pillCls(!!extras.find(x => x.name === e))}>
                      {e}
                    </button>
                  ))}
                </div>
                {extras.filter(e => e.category === 'kids').map(e => (
                  <div key={e.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{e.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={e.quantity}
                      onChange={ev => setExtras(prev => prev.map(x => x.name === e.name ? { ...x, quantity: parseInt(ev.target.value) || 1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center"
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-3 text-[11px] font-black text-rose">
                  ❌ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-tumbleweed/20 flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-night/40 hover:text-night transition-colors">
            <ChevronLeft size={14} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-night text-bone disabled:opacity-30 hover:bg-night/80 transition-all">
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-700 text-white disabled:opacity-50 hover:bg-emerald-800 transition-all">
              {loading ? <span className="animate-pulse">Generating...</span> : <><FileText size={14} /> Generate PDF</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}