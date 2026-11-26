/**
 * Gera exemplos reais de PDF e CSV com o mesmo código do app.
 * Uso: node tests/generate-samples.mjs  → arquivos em tests/output/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculatePlan } from '../js/calculator.js';
import { computeBudget, buildCSV } from '../js/budget.js';
import { buildPlanPDF } from '../js/pdf.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
const { recipes } = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));
const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
const out = join(root, 'tests/output');
mkdirSync(out, { recursive: true });

const scenarios = [
  {
    file: 'exemplo-aniversario-50', name: 'Aniversário da Sofia', currency: 'BRL',
    event: { guests: 50, hours: 4, type: 'cumpleanos', profile: 'moderado', alcoholPct: 80, marginPct: 10 },
    selection: [['mojito', 100], ['margarita', 50], ['gin_tonic', 50], ['limonada_tropical', 50], ['mojito_sin', 50]],
    prices: { gin: 89.9, ron_blanco: 39.9, tequila: 119, triple_sec: 49.9, hielo: 12, limon: 6.5, menta: 3, agua_tonica: 4.5 },
    overrides: { ron_blanco: 6 }, bought: { gin: true, hielo: true }
  },
  {
    file: 'exemplo-casamento-100-todos', name: 'Casamento de Camila e André', currency: 'BRL',
    event: { guests: 100, hours: 8, type: 'bodas', profile: 'alto', alcoholPct: 75, marginPct: 15 },
    selection: recipes.map((r) => [r.id, 50]),
    prices: { hielo: 12, tequila: 119, ron_blanco: 39.9 }, overrides: {}, bought: {}
  }
];

for (const s of scenarios) {
  const plan = calculatePlan({ event: s.event, selection: s.selection.map(([id, weight]) => ({ id, weight })), recipes, catalog });
  const budget = computeBudget(plan, s.prices, s.overrides, catalog);
  const pdf = buildPlanPDF({
    plan, budget, catalog, recipesById, eventName: s.name,
    eventTypeName: { cumpleanos: 'Aniversário', bodas: 'Casamento' }[s.event.type],
    profileName: { moderado: 'Moderado', alto: 'Alto' }[s.event.profile],
    currency: s.currency, overrides: s.overrides, bought: s.bought
  });
  writeFileSync(join(out, `${s.file}.pdf`), pdf);
  writeFileSync(join(out, `${s.file}.csv`), buildCSV(plan, { prices: s.prices, overrides: s.overrides, bought: s.bought, currency: s.currency, catalog, eventName: s.name }), 'utf8');
  console.log(`${s.file}: ${plan.totals.drinks} coquetéis, ${plan.items.length} produtos, total ${budget.total.toFixed(2)} ${s.currency}, PDF ${pdf.length} bytes`);
}
