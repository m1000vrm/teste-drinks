/** Orçamento e lista de compras. Módulo puro (sem DOM). */
import { formatQty } from './format.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Quantidade de embalagens a comprar: a calculada ou a editada pelo usuário. */
export function effectivePackages(item, overrides = {}) {
  const o = overrides[item.id];
  return isNum(o) && o >= 0 ? Math.floor(o) : item.packages;
}

/**
 * @param {object} plan resultado de calculatePlan
 * @param {object} prices { itemId: preço por embalagem }
 * @param {object} overrides { itemId: embalagens editadas }
 */
export function computeBudget(plan, prices = {}, overrides = {}, catalog) {
  const lines = plan.items.map((item) => {
    const packages = effectivePackages(item, overrides);
    const price = isNum(prices[item.id]) && prices[item.id] >= 0 ? prices[item.id] : null;
    return { id: item.id, category: item.category, packages, price, cost: price === null ? 0 : price * packages, edited: packages !== item.packages };
  });
  const byCategory = {};
  for (const l of lines) {
    byCategory[l.category] = byCategory[l.category] || { cost: 0, items: 0, priced: 0 };
    byCategory[l.category].cost += l.cost;
    byCategory[l.category].items += 1;
    if (l.price !== null) byCategory[l.category].priced += 1;
  }
  const total = lines.reduce((a, l) => a + l.cost, 0);
  const priced = lines.filter((l) => l.price !== null).length;
  const guests = plan.event.guests;
  const drinks = plan.totals.drinks;
  const categories = (catalog?.categories || []).slice().sort((a, b) => a.order - b.order)
    .filter((c) => byCategory[c.id]).map((c) => ({ ...c, ...byCategory[c.id] }));
  return {
    lines: Object.fromEntries(lines.map((l) => [l.id, l])),
    categories,
    total,
    perGuest: guests > 0 ? total / guests : 0,
    perDrink: drinks > 0 ? total / drinks : 0,
    priced,
    missing: lines.length - priced,
    count: lines.length
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com separador ";" e BOM UTF-8 para abrir direto no Excel em português. */
export function buildCSV(plan, { prices = {}, overrides = {}, bought = {}, currency = 'BRL', catalog, eventName = '' } = {}) {
  const budget = computeBudget(plan, prices, overrides, catalog);
  const catName = Object.fromEntries((catalog?.categories || []).map((c) => [c.id, c.name]));
  const num = (n, d = 2) => (isNum(n) ? n.toFixed(d).replace('.', ',') : '');
  const rows = [];
  rows.push(['Cocktail Planner Pro — Lista de compras']);
  if (eventName) rows.push(['Evento', eventName]);
  rows.push(['Convidados', plan.event.guests, 'Duração (h)', plan.event.hours, 'Coquetéis estimados', plan.totals.drinks]);
  rows.push(['Margem de segurança (%)', plan.event.marginPct, 'Moeda', currency]);
  rows.push([]);
  rows.push(['Categoria', 'Produto', 'Quantidade necessária', 'Embalagem', 'Quantidade a comprar', 'Preço por embalagem', 'Subtotal', 'Comprado']);
  for (const item of plan.items) {
    const l = budget.lines[item.id];
    rows.push([
      catName[item.category] || item.category,
      item.name,
      formatQty(item.required, item.unit),
      item.packageLabel,
      l.packages,
      l.price === null ? '' : num(l.price),
      l.price === null ? '' : num(l.cost),
      bought[item.id] ? 'Sim' : 'Não'
    ]);
  }
  rows.push([]);
  for (const c of budget.categories) rows.push(['Subtotal', c.name, '', '', '', '', num(c.cost)]);
  rows.push(['TOTAL', '', '', '', '', '', num(budget.total)]);
  rows.push(['Custo por convidado', '', '', '', '', '', num(budget.perGuest)]);
  rows.push(['Custo por coquetel', '', '', '', '', '', num(budget.perDrink)]);
  rows.push([]);
  rows.push(['As quantidades são estimativas. Ajuste conforme seu público. Beba com moderação.']);
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Texto simples para compartilhar no WhatsApp, e-mail etc. */
export function buildShareText(plan, { overrides = {}, catalog, eventName = '' } = {}) {
  const lines = [`🍹 Cocktail Planner Pro${eventName ? ` — ${eventName}` : ''}`,
    `${plan.event.guests} convidados · ${plan.event.hours} h · ${plan.totals.drinks} coquetéis estimados`, ''];
  for (const c of catalog.categories.slice().sort((a, b) => a.order - b.order)) {
    const items = plan.items.filter((i) => i.category === c.id);
    if (!items.length) continue;
    lines.push(`*${c.name}*`);
    for (const i of items) lines.push(`• ${i.name}: ${effectivePackages(i, overrides)} × ${i.packageLabel}`);
    lines.push('');
  }
  lines.push('Quantidades estimadas. Beba com moderação.');
  return lines.join('\n');
}
