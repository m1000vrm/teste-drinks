/**
 * Ilustraciones vectoriales de cócteles (SVG generado). Sin imágenes externas:
 * carga instantánea, nítidas en cualquier pantalla y coherentes con la identidad.
 * Si una receta tiene `photo`, la interfaz muestra la fotografía en su lugar.
 */

const GLASSES = {
  highball: {
    path: 'M64 58 L136 58 L132 212 Q131.5 220 124 220 L76 220 Q68.5 220 68 212 Z',
    rim: [64, 136, 58], liquidTop: 78, hl: 'M74 70 L77 206'
  },
  rocks: {
    path: 'M50 110 L150 110 L145 210 Q144.5 220 135 220 L65 220 Q55.5 220 55 210 Z',
    rim: [50, 150, 110], liquidTop: 126, hl: 'M60 122 L64 206'
  },
  coupe: {
    path: 'M40 96 L160 96 Q158 150 100 154 Q42 150 40 96 Z',
    rim: [40, 160, 96], liquidTop: 104, stem: [154, 212], hl: 'M52 104 Q56 132 76 142'
  },
  margarita: {
    path: 'M28 86 L172 86 Q166 114 126 121 Q108 125 106 146 L94 146 Q92 125 74 121 Q34 114 28 86 Z',
    rim: [28, 172, 86], liquidTop: 92, stem: [146, 212], hl: 'M40 94 Q52 110 72 114'
  },
  hurricane: {
    path: 'M70 52 L130 52 Q138 92 122 120 Q110 142 126 172 Q136 198 114 204 L86 204 Q64 198 74 172 Q90 142 78 120 Q62 92 70 52 Z',
    rim: [70, 130, 52], liquidTop: 66, stem: [204, 212], hl: 'M78 64 Q74 96 86 120'
  },
  balon: {
    path: 'M56 70 L144 70 Q172 122 146 160 Q128 182 100 182 Q72 182 54 160 Q28 122 56 70 Z',
    rim: [56, 144, 70], liquidTop: 104, stem: [182, 212], hl: 'M60 96 Q50 130 66 156'
  },
  vino: {
    path: 'M62 60 L138 60 Q150 122 128 150 Q116 164 100 164 Q84 164 72 150 Q50 122 62 60 Z',
    rim: [62, 138, 60], liquidTop: 92, stem: [164, 212], hl: 'M68 86 Q62 120 76 144'
  },
  mule: {
    path: 'M58 92 L142 92 L138 212 Q137.5 220 130 220 L70 220 Q62.5 220 62 212 Z',
    rim: [58, 142, 92], liquidTop: 96, opaque: true, hl: 'M70 104 L73 208'
  }
};

let uid = 0;

