'use client';

import { useState, useEffect, useCallback } from 'react';
import { menuApi } from '@/services/api/menuApi';
import { cateringApi } from '@/services/api/cateringApi';
import type { CateringOrder, CateringOrderItem } from '@/services/api/cateringApi';
import type { MenuItem } from '@/services/api/menuApi';
import type { Store } from '@/services/api/storesApi';
import { X, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface ApiError {
  response?: { data?: { error?: string } };
}

const EVENT_TYPES      = ['TACO_BAR', 'BIRD_BOX', 'PERSONAL_BOX', 'FOODA', 'NEEDS_REVIEW'];
const DELIVERY_METHODS = ['PICKUP', 'DELIVERY'];
const STATUSES         = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['OPEN', 'PAID', 'CLOSED'];

const CATEGORY_LABELS: Record<string, string> = {
  menu_item:   'Event Package',
  size:        'Box Size',
  combo:       'Combos',
  protein:     'Proteins',
  topping:     'Toppings',
  salsa:       'Salsas',
  tortilla:    'Tortilla',
  snack:       'Snacks',
  chips_salsa: 'Chips & Salsa',
  paper:       'Paper Goods',
  drink:       'Drinks',
  drink_cups:  'Cups & Lids',
  creamer:     'Creamers',
};

const CATEGORY_COLORS: Record<string, string> = {
  menu_item:   'bg-night/10 text-night border-night/20',
  size:        'bg-sky-100 text-sky-700 border-sky-200',
  combo:       'bg-rose-100 text-rose-600 border-rose-200',
  protein:     'bg-red-100 text-red-600 border-red-200',
  topping:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  salsa:       'bg-orange-100 text-orange-600 border-orange-200',
  tortilla:    'bg-purple-100 text-purple-600 border-purple-200',
  snack:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  chips_salsa: 'bg-amber-100 text-amber-700 border-amber-200',
  paper:       'bg-stone-100 text-stone-600 border-stone-200',
  drink:       'bg-blue-100 text-blue-600 border-blue-200',
  drink_cups:  'bg-blue-50 text-blue-500 border-blue-100',
  creamer:     'bg-stone-100 text-stone-600 border-stone-200',
};

const SINGLE_SELECT           = new Set(['tortilla', 'chips_salsa', 'paper', 'drink_cups', 'size', 'menu_item']);
const PRICE_PER_PERSON_CATS   = new Set(['protein', 'topping', 'salsa', 'tortilla', 'snack', 'paper', 'menu_item']);

function formatDatetimeLocal(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SelectedItem {
  menuItemId:  string;
  displayName: string;
  quantity:    number;
  price:       number;
  category:    string;
  modifiers:   CateringOrderItem['modifiers'];
}

export default function EditOrderModal({
  order, stores, onClose, onSave,
}: {
  order: CateringOrder; stores: Store[]; onClose: () => void; onSave: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  const [form, setForm] = useState({
    storeId:                  order.storeId || '',
    eventType:                order.eventType || 'TACO_BAR',
    status:                   order.status || 'pending',
    paymentStatus:            order.paymentStatus || 'OPEN',
    clientName:               order.clientName || '',
    clientEmail:              order.clientEmail || '',
    clientPhone:              order.clientPhone || '',
    estimatedFulfillmentDate: formatDatetimeLocal(order.estimatedFulfillmentDate),
    deliveryMethod:           order.deliveryMethod || 'PICKUP',
    deliveryAddress:          order.deliveryAddress || '',
    deliveryNotes:            order.deliveryNotes || '',
    guestCount:               order.guestCount || 0,
    totalAmount:              parseFloat(String(order.totalAmount)) || 0,
    overrideNotes:            order.overrideNotes || '',
  });

  // Inicializar items seleccionados desde la orden existente
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(() =>
    (order.items || []).map(item => ({
      menuItemId:  item.guid,
      displayName: item.displayName,
      quantity:    item.quantity,
      price:       item.price,
      category:    'modifier', // default, se actualiza al cargar el menú
      modifiers:   item.modifiers || [],
    }))
  );

  const [menuItems, setMenuItems]     = useState<MenuItem[]>([]);
  const [baseItem, setBaseItem]       = useState<MenuItem | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const loadMenu = useCallback(async (eventType: string) => {
    setLoadingMenu(true);
    try {
      const res = await menuApi.getForOrderCreation(eventType);
      setMenuItems(res.data.data);
      setBaseItem(res.data.baseItem || null);
      const cats = new Set(res.data.data.map((i: MenuItem) => i.category));
      setExpandedCats(cats);

      // Actualizar categorías de los items ya seleccionados
      const menuMap = new Map(res.data.data.map((i: MenuItem) => [i.id, i]));
      setSelectedItems(prev => prev.map(item => {
        const menuItem = menuMap.get(item.menuItemId);
        return menuItem ? { ...item, category: menuItem.category } : item;
      }));
    } catch (err) { console.error(err); }
    finally { setLoadingMenu(false); }
  }, []);

  useEffect(() => {
    if (step === 2) loadMenu(form.eventType);
  }, [step, form.eventType, loadMenu]);

  const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const isSelected = (itemId: string) => selectedItems.some(i => i.menuItemId === itemId);

  const toggleItem = (item: MenuItem) => {
    const isSingle = SINGLE_SELECT.has(item.category);
    setSelectedItems(prev => {
      const filtered = isSingle
        ? prev.filter(i => i.category !== item.category)
        : prev.filter(i => i.menuItemId !== item.id);
      if (!isSingle && prev.some(i => i.menuItemId === item.id)) return filtered;
      if (isSingle && prev.some(i => i.menuItemId === item.id)) return filtered;
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

  const updateQty = (itemId: string, delta: number) => {
    setSelectedItems(prev => prev.map(i =>
      i.menuItemId !== itemId ? i : { ...i, quantity: Math.max(1, i.quantity + delta) }
    ));
  };

  const guestCount = Number(form.guestCount) || 1;

  const calculateTotal = (): number => {
    let total = 0;
    if (baseItem && Number(baseItem.price) > 0) {
      total += Number(baseItem.price) * guestCount;
    }
    for (const item of selectedItems) {
      const price = Number(item.price) || 0;
      if (price === 0) continue;
      if (PRICE_PER_PERSON_CATS.has(item.category)) {
        total += price * guestCount * item.quantity;
      } else {
        total += price * item.quantity;
      }
    }
    return total;
  };

  const getPriceLabel = (item: MenuItem): string => {
    const price = Number(item.price);
    if (price === 0) return 'Included';
    if (PRICE_PER_PERSON_CATS.has(item.category)) return `+$${price.toFixed(2)}/person`;
    return `$${price.toFixed(2)}`;
  };

  const handleSave = async () => {
    if (!form.clientName || !form.eventType || !form.estimatedFulfillmentDate) {
      setError('Client name, event type and event date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const computedTotal = step === 2 ? calculateTotal() : form.totalAmount;
      const parsedData = step === 2 ? {
        items: selectedItems.map(i => ({
          guid:        i.menuItemId,
          displayName: i.displayName,
          quantity:    i.quantity,
          price:       i.price,
          modifiers:   i.modifiers,
        })),
        isManualOrder: true,
        baseItem: baseItem ? { name: baseItem.name, price: baseItem.price } : null,
      } : undefined;

      await cateringApi.updateManual(order.id, {
        ...form,
        estimatedFulfillmentDate: new Date(form.estimatedFulfillmentDate).toISOString(),
        guestCount:  Number(form.guestCount),
        totalAmount: String(computedTotal.toFixed ? computedTotal.toFixed(2) : computedTotal),
        ...(parsedData ? { parsedData } : {}),
      } as never);
      onSave();
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Error saving order');
    } finally { setSaving(false); }
  };

  const inputCls  = 'w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night';
  const selectCls = inputCls + ' cursor-pointer';
  const labelCls  = 'text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block';
  const totalAmount = calculateTotal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-4 shrink-0">
          <div>
            <h3 className="text-xl font-black text-night uppercase italic tracking-tight">Edit Order</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${step === 1 ? 'bg-night text-bone' : 'bg-bone text-night/40'}`}>
                1. Order Info
              </span>
              <span className="text-night/20 text-xs">→</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${step === 2 ? 'bg-night text-bone' : 'bg-bone text-night/40'}`}>
                2. Items
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-night/30 hover:text-rose transition-colors rounded-xl hover:bg-rose/10">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-8 pb-4 space-y-5 flex-1">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
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
                    {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}
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
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                    className={inputCls} />
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
                    onChange={e => set('guestCount', e.target.value)} className={inputCls} min={0} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Delivery Method</label>
                  <select value={form.deliveryMethod} onChange={e => set('deliveryMethod', e.target.value)} className={selectCls}>
                    {DELIVERY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Total Amount ($)</label>
                  <input type="number" step="0.01" value={form.totalAmount}
                    onChange={e => set('totalAmount', parseFloat(e.target.value) || 0)} className={inputCls} min={0} />
                </div>
              </div>
              {form.deliveryMethod === 'DELIVERY' && (
                <div>
                  <label className={labelCls}>Delivery Address</label>
                  <input type="text" value={form.deliveryAddress}
                    onChange={e => set('deliveryAddress', e.target.value)} className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Delivery Notes</label>
                <textarea value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)}
                  className={inputCls + ' resize-none'} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className={selectCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Payment Status</label>
                  <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)} className={selectCls}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Internal Notes</label>
                <textarea value={form.overrideNotes} onChange={e => set('overrideNotes', e.target.value)}
                  className={inputCls + ' resize-none'} rows={2} />
              </div>
            </>
          )}

          {/* ── STEP 2 — ITEMS ── */}
          {step === 2 && (
            <div className="space-y-4">
              {loadingMenu ? (
                <div className="flex justify-center py-16 text-night animate-pulse font-black uppercase tracking-widest text-sm">
                  Loading menu...
                </div>
              ) : (
                <>
                  {/* Items actuales */}
                  {selectedItems.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">
                        Selected ({selectedItems.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedItems.map(item => (
                          <div key={item.menuItemId}
                            className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-black text-night truncate max-w-[160px]">
                              {item.displayName}
                            </span>
                            {!SINGLE_SELECT.has(item.category) && (
                              <div className="flex items-center gap-1 ml-1">
                                <button onClick={() => updateQty(item.menuItemId, -1)}
                                  className="w-4 h-4 rounded-full bg-bone flex items-center justify-center hover:bg-night/10">
                                  <Minus size={9} />
                                </button>
                                <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQty(item.menuItemId, 1)}
                                  className="w-4 h-4 rounded-full bg-bone flex items-center justify-center hover:bg-night/10">
                                  <Plus size={9} />
                                </button>
                              </div>
                            )}
                            <button
                              onClick={() => setSelectedItems(prev => prev.filter(i => i.menuItemId !== item.menuItemId))}
                              className="text-night/30 hover:text-rose ml-1">
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {totalAmount > 0 && (
                        <p className="text-[11px] font-black text-emerald-700 mt-2">
                          Estimated Total: ${totalAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Menu por categoría */}
                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="border border-tumbleweed/30 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedCats(prev => {
                          const next = new Set(prev);
                          next.has(category) ? next.delete(category) : next.add(category);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-5 py-3 bg-bone hover:bg-tumbleweed/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {CATEGORY_LABELS[category] || category}
                          </span>
                          {selectedItems.filter(i => i.category === category).length > 0 && (
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {selectedItems.filter(i => i.category === category).length} selected
                            </span>
                          )}
                        </div>
                        {expandedCats.has(category)
                          ? <ChevronUp size={14} className="text-night/30" />
                          : <ChevronDown size={14} className="text-night/30" />}
                      </button>
                      {expandedCats.has(category) && (
                        <div className="p-3 grid grid-cols-1 gap-2">
                          {items.map(item => {
                            const selected   = isSelected(item.id);
                            const priceLabel = getPriceLabel(item);
                            return (
                              <button key={item.id} onClick={() => toggleItem(item)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                                  selected
                                    ? 'bg-night text-bone border-night'
                                    : 'bg-white text-night border-tumbleweed/20 hover:border-tumbleweed hover:bg-bone/50'
                                }`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black">{item.name}</span>
                                  <span className={`text-[10px] font-bold ${
                                    selected ? 'text-bone/70' : priceLabel === 'Included' ? 'text-emerald-600' : 'text-night/50'
                                  }`}>
                                    {priceLabel}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {error && (
            <p className="p-3 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-red-100">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 pt-4 flex gap-3 justify-between shrink-0 border-t border-tumbleweed/20">
          <button onClick={onClose}
            className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-bone text-night/40 hover:text-night transition-all">
            Cancel
          </button>
          <div className="flex gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)}
                className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-bone text-night/60 hover:text-night transition-all">
                ← Back
              </button>
            )}
            {step === 1 ? (
              <button onClick={() => setStep(2)}
                className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-bone text-night/60 hover:text-night transition-all">
                Edit Items →
              </button>
            ) : null}
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-night text-bone hover:bg-rose hover:text-white transition-all disabled:opacity-40">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}