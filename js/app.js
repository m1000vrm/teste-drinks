/** Cocktail Planner Pro — interfaz. */
import {
  calculatePlan, estimateServings, distribute, mergeParams, validateEvent, validateParams,
  EVENT_TYPES, PROFILES, DEFAULT_PARAMS, PlanError, ceilSafe
} from './calculator.js';
import { computeBudget, buildCSV, buildShareText, effectivePackages } from './budget.js';
import { formatQty, formatPortion, formatMoney, formatNumber, packagesLabel, CURRENCIES, currencyInfo } from './format.js';
import { loadCatalogs, norm, searchIndex } from './recipes.js';
import { cocktailSVG, logoSVG } from './illustrations.js';
import { buildPlanPDF } from './pdf.js';

/* ---------------- Estado ---------------- */
const STORAGE_KEY = 'cocktail-planner-pro:v1';
const VIEWS = ['inicio', 'evento', 'cocteles', 'proporciones', 'resultados', 'lista'];

const defaultState = () => ({
  event: { name: '', guests: 50, hours: 4, type: 'cumpleanos', profile: 'moderado', alcoholPct: 80, marginPct: 10 },
  params: structuredClone({ ...DEFAULT_PARAMS, rates: { ...DEFAULT_PARAMS.rates }, eventFactors: { ...DEFAULT_PARAMS.eventFactors } }),
  selection: [], // [{ id, weight }]
  prices: {}, overrides: {}, bought: {},
  currency: 'BRL',
  planKey: null,
  started: false
});

let state = defaultState();
let plan = null;
let DATA = null;
let filter = 'todos';
let query = '';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const d = defaultState();
    state = { ...d, ...s, event: { ...d.event, ...s.event }, params: mergeParams(s.params) };
  } catch { /* almacenamiento no disponible */ }
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  }, 150);
}

/* ---------------- Utilidades ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseNum = (v) => {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};
const recipeById = (id) => DATA.recipesById[id];
const typeName = (id) => EVENT_TYPES.find((t) => t.id === id)?.name || '';
const profileName = (id) => PROFILES.find((p) => p.id === id)?.name || '';
const catName = (id) => DATA.catalog.categories.find((c) => c.id === id)?.name || id;
const isSelected = (id) => state.selection.some((s) => s.id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toast(msg, type = 'info', ms = 3200) {
  const box = $('[data-toasts]');
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 260); }, ms);
}

function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

function art(recipe, cls = '') {
  if (recipe.photo) return `<img class="${cls}" src="${esc(recipe.photo)}" alt="${esc(recipe.name)}" loading="lazy" width="800" height="800">`;
  return cocktailSVG(recipe);
}
/** Miniatura: foto si existe, ilustración si no. */
function thumb(recipe) {
  if (recipe.photo) return `<img class="thumb-photo" src="${esc(recipe.photo)}" alt="" loading="lazy" width="800" height="800">`;
  return cocktailSVG(recipe, { bg: false });
}

