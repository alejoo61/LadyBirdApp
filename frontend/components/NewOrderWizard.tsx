'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { menuApi } from '@/services/api/menuApi';
import { cateringApi } from '@/services/api/cateringApi';
import type { MenuItem } from '@/services/api/menuApi';
import type { Store } from '@/services/api/storesApi';
import {
  ArrowLeft, ArrowRight, Check, Plus, Minus, X,
  ChevronRight, ShoppingBag, Users, Clock, MapPin,
  Utensils, Package, Trash2, Edit2,
} from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface OrderItem {
  menuItemId:  string;
  displayName: string;
  quantity:    number;
  price:       number;
  category:    string;
  modifiers:   { menuItemId: string; displayName: string; quantity: number; price: number }[];
}

interface BirdBox {
  id:        string;
  name:      string;
  tacoCount: number;
  combos:    OrderItem[];
  tortilla:  OrderItem | null;
  chips:     OrderItem | null;
  addons:    OrderItem[];
  paper:     OrderItem | null;
}

const EVENT_TYPES = [
  { value: 'TACO_BAR',     label: 'Taco Bar',    icon: '🌮', desc: 'Full taco bar buffet style' },
  { value: 'BIRD_BOX',     label: "Bird Box",     icon: '📦', desc: 'Individual bird boxes with taco combos' },
  { value: 'PERSONAL_BOX', label: 'Personal Box', icon: '🥡', desc: 'Individual boxes per person' },
  { value: 'FOODA',        label: 'Fooda',        icon: '🍽️', desc: 'Fooda platform orders' },
];

const PRICE_PER_PERSON = new Set(['protein', 'topping', 'salsa', 'tortilla', 'snack', 'paper', 'menu_item']);
const SINGLE_SELECT    = new Set(['tortilla', 'chips_salsa', 'paper', 'drink_cups', 'size', 'menu_item']);

const TACO_BAR_STEPS  = ['protein', 'topping', 'salsa', 'tortilla', 'snack', 'paper', 'drink'];
const BIRD_BOX_STEPS  = ['BOX_BUILDER'];
const PERSONAL_STEPS  = ['size', 'tortilla', 'paper'];
const FOODA_STEPS     = ['menu_item'];

const STEP_LABELS: Record<string, string> = {
  protein:     'Proteins',
  topping:     'Toppings',
  salsa:       'Salsas',
  tortilla:    'Tortilla',
  snack:       'Snacks & Add-ons',
  paper:       'Paper Goods',
  drink:       'Drinks',
  size:        'Box Size',
  chips_salsa: 'Chips & Salsa',
  menu_item:   'Event Package',
  BOX_BUILDER: 'Build Your Boxes',
};

const STEP_REQUIRED = new Set(['protein', 'tortilla', 'size', 'menu_item', 'BOX_BUILDER']);

