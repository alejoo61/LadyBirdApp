// src/services/fulfillment/shared/UtensilContextBuilder.js
//
// Single source of truth for paper goods / utensil context.
// Used by ALL event calculators — Taco Bar, Bird Box, Personal Box.
//
// Rules from operations document:
// ALWAYS (based on what's in the order):
//   Spoon Small  — 1 per 6oz salsa + 1 per salad dressing + cotija
//   Fork Serving — 2 per salad
//   Spoon Serving— 1 per: guac, esquites, black beans, pico, potato, refried beans, eggs, sv chicken, chorizo
//   Tong Small   — 1 per tortilla type + avocado slices, pickled onions, shredded cheese, cabbage
//   Tong Large   — 1 per TYPE present: chips, bunuelos, rajas, brisket, adobo, bacon
//   Ladle        — queso + 1 per 16/32oz salsa
//
// ONLY IF CLIENT REQUESTED PAPER GOODS (wantsPaper: true):
//   Taco Boats   — guests + 5 (double if queso/guac/bunuelos)
//   Napkins      — guests × 2.5
//   Fork Small   — guests + 5
//
// ─── REGLAS POR EVENTO ────────────────────────────────────────────────────
//
// TACO BAR:
//   Todos los ingredientes triggerean utensils (self-service en bandejas).
//
// BIRD BOX:
//   Tacos pre-armados. Solo triggerean utensils:
//   - tortillas  → Tong Small
//   - salsas standalone → Ladle / Spoon Small
//   - addons standalone (Bunuelos, Chips) → Tong Large
//   - salads → Fork Serving, Spoon Small
//   NO se pasan combo ingredients — van dentro del taco.
//
// PERSONAL BOX:
//   Similar a Bird Box. wantsPaper=true siempre (Fork Small + Napkins per box).
//
// ─── IMPORTANTE: Churro Chips / Bunuelos ─────────────────────────────────
// "Churro Chips" en Toast contiene 'chip' Y 'churro'.
// hasBunuelos matchea 'churro' → Tong Large +1
// hasChips    matchea 'chip'   → Tong Large +1  ← DOBLE CONTEO
//
// Fix: hasChips excluye nombres que también son bunuelos/churros.
// Solo cuenta 'chip' si el nombre NO incluye 'churro' ni 'bunuelo'.

