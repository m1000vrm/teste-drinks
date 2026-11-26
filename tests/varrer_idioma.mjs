/**
 * Procura palavras em espanhol nos textos visíveis do app:
 * strings do código (index.html e js/*.js) e campos de texto dos catálogos JSON.
 * Uso: node tests/varrer_idioma.mjs   (sai com código 1 se encontrar algo)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const textos = [];

// HTML: texto fora das tags e atributos visíveis
const html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
for (const m of html.matchAll(/>([^<]+)</g)) textos.push(['index.html', m[1]]);
for (const m of html.matchAll(/(?:placeholder|aria-label|content|title)="([^"]+)"/g)) textos.push(['index.html', m[1]]);

// JS: literais de string (ignora comentários)
for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) {
  const src = readFileSync(join(root, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/'([^'\n]{3,})'|`([^`]{3,})`/g)) textos.push([f, (m[1] || m[2]).replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]+>/g, ' ')]);
}

// JSON: campos visíveis
const ing = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
for (const c of ing.categories) textos.push(['ingredients.json', c.name]);
for (const it of Object.values(ing.items)) { textos.push(['ingredients.json', it.name]); if (it.package) textos.push(['ingredients.json', it.package.label]); if (it.buyAs) textos.push(['ingredients.json', it.buyAs.rule]); }
for (const g of [...Object.values(ing.equipment), ...Object.values(ing.glasses)]) textos.push(['ingredients.json', g.name]);
const { recipes } = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));
for (const r of recipes) for (const t of [r.name, r.description, r.garnish, ...r.steps]) textos.push(['recipes.json', t]);

const nomesProprios = /Piña Colada|Cuba Libre|Moscow Mule|Sex on the Beach|Tequila Sunrise|Mai Tai|Paloma|Whisky Sour|Aperol Spritz|Cosmopolitan|Cocktail Planner Pro|Planner|muddler|jigger|triple sec|orgeat|ginger beer|highball|old fashioned|coupé|hurricane|Manrope|Fraunces|fonts\.g/gi;
const suspeitos = /\b(y|el|los|las|del|al|una|unos|con|pero|muy|también|puede|hasta|sin|tu|tus|cóctel|cócteles|receta|recetas|hielo|jugo|lima|vaso|copa|copas|fiesta|naranja|agua|fresa|fresas|piña|durazno|maracuyá|sandía|menta|ron|licuadora|coctelera|jarabe|cuchara|gajo|rodaja|cáscara|botella|botellas|invitado|invitados|preparación|consejo|dificultad|porción|porciones|presupuesto|moneda|cantidad|precio|precios|descargar|compartir|elige|agregar|quitar|volver|empezar|nuevo|paso|datos|evento\b.*\bde tu|presentación|bolsa|paquete|envase|unidad|hoja|hojas)\b|\w+ción\b|ñ/gi;
const achados = new Map();
for (const [f, t] of textos) {
  if (/[(){};=]|=>/.test(t)) continue; // trecho de código, não texto
  const limpo = t.replace(nomesProprios, ' ');
  for (const m of limpo.matchAll(suspeitos)) {
    const k = `${f}: "${m[0]}"`;
    if (!achados.has(k)) achados.set(k, limpo.trim().slice(0, 90));
  }
}
// Identificadores internos (não aparecem para o usuário) que coincidem com palavras em espanhol
const internos = /^(unidad|hoja|botella|lata|bolsa|paquete|envase|alcohol|sin|hielo|receta|extra|hielera)$/i;
for (const k of [...achados.keys()]) {
  const palavra = k.split('"')[1];
  const ctx = achados.get(k);
  if (internos.test(ctx) || internos.test(palavra) && /^[a-z_]+$/.test(ctx)) achados.delete(k);
}
if (achados.size) {
  console.log(`${achados.size} ocorrência(s) suspeita(s):`);
  for (const [k, ctx] of achados) console.log(`- ${k} → ${ctx}`);
  process.exit(1);
}
console.log(`OK: ${textos.length} textos verificados, nenhum termo em espanhol.`);
