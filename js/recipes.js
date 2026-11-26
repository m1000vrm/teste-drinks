/** Carga de catálogos JSON (recetas e ingredientes). */

let cache = null;

export async function loadCatalogs() {
  if (cache) return cache;
  const [ingRes, recRes] = await Promise.all([
    fetch('data/ingredients.json', { cache: 'no-cache' }),
    fetch('data/recipes.json', { cache: 'no-cache' })
  ]);
  if (!ingRes.ok || !recRes.ok) throw new Error('Não foi possível carregar os catálogos.');
  const catalog = await ingRes.json();
  const { recipes } = await recRes.json();
  cache = { catalog, recipes, recipesById: Object.fromEntries(recipes.map((r) => [r.id, r])) };
  return cache;
}

/** Texto de búsqueda normalizado (sin acentos, minúsculas). */
export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchIndex(recipe, catalog) {
  return norm([recipe.name, recipe.description, ...recipe.ingredients.map((i) => catalog.items[i.id]?.name || '')].join(' '));
}