function buildUtensilContext({
  proteins   = [],
  toppings   = [],
  salsas     = [],
  tortillas  = [],
  snacks     = [],
  addons     = [],
  salads     = [],
  tacoRows   = [],
  extraNames = [],
  wantsPaper = false,
} = {}) {

  // Todos los nombres aplanados. extraNames filtra falsy para evitar '' matchee todo.
  const nameLcs = [
    ...proteins.map(i   => (i.name || '').toLowerCase()),
    ...toppings.map(i   => (i.name || '').toLowerCase()),
    ...salsas.map(i     => (i.name || '').toLowerCase()),
    ...snacks.map(i     => (i.name || '').toLowerCase()),
    ...addons.map(i     => (i.name || '').toLowerCase()),
    ...tortillas.map(i  => (i.name || '').toLowerCase()),
    ...salads.map(i     => (i.name || '').toLowerCase()),
    ...tacoRows.map(t   => (t.name || '').toLowerCase()),
    ...extraNames.filter(Boolean).map(n => n.toLowerCase()),
  ];

  // has() — boolean, detecta si algún nombre contiene alguno de los keywords
  const has = (...keywords) => nameLcs.some(n => keywords.some(k => n.includes(k)));

  // ── Salsa packaging breakdown ─────────────────────────────────────────────
  const salsaSmall = salsas.filter(s => (s.packaging || '').toLowerCase().includes('6 oz')).length;
  const salsaLarge = salsas.filter(s => {
    const p = (s.packaging || '').toLowerCase();
    return p.includes('16 oz') || p.includes('32 oz');
  }).length;

  // ── Tong Small triggers ───────────────────────────────────────────────────
  const hasTortillaFlour  = tortillas.some(t => (t.name || '').toLowerCase().includes('flour'));
  const hasTortillaCorn   = tortillas.some(t => (t.name || '').toLowerCase().includes('corn'));
  const hasAvocado        = has('avocado');
  const hasPickledOnions  = has('pickled onion');
  const hasShredredCheese = has('shredded cheese', 'monterrey jack');
  const hasCabbage        = has('cabbage');

  const tongSmallQty =
    (hasTortillaFlour   ? 1 : 0) +
    (hasTortillaCorn    ? 1 : 0) +
    (hasAvocado         ? 1 : 0) +
    (hasPickledOnions   ? 1 : 0) +
    (hasShredredCheese  ? 1 : 0) +
    (hasCabbage         ? 1 : 0);

  // ── Tong Large triggers ───────────────────────────────────────────────────
  // ⚠ hasChips: excluir nombres que contienen 'churro' o 'bunuelo' para evitar
  //   doble conteo cuando el item en Toast se llama "Churro Chips".
  //   "Churro Chips" es Bunuelos — triggerean UN solo Tong Large via hasBunuelos.
  const hasChips = nameLcs.some(n =>
    n.includes('chip') && !n.includes('churro') && !n.includes('bunuelo') && !n.includes('buñuelo')
  );
  const hasBunuelos = has('bunuelo', 'buñuelo', 'churro');
  const hasRajas    = has('rajas');
  const hasBrisket  = has('brisket');
  const hasAdobo    = has('adobo');
  const hasBacon    = has('bacon');

  const tongLargeQty =
    (hasChips    ? 1 : 0) +
    (hasBunuelos ? 1 : 0) +
    (hasRajas    ? 1 : 0) +
    (hasBrisket  ? 1 : 0) +
    (hasAdobo    ? 1 : 0) +
    (hasBacon    ? 1 : 0);

  // ── Spoon Serving triggers ────────────────────────────────────────────────
  const SPOON_SERVING_KEYWORDS = [
    'guacamole', 'guac', 'esquites', 'black beans', 'pico',
    'potato', 'refried beans', 'scrambled eggs', 'egg',
    'salsa verde braised chicken', 'chorizo',
  ];
  const spoonServingCount = SPOON_SERVING_KEYWORDS.filter(k =>
    nameLcs.some(n => n.includes(k))
  ).length;

  // ── Spoon Small triggers ──────────────────────────────────────────────────
  const hasCotija     = has('cotija');
  const spoonSmallQty = salsaSmall + salads.length + (hasCotija ? 1 : 0);

  // ── Ladle triggers ────────────────────────────────────────────────────────
  const hasQueso = has('queso');
  const ladleQty = (hasQueso ? 1 : 0) + salsaLarge;

  // ── Fork Serving ──────────────────────────────────────────────────────────
  const forkServingQty = salads.length * 2;

  // ── Flags para boat doubling ──────────────────────────────────────────────
  const hasGuac = has('guacamole', 'guac');

  return {
    wantsPaper,
    // Tong Small
    tongSmallQty,
    hasTortillaFlour, hasTortillaCorn,
    hasAvocado, hasPickledOnions, hasShredredCheese, hasCabbage,
    // Tong Large
    tongLargeQty,
    hasChips, hasBunuelos, hasRajas, hasBrisket, hasAdobo, hasBacon,
    // Ladle
    ladleQty, hasQueso, salsaLargeCount: salsaLarge,
    // Spoon Small
    spoonSmallQty, salsaCount: salsaSmall, dressingCount: salads.length,
    // Spoon Serving
    spoonServingCount,
    // Fork Serving
    forkServingQty, saladCount: salads.length,
    // Boat doubling
    hasGuac, hasBunuelos,
  };
}

module.exports = { buildUtensilContext }; 