const ICONS = {
  cumpleanos: '<path d="M5 21h14M6 21v-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7M6 16c2 1.2 4 1.2 6 0s4-1.2 6 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5Z"/>',
  bodas: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="m10 4 2 3 2-3"/>',
  familiar: '<circle cx="8" cy="7" r="2.5"/><circle cx="16" cy="7" r="2.5"/><circle cx="12" cy="12" r="2"/><path d="M3.5 20a4.5 4.5 0 0 1 9 0M11.5 20a4.5 4.5 0 0 1 9 0"/>',
  corporativo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  casa: '<path d="M3 11 12 4l9 7M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  otro: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
};
const icon = (name, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const CAT_ICONS = {
  alcohol: ['#174E3A', '#DDF0DF', '<path d="M10 2h4v4l1.5 3V21h-7V9L10 6Z"/><path d="M8.5 13h7"/>'],
  frutas: ['#5E9E3E', '#E6F3D9', '<circle cx="12" cy="14" r="7"/><path d="M12 7c0-2 1-3.5 3-4"/>'],
  mezcladores: ['#2C8C9A', '#DDF0F2', '<path d="M7 3h10l-1 18H8Z"/><path d="M7.5 9h9"/>'],
  complementos: ['#C9791F', '#FCEBC0', '<path d="M9 3h6v3l2 3v12H7V9l2-3Z"/><path d="M7 14h10"/>'],
  hielo: ['#3E7FAE', '#E2EFF8', '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h2M8 13l3 3"/>'],
  decoracion: ['#C2503F', '#FCDDD8', '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/>'],
  utensilios: ['#7A6A4F', '#F1EBDD', '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10"/>']
};
function catIcon(id) {
  const [fg, bg, p] = CAT_ICONS[id] || CAT_ICONS.utensilios;
  return `<span class="cat-head__icon" style="background:${bg};color:${fg}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg></span>`;
}

/* ---------------- Router ---------------- */
let currentView = 'inicio';

function canEnter(view) {
  const idx = VIEWS.indexOf(view);
  if (idx <= 1) return true;
  if (Object.keys(validateEvent(state.event)).length) return 'evento';
  if (view === 'cocteles') return true;
  if (!state.selection.length) return 'cocteles';
  return true;
}

function ensurePlan() {
  const key = planKey();
  if (plan && state.planKey === key) return true;
  try {
    const hadOverrides = Object.keys(state.overrides).length > 0;
    plan = runCalculation();
    if (state.planKey && state.planKey !== key && hadOverrides) {
      state.overrides = {};
      toast('Recalculamos a lista com os novos dados. As quantidades editadas foram restauradas.');
    }
    state.planKey = key;
    save();
    return true;
  } catch (err) {
    toast(err.message, 'error');
    return false;
  }
}

function go(view, { replace = false } = {}) {
  if (!VIEWS.includes(view)) view = 'inicio';
  const ok = canEnter(view);
  if (ok !== true) {
    if (ok === 'evento') { showEventErrors(); toast('Revise os dados do evento antes de continuar.', 'error'); }
    if (ok === 'cocteles') toast('Selecione pelo menos um coquetel para continuar.', 'error');
    view = ok;
  }
  if ((view === 'resultados' || view === 'lista') && !ensurePlan()) view = 'proporciones';
  const hash = `#${view}`;
  if (location.hash !== hash) {
    if (replace) history.replaceState(null, '', hash); else history.pushState(null, '', hash);
  }
  show(view);
}

function show(view) {
  currentView = view;
  $$('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== view; });
  document.body.classList.toggle('no-bar', view === 'inicio' || view === 'resultados' || view === 'lista');
  const idx = VIEWS.indexOf(view);
  $$('.stepper [data-go]').forEach((b) => {
    const i = VIEWS.indexOf(b.dataset.go);
    b.classList.toggle('is-current', i === idx);
    b.classList.toggle('is-done', i < idx);
    if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  $('[data-progress]').style.width = idx <= 0 ? '0%' : `${(idx / (VIEWS.length - 1)) * 100}%`;
  if (view === 'evento') renderEventForm();
  if (view === 'cocteles') renderCatalog();
  if (view === 'proporciones') renderProportions();
  if (view === 'resultados') renderResults();
  if (view === 'lista') renderShop();
  if (view !== 'inicio') { state.started = true; save(); }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  $('#main').focus({ preventScroll: true });
}

/* ---------------- Inicio ---------------- */
function renderHome() {
  $$('[data-logo]').forEach((el) => { el.innerHTML = logoSVG(36); });
  $$('[data-logo-sm]').forEach((el) => { el.innerHTML = logoSVG(30); });
  const picks = ['aperol_spritz', 'pina_colada', 'mojito'].map(recipeById);
  $('[data-hero-art]').innerHTML = `
    <div class="sun"></div>
    <svg class="leaf" viewBox="0 0 200 200" style="left:-12%;bottom:-8%;width:62%" aria-hidden="true"><path d="M30 190 C 20 120 60 50 150 20 C 140 90 110 160 30 190 Z" fill="#2E7A57"/><path d="M30 190 C 70 140 110 80 150 20" stroke="#174E3A" stroke-width="3" fill="none"/>${[40, 60, 80, 100, 120].map((p, i) => `<path d="M${40 + i * 22} ${180 - i * 34} l ${18 + i * 2} -${8 + i}" stroke="#174E3A" stroke-width="2"/>`).join('')}</svg>
    <svg class="leaf" viewBox="0 0 200 200" style="right:-14%;top:-6%;width:56%;transform:rotate(160deg)" aria-hidden="true"><path d="M30 190 C 20 120 60 50 150 20 C 140 90 110 160 30 190 Z" fill="#22644B"/><path d="M30 190 C 70 140 110 80 150 20" stroke="#174E3A" stroke-width="3" fill="none"/></svg>
    <svg class="leaf" viewBox="0 0 120 120" style="left:52%;top:42%;width:18%" aria-hidden="true"><circle cx="60" cy="60" r="34" fill="#F6A33B"/><circle cx="60" cy="60" r="28" fill="#FFE2B0"/><circle cx="60" cy="60" r="24" fill="#F8A93B"/></svg>
    <div class="hero__glasses">${picks.map((r) => cocktailSVG(r, { bg: false })).join('')}</div>
    <div class="hero__badge"><b>${formatNumber(estimateHero(), 0)}</b>coquetéis para 50 convidados<br>numa festa de 4 h</div>`;
  $('[data-action="resume"]').hidden = !state.started;
}
const estimateHero = () => {
  const e = estimateServings({ guests: 50, hours: 4, type: 'cumpleanos', profile: 'moderado', alcoholPct: 80 }, mergeParams(), { hasAlcohol: true, hasNonAlcohol: true });
  return ceilSafe(e.alcohol) + ceilSafe(e.nonAlcohol);
};

/* ---------------- Paso 1: evento ---------------- */
function buildEventForm() {
  $('[data-types]').innerHTML = EVENT_TYPES.map((t) => `
    <button type="button" class="tile" role="radio" aria-checked="false" data-type="${t.id}">
      <span class="tile__icon">${icon(t.id)}</span><span class="tile__t">${t.name}</span>
    </button>`).join('');
  $('[data-types]').setAttribute('role', 'radiogroup');
  const pd = { bajo: 'Poucas doses, ritmo tranquilo', moderado: 'O normal numa festa', alto: 'Festa longa e animada' };
  $('[data-profiles]').innerHTML = PROFILES.map((p, i) => `
    <button type="button" class="tile" role="radio" aria-checked="false" data-profile="${p.id}">
      <span><span class="tile__t">${p.name}</span><span class="tile__d" data-profile-desc="${p.id}">${pd[p.id]}</span></span>
      <span class="meter" aria-hidden="true">${[0, 1, 2].map((k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</span>
    </button>`).join('');
  $('[data-profiles]').setAttribute('role', 'radiogroup');

  const adv = [
    '<p class="advanced__group">Coquetéis por pessoa a cada 4 horas</p>',
    ...PROFILES.map((p) => numField(`rate_${p.id}`, `Perfil ${p.name.toLowerCase()}`, state.params.rates[p.id], 0, 20, 0.5)),
    '<p class="advanced__group">Ajuste por tipo de celebração (1 = sem ajuste)</p>',
    ...EVENT_TYPES.map((t) => numField(`factor_${t.id}`, t.name, state.params.eventFactors[t.id], 0.1, 3, 0.05)),
    '<p class="advanced__group">Extras</p>',
    numField('coolingIceKgPerGuest', 'Gelo para gelar bebidas (kg/convidado)', state.params.coolingIceKgPerGuest, 0, 5, 0.1),
    numField('waterMlPerGuestPerHour', 'Água (ml/convidado/hora)', state.params.waterMlPerGuestPerHour, 0, 2000, 50),
    numField('cupsPerGuest', 'Copos por convidado', state.params.cupsPerGuest, 0, 20, 1),
    numField('napkinsPerDrink', 'Guardanapos por coquetel', state.params.napkinsPerDrink, 0, 5, 1),
    numField('strawsPerDrink', 'Canudos por coquetel', state.params.strawsPerDrink, 0, 5, 1)
  ];
  $('[data-advanced]').innerHTML = adv.join('');
}
function numField(key, label, value, min, max, step) {
  return `<div class="field"><label for="p-${key}">${esc(label)}</label><input id="p-${key}" type="number" inputmode="decimal" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-describedby="err-p-${key}"><p class="error" id="err-p-${key}" role="alert"></p></div>`;
}

function renderEventForm() {
  const e = state.event;
  $('#ev-name').value = e.name;
  $('#ev-guests').value = e.guests;
  $('#ev-hours').value = e.hours;
  $('#ev-alcohol').value = e.alcoholPct;
  $('#ev-margin').value = e.marginPct;
  $$('[data-type]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === e.type)));
  $$('[data-profile]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.profile === e.profile)));
  $$('[data-param]').forEach((inp) => {
    const k = inp.dataset.param;
    inp.value = k.startsWith('rate_') ? state.params.rates[k.slice(5)] : k.startsWith('factor_') ? state.params.eventFactors[k.slice(7)] : state.params[k];
  });
  updateEventLive();
}

function updateEventLive() {
  const e = state.event;
  $$('[data-hours]').forEach((c) => c.classList.toggle('is-active', Number(c.dataset.hours) === e.hours));
  $('[data-out="alcoholPct"]').textContent = `${e.alcoholPct}%`;
  $('[data-out="marginPct"]').textContent = `${e.marginPct}%`;
  for (const id of ['ev-alcohol', 'ev-margin']) {
    const el = $(`#${id}`);
    el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  }
  for (const p of PROFILES) {
    const d = $(`[data-profile-desc="${p.id}"]`);
    if (d) d.textContent = `≈ ${formatNumber(state.params.rates[p.id], 1)} coquetéis por pessoa a cada 4 h`;
  }
  const ok = !Object.keys(validateEvent(e)).length && !Object.keys(validateParams(state.params)).length;
  const el = $('[data-live-drinks]');
  if (!ok) { el.textContent = '—'; return; }
  const types = new Set(state.selection.map((s) => recipeById(s.id)?.type));
  const flags = state.selection.length ? { hasAlcohol: types.has('alcohol'), hasNonAlcohol: types.has('sin') } : { hasAlcohol: true, hasNonAlcohol: true };
  const est = estimateServings(e, state.params, flags);
  const n = ceilSafe(est.alcohol) + ceilSafe(est.nonAlcohol);
  if (el.textContent !== formatNumber(n, 0)) { el.textContent = formatNumber(n, 0); bump(el); }
}

function showEventErrors() {
  const errs = validateEvent(state.event);
  for (const k of ['guests', 'hours', 'type', 'profile', 'alcoholPct', 'marginPct']) {
    const p = $(`#err-${k}`);
    if (p) p.textContent = errs[k] || '';
  }
  $('#ev-guests').setAttribute('aria-invalid', String(!!errs.guests));
  $('#ev-hours').setAttribute('aria-invalid', String(!!errs.hours));
  const perrs = validateParams(state.params);
  $$('[data-param]').forEach((inp) => {
    const k = inp.dataset.param;
    const p = $(`#err-p-${k}`);
    if (p) p.textContent = perrs[k] || '';
    inp.setAttribute('aria-invalid', String(!!perrs[k]));
  });
  if (Object.keys(perrs).length) $('.advanced').open = true;
  return { ...errs, ...perrs };
}

function bindEventForm() {
  const form = $('#event-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  $('#ev-name').addEventListener('input', (e) => { state.event.name = e.target.value.slice(0, 60); save(); });
  $('#ev-guests').addEventListener('input', (e) => { state.event.guests = parseNum(e.target.value); onEventChange(); });
  $('#ev-hours').addEventListener('input', (e) => { state.event.hours = parseNum(e.target.value); onEventChange(); });
  $('#ev-alcohol').addEventListener('input', (e) => { state.event.alcoholPct = Number(e.target.value); onEventChange(); });
  $('#ev-margin').addEventListener('input', (e) => { state.event.marginPct = Number(e.target.value); onEventChange(); });
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const cur = Number.isFinite(state.event.guests) ? state.event.guests : 0;
    const d = Number(b.dataset.delta);
    const next = Math.min(5000, Math.max(1, d > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5));
    state.event.guests = next;
    $('#ev-guests').value = next;
    onEventChange();
  }));
  $('[data-hours-chips]').addEventListener('click', (e) => {
    const c = e.target.closest('[data-hours]');
    if (!c) return;
    state.event.hours = Number(c.dataset.hours);
    $('#ev-hours').value = state.event.hours;
    onEventChange();
  });
  $('[data-types]').addEventListener('click', (e) => {
    const t = e.target.closest('[data-type]');
    if (!t) return;
    state.event.type = t.dataset.type;
    $$('[data-type]').forEach((b) => b.setAttribute('aria-checked', String(b === t)));
    onEventChange();
  });
  $('[data-profiles]').addEventListener('click', (e) => {
    const t = e.target.closest('[data-profile]');
    if (!t) return;
    state.event.profile = t.dataset.profile;
    $$('[data-profile]').forEach((b) => b.setAttribute('aria-checked', String(b === t)));
    onEventChange();
  });
  // Navegación con flechas dentro de los grupos de opciones
  for (const group of ['[data-types]', '[data-profiles]']) {
    $(group).addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const items = $$('.tile', $(group));
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const n = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      n.focus(); n.click();
    });
  }
  $('[data-advanced]').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-param]');
    if (!inp) return;
    const k = inp.dataset.param;
    const v = parseNum(inp.value);
    if (k.startsWith('rate_')) state.params.rates[k.slice(5)] = v;
    else if (k.startsWith('factor_')) state.params.eventFactors[k.slice(7)] = v;
    else state.params[k] = v;
    onEventChange();
  });
  $('[data-action="reset-params"]').addEventListener('click', () => {
    state.params = mergeParams();
    renderEventForm();
    showEventErrors();
    save();
    toast('Restauramos os valores de referência.');
  });
}

