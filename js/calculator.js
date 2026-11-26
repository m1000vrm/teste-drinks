/**
 * Cocktail Planner Pro — motor de cálculo.
 * Módulo puro (sin DOM): recibe datos y devuelve resultados. Se prueba en Node con `npm test`.
 *
 * Fórmula base de porciones (estimación):
 *   porciones = invitados × % consumidores × cócteles por persona cada 4 h × factor del evento × horas / 4
 */

export const EPS = 1e-9;

export const EVENT_TYPES = [
  { id: 'cumpleanos', name: 'Aniversário' },
  { id: 'bodas', name: 'Casamento' },
  { id: 'familiar', name: 'Reunião de família' },
  { id: 'corporativo', name: 'Evento corporativo' },
  { id: 'casa', name: 'Festa em casa' },
  { id: 'otro', name: 'Outros eventos' }
];

export const PROFILES = [
  { id: 'bajo', name: 'Baixo' },
  { id: 'moderado', name: 'Moderado' },
  { id: 'alto', name: 'Alto' }
];

/** Parámetros por defecto. Todos son estimaciones editables por el usuario. */
export const DEFAULT_PARAMS = Object.freeze({
  /** Cócteles por persona en un evento de 4 horas, según el perfil de consumo. */
  rates: { bajo: 2, moderado: 3, alto: 4 },
  /** Multiplicador por tipo de celebración (1 = sin ajuste). */
  eventFactors: { cumpleanos: 1, bodas: 1.1, familiar: 0.9, corporativo: 0.8, casa: 1, otro: 1 },
  /** Hielo extra para enfriar botellas y latas, en kg por invitado. */
  coolingIceKgPerGuest: 0.3,
  /** Agua para hidratación, en ml por invitado por hora (consumo responsable). */
  waterMlPerGuestPerHour: 125,
  /** Vasos por invitado (0 = no incluir). */
  cupsPerGuest: 2,
  /** Servilletas por cóctel (0 = no incluir). */
  napkinsPerDrink: 1,
  /** Pajitas por cóctel servido con pajita (0 = no incluir). */
  strawsPerDrink: 1
});

export class PlanError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'PlanError';
    this.field = field;
  }
}