function iceCubes(g, top, clip) {
  const [x1, x2] = [g.rim[0] + 14, g.rim[1] - 14];
  const w = x2 - x1;
  const cubes = [
    [x1 + w * 0.08, top + 8, -12], [x1 + w * 0.44, top + 3, 9], [x1 + w * 0.22, top + 30, 18], [x1 + w * 0.6, top + 34, -8]
  ];
  return `<g clip-path="url(#${clip})" opacity=".55">${cubes.map(([x, y, r]) =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="24" height="22" rx="5" transform="rotate(${r} ${(x + 12).toFixed(1)} ${(y + 11).toFixed(1)})" fill="#fff" stroke="#fff" stroke-opacity=".9"/>`).join('')}</g>`;
}

function bubbles(g, top, clip) {
  const pts = [[0.2, 0.7], [0.32, 0.45], [0.5, 0.82], [0.66, 0.55], [0.78, 0.76], [0.42, 0.3], [0.58, 0.95]];
  const [x1, x2] = [g.rim[0] + 12, g.rim[1] - 12];
  const bottom = 205;
  return `<g clip-path="url(#${clip})" fill="#fff" opacity=".7">${pts.map(([px, py], i) =>
    `<circle cx="${(x1 + (x2 - x1) * px).toFixed(1)}" cy="${(top + (bottom - top) * py).toFixed(1)}" r="${(i % 3) + 1.6}"/>`).join('')}</g>`;
}

const G = {
  lime: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="19" fill="#7DB43C"/><circle r="16" fill="#E4F2B5"/><circle r="13.5" fill="#B9DB62"/>${[0, 60, 120, 180, 240, 300].map((a) => `<line x1="0" y1="0" x2="${(13 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(13 * Math.sin(a * Math.PI / 180)).toFixed(1)}" stroke="#E4F2B5" stroke-width="1.6"/>`).join('')}<circle r="2.2" fill="#E4F2B5"/></g>`,
  orange: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="20" fill="#E9861F"/><circle r="17" fill="#FFE2B0"/><circle r="14.5" fill="#F8A93B"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="0" x2="${(14 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(14 * Math.sin(a * Math.PI / 180)).toFixed(1)}" stroke="#FFE2B0" stroke-width="1.4"/>`).join('')}<circle r="2.4" fill="#FFE2B0"/></g>`,
  mint: (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 18 Q2 0 -2 -16" stroke="#2F7A45" stroke-width="2" fill="none"/>${[[-9, -14, -35], [8, -10, 30], [-10, 0, -50], [9, 4, 45], [-1, -22, 0]].map(([dx, dy, r]) => `<ellipse cx="${dx}" cy="${dy}" rx="6.5" ry="11" transform="rotate(${r} ${dx} ${dy})" fill="#3E9A55"/><path d="M${dx} ${dy - 8} L${dx} ${dy + 8}" transform="rotate(${r} ${dx} ${dy})" stroke="#7FCB8C" stroke-width="1"/>`).join('')}</g>`,
  cherry: (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 0 Q4 -18 16 -26" stroke="#5B7F2B" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle r="8.5" fill="#C8213A"/><circle cx="-2.8" cy="-2.8" r="2.4" fill="#fff" opacity=".55"/></g>`,
  pineapple: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-6 -28 Q-14 -44 -4 -50 Q-2 -38 0 -30 Q4 -46 14 -48 Q10 -34 4 -28 Z" fill="#3E9A55"/><path d="M-20 -26 L20 -26 L0 16 Z" fill="#F6C453" stroke="#E2A72E" stroke-width="2" stroke-linejoin="round"/><path d="M-12 -18 L12 -18 M-7 -8 L7 -8" stroke="#E2A72E" stroke-width="1.6"/><path d="M-22 -28 L22 -28" stroke="#C9922A" stroke-width="4" stroke-linecap="round"/></g>`,
  strawberry: (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 18 Q-18 4 -15 -8 Q-12 -16 0 -13 Q12 -16 15 -8 Q18 4 0 18 Z" fill="#E8435A"/><path d="M-10 -12 L-4 -19 L0 -13 L4 -19 L10 -12 Q0 -8 -10 -12 Z" fill="#3E9A55"/>${[[-6, -4], [4, -5], [-2, 4], [7, 3], [-8, 5], [1, 11]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx=".9" ry="1.5" fill="#FFE07A"/>`).join('')}</g>`,
  watermelon: (x, y) => `<g transform="translate(${x} ${y}) rotate(-12)"><path d="M-24 -18 Q0 -26 24 -18 L0 22 Z" fill="#F07868"/><path d="M-24 -18 Q0 -26 24 -18" stroke="#3E9A55" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-24 -18 Q0 -26 24 -18" stroke="#DDF0DF" stroke-width="2" fill="none" transform="translate(0 4)"/>${[[-8, -8], [6, -9], [-1, 2]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="1.6" ry="2.6" fill="#2C2C2C"/>`).join('')}</g>`,
  umbrella: (x, y) => `<g transform="translate(${x} ${y}) rotate(18)"><path d="M0 -20 L0 34" stroke="#C9922A" stroke-width="2.2" stroke-linecap="round"/><path d="M-26 -18 Q0 -48 26 -18 Q19 -23 13 -18 Q6 -23 0 -18 Q-6 -23 -13 -18 Q-19 -23 -26 -18 Z" fill="#F07868"/><path d="M0 -40 L-13 -18 M0 -40 L13 -18" stroke="#FFF9EF" stroke-width="1.6" opacity=".8"/></g>`,
  rosemary: (x, y) => `<g transform="translate(${x} ${y}) rotate(-14)"><path d="M0 26 L0 -40" stroke="#5C6B3C" stroke-width="2" stroke-linecap="round"/>${Array.from({ length: 8 }, (_, i) => { const yy = 18 - i * 7; return `<path d="M0 ${yy} q-9 -3 -11 -9 M0 ${yy - 3} q9 -3 11 -9" stroke="#4F7F52" stroke-width="2.6" stroke-linecap="round" fill="none"/>`; }).join('')}</g>`,
  twist: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-14 -20 Q8 -22 6 -10 Q4 0 -10 0 Q-20 2 -14 12 Q-8 22 12 18" stroke="#F6A33B" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-14 -20 Q8 -22 6 -10 Q4 0 -10 0 Q-20 2 -14 12 Q-8 22 12 18" stroke="#FFD08A" stroke-width="2" fill="none" stroke-linecap="round"/></g>`
};