function onEventChange() {
  save();
  updateEventLive();
  // Limpia errores a medida que el usuario corrige
  const errs = validateEvent(state.event);
  for (const k of Object.keys({ guests: 1, hours: 1, type: 1, profile: 1 })) {
    const p = $(`#err-${k}`);
    if (p && p.textContent && !errs[k]) p.textContent = '';
  }
  if (!errs.guests) $('#ev-guests').setAttribute('aria-invalid', 'false');
  if (!errs.hours) $('#ev-hours').setAttribute('aria-invalid', 'false');
  const perrs = validateParams(state.params);
  $$('[data-param]').forEach((inp) => {
    const p = $(`#err-p-${inp.dataset.param}`);
    if (p && p.textContent && !perrs[inp.dataset.param]) { p.textContent = ''; inp.setAttribute('aria-invalid', 'false'); }
  });
}

/* ---------------- Paso 2: cócteles ---------------- */
let catalogBuilt = false;
function buildCatalog() {
  const groups = [['alcohol', 'Coquetéis com álcool'], ['sin', 'Coquetéis sem álcool']];
  $('[data-catalog]').innerHTML = groups.map(([type, title]) => {
    const list = DATA.recipes.filter((r) => r.type === type);
    return `<h2 class="group-title" data-group="${type}">${title} <small>${list.length} receitas</small></h2>` + list.map((r) => `
      <article class="card" data-card="${r.id}" data-type-card="${r.type}" data-search-text="${esc(searchIndex(r, DATA.catalog))}">
        <div class="card__art ${r.photo ? 'card__art--photo' : ''}" style="background:linear-gradient(180deg, ${r.visual.top}33, ${r.visual.bottom}22)">
          ${art(r)}
          <span class="card__tag ${r.type === 'sin' ? 'card__tag--sin' : ''}">${r.type === 'alcohol' ? 'Com álcool' : 'Sem álcool'}</span>
          <span class="card__check" aria-hidden="true">${CHECK}</span>
        </div>
        <div class="card__body">
          <h3 class="card__name">${esc(r.name)}</h3>
          <p class="card__desc">${esc(r.description)}</p>
          <p class="card__meta">${esc(DATA.catalog.glasses[r.glass].name)} · ${r.ingredients.length} ingredientes</p>
          <div class="card__actions">
            <button type="button" class="btn btn--sm card__toggle" data-toggle="${r.id}" aria-pressed="false" aria-label="Adicionar ${esc(r.name)}">Adicionar</button>
            <button type="button" class="btn btn--text btn--sm" data-recipe="${r.id}">Ver receita</button>
          </div>
        </div>
      </article>`).join('');
  }).join('');
  catalogBuilt = true;
}

