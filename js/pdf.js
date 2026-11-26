/**
 * Generador de PDF propio (sin dependencias). Usa las fuentes estándar Helvetica y
 * Helvetica-Bold con codificación WinAnsi (soporta á, é, í, ó, ú, ñ, ü, ¿, ¡, €).
 * Coordenadas en puntos, origen arriba a la izquierda (se convierten al sistema PDF).
 */
import { formatQty, formatMoney, formatNumber } from './format.js';
import { effectivePackages } from './budget.js';

// Anchos de Helvetica (1/1000 em) para ASCII 32..126
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const WINANSI_EXTRA = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };

/** Convierte texto a bytes WinAnsi (como string de 1 byte por carácter). */
export function toWinAnsi(str) {
  let out = '';
  for (const ch of String(str ?? '')) {
    const c = ch.codePointAt(0);
    if (c === 0x00A0 || c === 0x202F || c === 0x2009) out += ' ';
    else if (c >= 32 && c < 127) out += ch;
    else if (c >= 160 && c <= 255) out += ch;
    else if (WINANSI_EXTRA[ch]) out += String.fromCharCode(WINANSI_EXTRA[ch]);
    else if (c === 0x2248) out += '~'; // ≈
    else if (c > 0xFFFF || (c >= 0x2600 && c <= 0x27BF)) continue; // emojis y símbolos
    else out += '?';
  }
  return out;
}

function charWidth(ch, bold) {
  const t = bold ? W_BOLD : W_REG;
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return t[c - 32];
  const base = ch.normalize('NFD')[0];
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return t[b - 32];
  return 556;
}