export function mergeParams(custom = {}) {
  return {
    ...DEFAULT_PARAMS,
    ...custom,
    rates: { ...DEFAULT_PARAMS.rates, ...(custom.rates || {}) },
    eventFactors: { ...DEFAULT_PARAMS.eventFactors, ...(custom.eventFactors || {}) }
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Valida los datos del evento. Devuelve { campo: mensaje } (vacío si todo está bien). */
export function validateEvent(event) {
  const e = {};
  const g = event?.guests;
  if (!isNum(g) || !Number.isInteger(g)) e.guests = 'Informe o número de convidados com um número inteiro.';
  else if (g < 1) e.guests = 'É preciso ter pelo menos 1 convidado.';
  else if (g > 5000) e.guests = 'O máximo é de 5000 convidados.';

  const h = event?.hours;
  if (!isNum(h)) e.hours = 'Informe a duração do evento em horas.';
  else if (h < 1) e.hours = 'A duração mínima é de 1 hora.';
  else if (h > 24) e.hours = 'A duração máxima é de 24 horas.';

  if (!EVENT_TYPES.some((t) => t.id === event?.type)) e.type = 'Escolha o tipo de celebração.';
  if (!PROFILES.some((p) => p.id === event?.profile)) e.profile = 'Escolha o perfil de consumo.';

  const a = event?.alcoholPct;
  if (!isNum(a) || a < 0 || a > 100) e.alcoholPct = 'A porcentagem de convidados que bebem álcool deve estar entre 0 e 100.';

  const m = event?.marginPct;
  if (!isNum(m) || m < 0 || m > 100) e.marginPct = 'A margem de segurança deve estar entre 0 e 100%.';
  return e;
}

export function validateParams(params) {
  const e = {};
  for (const p of PROFILES) {
    const r = params.rates[p.id];
    if (!isNum(r) || r < 0 || r > 20) e[`rate_${p.id}`] = `O consumo do perfil ${p.name.toLowerCase()} deve estar entre 0 e 20 coquetéis.`;
  }
  for (const t of EVENT_TYPES) {
    const f = params.eventFactors[t.id];
    if (!isNum(f) || f < 0.1 || f > 3) e[`factor_${t.id}`] = `O fator de "${t.name}" deve estar entre 0,1 e 3.`;
  }
  const ranges = {
    coolingIceKgPerGuest: [0, 5, 'O gelo para gelar bebidas deve estar entre 0 e 5 kg por convidado.'],
    waterMlPerGuestPerHour: [0, 2000, 'A água por convidado deve estar entre 0 e 2000 ml por hora.'],
    cupsPerGuest: [0, 20, 'Os copos por convidado devem estar entre 0 e 20.'],
    napkinsPerDrink: [0, 5, 'Os guardanapos por coquetel devem estar entre 0 e 5.'],
    strawsPerDrink: [0, 5, 'Os canudos por coquetel devem estar entre 0 e 5.']
  };
  for (const [k, [min, max, msg]] of Object.entries(ranges)) {
    if (!isNum(params[k]) || params[k] < min || params[k] > max) e[k] = msg;
  }
  return e;
}

/** Porciones estimadas sin redondear, separadas en con y sin alcohol. */
export function estimateServings(event, params, { hasAlcohol, hasNonAlcohol }) {
  const perPerson = params.rates[event.profile] * params.eventFactors[event.type] * (event.hours / 4);
  const share = event.alcoholPct / 100;
  const alcohol = hasAlcohol ? event.guests * share * perPerson : 0;
  // Los no consumidores de alcohol toman cócteles sin alcohol.
  // Si no se eligió ningún cóctel con alcohol, todos los invitados toman sin alcohol.
  const nonAlcoholShare = hasAlcohol ? 1 - share : 1;
  const nonAlcohol = hasNonAlcohol ? event.guests * nonAlcoholShare * perPerson : 0;
  return { perPerson, alcohol, nonAlcohol };
}

export const ceilSafe = (x) => Math.ceil(x - EPS);

/**
 * Reparte `total` porciones enteras según pesos (método del mayor resto).
 * La suma siempre es exactamente `total`. Pesos todos en 0 => reparto igual.
 */
export function distribute(total, entries) {
  if (!entries.length) return [];
  let weights = entries.map((e) => (isNum(e.weight) && e.weight > 0 ? e.weight : 0));
  let sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    weights = entries.map(() => 1);
    sum = entries.length;
  }
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map((r) => Math.floor(r + EPS));
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i], w: weights[i] }))
    .filter((o) => o.w > 0)
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) floors[order[k].i] += 1;
  return entries.map((e, i) => ({ id: e.id, portions: floors[i], share: weights[i] / sum }));
}

/** Resuelve el artículo de compra de un ingrediente de receta, sin mezclar unidades. */
export function resolvePurchase(ingredientId, qty, catalog) {
  const ing = catalog.items[ingredientId];
  if (!ing) throw new PlanError(`Ingrediente desconhecido no catálogo: "${ingredientId}".`);
  if (ing.buyAs) {
    const target = catalog.items[ing.buyAs.item];
    if (!target) throw new PlanError(`A regra de compra de "${ing.name}" aponta para um item inexistente.`);
    if (!target.package) throw new PlanError(`"${target.name}" não tem embalagem comercial definida.`);
    if (!isNum(ing.buyAs.factor) || ing.buyAs.factor <= 0) throw new PlanError(`Fator de conversão inválido em "${ing.name}".`);
    return { itemId: ing.buyAs.item, qty: qty * ing.buyAs.factor, unit: target.unit, rule: ing.buyAs.rule };
  }
  if (!ing.package) throw new PlanError(`"${ing.name}" não tem embalagem comercial nem regra de conversão.`);
  if (ing.package.unit && ing.package.unit !== ing.unit) {
    throw new PlanError(`Unidades incompatíveis em "${ing.name}": ${ing.unit} vs ${ing.package.unit}.`);
  }
  return { itemId: ingredientId, qty, unit: ing.unit, rule: null };
}

