/** Formatação de quantidades e moedas (pt-BR). Módulo puro. */

export const CURRENCIES = [
  { code: 'BRL', name: 'Real brasileiro', locale: 'pt-BR' },
  { code: 'USD', name: 'Dólar americano', locale: 'pt-BR' },
  { code: 'EUR', name: 'Euro', locale: 'pt-BR' },
  { code: 'MXN', name: 'Peso mexicano', locale: 'pt-BR' },
  { code: 'COP', name: 'Peso colombiano', locale: 'pt-BR' },
  { code: 'ARS', name: 'Peso argentino', locale: 'pt-BR' },
  { code: 'CLP', name: 'Peso chileno', locale: 'pt-BR' },
  { code: 'PEN', name: 'Sol peruano', locale: 'pt-BR' }
];

const nf = (max = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max, minimumFractionDigits: 0 });

export function formatNumber(n, max = 1) {
  return nf(max).format(n);
}

/** Quantidade legível: ml → L, g → kg, unidades e folhas com plural. */
export function formatQty(qty, unit) {
  const q = Math.max(0, qty);
  switch (unit) {
    case 'ml':
      return q >= 1000 ? `${formatNumber(q / 1000, 2)} L` : `${formatNumber(Math.ceil(q - 1e-9), 0)} ml`;
    case 'g':
      return q >= 1000 ? `${formatNumber(q / 1000, 2)} kg` : `${formatNumber(Math.ceil(q - 1e-9), 0)} g`;
    case 'hoja': {
      const n = Math.ceil(q - 1e-9);
      return `${formatNumber(n, 0)} ${n === 1 ? 'folha' : 'folhas'}`;
    }
    case 'unidad': {
      const n = Math.ceil(q - 1e-9);
      return `${formatNumber(n, 0)} ${n === 1 ? 'unidade' : 'unidades'}`;
    }
    default:
      return `${formatNumber(q, 2)} ${unit}`;
  }
}

/** Quantidade por dose, como se mede no preparo. */
export function formatPortion(qty, unit) {
  const labels = { ml: 'ml', g: 'g', hoja: qty === 1 ? 'folha' : 'folhas', unidad: qty === 1 ? 'unidade' : 'unidades' };
  return `${formatNumber(qty, 2)} ${labels[unit] || unit}`;
}

export function packagesLabel(n, kind) {
  const names = {
    botella: ['garrafa', 'garrafas'], lata: ['lata', 'latas'], bolsa: ['saco', 'sacos'],
    paquete: ['pacote', 'pacotes'], envase: ['caixa', 'caixas'], unidad: ['unidade', 'unidades']
  };
  const [s, p] = names[kind] || ['unidade', 'unidades'];
  return `${formatNumber(n, 0)} ${n === 1 ? s : p}`;
}

export function currencyInfo(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

export function formatMoney(value, code) {
  const c = currencyInfo(code);
  const noDecimals = ['CLP', 'COP'].includes(c.code);
  return new Intl.NumberFormat(c.locale, {
    style: 'currency', currency: c.code,
    minimumFractionDigits: noDecimals ? 0 : 2, maximumFractionDigits: noDecimals ? 0 : 2
  }).format(value || 0);
}