function renderCatalog() {
  if (!catalogBuilt) buildCatalog();
  $$('[data-card]').forEach((card) => {
    const id = card.dataset.card;
    const sel = isSelected(id);
    card.classList.toggle('is-selected', sel);
    const btn = $('[data-toggle]', card);
    btn.setAttribute('aria-pressed', String(sel));
    btn.textContent = sel ? 'Adicionado' : 'Adicionar';
    btn.setAttribute('aria-label', `${sel ? 'Remover' : 'Adicionar'} ${recipeById(id).name}`);
  });
  applyFilter();
  updateSelectionBar();
}

function applyFilter() {
  const q = norm(query.trim());
  let visible = 0;
  $$('[data-card]').forEach((card) => {
    const okType = filter === 'todos' || card.dataset.typeCard === filter;
    const okQ = !q || card.dataset.searchText.includes(q);
    card.hidden = !(okType && okQ);
    if (!card.hidden) visible++;
  });
  $$('[data-group]').forEach((g) => {
    g.hidden = !$$(`[data-type-card="${g.dataset.group}"]`).some((c) => !c.hidden);
  });
  $('[data-catalog-empty]').hidden = visible > 0;
}

function updateSelectionBar() {
  const n = state.selection.length;
  const alc = state.selection.filter((s) => recipeById(s.id)?.type === 'alcohol').length;
  const el = $('[data-sel-count]');
  if (el.textContent !== String(n)) { el.textContent = n; bump(el); }
  $('[data-sel-detail]').textContent = n ? `${alc} com álcool · ${n - alc} sem álcool` : 'selecionados';
  if (n) $('#err-selection').textContent = '';
}

function toggleRecipe(id) {
  if (isSelected(id)) state.selection = state.selection.filter((s) => s.id !== id);
  else state.selection.push({ id, weight: 50 });
  save();
  renderCatalog();
}

function bindCatalog() {
  $('[data-catalog]').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) return toggleRecipe(t.dataset.toggle);
    const r = e.target.closest('[data-recipe]');
    if (r) return openRecipe(r.dataset.recipe);
  });
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', String(x === b)); });
    applyFilter();
  }));
  $('[data-search]').addEventListener('input', (e) => { query = e.target.value; applyFilter(); });
}

function openRecipe(id) {
  const r = recipeById(id);
  const cat = DATA.catalog;
  const sel = isSelected(id);
  $('[data-recipe-body]').innerHTML = `
    <div class="rm__top" style="background:linear-gradient(180deg, ${r.visual.top}55, ${r.visual.bottom}22)">
      ${art(r)}
      <button type="button" class="rm__close" data-close aria-label="Fechar">×</button>
    </div>
    <div class="rm__body">
      <div class="rm__head">
        <span class="pill ${r.type === 'sin' ? 'pill--sin' : ''}">${r.type === 'alcohol' ? 'Com álcool' : 'Sem álcool'}</span>
        <h2 id="rm-title" style="margin-top:10px">${esc(r.name)}</h2>
        <p>${esc(r.description)}</p>
      </div>
      <div class="rm__facts">
        <span class="tag">Copo: <b>${esc(cat.glasses[r.glass].name)}</b></span>
        <span class="tag">Decoração: <b>${esc(r.garnish)}</b></span>
      </div>
      <div class="rm__cols">
        <div><h3>Ingredientes por dose</h3><ul class="rm__list">${r.ingredients.map((i) => `<li><span>${esc(cat.items[i.id].name)}</span><span>${formatPortion(i.qty, cat.items[i.id].unit)}</span></li>`).join('')}</ul></div>
        <div><h3>Modo de preparo</h3><ol class="rm__steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          <p class="hint" style="margin-top:10px">Utensílios: ${r.tools.map((t) => esc(cat.equipment[t].name)).join(', ')}.</p></div>
      </div>
      <div class="rm__foot">
        <button type="button" class="btn ${sel ? 'btn--ghost' : 'btn--primary'}" data-modal-toggle="${r.id}">${sel ? 'Remover do meu bar' : 'Adicionar ao meu bar'}</button>
        <button type="button" class="btn btn--ghost" data-close>Fechar</button>
      </div>
    </div>`;
  const dlg = $('#recipe-modal');
  if (!dlg.open) dlg.showModal();
}

function bindModal() {
  const dlg = $('#recipe-modal');
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    const t = e.target.closest('[data-modal-toggle]');
    if (t) {
      toggleRecipe(t.dataset.modalToggle);
      toast(isSelected(t.dataset.modalToggle) ? 'Coquetel adicionado ao seu bar.' : 'Coquetel removido do seu bar.');
      dlg.close();
      if (currentView === 'proporciones') renderProportions();
    }
  });
}

/* ---------------- Paso 3: proporciones ---------------- */
function groupTotals() {
  const types = new Set(state.selection.map((s) => recipeById(s.id).type));
  const est = estimateServings(state.event, state.params, { hasAlcohol: types.has('alcohol'), hasNonAlcohol: types.has('sin') });
  return { alcohol: ceilSafe(est.alcohol), sin: ceilSafe(est.nonAlcohol) };
}

function renderProportions() {
  const totals = groupTotals();
  const groups = [['alcohol', 'Com álcool'], ['sin', 'Sem álcool']];
  const html = groups.map(([type, title]) => {
    const sel = state.selection.filter((s) => recipeById(s.id).type === type);
    if (!sel.length) return '';
    return `<section class="panel prop-group" data-prop-group="${type}">
      <div class="prop-group__head">
        <h2>${title}</h2>
        <span class="prop-group__total"><span data-group-total="${type}">${formatNumber(totals[type], 0)}</span> doses</span>
      </div>
      <div class="prop-presets"><button type="button" class="btn btn--text" data-equal="${type}">Dividir em partes iguais</button></div>
      ${sel.map((s) => {
        const r = recipeById(s.id);
        return `<div class="prop-row">
          <div class="prop-row__art" style="background:${r.visual.top}44">${thumb(r)}</div>
          <div class="prop-row__name"><label for="w-${r.id}">${esc(r.name)}</label><span class="prop-row__val"><span data-portions="${r.id}">0</span> <small data-pct="${r.id}">0 %</small></span></div>
          <input id="w-${r.id}" type="range" min="0" max="100" step="5" value="${s.weight}" data-weight="${r.id}" aria-label="Popularidade de ${esc(r.name)}">
        </div>`;
      }).join('')}
    </section>`;
  }).join('');
  const warn = [];
  const hasAlc = state.selection.some((s) => recipeById(s.id).type === 'alcohol');
  const hasSin = state.selection.some((s) => recipeById(s.id).type === 'sin');
  if (hasAlc && !hasSin && state.event.alcoholPct < 100) warn.push('Você não escolheu coquetéis sem álcool: os convidados que não bebem ficarão sem opção. Recomendamos adicionar pelo menos um.');
  if (hasAlc && state.event.alcoholPct === 0) warn.push('Você indicou que ninguém vai beber álcool: os coquetéis com álcool ficarão com 0 doses.');
  $('[data-proportions]').innerHTML = (warn.length ? `<aside class="note note--warn"><div class="note__icon" aria-hidden="true">!</div><div><strong>Antes de calcular</strong>${warn.map((w) => `<p>${w}</p>`).join('')}<p><button type="button" class="btn btn--text" data-go="cocteles">Voltar e escolher coquetéis</button></p></div></aside>` : '') + html;
  updateProportions();
}