/**
 * Calcula el plan completo.
 * @param {object} input
 * @param {object} input.event  { guests, hours, type, profile, alcoholPct, marginPct }
 * @param {Array}  input.selection [{ id, weight }]
 * @param {Array}  input.recipes  catálogo de recetas
 * @param {object} input.catalog  catálogo de ingredientes
 * @param {object} [input.params] parámetros personalizados
 */
export function calculatePlan({ event, selection, recipes, catalog, params: customParams }) {
  const params = mergeParams(customParams);
  const errors = { ...validateEvent(event), ...validateParams(params) };
  const firstError = Object.entries(errors)[0];
  if (firstError) throw new PlanError(firstError[1], firstError[0]);
  if (!Array.isArray(selection) || selection.length === 0) {
    throw new PlanError('Selecione pelo menos um coquetel para calcular.', 'selection');
  }

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const seen = new Set();
  const chosen = [];
  for (const s of selection) {
    const r = byId.get(s.id);
    if (!r) throw new PlanError(`Receita desconhecida: "${s.id}".`, 'selection');
    if (seen.has(s.id)) continue; // evita duplicados en la selección
    seen.add(s.id);
    chosen.push({ recipe: r, weight: s.weight });
  }
  const alc = chosen.filter((c) => c.recipe.type === 'alcohol');
  const sin = chosen.filter((c) => c.recipe.type !== 'alcohol');

  const est = estimateServings(event, params, { hasAlcohol: alc.length > 0, hasNonAlcohol: sin.length > 0 });
  const alcoholTotal = ceilSafe(est.alcohol);
  const nonAlcoholTotal = ceilSafe(est.nonAlcohol);

  const warnings = [];
  if (alc.length && event.alcoholPct === 0) {
    warnings.push('Você escolheu coquetéis com álcool, mas a porcentagem de quem bebe é 0%: nenhuma dose com álcool foi calculada.');
  }
  if (alc.length && !sin.length && event.alcoholPct < 100) {
    warnings.push('Você não escolheu nenhum coquetel sem álcool. Recomendamos incluir pelo menos uma opção sem álcool para quem não bebe.');
  }

  const dist = [
    ...distribute(alcoholTotal, alc.map((c) => ({ id: c.recipe.id, weight: c.weight }))),
    ...distribute(nonAlcoholTotal, sin.map((c) => ({ id: c.recipe.id, weight: c.weight })))
  ];
  const portionsById = new Map(dist.map((d) => [d.id, d]));

  const perRecipe = chosen.map(({ recipe }) => {
    const d = portionsById.get(recipe.id);
    return { id: recipe.id, name: recipe.name, type: recipe.type, glass: recipe.glass, portions: d.portions, share: d.share };
  });

  // 1) Ingredientes por receta (unidades de receta) y 2) consolidación por artículo de compra.
  const items = new Map();
  const addToItem = (itemId, qty, source) => {
    if (qty <= 0) return;
    const def = catalog.items[itemId];
    let it = items.get(itemId);
    if (!it) {
      it = { id: itemId, name: def.name, category: def.category, unit: def.unit, net: 0, sources: [] };
      items.set(itemId, it);
    }
    if (it.unit !== def.unit) throw new PlanError(`Unidades incompatíveis ao consolidar "${def.name}".`);
    it.net += qty;
    it.sources.push(source);
  };

  for (const { recipe } of chosen) {
    const portions = portionsById.get(recipe.id).portions;
    if (!portions) continue;
    for (const ing of recipe.ingredients) {
      if (!isNum(ing.qty) || ing.qty < 0) throw new PlanError(`Quantidade inválida de "${ing.id}" em "${recipe.name}".`);
      const recipeQty = ing.qty * portions;
      const p = resolvePurchase(ing.id, recipeQty, catalog);
      addToItem(p.itemId, p.qty, {
        kind: 'receta', recipeId: recipe.id, recipe: recipe.name,
        ingredient: catalog.items[ing.id].name, qty: recipeQty, unit: catalog.items[ing.id].unit, rule: p.rule
      });
    }
  }

  const totalDrinks = perRecipe.reduce((a, r) => a + r.portions, 0);
  const strawDrinks = perRecipe.reduce((a, r) => a + (byId.get(r.id).visual?.straw ? r.portions : 0), 0);

  // Extras configurables
  const extra = (itemId, qty, label) => addToItem(itemId, qty, { kind: 'extra', ingredient: label, qty, unit: catalog.items[itemId].unit });
  if (totalDrinks > 0) {
    extra('hielo', event.guests * params.coolingIceKgPerGuest * 1000, 'Gelo para gelar bebidas');
    extra('agua_hidratacion', event.guests * event.hours * params.waterMlPerGuestPerHour, 'Água para os convidados');
    extra('vasos', event.guests * params.cupsPerGuest, 'Copos por convidado');
    extra('servilletas', totalDrinks * params.napkinsPerDrink, 'Guardanapos por coquetel');
    extra('pajitas', strawDrinks * params.strawsPerDrink, 'Canudos por coquetel');
  }

  // 3) Margen de seguridad, 4) presentaciones comerciales redondeadas hacia arriba.
  const factor = 1 + event.marginPct / 100;
  const categoryOrder = new Map(catalog.categories.map((c) => [c.id, c.order]));
  const list = [...items.values()].map((it) => {
    const def = catalog.items[it.id];
    const required = it.net * factor;
    const packages = ceilSafe(required / def.package.size);
    const purchased = packages * def.package.size;
    const approxKg = def.unitWeightG ? (required * def.unitWeightG) / 1000 : null;
    return {
      ...it,
      required,
      packageSize: def.package.size,
      packageLabel: def.package.label,
      packageKind: def.package.kind,
      packages,
      purchased,
      leftover: purchased - required,
      approxKg
    };
  }).sort((a, b) => (categoryOrder.get(a.category) - categoryOrder.get(b.category)) || a.name.localeCompare(b.name, 'es'));

  // Cristalería y equipo
  const glassware = new Map();
  for (const r of perRecipe) {
    if (!r.portions) continue;
    glassware.set(r.glass, (glassware.get(r.glass) || 0) + r.portions);
  }
  const equipment = new Set(['hielera']);
  for (const { recipe } of chosen) {
    if (portionsById.get(recipe.id).portions) (recipe.tools || []).forEach((t) => equipment.add(t));
  }

  const kindCount = (kinds) => list.filter((i) => kinds.includes(i.packageKind)).reduce((a, i) => a + i.packages, 0);
  const iceItem = list.find((i) => i.id === 'hielo');

  return {
    event: { ...event },
    params,
    estimate: { perPerson: est.perPerson, alcoholRaw: est.alcohol, nonAlcoholRaw: est.nonAlcohol },
    totals: {
      drinks: totalDrinks,
      alcohol: perRecipe.filter((r) => r.type === 'alcohol').reduce((a, r) => a + r.portions, 0),
      nonAlcohol: perRecipe.filter((r) => r.type !== 'alcohol').reduce((a, r) => a + r.portions, 0),
      bottles: kindCount(['botella']),
      alcoholBottles: list.filter((i) => i.category === 'alcohol').reduce((a, i) => a + i.packages, 0),
      cans: kindCount(['lata']),
      packs: kindCount(['paquete', 'bolsa']),
      others: kindCount(['envase', 'unidad']),
      iceKg: iceItem ? iceItem.required / 1000 : 0,
      iceBags: iceItem ? iceItem.packages : 0,
      fruitItems: list.filter((i) => i.category === 'frutas').reduce((a, i) => a + i.packages, 0)
    },
    perRecipe,
    items: list,
    glassware: [...glassware.entries()].map(([id, count]) => ({ id, name: catalog.glasses?.[id]?.name || id, count })),
    equipment: [...equipment].map((id) => ({ id, name: catalog.equipment?.[id]?.name || id })),
    warnings
  };
}
