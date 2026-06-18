'use client';

import { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronRight, ChevronLeft,
  FileText, ClipboardList, Coffee, UtensilsCrossed,
} from 'lucide-react';
import type { Store } from '@/services/api/storesApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'TACO_BAR' | 'BIRD_BOX' | 'PERSONAL_BOX' | 'INDIVIDUAL_TACOS' | 'SALADS';

interface TacoBarConfig {
  guestCount: number;
  proteins:   string[];
  toppings:   string[];
  salsas:     string[];
  tortilla:   string;
  extras:     string[];  // queso, guac, bunuelos, paper goods
}

interface BirdBoxConfig {
  tacoCount:  number;   // 20 | 30 | 40
  tacos:      string[];
  tortilla:   string;
  chipsIncluded: boolean;
  paperItems: boolean;
  mealType:   'breakfast' | 'lunch';
}

interface PersonalBoxConfig {
  quantity:   number;
  tacos:      { name: string; tortilla: string }[];
  salsa:      string;
  mealType:   'breakfast' | 'lunch';
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

interface IndividualTacosConfig {
  tacos: { name: string; quantity: number; tortilla: string }[];
}

interface SaladsConfig {
  salads: { name: string; quantity: number; protein: string }[];
}

interface DrinkItem {
  name:     string;
  quantity: number;
  milks?:   string[];
  cups?:    boolean;
}

interface AddonItem {
  name:     string;
  quantity: number;
}

interface WizardProps {
  stores:   Store[];
  onClose:  () => void;
  onSuccess?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRINKS              = ["June Drip Coffee", "Iced Coffee", "Cold Brew", "Lavender Limeade", "Hibiscus Lemonade", "Agua Fresca", "Half & Half"];
const ADDONS              = ["Chips & Salsa", "Chips & Guacamole", "Chips & Queso", "Bunuelos (serves 10)"];
const BB_TACO_COUNTS      = [20, 30, 40];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function buildItems(events: EventBlock[], drinks: DrinkItem[], addons: AddonItem[]) {
  const items: object[] = [];

  for (const ev of events) {
    if (ev.type === 'TACO_BAR' && ev.tacoBar) {
      const tb = ev.tacoBar;
      const q  = tb.guestCount;
      const modifiers = [
        ...tb.proteins.map(p  => ({ displayName: p, quantity: q, price: 0 })),
        ...tb.toppings.map(t  => ({ displayName: t, quantity: q, price: 0 })),
        ...tb.salsas.map(s    => ({ displayName: s, quantity: q, price: 0 })),
        { displayName: tb.tortilla, quantity: q, price: 0 },
        ...tb.extras.map(e    => ({ displayName: e, quantity: q, price: 0 })),
      ];
      items.push({ guid: uid(), displayName: 'Build Your Own Taco Bar', quantity: q, price: 0, modifiers });
    }

    if (ev.type === 'BIRD_BOX' && ev.birdBox) {
      const bb   = ev.birdBox;
      const name = bb.mealType === 'breakfast' ? "Breakfast 'Bird Box" : "Lunch 'Bird Box";
      const sizeLabel = bb.mealType === 'breakfast'
        ? `Breakfast 'Bird Box - ${bb.tacoCount} Tacos`
        : `Lunch 'Bird Box - ${bb.tacoCount} Tacos`;
      const modifiers = [
        { displayName: sizeLabel, quantity: 1, price: 0 },
        ...bb.tacos.map(t    => ({ displayName: t, quantity: 1, price: 0 })),
        { displayName: bb.tortilla, quantity: 1, price: 0 },
        { displayName: bb.chipsIncluded ? "Yes! I would like the included chips & salsa" : "Nope! I do NOT want the included chips & salsa", quantity: 1, price: 0 },
        { displayName: bb.paperItems   ? "Yes, I want paper items" : "No, I do not want paper items", quantity: 1, price: 0 },
      ];
      items.push({ guid: uid(), displayName: name, quantity: 1, price: 0, modifiers });
    }

    if (ev.type === 'PERSONAL_BOX' && ev.personalBox) {
      const pb   = ev.personalBox;
      const name = pb.mealType === 'breakfast' ? "Personal Breakfast 'Bird Box" : "Personal Lunch 'Bird Box";
      for (let i = 0; i < pb.quantity; i++) {
        const tacoModifiers = pb.tacos.map(t => ({ displayName: t.name, quantity: 1, price: 0 }));
        const tortillaModifiers = [...new Set(pb.tacos.map(t => t.tortilla))].map(t => ({ displayName: t, quantity: 1, price: 0 }));
        const modifiers = [
          ...tacoModifiers,
          ...tortillaModifiers,
          { displayName: pb.salsa, quantity: 1, price: 0 },
        ];
        items.push({ guid: uid(), displayName: name, quantity: 1, price: 0, modifiers });
      }
    }

    if (ev.type === 'INDIVIDUAL_TACOS' && ev.individualTacos) {
      for (const taco of ev.individualTacos.tacos) {
        const modifiers = taco.tortilla
          ? [{ displayName: taco.tortilla, quantity: taco.quantity, price: 0 }]
          : [];
        items.push({ guid: uid(), displayName: taco.name, quantity: taco.quantity, price: 0, modifiers });
      }
    }

    if (ev.type === 'SALADS' && ev.salads) {
      for (const salad of ev.salads.salads) {
        const modifiers = salad.protein
          ? [{ displayName: salad.protein, quantity: 1, price: 0 }]
          : [];
        items.push({ guid: uid(), displayName: salad.name, quantity: salad.quantity, price: 0, modifiers });
      }
    }
  }

  for (const d of drinks) {
    const modifiers: object[] = [];
    if (d.milks?.length)  d.milks.forEach(m  => modifiers.push({ displayName: m, quantity: 1, price: 0 }));
    if (d.cups)           modifiers.push({ displayName: 'Yes, I want cups and lids included', quantity: 1, price: 0 });
    items.push({ guid: uid(), displayName: d.name, quantity: d.quantity, price: 0, modifiers });
  }

  for (const a of addons) {
    items.push({ guid: uid(), displayName: a.name, quantity: a.quantity, price: 0, modifiers: [] });
  }

  return items;
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

// Carga items del menu API y los agrupa por categoría
function useMenuItems(eventType: string) {
  const [items, setItems] = useState<import('@/services/api/menuApi').MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    import('@/services/api/menuApi').then(({ menuApi }) =>
      menuApi.getForOrderCreation(eventType)
    ).then(res => {
      setItems(res.data.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [eventType]);

  const byCategory = items.reduce<Record<string, string[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item.name);
    return acc;
  }, {});

  return { byCategory, loading };
}

function TacoBarForm({ value, onChange }: { value: TacoBarConfig; onChange: (v: TacoBarConfig) => void }) {
  const { byCategory, loading } = useMenuItems('TACO_BAR');

  const proteins  = byCategory['protein']  || [];
  const toppings  = byCategory['topping']  || [];
  const salsas    = byCategory['salsa']    || [];
  const tortillas = byCategory['tortilla'] || [];
  // snacks = queso, guac, bunuelos + paper
  const snacks    = byCategory['snack']    || [];
  const papers    = byCategory['paper']    || [];
  const extras    = [...snacks, ...papers.filter(p => p.toLowerCase().includes('paper') || p.toLowerCase().includes('goods'))];

  const toggle = (field: 'proteins' | 'toppings' | 'salsas' | 'extras', item: string) => {
    const arr = value[field];
    onChange({ ...value, [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] });
  };

  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      active ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Guest Count</label>
        <input type="number" min={1} value={value.guestCount}
          onChange={e => onChange({ ...value, guestCount: parseInt(e.target.value) || 1 })}
          className="w-24 px-3 py-2 bg-bone rounded-xl text-sm font-black text-night outline-none" />
      </div>
      {([
        ['Proteins', 'proteins', proteins],
        ['Toppings', 'toppings', toppings],
        ['Salsas',   'salsas',   salsas],
        ['Extras',   'extras',   extras],
      ] as [string, 'proteins'|'toppings'|'salsas'|'extras', string[]][]).map(([label, field, opts]) => (
        <div key={field}>
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">{label}</label>
          <div className="flex flex-wrap gap-2">
            {opts.map(o => <button key={o} type="button" onClick={() => toggle(field, o)} className={cls(value[field].includes(o))}>{o}</button>)}
          </div>
        </div>
      ))}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tortilla</label>
        <div className="flex flex-wrap gap-2">
          {tortillas.map(t => <button key={t} type="button" onClick={() => onChange({ ...value, tortilla: t })} className={cls(value.tortilla === t)}>{t}</button>)}
        </div>
      </div>
    </div>
  );
}

function BirdBoxForm({ value, onChange }: { value: BirdBoxConfig; onChange: (v: BirdBoxConfig) => void }) {
  const eventType = value.mealType === 'breakfast' ? 'BIRD_BOX' : 'BIRD_BOX';
  const { byCategory, loading } = useMenuItems(eventType);

  const allCombos  = byCategory['combo'] || [];
  const tortillas  = byCategory['tortilla'] || [];

  const toggle = (taco: string) => onChange({
    ...value,
    tacos: value.tacos.includes(taco) ? value.tacos.filter(t => t !== taco) : [...value.tacos, taco],
  });

  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      active ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

  // Filtrar combos por meal type basado en el nombre
  const tacoOpts = allCombos.filter(c => {
    const lc = c.toLowerCase();
    return value.mealType === 'breakfast'
      ? lc.includes('bacon') || lc.includes('egg') || lc.includes('potato') || lc.includes('chorizo') || lc.includes('migas') || lc.includes('avocado') || /^#[1-6]/.test(c)
      : lc.includes('chicken') || lc.includes('barbacoa') || lc.includes('pastor') || lc.includes('brisket') || lc.includes('bean') || /^#[1-5]/.test(c);
  });

  if (loading) return <div className="text-[11px] text-night/40 font-black uppercase tracking-widest animate-pulse">Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Meal Type</label>
        <div className="flex gap-2">
          {(['breakfast','lunch'] as const).map(m => (
            <button key={m} type="button" onClick={() => onChange({ ...value, mealType: m, tacos: [] })} className={cls(value.mealType === m)}>{m}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Taco Count</label>
        <div className="flex gap-2">
          {BB_TACO_COUNTS.map(n => (
            <button key={n} type="button" onClick={() => onChange({ ...value, tacoCount: n })} className={cls(value.tacoCount === n)}>{n} tacos</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tacos</label>
        <div className="flex flex-wrap gap-2">
          {tacoOpts.map(t => <button key={t} type="button" onClick={() => toggle(t)} className={cls(value.tacos.includes(t))}>{t}</button>)}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tortilla</label>
        <div className="flex flex-wrap gap-2">
          {tortillas.map(t => <button key={t} type="button" onClick={() => onChange({ ...value, tortilla: t })} className={cls(value.tortilla === t)}>{t}</button>)}
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

function PersonalBoxForm({ value, onChange }: { value: PersonalBoxConfig; onChange: (v: PersonalBoxConfig) => void }) {
  const { byCategory, loading } = useMenuItems('PERSONAL_BOX');

  const allCombos  = byCategory['combo'] || [];
  const tortillas  = byCategory['tortilla'] || [];
  const salsas     = byCategory['salsa'] || [];

  const tacoOpts = allCombos.filter(c => {
    const lc = c.toLowerCase();
    return value.mealType === 'breakfast'
      ? lc.includes('bacon') || lc.includes('egg') || lc.includes('potato') || lc.includes('chorizo') || lc.includes('migas') || lc.includes('avocado') || /^#[1-6]/.test(c)
      : lc.includes('chicken') || lc.includes('barbacoa') || lc.includes('pastor') || lc.includes('brisket') || lc.includes('bean') || /^#[1-5]/.test(c);
  });

  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      active ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

  const toggleTaco = (name: string) => {
    const exists = value.tacos.find(t => t.name === name);
    onChange({
      ...value,
      tacos: exists ? value.tacos.filter(t => t.name !== name) : [...value.tacos, { name, tortilla: tortillas[0] || '' }],
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
            {(['breakfast','lunch'] as const).map(m => (
              <button key={m} type="button" onClick={() => onChange({ ...value, mealType: m, tacos: [] })} className={cls(value.mealType === m)}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Boxes</label>
          <input type="number" min={1} value={value.quantity}
            onChange={e => onChange({ ...value, quantity: parseInt(e.target.value) || 1 })}
            className="w-20 px-3 py-2 bg-bone rounded-xl text-sm font-black text-night outline-none" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Tacos (select all that apply)</label>
        <div className="flex flex-wrap gap-2">
          {tacoOpts.map(t => <button key={t} type="button" onClick={() => toggleTaco(t)} className={cls(!!value.tacos.find(x => x.name === t))}>{t}</button>)}
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
                  <button key={tort} type="button" onClick={() => setTortilla(taco.name, tort)} className={cls(taco.tortilla === tort)}>{tort}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block mb-2">Salsa</label>
        <div className="flex flex-wrap gap-2">
          {salsas.map(s => <button key={s} type="button" onClick={() => onChange({ ...value, salsa: s })} className={cls(value.salsa === s)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}
// ─── Individual Tacos Form ───────────────────────────────────────────────────

function IndividualTacosForm({ value, onChange }: { value: IndividualTacosConfig; onChange: (v: IndividualTacosConfig) => void }) {
  const { byCategory, loading } = useMenuItems('TACO_BAR');
  const allCombos = byCategory['individual_taco'] || [];
  const tortillas = byCategory['tortilla'] || [];

  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      active ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

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
            <button key={c} type="button" onClick={() => toggleTaco(c)} className={cls(!!value.tacos.find(t => t.name === c))}>{c}</button>
          ))}
        </div>
      </div>
      {value.tacos.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-night/40 block">Qty & Tortilla</label>
          {value.tacos.map(taco => (
            <div key={taco.name} className="flex items-center gap-3 py-1">
              <span className="text-[11px] font-bold text-night/70 flex-1 truncate">{taco.name}</span>
              <input type="number" min={1} value={taco.quantity}
                onChange={e => updateTaco(taco.name, 'quantity', parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center" />
              <div className="flex gap-1">
                {tortillas.map(t => (
                  <button key={t} type="button" onClick={() => updateTaco(taco.name, 'tortilla', t)}
                    className={cls(taco.tortilla === t)}>{t}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Salads Form ──────────────────────────────────────────────────────────────

function SaladsForm({ value, onChange }: { value: SaladsConfig; onChange: (v: SaladsConfig) => void }) {
  const { byCategory, loading } = useMenuItems('TACO_BAR');
  const allSalads  = byCategory['salad'] || [];
  const allSaladsMenu = [...allSalads, ...(byCategory['menu_item'] || []).filter(i => i.toLowerCase().includes('salad'))];
  const proteins   = ['Salsa Verde Braised Chicken', 'House-smoked Brisket', 'Chorizo', 'Without Protein'];

  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      active ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

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
            <button key={s} type="button" onClick={() => toggleSalad(s)} className={cls(!!value.salads.find(x => x.name === s))}>{s}</button>
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
                <input type="number" min={1} value={salad.quantity}
                  onChange={e => updateSalad(salad.name, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center" />
              </div>
              <div className="flex flex-wrap gap-2 pl-2">
                {proteins.map(p => (
                  <button key={p} type="button" onClick={() => updateSalad(salad.name, 'protein', p)}
                    className={cls(salad.protein === p)}>{p}</button>
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

function EventEditor({ ev, onChange, onRemove }: { ev: EventBlock; onChange: (v: EventBlock) => void; onRemove: () => void }) {
  const defaultTacoBar: TacoBarConfig        = { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] };
  const defaultBirdBox: BirdBoxConfig        = { tacoCount: 20, tacos: [], tortilla: '', chipsIncluded: true, paperItems: true, mealType: 'breakfast' };
  const defaultPersonalBox: PersonalBoxConfig = { quantity: 1, tacos: [], salsa: '', mealType: 'breakfast' };
  const defaultIndividualTacos: IndividualTacosConfig = { tacos: [] };
  const defaultSalads: SaladsConfig          = { salads: [] };

  const setType = (type: EventType) => {
    onChange({
      ...ev, type,
      tacoBar:          type === 'TACO_BAR'          ? defaultTacoBar          : undefined,
      birdBox:          type === 'BIRD_BOX'           ? defaultBirdBox          : undefined,
      personalBox:      type === 'PERSONAL_BOX'       ? defaultPersonalBox      : undefined,
      individualTacos:  type === 'INDIVIDUAL_TACOS'   ? defaultIndividualTacos  : undefined,
      salads:           type === 'SALADS'             ? defaultSalads           : undefined,
    });
  };

  const typeCls = (t: EventType) =>
    `px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
      ev.type === t ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
    }`;

  return (
    <div className="border border-tumbleweed/40 rounded-2xl p-5 space-y-4 bg-bone/30">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {([
            ['TACO_BAR', 'Taco Bar'],
            ['BIRD_BOX', "'Bird Box"],
            ['PERSONAL_BOX', 'Personal Box'],
            ['INDIVIDUAL_TACOS', 'Individual Tacos'],
            ['SALADS', 'Salads'],
          ] as [EventType, string][]).map(([t, label]) => (
            <button key={t} type="button" onClick={() => setType(t)} className={typeCls(t)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} className="text-night/30 hover:text-rose transition-colors">
          <Trash2 size={15} />
        </button>
      </div>

      {ev.type === 'TACO_BAR' && ev.tacoBar && (
        <TacoBarForm value={ev.tacoBar} onChange={v => onChange({ ...ev, tacoBar: v })} />
      )}
      {ev.type === 'BIRD_BOX' && ev.birdBox && (
        <BirdBoxForm value={ev.birdBox} onChange={v => onChange({ ...ev, birdBox: v })} />
      )}
      {ev.type === 'PERSONAL_BOX' && ev.personalBox && (
        <PersonalBoxForm value={ev.personalBox} onChange={v => onChange({ ...ev, personalBox: v })} />
      )}
      {ev.type === 'INDIVIDUAL_TACOS' && ev.individualTacos && (
        <IndividualTacosForm value={ev.individualTacos} onChange={v => onChange({ ...ev, individualTacos: v })} />
      )}
      {ev.type === 'SALADS' && ev.salads && (
        <SaladsForm value={ev.salads} onChange={v => onChange({ ...ev, salads: v })} />
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ManualFulfillmentWizard({ stores, onClose, onSuccess }: WizardProps) {
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Step 1 — Order info
  const [storeId, setStoreId]               = useState(stores[0]?.id || '');
  const [clientName, setClientName]         = useState('');
  const [clientPhone, setClientPhone]       = useState('');
  const [clientEmail, setClientEmail]       = useState('');
  const [eventDate, setEventDate]           = useState('');
  const [eventTime, setEventTime]           = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP'|'DELIVERY'>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes]   = useState('');

  // Step 2 — Events
  const [events, setEvents] = useState<EventBlock[]>([
    { id: uid(), type: 'TACO_BAR', tacoBar: { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] } },
  ]);

  // Step 3 — Extras
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [addons, setAddons] = useState<AddonItem[]>([]);

  const addEvent = () => setEvents(prev => [...prev, {
    id: uid(), type: 'TACO_BAR',
    tacoBar: { guestCount: 10, proteins: [], toppings: [], salsas: [], tortilla: '', extras: [] },
  }]);

  const updateEvent = (id: string, ev: EventBlock) => setEvents(prev => prev.map(e => e.id === id ? ev : e));
  const removeEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));

  const totalGuests = events.reduce((acc, ev) => {
    if (ev.type === 'TACO_BAR')     return acc + (ev.tacoBar?.guestCount || 0);
    if (ev.type === 'BIRD_BOX')     return acc + 0;
    if (ev.type === 'PERSONAL_BOX') return acc + (ev.personalBox?.quantity || 0);
    // INDIVIDUAL_TACOS and SALADS don't count as guests
    return acc;
  }, 0);

  const toggleDrink = (name: string) => {
    const exists = drinks.find(d => d.name === name);
    if (exists) setDrinks(prev => prev.filter(d => d.name !== name));
    else        setDrinks(prev => [...prev, { name, quantity: 1, cups: true, milks: name.includes('Coffee') ? ['Local Whole Milk'] : undefined }]);
  };

  const toggleAddon = (name: string) => {
    const exists = addons.find(a => a.name === name);
    if (exists) setAddons(prev => prev.filter(a => a.name !== name));
    else        setAddons(prev => [...prev, { name, quantity: 1 }]);
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const items = buildItems(events, drinks, addons);

      // Si hay múltiples eventos, usar PERSONAL_BOX porque ese handler
      // del calculator sabe combinar TACO_BAR + BIRD_BOX + PERSONAL_BOX en un solo sheet.
      // Si hay un solo evento, usar su tipo directamente.
      const eventType = events.length === 1 ? events[0].type : 'PERSONAL_BOX';

      // guestCount: total de guests de todos los eventos
      const guestCount = totalGuests || 1;

      const body = {
        storeId, clientName, clientPhone, clientEmail,
        eventType, guestCount,
        deliveryMethod, deliveryAddress: deliveryMethod === 'DELIVERY' ? deliveryAddress : null,
        deliveryNotes: deliveryNotes || null,
        eventDate, eventTime,
        items,
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/catering/orders/manual-fulfillment`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );

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
              <h2 className="font-black text-night text-base">Fulfillment Sheet Builder</h2>
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
          {[1,2,3].map(s => (
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
                  <label className={labelCls}>Phone</label>
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="615-000-0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Event Date *</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Event Time</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Delivery Method</label>
                <div className="flex gap-2">
                  {(['PICKUP','DELIVERY'] as const).map(m => (
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
                <EventEditor key={ev.id} ev={ev}
                  onChange={v => updateEvent(ev.id, v)}
                  onRemove={() => removeEvent(ev.id)} />
              ))}
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
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Coffee size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Drinks</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {DRINKS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDrink(d)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
                        drinks.find(x => x.name === d) ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
                      }`}>{d}</button>
                  ))}
                </div>
                {drinks.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{d.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={d.quantity}
                      onChange={e => setDrinks(prev => prev.map((x,j) => j === i ? { ...x, quantity: parseInt(e.target.value)||1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center" />
                    {d.name.includes('Coffee') && (
                      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-night/40">
                        <input type="checkbox" checked={d.cups || false}
                          onChange={e => setDrinks(prev => prev.map((x,j) => j === i ? { ...x, cups: e.target.checked } : x))}
                          className="accent-night" />
                        Cups
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed size={14} className="text-night/40" />
                  <label className={labelCls + ' mb-0'}>Add-ons</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {ADDONS.map(a => (
                    <button key={a} type="button" onClick={() => toggleAddon(a)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border ${
                        addons.find(x => x.name === a) ? 'bg-night text-bone border-night' : 'bg-bone text-night/50 border-transparent hover:border-night/20'
                      }`}>{a}</button>
                  ))}
                </div>
                {addons.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3 py-2 border-b border-tumbleweed/10">
                    <span className="text-[11px] font-bold text-night flex-1">{a.name}</span>
                    <label className="text-[10px] font-black uppercase text-night/40">Qty</label>
                    <input type="number" min={1} value={a.quantity}
                      onChange={e => setAddons(prev => prev.map((x,j) => j === i ? { ...x, quantity: parseInt(e.target.value)||1 } : x))}
                      className="w-16 px-2 py-1 bg-bone rounded-lg text-xs font-black text-night outline-none text-center" />
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
              {loading ? (
                <span className="animate-pulse">Generating...</span>
              ) : (
                <><FileText size={14} /> Generate PDF</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}