function straw(g) {
  const [x1, x2, y] = g.rim;
  const x = x1 + (x2 - x1) * 0.62;
  return `<g transform="rotate(14 ${x} ${y})"><rect x="${x - 3.5}" y="${y - 46}" width="7" height="120" rx="3.5" fill="#fff"/><g clip-path="none">${Array.from({ length: 8 }, (_, i) => `<rect x="${x - 3.5}" y="${y - 46 + i * 15}" width="7" height="7" fill="#F07868"/>`).join('')}</g></g>`;
}

/**
 * @param {object} recipe receta del catálogo
 * @param {object} [opts] { bg: true }
 * @returns {string} SVG
 */
export function cocktailSVG(recipe, opts = {}) {
  const g = GLASSES[recipe.glass] || GLASSES.highball;
  const v = recipe.visual || {};
  const id = `c${++uid}`;
  const clip = `${id}clip`;
  const top = v.frozen ? g.rim[2] + 2 : g.liquidTop;
  const [x1, x2, ry] = g.rim;
  const parts = [];

  parts.push(`<defs>
    <linearGradient id="${id}liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.top}"/><stop offset="1" stop-color="${v.bottom}"/></linearGradient>
    <linearGradient id="${id}cu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B8693A"/><stop offset=".35" stop-color="#F2A970"/><stop offset=".6" stop-color="#C97945"/><stop offset="1" stop-color="#8E4A26"/></linearGradient>
    <radialGradient id="${id}bg" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="${v.bottom}" stop-opacity=".30"/><stop offset="1" stop-color="${v.bottom}" stop-opacity="0"/></radialGradient>
    <clipPath id="${clip}"><path d="${g.path}"/></clipPath>
  </defs>`);

  if (opts.bg !== false) parts.push(`<ellipse cx="100" cy="140" rx="96" ry="96" fill="url(#${id}bg)"/>`);
  // sombra
  parts.push(`<ellipse cx="100" cy="224" rx="${g.stem ? 38 : (x2 - x1) / 2 + 4}" ry="6" fill="#174E3A" opacity=".10"/>`);

  if (v.straw && !g.opaque) parts.push(straw(g));

  // pie y tallo
  if (g.stem) {
    parts.push(`<path d="M97 ${g.stem[0]} L97 ${g.stem[1]} M103 ${g.stem[0]} L103 ${g.stem[1]}" stroke="#CFE3D8" stroke-width="2"/><rect x="97" y="${g.stem[0]}" width="6" height="${g.stem[1] - g.stem[0]}" fill="#EAF4EE" opacity=".9"/><ellipse cx="100" cy="${g.stem[1] + 3}" rx="34" ry="6" fill="#EAF4EE" stroke="#CFE3D8" stroke-width="1.5"/>`);
  }

  if (g.opaque) {
    // taza de cobre: cuerpo opaco y bebida visible solo en la boca
    parts.push(`<path d="M140 116 Q168 116 168 146 Q168 176 138 178" stroke="url(#${id}cu)" stroke-width="9" fill="none" stroke-linecap="round"/>`);
    parts.push(`<path d="${g.path}" fill="url(#${id}cu)"/>`);
    parts.push(`<ellipse cx="100" cy="${ry}" rx="${(x2 - x1) / 2}" ry="7" fill="${v.bottom}"/><ellipse cx="100" cy="${ry}" rx="${(x2 - x1) / 2}" ry="7" fill="none" stroke="#8E4A26" stroke-width="2"/>`);
    parts.push(`<g opacity=".85"><rect x="80" y="${ry - 12}" width="18" height="16" rx="4" fill="#fff" transform="rotate(-10 89 ${ry - 4})"/><rect x="104" y="${ry - 10}" width="16" height="14" rx="4" fill="#fff" transform="rotate(12 112 ${ry - 3})"/></g>`);
    parts.push(`<path d="${g.hl}" stroke="#FFD9B8" stroke-width="5" stroke-linecap="round" opacity=".55"/>`);
  } else {
    // cristal
    parts.push(`<path d="${g.path}" fill="#FFFFFF" fill-opacity=".55"/>`);
    // líquido
    if (v.frozen) {
      const w = x2 - x1;
      parts.push(`<g clip-path="url(#${clip})"><path d="M${x1 - 4} ${top + 10} Q${x1 + w * 0.2} ${top - 10} ${x1 + w * 0.4} ${top + 2} Q${x1 + w * 0.6} ${top - 12} ${x1 + w * 0.8} ${top + 1} Q${x2} ${top - 6} ${x2 + 4} ${top + 10} L${x2 + 4} 230 L${x1 - 4} 230 Z" fill="url(#${id}liq)"/></g>`);
      parts.push(`<path d="M${x1 + 6} ${top - 2} Q${x1 + w * 0.3} ${top - 22} ${x1 + w * 0.5} ${top - 8} Q${x1 + w * 0.7} ${top - 24} ${x2 - 6} ${top - 2} Z" fill="${v.top}"/>`);
    } else {
      parts.push(`<g clip-path="url(#${clip})"><rect x="0" y="${top}" width="200" height="${230 - top}" fill="url(#${id}liq)"/><ellipse cx="100" cy="${top}" rx="${(x2 - x1) / 2 + 2}" ry="3.5" fill="#fff" opacity=".35"/></g>`);
      parts.push(iceCubes(g, top, clip));
    }
    if (v.bubbles) parts.push(bubbles(g, top + 10, clip));
    parts.push(`<path d="${g.path}" fill="none" stroke="#174E3A" stroke-opacity=".16" stroke-width="2.2" stroke-linejoin="round"/>`);
    parts.push(`<path d="${g.hl}" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".8" fill="none"/>`);
    parts.push(`<line x1="${x1}" y1="${ry}" x2="${x2}" y2="${ry}" stroke="#174E3A" stroke-opacity=".18" stroke-width="2.2" stroke-linecap="round"/>`);
  }

  if (v.rim === 'salt') {
    parts.push(`<g fill="#fff" stroke="#E7E1D3" stroke-width=".6">${Array.from({ length: 14 }, (_, i) => `<circle cx="${(x1 + 4 + ((x2 - x1 - 8) * i) / 13).toFixed(1)}" cy="${ry + 2.5 + (i % 2) * 1.6}" r="2"/>`).join('')}</g>`);
  }

  // decoraciones: la primera en el borde derecho, la segunda a la izquierda
  const garn = v.garnish || [];
  const spots = [[x2 - 6, ry - 2], [x1 + 14, ry - 8], [x2 - 26, ry - 14]];
  garn.forEach((name, i) => {
    const fn = G[name];
    if (!fn) return;
    const [gx, gy] = spots[i] || spots[0];
    if (name === 'mint') parts.push(fn(gx + (i === 0 ? -10 : 0), gy - 10));
    else if (name === 'cherry') parts.push(fn(i === 0 ? 100 : gx + 6, gy - 6));
    else if (name === 'pineapple' || name === 'watermelon') parts.push(fn(gx, gy + 8));
    else if (name === 'umbrella') parts.push(fn(gx - 4, gy - 12));
    else if (name === 'rosemary') parts.push(fn(gx + 4, gy - 16));
    else parts.push(fn(gx, gy));
  });

  return `<svg viewBox="-10 -34 220 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${recipe.name}">${parts.join('')}</svg>`;
}

/** Marca del producto: copa coupé con hoja tropical. */
export function logoSVG(size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="48" height="48" rx="14" fill="#174E3A"/>
    <path d="M30 9 Q40 8 41 18 Q33 19 30 9 Z" fill="#7FCB8C"/>
    <path d="M30.5 9.5 L38 16.5" stroke="#174E3A" stroke-width="1.2"/>
    <path d="M10 17 L38 17 Q37 30 24 31 Q11 30 10 17 Z" fill="#F6C453"/>
    <path d="M12.5 20 L35.5 20 Q34 28.5 24 29 Q14 28.5 12.5 20 Z" fill="#F07868"/>
    <path d="M24 31 L24 38 M17 39 L31 39" stroke="#FFF9EF" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="33" cy="16" r="3" fill="#F6A33B"/>
  </svg>`;
}