function updateProportions() {
  const totals = groupTotals();
  let all = 0;
  for (const type of ['alcohol', 'sin']) {
    const sel = state.selection.filter((s) => recipeById(s.id).type === type);
    if (!sel.length) continue;
    const d = distribute(totals[type], sel.map((s) => ({ id: s.id, weight: s.weight })));
    for (const x of d) {
      const p = $(`[data-portions="${x.id}"]`); if (p) p.textContent = formatNumber(x.portions, 0);
      const pc = $(`[data-pct="${x.id}"]`); if (pc) pc.textContent = `${formatNumber(x.share * 100, 0)} %`;
      const inp = $(`[data-weight="${x.id}"]`); if (inp) inp.style.setProperty('--p', `${inp.value}%`);
    }
    all += totals[type];
  }
  $('[data-prop-total]').textContent = formatNumber(all, 0);
}

function bindProportions() {
  const box = $('[data-proportions]');
  box.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-weight]');
    if (!inp) return;
    const s = state.selection.find((x) => x.id === inp.dataset.weight);
    if (s) s.weight = Number(inp.value);
    save();
    updateProportions();
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-equal]');
    if (!b) return;
    state.selection.forEach((s) => { if (recipeById(s.id).type === b.dataset.equal) s.weight = 50; });
    save();
    renderProportions();
  });
}

/* ---------------- Cálculo ---------------- */
function planKey() {
  return JSON.stringify([state.event.guests, state.event.hours, state.event.type, state.event.profile, state.event.alcoholPct, state.event.marginPct, state.params, state.selection]);
}
function runCalculation() {
  return calculatePlan({
    event: { guests: state.event.guests, hours: state.event.hours, type: state.event.type, profile: state.event.profile, alcoholPct: state.event.alcoholPct, marginPct: state.event.marginPct },
    selection: state.selection, recipes: DATA.recipes, catalog: DATA.catalog, params: state.params
  });
}

async function onCalculate(btn) {
  const errs = showEventErrors();
  if (Object.keys(errs).length) { toast('Revise os dados do evento.', 'error'); return go('evento'); }
  if (!state.selection.length) { $('#err-selection').textContent = 'Selecione pelo menos um coquetel.'; return go('cocteles'); }
  btn.classList.add('is-loading'); btn.disabled = true;
  try {
    await sleep(450); // breve estado de carga para dar feedback
    const hadOverrides = Object.keys(state.overrides).length > 0;
    const key = planKey();
    plan = runCalculation();
    if (state.planKey !== key && hadOverrides) state.overrides = {};
    state.planKey = key;
    save();
    go('resultados');
  } catch (err) {
    toast(err instanceof PlanError ? err.message : 'Ocorreu um erro inesperado ao calcular.', 'error');
    console.error(err);
  } finally {
    btn.classList.remove('is-loading'); btn.disabled = false;
  }
}