const CATEGORY_COLORS: Record<string, string> = {
  protein:     '#ef4444',
  topping:     '#10b981',
  salsa:       '#f97316',
  tortilla:    '#8b5cf6',
  snack:       '#f59e0b',
  paper:       '#6b7280',
  drink:       '#3b82f6',
  chips_salsa: '#92400e',
  size:        '#0ea5e9',
  menu_item:   '#1a1a1a',
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function NewOrderWizard({
  stores,
  onClose,
  onSave,
}: {
  stores: Store[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    storeId:                  '',
    eventType:                'TACO_BAR',
    clientName:               '',
    clientEmail:              '',
    clientPhone:              '',
    estimatedFulfillmentDate: '',
    deliveryMethod:           'PICKUP',
    deliveryAddress:          '',
    deliveryNotes:            '',
    guestCount:               20,
    status:                   'pending',
    paymentStatus:            'OPEN',
    overrideNotes:            '',
  });

  const [menuItems, setMenuItems]       = useState<MenuItem[]>([]);
  const [baseItem, setBaseItem]         = useState<MenuItem | null>(null);
  const [loadingMenu, setLoadingMenu]   = useState(false);
  const [infoComplete, setInfoComplete] = useState(false);
  const [currentStep, setCurrentStep]  = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems]   = useState<OrderItem[]>([]);
  const [boxes, setBoxes]               = useState<BirdBox[]>([]);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [boxDraft, setBoxDraft]         = useState<Partial<BirdBox> & { step: string }>({ step: 'size' });
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const loadMenu = useCallback(async () => {
    setLoadingMenu(true);
    setSelectedItems([]);
    setBoxes([]);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    try {
      const res = await menuApi.getForOrderCreation(form.eventType);
      setMenuItems(res.data.data);
      setBaseItem(res.data.baseItem || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMenu(false);
    }
  }, [form.eventType]);

  useEffect(() => {
    if (infoComplete) loadMenu();
  }, [form.eventType, infoComplete, loadMenu]);

  const steps = form.eventType === 'TACO_BAR'     ? TACO_BAR_STEPS
              : form.eventType === 'BIRD_BOX'     ? BIRD_BOX_STEPS
              : form.eventType === 'PERSONAL_BOX' ? PERSONAL_STEPS
              : FOODA_STEPS;

  const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const guestCount  = Number(form.guestCount) || 1;

  const calcTotal = (): number => {
    let total = baseItem ? Number(baseItem.price) * guestCount : 0;
    for (const item of selectedItems) {
      const price = Number(item.price) || 0;
      if (price === 0) continue;
      total += PRICE_PER_PERSON.has(item.category)
        ? price * guestCount * item.quantity
        : price * item.quantity;
    }
    return total;
  };

  const totalAmount = calcTotal();

  const isSelected = (id: string) => selectedItems.some(i => i.menuItemId === id);

  const toggleItem = (item: MenuItem) => {
    const isSingle = SINGLE_SELECT.has(item.category);
    setSelectedItems(prev => {
      const alreadyIn = prev.some(i => i.menuItemId === item.id);
      const filtered  = isSingle
        ? prev.filter(i => i.category !== item.category)
        : prev.filter(i => i.menuItemId !== item.id);
      if (alreadyIn) return filtered;
      return [...filtered, {
        menuItemId:  item.id,
        displayName: item.name,
        quantity:    1,
        price:       Number(item.price) || 0,
        category:    item.category,
        modifiers:   [],
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setSelectedItems(prev => prev.map(i =>
      i.menuItemId !== id ? i : { ...i, quantity: Math.max(1, i.quantity + delta) }
    ));
  };

  const getPriceLabel = (item: MenuItem): string => {
    const price = Number(item.price);
    if (price === 0) return 'Included';
    return PRICE_PER_PERSON.has(item.category)
      ? `+$${price.toFixed(2)}/person`
      : `$${price.toFixed(2)}`;
  };

  const advanceStep = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    const next = currentStep + 1;
    setCurrentStep(next);
    setTimeout(() => {
      stepRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const canAdvance = (stepIdx: number): boolean => {
    const cat = steps[stepIdx];
    if (!STEP_REQUIRED.has(cat)) return true;
    if (cat === 'BOX_BUILDER') return boxes.length > 0;
    return selectedItems.some(i => i.category === cat);
  };

  // ─── BIRD BOX BUILDER ─────────────────────────────────────────────────────

  const startNewBox = () => { setBoxDraft({ step: 'size' }); setEditingBoxId('NEW'); };

  const editBox   = (id: string) => {
    const box = boxes.find(b => b.id === id);
    if (!box) return;
    setBoxDraft({ ...box, step: 'review' });
    setEditingBoxId(id);
  };

  const deleteBox = (id: string) => setBoxes(prev => prev.filter(b => b.id !== id));

  const boxSizeItems  = grouped['size']       || [];
  const boxComboItems = grouped['combo']      || [];
  const boxTortillas  = grouped['tortilla']   || [];
  const boxChipsItems = grouped['chips_salsa']|| [];
  const boxAddonItems = grouped['snack']      || [];
  const boxPaperItems = grouped['paper']      || [];

  const saveDraftBox = () => {
    if (!boxDraft.name) return;
    const newBox: BirdBox = {
      id:       editingBoxId === 'NEW' ? `box-${Date.now()}` : editingBoxId!,
      name:     boxDraft.name || '',
      tacoCount:boxDraft.tacoCount || 0,
      combos:   boxDraft.combos    || [],
      tortilla: boxDraft.tortilla  || null,
      chips:    boxDraft.chips     || null,
      addons:   boxDraft.addons    || [],
      paper:    boxDraft.paper     || null,
    };
    setBoxes(prev =>
      editingBoxId === 'NEW' ? [...prev, newBox] : prev.map(b => b.id === editingBoxId ? newBox : b)
    );
    setEditingBoxId(null);
    setBoxDraft({ step: 'size' });
  };

  const toggleBoxDraftItem = (item: MenuItem, field: 'combos' | 'addons') => {
    setBoxDraft(prev => {
      const list    = (prev[field] || []) as OrderItem[];
      const already = list.some(i => i.menuItemId === item.id);
      return {
        ...prev,
        [field]: already
          ? list.filter(i => i.menuItemId !== item.id)
          : [...list, { menuItemId: item.id, displayName: item.name, quantity: 1, price: Number(item.price) || 0, category: item.category, modifiers: [] }],
      };
    });
  };

  const setBoxDraftSingle = (item: MenuItem, field: 'tortilla' | 'chips' | 'paper') => {
    setBoxDraft(prev => {
      const same = prev[field]?.menuItemId === item.id;
      return {
        ...prev,
        [field]: same ? null : { menuItemId: item.id, displayName: item.name, quantity: 1, price: Number(item.price) || 0, category: item.category, modifiers: [] },
      };
    });
  };

  // ─── SUBMIT ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let items: object[] = [];

      if (form.eventType === 'BIRD_BOX') {
        items = boxes.flatMap(box => {
          const boxItems: object[] = [];
          boxItems.push({
            guid: box.id, displayName: box.name, quantity: 1, price: 0,
            modifiers: [
              ...box.combos.map(c => ({ menuItemId: c.menuItemId, displayName: c.displayName, quantity: 1, price: c.price })),
              ...(box.tortilla ? [{ menuItemId: box.tortilla.menuItemId, displayName: box.tortilla.displayName, quantity: 1, price: box.tortilla.price }] : []),
              ...(box.chips    ? [{ menuItemId: box.chips.menuItemId,    displayName: box.chips.displayName,    quantity: 1, price: box.chips.price    }] : []),
              ...(box.paper    ? [{ menuItemId: box.paper.menuItemId,    displayName: box.paper.displayName,    quantity: 1, price: box.paper.price    }] : []),
            ],
          });
          box.addons.forEach(a => boxItems.push({ guid: a.menuItemId, displayName: a.displayName, quantity: a.quantity, price: a.price, modifiers: [] }));
          return boxItems;
        });
      } else {
        items = selectedItems.map(i => ({
          guid: i.menuItemId, displayName: i.displayName,
          quantity: i.quantity, price: i.price, modifiers: i.modifiers,
        }));
      }

      await cateringApi.createManual({
        ...form,
        estimatedFulfillmentDate: new Date(form.estimatedFulfillmentDate).toISOString(),
        guestCount:  Number(form.guestCount),
        totalAmount: String(totalAmount.toFixed(2)),
        parsedData: { items, isManualOrder: true, baseItem: baseItem ? { name: baseItem.name, price: baseItem.price } : null },
        isManuallyEdited: true,
      } as never);

      onSave();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error creating order');
    } finally {
      setSaving(false);
    }
  };

  const inputCls  = 'w-full px-4 py-3 bg-stone-100 rounded-xl text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-stone-900 transition-all';
  const selectCls = inputCls + ' cursor-pointer';
  const labelCls  = 'text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block';

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col">

      {/* TOP BAR */}
      <div className="sticky top-0 z-40 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-900 transition-colors text-sm font-semibold">
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="h-5 w-px bg-stone-200" />
          <h1 className="text-sm font-black uppercase tracking-widest text-stone-900">New Catering Order</h1>
        </div>
        {infoComplete && (
          <button onClick={handleSave}
            disabled={saving || (form.eventType === 'BIRD_BOX' ? boxes.length === 0 : selectedItems.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-30">
            {saving ? 'Creating...' : (
              <>
                <Check size={14} />
                Create Order{totalAmount > 0 ? ` — $${totalAmount.toFixed(2)}` : ''}
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL */}
        <div className="w-72 shrink-0 bg-stone-900 text-white flex flex-col overflow-y-auto">
          <div className="p-6 border-b border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Order Summary</p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{EVENT_TYPES.find(e => e.value === form.eventType)?.icon}</span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white">
                  {EVENT_TYPES.find(e => e.value === form.eventType)?.label}
                </p>
                {form.storeId && (
                  <p className="text-[10px] text-white/40">
                    {stores.find(s => s.id === form.storeId)?.name}
                  </p>
                )}
              </div>
            </div>
            {form.clientName && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white/70">
                  <Users size={12} />
                  <span className="text-xs font-semibold">{form.clientName}</span>
                </div>
                {form.estimatedFulfillmentDate && (
                  <div className="flex items-center gap-2 text-white/70">
                    <Clock size={12} />
                    <span className="text-xs">
                      {new Date(form.estimatedFulfillmentDate).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-white/70">
                  <Users size={12} />
                  <span className="text-xs">{guestCount} guests</span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <MapPin size={12} />
                  <span className="text-xs">{form.deliveryMethod}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-6 space-y-3 overflow-y-auto">
            {!infoComplete && (
              <p className="text-white/20 text-xs text-center mt-8">Complete order info to start building</p>
            )}
            {form.eventType === 'BIRD_BOX' && boxes.map((box, i) => (
              <div key={box.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Box {i + 1}</p>
                  <div className="flex gap-1">
                    <button onClick={() => editBox(box.id)} className="p-1 text-white/30 hover:text-white transition-colors">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => deleteBox(box.id)} className="p-1 text-white/30 hover:text-red-400 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <p className="text-xs font-bold text-white">{box.name}</p>
                {box.combos.length > 0 && (
                  <p className="text-[10px] text-white/40 mt-0.5">{box.combos.map(c => c.displayName).join(' / ')}</p>
                )}
              </div>
            ))}
            {form.eventType !== 'BIRD_BOX' && selectedItems.map(item => (
              <div key={item.menuItemId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: CATEGORY_COLORS[item.category] || '#888' }} />
                  <span className="text-xs text-white/70 truncate">{item.displayName}</span>
                </div>
                {!SINGLE_SELECT.has(item.category) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQty(item.menuItemId, -1)}
                      className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                      <Minus size={10} />
                    </button>
                    <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.menuItemId, 1)}
                      className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {infoComplete && totalAmount > 0 && (
            <div className="p-6 border-t border-white/10 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Estimated Total</span>
                <span className="text-xl font-black text-white">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

            {/* STEP 1 — Order Info */}
            <Section
              title="Order Info"
              icon={<Users size={16} />}
              status={infoComplete ? 'done' : 'active'}
              onEdit={infoComplete ? () => setInfoComplete(false) : undefined}
            >
              {!infoComplete ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Store *</label>
                      <select value={form.storeId} onChange={e => set('storeId', e.target.value)} className={selectCls}>
                        <option value="">Select store...</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Event Type *</label>
                      <select value={form.eventType} onChange={e => set('eventType', e.target.value)} className={selectCls}>
                        {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Client Name *</label>
                    <input type="text" value={form.clientName} onChange={e => set('clientName', e.target.value)}
                      className={inputCls} placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)}
                        className={inputCls} placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input type="tel" value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                        className={inputCls} placeholder="(000) 000-0000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Event Date & Time *</label>
                      <input type="datetime-local" value={form.estimatedFulfillmentDate}
                        onChange={e => set('estimatedFulfillmentDate', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Guest Count</label>
                      <input type="number" value={form.guestCount}
                        onChange={e => set('guestCount', e.target.value)} className={inputCls} min={1} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Delivery Method</label>
                      <select value={form.deliveryMethod} onChange={e => set('deliveryMethod', e.target.value)} className={selectCls}>
                        <option value="PICKUP">Pickup</option>
                        <option value="DELIVERY">Delivery</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Payment Status</label>
                      <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)} className={selectCls}>
                        <option value="OPEN">Open</option>
                        <option value="PAID">Paid</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                  </div>
                  {form.deliveryMethod === 'DELIVERY' && (
                    <div>
                      <label className={labelCls}>Delivery Address</label>
                      <input type="text" value={form.deliveryAddress}
                        onChange={e => set('deliveryAddress', e.target.value)}
                        className={inputCls} placeholder="Full address" />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Delivery Notes</label>
                    <textarea value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)}
                      className={inputCls + ' resize-none'} rows={2} placeholder="Special instructions..." />
                  </div>
                  <div>
                    <label className={labelCls}>Internal Notes</label>
                    <input type="text" value={form.overrideNotes} onChange={e => set('overrideNotes', e.target.value)}
                      className={inputCls} placeholder="Notes for the team..." />
                  </div>
                  {error && (
                    <p className="p-3 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100">
                      {error}
                    </p>
                  )}
                  <button onClick={() => {
                    if (!form.clientName || !form.estimatedFulfillmentDate || !form.storeId) {
                      setError('Store, client name and event date are required.');
                      return;
                    }
                    setError('');
                    setInfoComplete(true);
                  }}
                    className="w-full py-3.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                    Continue to Menu
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <InfoPill label="Client"  value={form.clientName} />
                  <InfoPill label="Guests"  value={`${guestCount} people`} />
                  <InfoPill label="Method"  value={form.deliveryMethod} />
                  <InfoPill label="Store"   value={stores.find(s => s.id === form.storeId)?.name || '—'} />
                  <InfoPill label="Date"    value={form.estimatedFulfillmentDate
                    ? new Date(form.estimatedFulfillmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'} />
                  <InfoPill label="Payment" value={form.paymentStatus} />
                </div>
              )}
            </Section>

            {/* MENU WIZARD */}
            {infoComplete && (
              loadingMenu ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-stone-400">Loading menu...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* BIRD BOX */}
                  {form.eventType === 'BIRD_BOX' && (
                    <Section title="Build Your Boxes" icon={<Package size={16} />} status="active">
                      <div className="space-y-4">
                        {boxes.length > 0 && (
                          <div className="space-y-3">
                            {boxes.map((box, i) => (
                              <div key={box.id} className="border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-4 bg-white">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-black shrink-0">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-stone-900">{box.name}</p>
                                    {box.combos.length > 0 && (
                                      <p className="text-xs text-stone-500 mt-0.5">Combos: {box.combos.map(c => c.displayName).join(', ')}</p>
                                    )}
                                    {box.tortilla && <p className="text-xs text-stone-500">Tortilla: {box.tortilla.displayName}</p>}
                                    {box.chips    && <p className="text-xs text-stone-500">Chips & Salsa: Yes</p>}
                                    {box.addons.length > 0 && <p className="text-xs text-stone-500">Add-ons: {box.addons.map(a => a.displayName).join(', ')}</p>}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => editBox(box.id)}
                                    className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all">
                                    <Edit2 size={13} />
                                  </button>
                                  <button onClick={() => deleteBox(box.id)}
                                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {editingBoxId ? (
                          <div className="border-2 border-stone-900 rounded-xl overflow-hidden">
                            <div className="bg-stone-900 text-white px-4 py-3 flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-widest">
                                {editingBoxId === 'NEW' ? 'New Box' : 'Edit Box'}
                              </p>
                              <button onClick={() => { setEditingBoxId(null); setBoxDraft({ step: 'size' }); }}
                                className="text-white/40 hover:text-white transition-colors">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="p-4 space-y-5">
                              <BoxSection label="Box Size *" color="#0ea5e9">
                                <div className="grid grid-cols-1 gap-2">
                                  {boxSizeItems.map(item => {
                                    const tacoMatch = item.name.match(/(\d+)\s*tacos?/i);
                                    const tacoCount = tacoMatch ? parseInt(tacoMatch[1]) : 0;
                                    const selected  = boxDraft.name === item.name;
                                    return (
                                      <button key={item.id}
                                        onClick={() => setBoxDraft(p => ({ ...p, name: item.name, tacoCount }))}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                        <span className="text-sm font-bold">{item.name}</span>
                                        <span className={`text-[10px] font-black ${selected ? 'text-white/60' : 'text-stone-400'}`}>{getPriceLabel(item)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </BoxSection>

                              {boxDraft.name && (
                                <BoxSection label="Combos" color="#ef4444">
                                  <div className="grid grid-cols-1 gap-2">
                                    {boxComboItems.map(item => {
                                      const selected = (boxDraft.combos || []).some(c => c.menuItemId === item.id);
                                      return (
                                        <button key={item.id} onClick={() => toggleBoxDraftItem(item, 'combos')}
                                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                          <span className="text-sm font-bold">{item.name}</span>
                                          {selected && <Check size={14} className="text-white/60 shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </BoxSection>
                              )}

                              {boxDraft.name && (
                                <BoxSection label="Tortilla" color="#8b5cf6">
                                  <div className="grid grid-cols-1 gap-2">
                                    {boxTortillas.map(item => {
                                      const selected = boxDraft.tortilla?.menuItemId === item.id;
                                      return (
                                        <button key={item.id} onClick={() => setBoxDraftSingle(item, 'tortilla')}
                                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                          <span className="text-sm font-bold">{item.name}</span>
                                          <span className={`text-[10px] font-black ${selected ? 'text-white/60' : 'text-emerald-600'}`}>{getPriceLabel(item)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </BoxSection>
                              )}

                              {boxDraft.name && boxChipsItems.length > 0 && (
                                <BoxSection label="Chips & Salsa" color="#92400e">
                                  <div className="grid grid-cols-1 gap-2">
                                    {boxChipsItems.map(item => {
                                      const selected = boxDraft.chips?.menuItemId === item.id;
                                      return (
                                        <button key={item.id} onClick={() => setBoxDraftSingle(item, 'chips')}
                                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                          <span className="text-sm font-bold">{item.name}</span>
                                          <span className={`text-[10px] font-black ${selected ? 'text-white/60' : 'text-stone-400'}`}>{getPriceLabel(item)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </BoxSection>
                              )}

                              {boxDraft.name && boxAddonItems.length > 0 && (
                                <BoxSection label="Add-ons (optional)" color="#f59e0b">
                                  <div className="grid grid-cols-1 gap-2">
                                    {boxAddonItems.map(item => {
                                      const selected = (boxDraft.addons || []).some(a => a.menuItemId === item.id);
                                      return (
                                        <button key={item.id} onClick={() => toggleBoxDraftItem(item, 'addons')}
                                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                          <span className="text-sm font-bold">{item.name}</span>
                                          <span className={`text-[10px] font-black ${selected ? 'text-white/60' : 'text-stone-400'}`}>{getPriceLabel(item)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </BoxSection>
                              )}

                              {boxDraft.name && boxPaperItems.length > 0 && (
                                <BoxSection label="Paper Goods" color="#6b7280">
                                  <div className="grid grid-cols-1 gap-2">
                                    {boxPaperItems.map(item => {
                                      const selected = boxDraft.paper?.menuItemId === item.id;
                                      return (
                                        <button key={item.id} onClick={() => setBoxDraftSingle(item, 'paper')}
                                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${selected ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}>
                                          <span className="text-sm font-bold">{item.name}</span>
                                          <span className={`text-[10px] font-black ${selected ? 'text-white/60' : 'text-emerald-600'}`}>{getPriceLabel(item)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </BoxSection>
                              )}

                              <button onClick={saveDraftBox} disabled={!boxDraft.name}
                                className="w-full py-3.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                                <Check size={14} />
                                {editingBoxId === 'NEW' ? 'Add Box to Order' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={startNewBox}
                            className="w-full py-4 border-2 border-dashed border-stone-300 rounded-xl text-stone-400 hover:border-stone-900 hover:text-stone-900 transition-all flex items-center justify-center gap-2 text-sm font-bold">
                            <Plus size={16} />
                            Add {boxes.length > 0 ? 'Another' : 'a'} Box
                          </button>
                        )}
                      </div>
                    </Section>
                  )}

                  {/* TACO BAR / PERSONAL / FOODA */}
                  {form.eventType !== 'BIRD_BOX' && steps.map((cat, idx) => {
                    const items    = grouped[cat] || [];
                    const isActive = idx <= currentStep;
                    const isDone   = completedSteps.has(idx);
                    const isLast   = idx === steps.length - 1;
                    const selected = selectedItems.filter(i => i.category === cat);
                    const required = STEP_REQUIRED.has(cat);

                    if (!isActive || items.length === 0) return null;

                    return (
                      <div key={cat} ref={el => { stepRefs.current[idx] = el; }}>
                        <Section
                          title={STEP_LABELS[cat] || cat}
                          icon={<Utensils size={16} />}
                          status={isDone ? 'done' : 'active'}
                          badge={required ? 'Required' : 'Optional'}
                          selectedCount={selected.length}
                          accentColor={CATEGORY_COLORS[cat]}
                        >
                          <div className="space-y-2">
                            {items.map(item => {
                              const sel        = isSelected(item.id);
                              const isSingle   = SINGLE_SELECT.has(item.category);
                              const priceLabel = getPriceLabel(item);
                              return (
                                <button key={item.id} onClick={() => toggleItem(item)}
                                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-left ${
                                    sel ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-900 border-stone-200 hover:border-stone-400'
                                  }`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    {sel && !isSingle && (
                                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => updateQty(item.id, -1)}
                                          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
                                          <Minus size={10} />
                                        </button>
                                        <span className="text-[11px] font-black w-4 text-center">
                                          {selectedItems.find(i => i.menuItemId === item.id)?.quantity || 1}
                                        </span>
                                        <button onClick={() => updateQty(item.id, 1)}
                                          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
                                          <Plus size={10} />
                                        </button>
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold truncate">{item.name}</p>
                                      {item.description && (
                                        <p className={`text-[10px] mt-0.5 truncate ${sel ? 'text-white/50' : 'text-stone-400'}`}>
                                          {item.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-black shrink-0 ml-3 ${
                                    sel ? 'text-white/60' : priceLabel === 'Included' ? 'text-emerald-600' : 'text-stone-400'
                                  }`}>
                                    {priceLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {!isLast && (
                            <div className="flex gap-3 mt-4">
                              {(canAdvance(idx) || !required) && (
                                <button onClick={advanceStep}
                                  className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                    canAdvance(idx)
                                      ? 'bg-stone-900 text-white hover:bg-red-600'
                                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                  }`}>
                                  {canAdvance(idx) ? `Next: ${STEP_LABELS[steps[idx + 1]] || 'Continue'}` : 'Skip →'}
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </Section>
                      </div>
                    );
                  })}

                  {/* CREATE BUTTON */}
                  <div className="pb-8">
                    {error && (
                      <p className="mb-4 p-3 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100">
                        {error}
                      </p>
                    )}
                    <button onClick={handleSave}
                      disabled={saving || (form.eventType === 'BIRD_BOX' ? boxes.length === 0 : selectedItems.length === 0)}
                      className="w-full py-4 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating Order...
                        </>
                      ) : (
                        <>
                          <ShoppingBag size={15} />
                          Create Order{totalAmount > 0 ? ` — $${totalAmount.toFixed(2)}` : ''}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Section({
  title, icon, status, children, onEdit, badge, selectedCount, accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  status: 'active' | 'done' | 'locked';
  children: React.ReactNode;
  onEdit?: () => void;
  badge?: string;
  selectedCount?: number;
  accentColor?: string;
}) {
  void accentColor;
  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      status === 'active' ? 'border-stone-900 bg-white shadow-lg' :
      status === 'done'   ? 'border-stone-200 bg-white' :
      'border-stone-100 bg-stone-50 opacity-50'
    }`}>
      <div className={`flex items-center justify-between px-5 py-4 ${status === 'active' ? 'border-b border-stone-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
            status === 'done'   ? 'bg-emerald-500 text-white' :
            status === 'active' ? 'bg-stone-900 text-white' :
            'bg-stone-200 text-stone-400'
          }`}>
            {status === 'done' ? <Check size={13} /> : icon}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">{title}</h2>
            {badge && status === 'active' && (
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                badge === 'Required' ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-500'
              }`}>
                {badge}
              </span>
            )}
            {selectedCount !== undefined && selectedCount > 0 && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                {selectedCount} selected
              </span>
            )}
          </div>
        </div>
        {onEdit && status === 'done' && (
          <button onClick={onEdit}
            className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-1">
            <Edit2 size={11} /> Edit
          </button>
        )}
      </div>
      {status !== 'locked' && (
        <div className={status === 'active' ? 'p-5' : 'px-5 py-4'}>
          {children}
        </div>
      )}
    </div>
  );
}

function BoxSection({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{label}</p>
      </div>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 rounded-xl px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-stone-900 truncate">{value}</p>
    </div>
  );
}