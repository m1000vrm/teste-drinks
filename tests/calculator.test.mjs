import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  calculatePlan, distribute, estimateServings, mergeParams, validateEvent, resolvePurchase, PlanError, DEFAULT_PARAMS
} from '../js/calculator.js';
import { computeBudget, buildCSV, buildShareText } from '../js/budget.js';
import { formatQty, formatMoney } from '../js/format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
const { recipes } = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));
const R = Object.fromEntries(recipes.map((r) => [r.id, r]));

const baseEvent = (o = {}) => ({ guests: 50, hours: 4, type: 'casa', profile: 'moderado', alcoholPct: 80, marginPct: 0, ...o });
const plan = (event, ids, weights = {}) =>
  calculatePlan({ event: baseEvent(event), selection: ids.map((id) => ({ id, weight: weights[id] ?? 1 })), recipes, catalog });
const item = (p, id) => p.items.find((i) => i.id === id);
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} esperado ${b}, obtenido ${a}`);

describe('Integridade do catálogo', () => {
  test('25 receitas: 15 com álcool e 10 sem álcool', () => {
    assert.equal(recipes.length, 25);
    assert.equal(recipes.filter((r) => r.type === 'alcohol').length, 15);
    assert.equal(recipes.filter((r) => r.type === 'sin').length, 10);
  });
  test('cada receita tem todos os campos obrigatórios', () => {
    for (const r of recipes) {
      for (const k of ['id', 'name', 'type', 'description', 'glass', 'garnish', 'ingredients', 'steps', 'visual']) {
        assert.ok(r[k] !== undefined && r[k] !== '', `${r.id} sin ${k}`);
      }
      assert.ok(catalog.glasses[r.glass], `${r.id}: copa desconocida ${r.glass}`);
      for (const t of r.tools) assert.ok(catalog.equipment[t], `${r.id}: utensilio desconocido ${t}`);
      for (const i of r.ingredients) {
        assert.ok(catalog.items[i.id], `${r.id}: ingrediente desconocido ${i.id}`);
        assert.ok(i.qty > 0, `${r.id}: cantidad inválida de ${i.id}`);
      }
    }
  });
  test('as receitas sem álcool não contêm ingredientes alcoólicos', () => {
    for (const r of recipes.filter((x) => x.type === 'sin')) {
      for (const i of r.ingredients) assert.notEqual(catalog.items[i.id].category, 'alcohol', `${r.id} contiene ${i.id}`);
    }
  });
  test('cada ingrediente tem embalagem ou regra de compra com a mesma unidade de destino', () => {
    for (const [id, it] of Object.entries(catalog.items)) {
      assert.ok(it.package || it.buyAs, `${id} sin presentación`);
      if (it.package) assert.ok(it.package.size > 0, `${id} tamaño inválido`);
      if (it.buyAs) assert.ok(catalog.items[it.buyAs.item]?.package, `${id} buyAs sin destino válido`);
    }
  });
});

describe('Fórmula de doses', () => {
  test('fórmula base: convidados × % × consumo × horas / 4', () => {
    const p = mergeParams();
    const e = estimateServings(baseEvent(), p, { hasAlcohol: true, hasNonAlcohol: true });
    close(e.alcohol, 50 * 0.8 * 3 * 1 * 4 / 4);
    close(e.nonAlcohol, 50 * 0.2 * 3);
  });
  for (const guests of [10, 50, 100]) {
    for (const hours of [2, 4, 6, 8]) {
      test(`${guests} convidados, ${hours} h, mistura de com e sem álcool`, () => {
        const p = plan({ guests, hours }, ['mojito', 'margarita', 'limonada_tropical']);
        const expAlc = Math.ceil(guests * 0.8 * 3 * hours / 4 - 1e-9);
        const expSin = Math.ceil(guests * 0.2 * 3 * hours / 4 - 1e-9);
        assert.equal(p.totals.alcohol, expAlc);
        assert.equal(p.totals.nonAlcohol, expSin);
        assert.equal(p.totals.drinks, expAlc + expSin);
        assert.equal(p.perRecipe.reduce((a, r) => a + r.portions, 0), p.totals.drinks);
      });
    }
  }
  test('as doses crescem de forma linear com a duração', () => {
    const t = [2, 4, 6, 8].map((h) => plan({ guests: 100, hours: h, alcoholPct: 100 }, ['gin_tonic']).totals.drinks);
    assert.deepEqual(t, [150, 300, 450, 600]);
  });
  test('perfil e tipo de evento alteram o consumo', () => {
    assert.equal(plan({ profile: 'bajo', alcoholPct: 100 }, ['gin_tonic']).totals.drinks, 100);
    assert.equal(plan({ profile: 'alto', alcoholPct: 100 }, ['gin_tonic']).totals.drinks, 200);
    assert.equal(plan({ type: 'bodas', alcoholPct: 100 }, ['gin_tonic']).totals.drinks, 165);
    assert.equal(plan({ type: 'corporativo', alcoholPct: 100 }, ['gin_tonic']).totals.drinks, 120);
  });
  test('parâmetros personalizados', () => {
    const p = calculatePlan({
      event: baseEvent({ alcoholPct: 100 }), selection: [{ id: 'gin_tonic', weight: 1 }], recipes, catalog,
      params: { rates: { moderado: 5 } }
    });
    assert.equal(p.totals.drinks, 250);
  });
});

describe('Seleções', () => {
  test('só coquetéis com álcool: não calcula sem álcool e avisa', () => {
    const p = plan({}, ['mojito', 'cuba_libre']);
    assert.equal(p.totals.nonAlcohol, 0);
    assert.equal(p.totals.alcohol, 120);
    assert.ok(p.warnings.some((w) => w.includes('sem álcool')));
  });
  test('só coquetéis sem álcool: todos os convidados bebem sem álcool', () => {
    const p = plan({}, ['mojito_sin', 'mango_splash']);
    assert.equal(p.totals.alcohol, 0);
    assert.equal(p.totals.nonAlcohol, 150);
    assert.equal(item(p, 'ron_blanco'), undefined);
    assert.equal(p.items.filter((i) => i.category === 'alcohol').length, 0);
  });
  test('0% de quem bebe com receitas alcoólicas: 0 doses e aviso', () => {
    const p = plan({ alcoholPct: 0 }, ['mojito', 'mojito_sin']);
    assert.equal(p.totals.alcohol, 0);
    assert.equal(p.totals.nonAlcohol, 150);
    assert.ok(p.warnings.length > 0);
  });
  test('seleção vazia gera erro em português', () => {
    assert.throws(() => plan({}, []), (e) => e instanceof PlanError && /Selecione pelo menos um coquetel/.test(e.message));
  });
  test('receita duplicada na seleção é contada uma só vez', () => {
    const p = calculatePlan({ event: baseEvent({ alcoholPct: 100 }), selection: [{ id: 'gin_tonic', weight: 1 }, { id: 'gin_tonic', weight: 1 }], recipes, catalog });
    assert.equal(p.perRecipe.length, 1);
    assert.equal(p.totals.drinks, 150);
  });
});

describe('Distribuição por proporção', () => {
  test('a soma sempre bate com o total', () => {
    for (const total of [0, 1, 7, 99, 100, 101, 1234]) {
      const d = distribute(total, [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }]);
      assert.equal(d.reduce((a, x) => a + x.portions, 0), total);
    }
  });
  test('proporções personalizadas 60/30/10', () => {
    const d = distribute(100, [{ id: 'a', weight: 60 }, { id: 'b', weight: 30 }, { id: 'c', weight: 10 }]);
    assert.deepEqual(d.map((x) => x.portions), [60, 30, 10]);
  });
  test('peso 0 exclui a receita; todos em 0 divide igual', () => {
    assert.deepEqual(distribute(10, [{ id: 'a', weight: 0 }, { id: 'b', weight: 5 }]).map((x) => x.portions), [0, 10]);
    assert.deepEqual(distribute(9, [{ id: 'a', weight: 0 }, { id: 'b', weight: 0 }, { id: 'c', weight: 0 }]).map((x) => x.portions), [3, 3, 3]);
  });
  test('no plano, 120 doses 3:1 → 90 mojitos e 30 cuba libre', () => {
    const p = plan({}, ['mojito', 'cuba_libre'], { mojito: 3, cuba_libre: 1 });
    assert.equal(p.perRecipe.find((r) => r.id === 'mojito').portions, 90);
    assert.equal(p.perRecipe.find((r) => r.id === 'cuba_libre').portions, 30);
  });
});

describe('Ingredientes, consolidação e unidades', () => {
  test('cálculo exato dos ingredientes de uma gim-tônica', () => {
    const p = plan({ alcoholPct: 100 }, ['gin_tonic']); // 150 porciones
    close(item(p, 'gin').net, 150 * 50);
    assert.equal(item(p, 'gin').packages, Math.ceil(7500 / 750)); // 10 botellas
    close(item(p, 'agua_tonica').net, 150 * 150);
    assert.equal(item(p, 'agua_tonica').packages, Math.ceil(22500 / 350)); // 65 latas
  });
  test('rum branco repetido em mojito, piña colada e mai tai vira um único item', () => {
    const p = plan({ alcoholPct: 100 }, ['mojito', 'pina_colada', 'mai_tai']); // 50 cada uno
    const ron = p.items.filter((i) => i.id === 'ron_blanco');
    assert.equal(ron.length, 1);
    close(ron[0].net, 50 * 50 + 50 * 50 + 50 * 30);
    assert.equal(ron[0].sources.length, 3);
    assert.equal(new Set(p.items.map((i) => i.id)).size, p.items.length, 'sin duplicados');
  });
  test('suco de limão (ml), gomos e rodelas viram limões com regras cadastradas', () => {
    const p = plan({ alcoholPct: 100, guests: 10, hours: 4 }, ['margarita', 'cuba_libre']); // 30 → 15 + 15
    const lim = item(p, 'limon');
    // margarita: 25 ml jugo (25/30) + 1 rodaja (1/6) ; cuba libre: 10 ml (10/30) + 1 gajo (1/8)
    close(lim.net, 15 * (25 / 30 + 1 / 6) + 15 * (10 / 30 + 1 / 8));
    assert.equal(lim.unit, 'unidad');
    assert.equal(item(p, 'jugo_limon'), undefined, 'el jugo no aparece como artículo separado');
    assert.equal(lim.packages, Math.ceil(lim.net / 14));
  });
  test('as unidades nunca se misturam: cada item mantém a unidade do catálogo', () => {
    const all = recipes.map((r) => r.id);
    const p = plan({ guests: 100, hours: 6 }, all);
    for (const i of p.items) assert.equal(i.unit, catalog.items[i.id].unit, i.id);
    assert.equal(item(p, 'menta').unit, 'hoja');
    assert.equal(item(p, 'fresas').unit, 'g');
    assert.equal(item(p, 'hielo').unit, 'g');
  });
  test('resolvePurchase rejeita regras inválidas', () => {
    const bad = { items: { x: { name: 'X', unit: 'ml', buyAs: { item: 'nada', factor: 1 } } } };
    assert.throws(() => resolvePurchase('x', 10, bad), PlanError);
    const noPkg = { items: { y: { name: 'Y', unit: 'g' } } };
    assert.throws(() => resolvePurchase('y', 10, noPkg), PlanError);
    const mix = { items: { z: { name: 'Z', unit: 'ml', package: { size: 100, unit: 'g' } } } };
    assert.throws(() => resolvePurchase('z', 10, mix), /incompatíveis/);
  });
  test('gelo = gelo das receitas + gelo para gelar bebidas', () => {
    const p = plan({ alcoholPct: 100, guests: 10 }, ['gin_tonic']); // 30 porciones
    close(item(p, 'hielo').net, 30 * 200 + 10 * DEFAULT_PARAMS.coolingIceKgPerGuest * 1000);
    close(p.totals.iceKg, 9);
    assert.equal(p.totals.iceBags, 3);
  });
  test('água para hidratação incluída (consumo responsável)', () => {
    const p = plan({ guests: 10, hours: 4 }, ['mojito_sin']);
    close(item(p, 'agua_hidratacion').net, 10 * 4 * DEFAULT_PARAMS.waterMlPerGuestPerHour);
  });
});

describe('Margem de segurança e arredondamento', () => {
  test('margem de 10% é aplicada à quantidade e depois arredondada para cima', () => {
    const p0 = plan({ alcoholPct: 100, marginPct: 0 }, ['gin_tonic']);
    const p10 = plan({ alcoholPct: 100, marginPct: 10 }, ['gin_tonic']);
    close(item(p10, 'gin').required, item(p0, 'gin').net * 1.1);
    assert.equal(item(p0, 'gin').packages, 10); // 7500 ml exactos → 10 botellas, sin redondeo extra
    assert.equal(item(p10, 'gin').packages, 11); // 8250 ml → 11 botellas
    assert.equal(p10.totals.drinks, p0.totals.drinks, 'el margen no cambia el número de cócteles');
  });
  test('quantidades exatas não são arredondadas a mais (tolerância de ponto flutuante)', () => {
    const p = plan({ alcoholPct: 100, guests: 15, hours: 4, marginPct: 0 }, ['gin_tonic']); // 45 × 50 = 2250 ml = 3 botellas
    assert.equal(item(p, 'gin').packages, 3);
  });
  test('uma quantidade mínima sempre compra pelo menos 1 embalagem', () => {
    const p = plan({ alcoholPct: 100, guests: 1, hours: 1 }, ['whisky_sour']);
    assert.equal(item(p, 'angostura').packages, 1);
    assert.ok(p.items.every((i) => i.packages >= 1));
  });
  test('margem de 30% com 100 convidados e 8 horas', () => {
    const p = plan({ guests: 100, hours: 8, marginPct: 30 }, ['margarita', 'paloma', 'virgin_margarita']);
    for (const i of p.items) {
      close(i.required, i.net * 1.3, i.id);
      assert.ok(i.purchased + 1e-9 >= i.required, `${i.id} compra suficiente`);
      assert.ok(i.purchased - i.required < i.packageSize, `${i.id} no compra una presentación de más`);
    }
  });
});

describe('Validação', () => {
  test('mensagens claras em português', () => {
    const e = validateEvent({ guests: 0, hours: 0, type: 'x', profile: 'y', alcoholPct: 120, marginPct: -1 });
    assert.match(e.guests, /pelo menos 1 convidado/);
    assert.match(e.hours, /mínima/);
    assert.match(e.type, /tipo de celebração/);
    assert.match(e.profile, /perfil/);
    assert.match(e.alcoholPct, /entre 0 e 100/);
    assert.match(e.marginPct, /margem/);
    assert.deepEqual(validateEvent(baseEvent()), {});
  });
  test('convidados não inteiros são rejeitados', () => {
    assert.ok(validateEvent(baseEvent({ guests: 10.5 })).guests);
    assert.throws(() => plan({ guests: 10.5 }, ['mojito']), PlanError);
  });
});

describe('Orçamento', () => {
  test('custos por item, total, por convidado e por coquetel', () => {
    const p = plan({ alcoholPct: 100, guests: 10, hours: 4 }, ['gin_tonic']); // 30 cócteles
    const prices = { gin: 20, agua_tonica: 1.5, hielo: 5, limon: 3 };
    const b = computeBudget(p, prices, {}, catalog);
    const gin = item(p, 'gin'); const ton = item(p, 'agua_tonica'); const hie = item(p, 'hielo'); const lim = item(p, 'limon');
    const expected = gin.packages * 20 + ton.packages * 1.5 + hie.packages * 5 + lim.packages * 3;
    close(b.total, expected);
    close(b.perGuest, expected / 10);
    close(b.perDrink, expected / 30);
    close(b.lines.gin.cost, gin.packages * 20);
    assert.equal(b.priced, 4);
    assert.equal(b.missing, p.items.length - 4);
    close(b.categories.reduce((a, c) => a + c.cost, 0), b.total);
  });
  test('quantidades editadas substituem as calculadas', () => {
    const p = plan({ alcoholPct: 100, guests: 10 }, ['gin_tonic']);
    const b = computeBudget(p, { gin: 20 }, { gin: 7 }, catalog);
    assert.equal(b.lines.gin.packages, 7);
    assert.equal(b.lines.gin.edited, true);
    close(b.total, 140);
  });
  test('preços vazios ou negativos são ignorados', () => {
    const p = plan({ alcoholPct: 100, guests: 10 }, ['gin_tonic']);
    const b = computeBudget(p, { gin: -5, hielo: NaN }, {}, catalog);
    assert.equal(b.total, 0);
    assert.equal(b.priced, 0);
  });
  test('formato de moedas', () => {
    assert.match(formatMoney(1234.5, 'USD'), /1.?234[.,]50/);
    assert.ok(!/[.,]\d\d$/.test(formatMoney(1234, 'CLP').trim()) || formatMoney(1234, 'CLP').includes('1.234'));
    for (const c of ['USD', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'EUR', 'BRL']) assert.ok(formatMoney(10, c).length > 0, c);
  });
});

describe('Exportação', () => {
  test('CSV com BOM, separador ; e uma linha por item', () => {
    const p = plan({}, ['mojito', 'mojito_sin']);
    const csv = buildCSV(p, { prices: { ron_blanco: 15 }, bought: { ron_blanco: true }, currency: 'USD', catalog, eventName: 'Aniver da "Ana"; quintal' });
    assert.ok(csv.startsWith('﻿'));
    const lines = csv.slice(1).split('\r\n');
    const header = lines.findIndex((l) => l.startsWith('Categoria;Produto'));
    assert.ok(header > 0);
    const body = lines.slice(header + 1, header + 1 + p.items.length);
    assert.equal(body.length, p.items.length);
    assert.ok(body.every((l) => l.split(';').length >= 8));
    const ron = body.find((l) => l.includes('Rum branco'));
    assert.ok(ron.endsWith(';Sim'));
    assert.ok(csv.includes('"Aniver da ""Ana""; quintal"'), 'escapa aspas e separadores');
    assert.ok(csv.includes('TOTAL'));
  });
  test('texto para compartilhar inclui categorias e quantidades', () => {
    const p = plan({}, ['mojito']);
    const t = buildShareText(p, { catalog });
    assert.match(t, /Bebidas alcoólicas/);
    assert.match(t, /Rum branco: \d+ × garrafa de 750 ml/);
  });
  test('formato de quantidades', () => {
    assert.equal(formatQty(850, 'ml'), '850 ml');
    assert.match(formatQty(2500, 'ml'), /^2[.,]5 L$/);
    assert.equal(formatQty(9000, 'g'), '9 kg');
    assert.equal(formatQty(1, 'hoja'), '1 folha');
    assert.equal(formatQty(12.2, 'unidad'), '13 unidades');
  });
});