/* ---------------- Paso 4: resultados ---------------- */
function renderResults() {
  if (!plan) return;
  const t = plan.totals;
  const e = plan.event;
  $('[data-result-sub]').innerHTML = `${state.event.name ? `<strong>${esc(state.event.name)}</strong> · ` : ''}${esc(typeName(e.type))} · ${formatNumber(e.guests, 0)} convidados · ${formatNumber(e.hours, 1)} h · consumo ${esc(profileName(e.profile).toLowerCase())} · margem ${e.marginPct}%`;
  const pctAlc = t.drinks ? (t.alcohol / t.drinks) * 100 : 0;
  const cats = DATA.catalog.categories.slice().sort((a, b) => a.order - b.order);

  const kpis = `<div class="kpis">
    <div class="kpi kpi--hero"><span class="kpi__label">Coquetéis estimados</span><span class="kpi__value">${formatNumber(t.drinks, 0)}</span>
      <span class="kpi__sub">≈ ${formatNumber(plan.estimate.perPerson, 1)} por convidado que bebe, durante ${formatNumber(e.hours, 1)} h</span>
      <div class="split" aria-hidden="true"><span style="width:${pctAlc}%"></span><span style="width:${100 - pctAlc}%"></span></div>
      <div class="split-legend"><span><i style="background:var(--yellow)"></i>Com álcool ${formatNumber(t.alcohol, 0)}</span><span><i style="background:var(--coral)"></i>Sem álcool ${formatNumber(t.nonAlcohol, 0)}</span></div>
    </div>
    <div class="kpi"><span class="kpi__label">Com álcool</span><span class="kpi__value">${formatNumber(t.alcohol, 0)}</span><span class="kpi__sub">${formatNumber(t.alcoholBottles, 0)} garrafas de bebida</span></div>
    <div class="kpi"><span class="kpi__label">Sem álcool</span><span class="kpi__value">${formatNumber(t.nonAlcohol, 0)}</span><span class="kpi__sub">coquetéis</span></div>
    <div class="kpi"><span class="kpi__label">Gelo</span><span class="kpi__value">${formatNumber(t.iceKg, 1)} kg</span><span class="kpi__sub">${packagesLabel(t.iceBags, 'bolsa')} de 3 kg</span></div>
    <div class="kpi"><span class="kpi__label">Garrafas</span><span class="kpi__value">${formatNumber(t.bottles, 0)}</span><span class="kpi__sub">bebidas, refrigerantes e xaropes</span></div>
    <div class="kpi"><span class="kpi__label">Latas</span><span class="kpi__value">${formatNumber(t.cans, 0)}</span><span class="kpi__sub">tônica, ginger beer e creme de coco</span></div>
    <div class="kpi"><span class="kpi__label">Pacotes</span><span class="kpi__value">${formatNumber(t.packs, 0)}</span><span class="kpi__sub">inclui gelo, frutas e descartáveis</span></div>
    <div class="kpi"><span class="kpi__label">Outros</span><span class="kpi__value">${formatNumber(t.others, 0)}</span><span class="kpi__sub">caixas de suco e frutas inteiras</span></div>
  </div>`;

  const warnings = plan.warnings.length ? `<aside class="note note--warn" style="margin:0 0 18px"><div class="note__icon" aria-hidden="true">!</div><div><strong>Atenção</strong>${plan.warnings.map((w) => `<p>${esc(w)}</p>`).join('')}</div></aside>` : '';

  const recipesPanel = `<section class="panel"><h2 class="panel__title">Doses por receita</h2>
    <table class="recipe-table"><thead><tr><th>Coquetel</th><th class="num">Proporção</th><th class="num">Doses</th></tr></thead><tbody>
    ${plan.perRecipe.map((r) => `<tr><td><div class="rname">${thumb(recipeById(r.id))}<div><button type="button" class="linkish" data-recipe="${r.id}">${esc(r.name)}</button><br><span class="pill ${r.type === 'sin' ? 'pill--sin' : ''}">${r.type === 'alcohol' ? 'Com álcool' : 'Sem álcool'}</span></div></div></td><td class="num">${formatNumber(r.share * 100, 0)}%</td><td class="num"><strong>${formatNumber(r.portions, 0)}</strong></td></tr>`).join('')}
    </tbody></table></section>`;

  const extras = `<section class="panel"><h2 class="panel__title">Copos sugeridos</h2><div class="tags">${plan.glassware.map((g) => `<span class="tag">${esc(g.name)}<b>${formatNumber(g.count, 0)}</b></span>`).join('')}</div>
    <p class="hint" style="margin-top:10px">Doses servidas por tipo de copo. Se você lavar durante o evento, vai precisar de menos peças.</p>
    <h2 class="panel__title" style="margin-top:22px">Equipamento do bar</h2><div class="tags">${plan.equipment.map((x) => `<span class="tag">${esc(x.name)}</span>`).join('')}</div></section>`;

  const lists = cats.map((c) => {
    const items = plan.items.filter((i) => i.category === c.id);
    if (!items.length) return '';
    return `<section class="panel cat-block"><div class="cat-head">${catIcon(c.id)}<h3>${esc(c.name)}</h3><span class="cat-head__sub">${items.length} ${items.length === 1 ? 'produto' : 'produtos'}</span></div>
      ${items.map((i) => `<div class="ing">
        <span class="ing__name">${esc(i.name)}</span>
        <span class="ing__buy">${packagesLabel(i.packages, i.packageKind)}</span>
        <span class="ing__detail">Você precisa de ${formatQty(i.required, i.unit)}${i.approxKg ? ` (≈ ${formatNumber(i.approxKg, 1)} kg)` : ''} · ${esc(i.packageLabel)} · <button type="button" data-sources="${i.id}" aria-expanded="false">ver detalhes</button></span>
        <ul class="ing__sources" data-sources-list="${i.id}" hidden>${i.sources.map((s) => `<li>${s.recipe ? `<strong>${esc(s.recipe)}</strong>: ` : ''}${esc(s.ingredient)} ${formatQty(s.qty, s.unit)}${s.rule ? ` <em>(${esc(s.rule)})</em>` : ''}</li>`).join('')}${plan.event.marginPct ? `<li>+ ${plan.event.marginPct}% de margem de segurança</li>` : ''}</ul>
      </div>`).join('')}</section>`;
  }).join('');

  $('[data-results]').innerHTML = `${kpis}${warnings}
    <div class="results-grid">
      <div class="col">${lists}</div>
      <div class="col">${recipesPanel}${extras}
        <aside class="note note--responsible" style="margin-top:0"><div class="note__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><strong>São estimativas, não garantias.</strong><p>O consumo real depende dos seus convidados, do clima e do horário. Incluímos água para todos (${formatQty(plan.items.find((i) => i.id === 'agua_hidratacion')?.required || 0, 'ml')}): deixe-a sempre à vista e não sirva álcool a menores.</p></div></aside>
        <button class="btn btn--primary btn--lg" type="button" data-go="lista">Ir para compras e orçamento</button>
      </div>
    </div>`;
}

function bindResults() {
  $('[data-results]').addEventListener('click', (e) => {
    const s = e.target.closest('[data-sources]');
    if (s) {
      const list = $(`[data-sources-list="${s.dataset.sources}"]`);
      list.hidden = !list.hidden;
      s.setAttribute('aria-expanded', String(!list.hidden));
      s.textContent = list.hidden ? 'ver detalhes' : 'ocultar detalhes';
    }
    const r = e.target.closest('[data-recipe]');
    if (r) openRecipe(r.dataset.recipe);
  });
}

/* ---------------- Paso 5: lista y presupuesto ---------------- */
function currencySymbol(code) {
  const c = currencyInfo(code);
  const parts = new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || c.code;
}

function renderShop() {
  if (!plan) return;
  const sym = currencySymbol(state.currency);
  const cats = DATA.catalog.categories.slice().sort((a, b) => a.order - b.order);
  $('[data-shop]').innerHTML = cats.map((c) => {
    const items = plan.items.filter((i) => i.category === c.id);
    if (!items.length) return '';
    return `<section class="panel shop-cat" data-shop-cat="${c.id}">
      <div class="shop-cat__head">${catIcon(c.id)}<h3>${esc(c.name)}</h3><span class="shop-cat__sub"><span data-cat-sub="${c.id}">—</span><small data-cat-count="${c.id}"></small></span></div>
      ${items.map((i) => {
        const price = state.prices[i.id];
        const qty = effectivePackages(i, state.overrides);
        return `<div class="row ${state.bought[i.id] ? 'is-bought' : ''}" data-row="${i.id}">
          <label class="check"><input type="checkbox" data-bought="${i.id}" ${state.bought[i.id] ? 'checked' : ''} aria-label="Marcar ${esc(i.name)} como comprado"><span>${CHECK.replace('currentColor', '#fff')}</span></label>
          <div class="row__main">
            <div class="row__name">${esc(i.name)}</div>
            <div class="row__need">Você precisa de ${formatQty(i.required, i.unit)} · ${esc(i.packageLabel)}</div>
            <div class="row__foot"><span data-edited="${i.id}"></span><span class="row__subtotal" data-row-sub="${i.id}"></span></div>
          </div>
          <div class="row__edit">
            <label>Quantidade<div class="mini-counter">
              <button type="button" data-qty-step="${i.id}" data-delta="-1" aria-label="Diminuir uma embalagem de ${esc(i.name)}">−</button>
              <input type="number" inputmode="numeric" min="0" max="9999" step="1" value="${qty}" data-qty="${i.id}" aria-label="Quantidade de ${esc(i.packageLabel)} de ${esc(i.name)}">
              <button type="button" data-qty-step="${i.id}" data-delta="1" aria-label="Aumentar uma embalagem de ${esc(i.name)}">+</button>
            </div></label>
            <label>Preço por embalagem<div class="price-input"><span>${esc(sym)}</span>
              <input type="text" inputmode="decimal" placeholder="0" value="${price ?? ''}" data-price="${i.id}" aria-label="Preço de ${esc(i.packageLabel)} de ${esc(i.name)}"></div></label>
          </div>
        </div>`;
      }).join('')}
    </section>`;
  }).join('');
  updateShop();
}