export function textWidth(str, size, bold = false) {
  let w = 0;
  for (const ch of toWinAnsi(str)) w += charWidth(ch, bold);
  return (w * size) / 1000;
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const hex = (h) => {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(n.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};
const f = (n) => (Math.round(n * 100) / 100).toString();

export class PDFDoc {
  constructor() {
    this.W = 595.28; this.H = 841.89;
    this.pages = [];
    this.addPage();
  }
  addPage() { this.cur = []; this.pages.push(this.cur); return this; }
  _y(y) { return this.H - y; }

  rect(x, y, w, h, { fill, stroke, lw = 1, r = 0 } = {}) {
    const ops = [];
    if (fill) ops.push(`${hex(fill)} rg`);
    if (stroke) ops.push(`${hex(stroke)} RG ${f(lw)} w`);
    if (r > 0) {
      const k = 0.5523 * r;
      const X = x, Y = this._y(y + h), R = x + w, T = this._y(y);
      ops.push(`${f(X + r)} ${f(Y)} m ${f(R - r)} ${f(Y)} l ${f(R - r + k)} ${f(Y)} ${f(R)} ${f(Y + r - k)} ${f(R)} ${f(Y + r)} c`
        + ` ${f(R)} ${f(T - r)} l ${f(R)} ${f(T - r + k)} ${f(R - r + k)} ${f(T)} ${f(R - r)} ${f(T)} c`
        + ` ${f(X + r)} ${f(T)} l ${f(X + r - k)} ${f(T)} ${f(X)} ${f(T - r + k)} ${f(X)} ${f(T - r)} c`
        + ` ${f(X)} ${f(Y + r)} l ${f(X)} ${f(Y + r - k)} ${f(X + r - k)} ${f(Y)} ${f(X + r)} ${f(Y)} c h`);
    } else {
      ops.push(`${f(x)} ${f(this._y(y + h))} ${f(w)} ${f(h)} re`);
    }
    ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.cur.push(ops.join(' '));
    return this;
  }

  line(x1, y1, x2, y2, { color = '#E9E1CF', lw = 0.8 } = {}) {
    this.cur.push(`${hex(color)} RG ${f(lw)} w ${f(x1)} ${f(this._y(y1))} m ${f(x2)} ${f(this._y(y2))} l S`);
    return this;
  }

  circle(cx, cy, r, { fill = '#000000' } = {}) {
    const k = 0.5523 * r, X = cx, Y = this._y(cy);
    this.cur.push(`${hex(fill)} rg ${f(X + r)} ${f(Y)} m ${f(X + r)} ${f(Y + k)} ${f(X + k)} ${f(Y + r)} ${f(X)} ${f(Y + r)} c ${f(X - k)} ${f(Y + r)} ${f(X - r)} ${f(Y + k)} ${f(X - r)} ${f(Y)} c ${f(X - r)} ${f(Y - k)} ${f(X - k)} ${f(Y - r)} ${f(X)} ${f(Y - r)} c ${f(X + k)} ${f(Y - r)} ${f(X + r)} ${f(Y - k)} ${f(X + r)} ${f(Y)} c f`);
    return this;
  }

  /** Trazo con comandos M, L, Q, Z en un sistema local escalado. */
  path(cmds, { x = 0, y = 0, s = 1, fill, stroke, lw = 1 } = {}) {
    const P = (px, py) => [x + px * s, this._y(y + py * s)];
    let cx = 0, cy = 0;
    const out = [];
    for (const c of cmds) {
      if (c[0] === 'M') { [cx, cy] = [c[1], c[2]]; out.push(`${P(cx, cy).map(f).join(' ')} m`); }
      else if (c[0] === 'L') { [cx, cy] = [c[1], c[2]]; out.push(`${P(cx, cy).map(f).join(' ')} l`); }
      else if (c[0] === 'Q') {
        const [qx, qy, ex, ey] = c.slice(1);
        const c1 = [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)];
        const c2 = [ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey)];
        out.push(`${[...P(...c1), ...P(...c2), ...P(ex, ey)].map(f).join(' ')} c`);
        [cx, cy] = [ex, ey];
      } else if (c[0] === 'Z') out.push('h');
    }
    const pre = [];
    if (fill) pre.push(`${hex(fill)} rg`);
    if (stroke) pre.push(`${hex(stroke)} RG ${f(lw)} w 1 J`);
    this.cur.push(`${pre.join(' ')} ${out.join(' ')} ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    return this;
  }

  text(str, x, y, { size = 10, bold = false, color = '#17302A', align = 'left', maxWidth } = {}) {
    let s = toWinAnsi(str);
    if (maxWidth && textWidth(s, size, bold) > maxWidth) {
      while (s.length > 1 && textWidth(s + '...', size, bold) > maxWidth) s = s.slice(0, -1);
      s = s.trimEnd() + '...';
    }
    const w = textWidth(s, size, bold);
    const tx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${hex(color)} rg ${f(tx)} ${f(this._y(y))} Td (${esc(s)}) Tj ET`);
    return this;
  }

  /** Divide un texto en líneas que caben en maxWidth. */
  wrap(str, size, maxWidth, bold = false) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (textWidth(t, size, bold) > maxWidth && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  output() {
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const catalogId = add(null);
    const pagesId = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds = [];
    for (const ops of this.pages) {
      const content = ops.join('\n');
      const cId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cId} 0 R >>`));
    }
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info << /Title (Cocktail Planner Pro) /Producer (Cocktail Planner Pro) >> >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xFF;
    return bytes;
  }
}

const C = { green: '#174E3A', green9: '#0F3829', green1: '#DDF0DF', green05: '#EEF7EF', yellow: '#F6C453', coral: '#F07868', orange: '#F6A33B', cream: '#FFF9EF', cream2: '#F6EEDD', ink: '#17302A', ink2: '#4D6159', ink3: '#7C8D86', line: '#E9E1CF', white: '#FFFFFF' };
const CAT_COLORS = { alcohol: C.green, frutas: '#5E9E3E', mezcladores: '#2C8C9A', complementos: C.orange, hielo: '#7FB2D6', decoracion: C.coral, utensilios: '#8C7A5B' };

function drawLogo(doc, x, y, s) {
  doc.rect(x, y, 48 * s, 48 * s, { fill: C.green9, r: 14 * s });
  doc.path([['M', 30, 9], ['Q', 40, 8, 41, 18], ['Q', 33, 19, 30, 9], ['Z']], { x, y, s, fill: '#7FCB8C' });
  doc.path([['M', 10, 17], ['L', 38, 17], ['Q', 37, 30, 24, 31], ['Q', 11, 30, 10, 17], ['Z']], { x, y, s, fill: C.yellow });
  doc.path([['M', 12.5, 20], ['L', 35.5, 20], ['Q', 34, 28.5, 24, 29], ['Q', 14, 28.5, 12.5, 20], ['Z']], { x, y, s, fill: C.coral });
  doc.path([['M', 24, 31], ['L', 24, 38]], { x, y, s, stroke: C.cream, lw: 2.4 * s });
  doc.path([['M', 17, 39], ['L', 31, 39]], { x, y, s, stroke: C.cream, lw: 2.4 * s });
  doc.circle(x + 33 * s, y + 16 * s, 3 * s, { fill: C.orange });
}

/**
 * Construye el PDF profesional del plan.
 * @returns {Uint8Array}
 */
export function buildPlanPDF({ plan, budget, catalog, recipesById, eventName, eventTypeName, profileName, currency, overrides, bought }) {
  const doc = new PDFDoc();
  const M = 40, W = doc.W, RIGHT = W - M, BOTTOM = doc.H - 56;
  let y = 0;

  const smallHeader = () => {
    doc.rect(0, 0, W, 34, { fill: C.green });
    drawLogo(doc, M, 7, 0.42);
    doc.text('Cocktail Planner Pro', M + 28, 22, { size: 10, bold: true, color: C.white });
    doc.text(eventName || 'Plano do bar', RIGHT, 22, { size: 9, color: C.green1, align: 'right', maxWidth: 300 });
    y = 56;
  };
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); smallHeader(); return true; } return false; };
  const section = (title) => {
    ensure(40);
    y += 10;
    doc.text(title, M, y + 12, { size: 13.5, bold: true, color: C.green9 });
    doc.rect(M, y + 18, 26, 3, { fill: C.yellow, r: 1.5 });
    y += 30;
  };

  // ---- Cabecera
  doc.rect(0, 0, W, 112, { fill: C.green });
  doc.circle(W - 40, 10, 70, { fill: '#22644B' });
  doc.circle(W - 70, 96, 22, { fill: C.yellow });
  drawLogo(doc, M, 30, 1);
  doc.text('COCKTAIL PLANNER PRO', M + 62, 52, { size: 19, bold: true, color: C.white });
  doc.text('Plano do bar e lista de compras', M + 62, 70, { size: 10.5, color: C.green1 });
  const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
  doc.text(`Gerado em ${today}`, M + 62, 86, { size: 8.5, color: C.green1 });
  y = 132;

  // ---- Datos del evento
  doc.text(eventName || 'Meu evento', M, y + 8, { size: 16, bold: true, color: C.green9, maxWidth: W - 2 * M });
  y += 22;
  const fields = [
    ['Tipo de celebração', eventTypeName], ['Convidados', formatNumber(plan.event.guests, 0)],
    ['Duração', `${formatNumber(plan.event.hours, 1)} horas`], ['Perfil de consumo', profileName],
    ['Bebem álcool', `${plan.event.alcoholPct}%`], ['Margem de segurança', `${plan.event.marginPct}%`],
    ['Coquetéis por pessoa', formatNumber(plan.estimate.perPerson, 2)], ['Moeda', currency]
  ];
  const cw = (W - 2 * M - 3 * 8) / 4;
  fields.forEach(([k, v], i) => {
    const cx = M + (i % 4) * (cw + 8), cy = y + Math.floor(i / 4) * 50;
    doc.rect(cx, cy, cw, 42, { fill: C.white, stroke: C.line, lw: 0.8, r: 8 });
    doc.text(k.toUpperCase(), cx + 10, cy + 15, { size: 6.8, bold: true, color: C.ink3, maxWidth: cw - 16 });
    doc.text(v, cx + 10, cy + 32, { size: 11, bold: true, color: C.ink, maxWidth: cw - 16 });
  });
  y += 104;

  // ---- KPIs
  const t = plan.totals;
  const kpis = [
    ['Coquetéis no total', formatNumber(t.drinks, 0)], ['Com álcool', formatNumber(t.alcohol, 0)],
    ['Sem álcool', formatNumber(t.nonAlcohol, 0)], ['Gelo', `${formatNumber(t.iceKg, 1)} kg`],
    ['Garrafas de bebida', formatNumber(t.alcoholBottles, 0)]
  ];
  const kw = (W - 2 * M - 4 * 8) / 5;
  kpis.forEach(([k, v], i) => {
    const kx = M + i * (kw + 8);
    doc.rect(kx, y, kw, 54, { fill: i === 0 ? C.green : C.cream2, r: 10 });
    doc.text(v, kx + 12, y + 28, { size: 17, bold: true, color: i === 0 ? C.white : C.green9, maxWidth: kw - 18 });
    doc.text(k, kx + 12, y + 44, { size: 7.8, bold: true, color: i === 0 ? C.green1 : C.ink2, maxWidth: kw - 18 });
  });
  y += 66;

  // ---- Recetas
  section('Coquetéis selecionados');
  const rh = (cols) => {
    doc.line(M, y + 14, RIGHT, y + 14, { color: C.green, lw: 1.2 });
    cols.forEach(([txt, x, align]) => doc.text(txt, x, y + 9, { size: 7.5, bold: true, color: C.ink3, align }));
    y += 20;
  };
  const recipeCols = [['COQUETEL', M], ['TIPO', M + 200], ['COPO', M + 280], ['PROPORÇÃO', RIGHT - 70, 'right'], ['DOSES', RIGHT, 'right']];
  rh(recipeCols);
  for (const r of plan.perRecipe) {
    if (ensure(20)) rh(recipeCols);
    const rec = recipesById[r.id];
    doc.circle(M + 4, y + 7, 3.2, { fill: rec?.visual?.bottom || C.coral });
    doc.text(r.name, M + 14, y + 10, { size: 9.5, bold: true, maxWidth: 180 });
    doc.text(r.type === 'alcohol' ? 'Com álcool' : 'Sem álcool', M + 200, y + 10, { size: 9, color: C.ink2 });
    doc.text(catalog.glasses[r.glass]?.name || r.glass, M + 280, y + 10, { size: 9, color: C.ink2, maxWidth: 140 });
    doc.text(`${formatNumber(r.share * 100, 0)}%`, RIGHT - 70, y + 10, { size: 9, color: C.ink2, align: 'right' });
    doc.text(formatNumber(r.portions, 0), RIGHT, y + 10, { size: 10, bold: true, align: 'right' });
    doc.line(M, y + 16, RIGHT, y + 16);
    y += 19;
  }

  // ---- Lista de compras
  section('Lista de compras');
  const X = { box: M, name: M + 16, need: M + 190, pres: M + 268, buy: M + 412, price: M + 468, sub: RIGHT };
  const listCols = [['', X.box], ['PRODUTO', X.name], ['NECESSÁRIO', X.need], ['EMBALAGEM', X.pres], ['COMPRAR', X.buy, 'right'], ['PREÇO', X.price, 'right'], ['SUBTOTAL', X.sub, 'right']];
  rh(listCols);
  const cats = catalog.categories.slice().sort((a, b) => a.order - b.order);
  for (const c of cats) {
    const items = plan.items.filter((i) => i.category === c.id);
    if (!items.length) continue;
    if (ensure(44)) rh(listCols);
    const cb = budget.categories.find((x) => x.id === c.id);
    doc.rect(M, y, RIGHT - M, 20, { fill: C.green05, r: 6 });
    doc.rect(M, y, 4, 20, { fill: CAT_COLORS[c.id] || C.green });
    doc.text(c.name, M + 12, y + 13.5, { size: 9.5, bold: true, color: C.green9 });
    doc.text(cb && cb.priced ? formatMoney(cb.cost, currency) : '—', RIGHT - 6, y + 13.5, { size: 9.5, bold: true, color: C.green9, align: 'right' });
    y += 24;
    for (const it of items) {
      if (ensure(22)) rh(listCols);
      const line = budget.lines[it.id];
      const isBought = !!bought[it.id];
      doc.rect(X.box, y + 2, 9, 9, { stroke: C.green, lw: 1, r: 2, fill: isBought ? C.green : undefined });
      doc.text(it.name, X.name, y + 10, { size: 9, bold: true, maxWidth: X.need - X.name - 8, color: isBought ? C.ink3 : C.ink });
      doc.text(formatQty(it.required, it.unit), X.need, y + 10, { size: 8.5, color: C.ink2, maxWidth: X.pres - X.need - 6 });
      doc.text(it.packageLabel, X.pres, y + 10, { size: 8.5, color: C.ink2, maxWidth: X.buy - X.pres - 34 });
      doc.text(formatNumber(effectivePackages(it, overrides), 0), X.buy, y + 10, { size: 10, bold: true, align: 'right' });
      doc.text(line.price === null ? '—' : formatMoney(line.price, currency), X.price, y + 10, { size: 8.5, color: C.ink2, align: 'right' });
      doc.text(line.price === null ? '—' : formatMoney(line.cost, currency), X.sub, y + 10, { size: 9, bold: true, align: 'right' });
      doc.line(X.name, y + 16, RIGHT, y + 16);
      y += 19;
    }
    y += 4;
  }

  // ---- Presupuesto
  ensure(120);
  y += 8;
  doc.rect(M, y, RIGHT - M, 96, { fill: C.green, r: 14 });
  doc.rect(M + 284, y + 16, 0.8, 64, { fill: '#3C7A60' });
  doc.text('ORÇAMENTO ESTIMADO', M + 18, y + 22, { size: 8, bold: true, color: C.green1 });
  doc.text(formatMoney(budget.total, currency), M + 18, y + 52, { size: 24, bold: true, color: C.white, maxWidth: 260 });
  doc.text(budget.missing ? `${budget.missing} de ${budget.count} produtos sem preço` : 'Todos os produtos têm preço', M + 18, y + 74, { size: 8.5, color: C.green1 });
  const bx = M + 300;
  [['Por convidado', formatMoney(budget.perGuest, currency)], ['Por coquetel', formatMoney(budget.perDrink, currency)]].forEach(([k, v], i) => {
    doc.text(k, bx, y + 34 + i * 30, { size: 8.5, color: C.green1 });
    doc.text(v, RIGHT - 18, y + 34 + i * 30, { size: 12, bold: true, color: C.yellow, align: 'right' });
  });
  y += 110;

  // ---- Cristalería y equipo
  section('Copos e equipamentos');
  const glassTxt = plan.glassware.map((g) => `${g.name}: ${formatNumber(g.count, 0)} doses`).join('   •   ');
  const eqTxt = plan.equipment.map((e) => e.name).join('   •   ');
  for (const [label, txt] of [['Copos sugeridos', glassTxt], ['Equipamento do bar', eqTxt]]) {
    const lines = doc.wrap(txt, 9, RIGHT - M - 130);
    ensure(lines.length * 13 + 10);
    doc.text(label, M, y + 10, { size: 9, bold: true, color: C.green9 });
    lines.forEach((l, i) => doc.text(l, M + 130, y + 10 + i * 13, { size: 9, color: C.ink2 }));
    y += lines.length * 13 + 10;
  }

  // ---- Recomendaciones
  const recs = [
    'As quantidades são estimativas para planejar as compras, não uma garantia nem uma meta de consumo.',
    'Deixe água fresca disponível durante todo o evento e ofereça sempre opções sem álcool.',
    'Não sirva álcool a menores de 18 anos nem a pessoas embriagadas.',
    'Organize a volta segura: motorista da rodada, táxi ou transporte por aplicativo.'
  ];
  const recLines = recs.flatMap((r) => doc.wrap(r, 8.8, RIGHT - M - 40));
  ensure(recLines.length * 12 + 44);
  y += 12;
  const boxH = recLines.length * 12 + 32;
  doc.rect(M, y, RIGHT - M, boxH, { fill: '#FFF4DE', r: 12 });
  doc.text('Celebre com responsabilidade', M + 16, y + 18, { size: 10, bold: true, color: C.green9 });
  let ry = y + 34;
  for (const r of recs) {
    const ls = doc.wrap(r, 8.8, RIGHT - M - 40);
    doc.circle(M + 20, ry - 3, 1.8, { fill: C.orange });
    ls.forEach((l, i) => doc.text(l, M + 28, ry + i * 12, { size: 8.8, color: C.ink2 }));
    ry += ls.length * 12;
  }
  y += boxH;

  // ---- Pie de página en todas las hojas
  const n = doc.pages.length;
  doc.pages.forEach((p, i) => {
    doc.cur = p;
    doc.line(M, doc.H - 34, RIGHT, doc.H - 34, { color: C.line });
    doc.text('Cocktail Planner Pro · Estimativas para planejar. Aproveite com responsabilidade.', M, doc.H - 20, { size: 7.5, color: C.ink3 });
    doc.text(`Página ${i + 1} de ${n}`, RIGHT, doc.H - 20, { size: 7.5, bold: true, color: C.ink3, align: 'right' });
  });
  return doc.output();
}