function updateShop() {
  if (!plan) return;
  const b = computeBudget(plan, state.prices, state.overrides, DATA.catalog);
  const cur = state.currency;
  for (const item of plan.items) {
    const l = b.lines[item.id];
    const sub = $(`[data-row-sub="${item.id}"]`);
    if (sub) sub.textContent = l.price === null ? 'Sem preço' : formatMoney(l.cost, cur);
    const ed = $(`[data-edited="${item.id}"]`);
    if (ed) ed.innerHTML = l.edited ? `<span class="row__edited">Editado (calculado: ${item.packages})</span> <button type="button" class="row__reset" data-reset="${item.id}">Restaurar</button>` : `${packagesLabel(l.packages, item.packageKind)}`;
  }
  for (const c of b.categories) {
    const el = $(`[data-cat-sub="${c.id}"]`);
    if (el) el.textContent = c.priced ? formatMoney(c.cost, cur) : '—';
    const cnt = $(`[data-cat-count="${c.id}"]`);
    if (cnt) cnt.textContent = `${c.priced} de ${c.items} com preço`;
  }
  const boughtN = plan.items.filter((i) => state.bought[i.id]).length;
  const pct = plan.items.length ? (boughtN / plan.items.length) * 100 : 0;
  $('[data-summary]').innerHTML = `
    <span class="kpi__label">Custo total estimado</span>
    <div class="summary__total">${formatMoney(b.total, cur)}</div>
    <div class="summary__row"><span>Por convidado</span><b>${formatMoney(b.perGuest, cur)}</b></div>
    <div class="summary__row"><span>Por coquetel</span><b>${formatMoney(b.perDrink, cur)}</b></div>
    <div class="summary__row"><span>Produtos com preço</span><b>${b.priced} de ${b.count}</b></div>
    <div class="summary__progress"><div class="summary__row" style="border:0;padding:0"><span>Comprado</span><b>${boughtN} de ${plan.items.length}</b></div><div class="bar"><span style="width:${pct}%"></span></div></div>
    <p class="summary__note">${b.missing ? 'Preencha os preços que faltam para um orçamento mais preciso. ' : ''}O custo por coquetel inclui gelo, água e descartáveis.</p>`;
}

function bindShop() {
  const box = $('[data-shop]');
  box.addEventListener('change', (e) => {
    const c = e.target.closest('[data-bought]');
    if (c) {
      if (c.checked) state.bought[c.dataset.bought] = true; else delete state.bought[c.dataset.bought];
      c.closest('.row').classList.toggle('is-bought', c.checked);
      save(); updateShop();
    }
  });
  box.addEventListener('input', (e) => {
    const q = e.target.closest('[data-qty]');
    if (q) {
      const v = parseNum(q.value);
      const item = plan.items.find((i) => i.id === q.dataset.qty);
      if (Number.isFinite(v) && v >= 0 && v <= 9999 && Number.isInteger(v)) {
        if (v === item.packages) delete state.overrides[item.id]; else state.overrides[item.id] = v;
        q.removeAttribute('aria-invalid');
      } else q.setAttribute('aria-invalid', 'true');
      save(); updateShop();
    }
    const p = e.target.closest('[data-price]');
    if (p) {
      const raw = p.value.trim();
      const v = parseNum(raw);
      if (!raw) { delete state.prices[p.dataset.price]; p.removeAttribute('aria-invalid'); }
      else if (Number.isFinite(v) && v >= 0) { state.prices[p.dataset.price] = v; p.removeAttribute('aria-invalid'); }
      else p.setAttribute('aria-invalid', 'true');
      save(); updateShop();
    }
  });
  box.addEventListener('focusout', (e) => {
    const q = e.target.closest('[data-qty]');
    if (q && q.getAttribute('aria-invalid') === 'true') {
      q.value = effectivePackages(plan.items.find((i) => i.id === q.dataset.qty), state.overrides);
      q.removeAttribute('aria-invalid');
      toast('A quantidade deve ser um número inteiro entre 0 e 9999.', 'error');
    }
    const p = e.target.closest('[data-price]');
    if (p && p.getAttribute('aria-invalid') === 'true') toast('Digite o preço só com números, por exemplo 15 ou 15,50.', 'error');
  });
  box.addEventListener('click', (e) => {
    const s = e.target.closest('[data-qty-step]');
    if (s) {
      const item = plan.items.find((i) => i.id === s.dataset.qtyStep);
      const next = Math.max(0, Math.min(9999, effectivePackages(item, state.overrides) + Number(s.dataset.delta)));
      if (next === item.packages) delete state.overrides[item.id]; else state.overrides[item.id] = next;
      $(`[data-qty="${item.id}"]`).value = next;
      save(); updateShop();
    }
    const r = e.target.closest('[data-reset]');
    if (r) {
      delete state.overrides[r.dataset.reset];
      const item = plan.items.find((i) => i.id === r.dataset.reset);
      $(`[data-qty="${item.id}"]`).value = item.packages;
      save(); updateShop();
    }
  });
  const sel = $('[data-currency]');
  sel.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code} · ${c.name}</option>`).join('');
  sel.value = state.currency;
  sel.addEventListener('change', () => { state.currency = sel.value; save(); renderShop(); toast(`Moeda: ${currencyInfo(sel.value).name}. Os preços informados foram mantidos.`); });
}

/* ---------------- Exportación ---------------- */
const fileBase = () => {
  const n = norm(state.event.name || 'meu-evento').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meu-evento';
  return `cocktail-planner-${n}`;
};

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function makePDF() {
  const budget = computeBudget(plan, state.prices, state.overrides, DATA.catalog);
  const bytes = buildPlanPDF({
    plan, budget, catalog: DATA.catalog, recipesById: DATA.recipesById,
    eventName: state.event.name, eventTypeName: typeName(plan.event.type), profileName: profileName(plan.event.profile),
    currency: state.currency, overrides: state.overrides, bought: state.bought
  });
  return new Blob([bytes], { type: 'application/pdf' });
}

async function onPDF(btn) {
  btn.classList.add('is-loading'); btn.disabled = true;
  try {
    await sleep(250);
    download(makePDF(), `${fileBase()}.pdf`);
    toast('PDF gerado. Confira seus downloads.');
  } catch (err) {
    console.error(err);
    toast('Não foi possível gerar o PDF. Tente a opção Imprimir.', 'error');
  } finally { btn.classList.remove('is-loading'); btn.disabled = false; }
}

function onCSV() {
  const csv = buildCSV(plan, { prices: state.prices, overrides: state.overrides, bought: state.bought, currency: state.currency, catalog: DATA.catalog, eventName: state.event.name });
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileBase()}.csv`);
  toast('CSV baixado. Abra no Excel ou no Google Planilhas.');
}

function onPrint() {
  const b = computeBudget(plan, state.prices, state.overrides, DATA.catalog);
  const cur = state.currency;
  const e = plan.event;
  const cats = DATA.catalog.categories.slice().sort((a, x) => a.order - x.order);
  $('#print-report').innerHTML = `
    <div class="pr-head">${logoSVG(44)}<div><h1>Cocktail Planner Pro</h1><p>Plano do bar e lista de compras</p></div>
      <div class="pr-date"><p>${esc(state.event.name || 'Meu evento')}</p><p>${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</p></div></div>
    <div class="pr-grid">
      <div><small>Tipo</small><b>${esc(typeName(e.type))}</b></div><div><small>Convidados</small><b>${formatNumber(e.guests, 0)}</b></div>
      <div><small>Duração</small><b>${formatNumber(e.hours, 1)} h</b></div><div><small>Perfil</small><b>${esc(profileName(e.profile))}</b></div>
      <div><small>Coquetéis</small><b>${formatNumber(plan.totals.drinks, 0)}</b></div><div><small>Com / sem álcool</small><b>${plan.totals.alcohol} / ${plan.totals.nonAlcohol}</b></div>
      <div><small>Gelo</small><b>${formatNumber(plan.totals.iceKg, 1)} kg</b></div><div><small>Margem</small><b>${e.marginPct}%</b></div>
    </div>
    <h2>Coquetéis selecionados</h2>
    <table><thead><tr><th>Coquetel</th><th>Tipo</th><th>Copo</th><th class="num">Proporção</th><th class="num">Doses</th></tr></thead><tbody>
      ${plan.perRecipe.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${r.type === 'alcohol' ? 'Com álcool' : 'Sem álcool'}</td><td>${esc(DATA.catalog.glasses[r.glass].name)}</td><td class="num">${formatNumber(r.share * 100, 0)}%</td><td class="num"><b>${r.portions}</b></td></tr>`).join('')}
    </tbody></table>
    <h2>Lista de compras</h2>
    <table><thead><tr><th></th><th>Produto</th><th>Necessário</th><th>Embalagem</th><th class="num">Comprar</th><th class="num">Preço</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${cats.map((c) => {
        const items = plan.items.filter((i) => i.category === c.id);
        if (!items.length) return '';
        const cb = b.categories.find((x) => x.id === c.id);
        return `<tr class="pr-cat"><td colspan="6">${esc(c.name)}</td><td class="num">${cb?.priced ? formatMoney(cb.cost, cur) : '—'}</td></tr>` + items.map((i) => {
          const l = b.lines[i.id];
          return `<tr><td><span class="pr-box ${state.bought[i.id] ? 'on' : ''}"></span></td><td><b>${esc(i.name)}</b></td><td>${formatQty(i.required, i.unit)}</td><td>${esc(i.packageLabel)}</td><td class="num"><b>${l.packages}</b></td><td class="num">${l.price === null ? '—' : formatMoney(l.price, cur)}</td><td class="num">${l.price === null ? '—' : formatMoney(l.cost, cur)}</td></tr>`;
        }).join('');
      }).join('')}
    </tbody></table>
    <div class="pr-total"><span>Total: <b>${formatMoney(b.total, cur)}</b></span><span>Por convidado: <b>${formatMoney(b.perGuest, cur)}</b></span><span>Por coquetel: <b>${formatMoney(b.perDrink, cur)}</b></span></div>
    <h2>Copos e equipamentos</h2>
    <p>${plan.glassware.map((g) => `${esc(g.name)}: ${g.count}`).join(' · ')}</p>
    <p>${plan.equipment.map((x) => esc(x.name)).join(' · ')}</p>
    <p class="pr-foot">As quantidades são estimativas para planejar as compras, não uma garantia de consumo. Ofereça água e opções sem álcool, não sirva álcool a menores e organize a volta segura dos seus convidados.</p>`;
  window.print();
}

async function onShare() {
  const text = buildShareText(plan, { overrides: state.overrides, catalog: DATA.catalog, eventName: state.event.name });
  const title = `Lista de compras${state.event.name ? ` — ${state.event.name}` : ''}`;
  try {
    if (navigator.share) {
      let file = null;
      try { file = new File([makePDF()], `${fileBase()}.pdf`, { type: 'application/pdf' }); } catch { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title, text, files: [file] });
      else await navigator.share({ title, text });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiamos a lista para a área de transferência. Cole no WhatsApp ou num e-mail.');
  } catch {
    toast('Seu navegador não permite compartilhar. Baixe o PDF ou o CSV.', 'error');
  }
}

function onRestart() {
  const dlg = $('#confirm-modal');
  dlg.returnValue = '';
  dlg.showModal();
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    state = defaultState();
    plan = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
    renderCatalog();
    renderHome();
    go('evento');
    toast('Pronto, começamos um plano novo.');
  }, { once: true });
}

/* ---------------- Arranque ---------------- */
function bindGlobal() {
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); if ($('#recipe-modal').open) $('#recipe-modal').close(); return go(g.dataset.go); }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'start': return go('evento');
      case 'resume': return go(state.planKey ? 'resultados' : state.selection.length ? 'proporciones' : 'evento');
      case 'to-cocktails': {
        const errs = showEventErrors();
        if (Object.keys(errs).length) {
          toast(Object.values(errs)[0], 'error');
          const first = $('[aria-invalid="true"]') || $('.error:not(:empty)');
          first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        return go('cocteles');
      }
      case 'to-proportions':
        if (!state.selection.length) { $('#err-selection').textContent = 'Selecione pelo menos um coquetel para continuar.'; toast('Selecione pelo menos um coquetel.', 'error'); return; }
        return go('proporciones');
      case 'calculate': return onCalculate(a);
      case 'pdf': return onPDF(a);
      case 'csv': return onCSV();
      case 'print': return onPrint();
      case 'share': return onShare();
      case 'restart': return onRestart();
    }
  });
  window.addEventListener('popstate', () => go(location.hash.slice(1) || 'inicio', { replace: true }));
}

async function init() {
  load();
  try {
    DATA = await loadCatalogs();
  } catch (err) {
    console.error(err);
    $('#main').innerHTML = `<div class="panel" style="margin-top:40px"><h1>Não foi possível carregar as receitas</h1><p class="lead">Abra o aplicativo pelo endereço da web (não com duplo clique no arquivo). Consulte o README para usar um servidor local.</p></div>`;
    return;
  }
  // Limpia selecciones de recetas que ya no existen
  state.selection = state.selection.filter((s) => DATA.recipesById[s.id]);
  renderHome();
  buildEventForm();
  bindEventForm();
  bindCatalog();
  bindModal();
  bindProportions();
  bindResults();
  bindShop();
  bindGlobal();
  go(location.hash.slice(1) || 'inicio', { replace: true });
}

init();
