#!/usr/bin/env node
/**
 * generate-swords.mjs
 * Deterministic 16-bit pixel-art sword generator for the 2D ForgeTax replica.
 * Every shape is an integer-coordinate rect/path. No external assets, no CSS.
 *
 * Output: client/assets/swords/
 *   9 families x 6 stages, 3 route silhouettes, broken, remnant  (59 files)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SWORD_FAMILIES } from '../shared/data/gameData.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client', 'assets', 'swords');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  ink: '#0d0b10', ink2: '#1a1620',
  stone: '#26222c', stone2: '#3a3441', stone3: '#524a5c',
  steel: '#87909e', steelHi: '#c8d2da', steelLo: '#5b6270',
  iron: '#4b5260', ironHi: '#6a7280', ironLo: '#333944',
  wood: '#5a3a26', woodHi: '#8a5a35', woodLo: '#3a2518',
  brass: '#c9973f', brassHi: '#f1cc71', brassLo: '#8a6328',
  ember: '#ff7a2f', emberHi: '#ffd166', blood: '#a8323e', bloodHi: '#d4545e',
  arcane: '#6f7bd6', arcaneHi: '#9ff6e8', bone: '#d8cfb4', boneLo: '#a89f86',
  white: '#f4f0e6', purple: '#b09ac9', purpleLo: '#6d5a86',
  leaf: '#84b35b', leafHi: '#b6d47c', leafLo: '#4e7040',
  sea: '#59c3d6', seaHi: '#a8ecf2', seaLo: '#2f7f8f',
};

/* ------------------------------------------------------------------ */
/* pixel primitives                                                    */
/* ------------------------------------------------------------------ */
const R = (x, y, w, h, fill, o = 1) => {
  const oo = Math.round(o * 100) / 100;
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"${oo !== 1 ? ` opacity="${oo}"` : ''}/>`;
};

function P(points, fill, { stroke = C.ink, sw = 2, o = 1 } = {}) {
  const pts = points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}"${o !== 1 ? ` opacity="${o}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"` : ''}/>`;
}

function PTH(d, fill, { stroke = C.ink, sw = 2, o = 1 } = {}) {
  return `<path d="${d}" fill="${fill}"${o !== 1 ? ` opacity="${o}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"` : ''}/>`;
}

function dither(x, y, w, h, color, cell = 2, o = 1) {
  let s = '';
  for (let yy = 0; yy < h; yy += cell) {
    for (let xx = 0; xx < w; xx += cell) {
      if (((xx / cell) + (yy / cell)) % 2 === 0) {
        s += R(x + xx, y + yy, Math.min(cell, w - xx), Math.min(cell, h - yy), color, o);
      }
    }
  }
  return s;
}

function linePx(x0, y0, x1, y1, color, t = 1, o = 1) {
  let s = '';
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let guard = 0;
  while (guard++ < 400) {
    s += R(x, y, t, t, color, o);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return s;
}

function discRows(cx, cy, r, fill, rowH = 1, o = 1) {
  let s = '';
  for (let dy = -r; dy <= r; dy += rowH) {
    const yy = cy + dy;
    const h = Math.min(rowH, cy + r - yy + 1);
    if (h <= 0) continue;
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    s += R(cx - w, yy, 2 * w + 1, h, fill, o);
  }
  return s;
}

function disc(cx, cy, r, fill, rowH = 1, o = 1) {
  return discRows(cx, cy, r + 1, C.ink, rowH) + discRows(cx, cy, r, fill, rowH, o);
}

function glowRect(cx, cy, rx, ry, color, base = 0.05) {
  // Bounded, ordered-dither halo. Never paints a flat background rectangle.
  let s = '';
  for (let i = 3; i >= 1; i--) {
    const x = cx - Math.round((rx * i) / 3);
    const y = cy - Math.round((ry * i) / 3);
    const w = Math.round((rx * 2 * i) / 3);
    const h = Math.round((ry * 2 * i) / 3);
    s += dither(x, y, w, h, color, 4, base * 1.6);
  }
  return s;
}

function sparks(arr) {
  let s = '';
  for (const [x, y, z, col = C.emberHi, o = 0.95] of arr) {
    s += R(x - 1, y - 1, z + 2, z + 2, col, 0.14);
    s += R(x, y, z, z, col, o);
  }
  return s;
}

const GLYPHS = [
  [[1, 0, 1], [0, 1, 0], [1, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 0], [0, 1, 0], [1, 1, 1]],
  [[0, 1, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
  [[1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
  [[0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1], [0, 1, 0], [1, 0, 1]],
];
function glyph(x, y, color, scale = 1, o = 1, index = 0) {
  const g = GLYPHS[index % GLYPHS.length];
  let s = R(x - 1, y - 1, g[0].length * scale + 2, g.length * scale + 2, color, 0.12 * o);
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[0].length; c++) {
      if (g[r][c]) s += R(x + c * scale, y + r * scale, scale, scale, color, o);
    }
  }
  return s;
}

function leafCluster(cx, cy, r, o = 1) {
  let s = discRows(cx, cy, r + 1, C.ink, 1);
  s += discRows(cx, cy, r, C.leafLo, 1, o);
  s += discRows(cx - 1, cy - 1, Math.max(1, r - 2), C.leaf, 1, o);
  s += dither(cx - r + 1, cy - r + 1, r * 2 - 1, r * 2 - 1, C.leafHi, 2, 0.55 * o);
  s += R(cx - 2, cy - r + 2, 2, 2, C.leafHi, 0.9 * o);
  return s;
}

function skullPx(x, y, s = 1, bone = C.bone, dark = C.ink) {
  let out = '';
  out += R(x, y - s, 3 * s, 2 * s, bone);
  out += R(x - s, y, 5 * s, 3 * s, bone);
  out += R(x, y + 3 * s, 3 * s, s, bone);
  out += R(x + s, y, s, s, dark);
  out += R(x + 3 * s, y, s, s, dark);
  out += R(x + 2 * s, y + 2 * s, s, s, dark);
  return out;
}

/* ------------------------------------------------------------------ */
/* palettes                                                            */
/* ------------------------------------------------------------------ */
const FAM = {
  citadel:    { accent: '#9fb4c8', blade: C.steel,    hi: C.steelHi, lo: C.iron,      guard: C.iron,  grip: C.wood,    glow: '#9fb4c8' },
  holy:       { accent: '#ffe08a', blade: '#b9c6d4',  hi: C.white,   lo: '#7a8495',   guard: C.brass, grip: '#d8cfb4', glow: '#ffe08a' },
  sawblade:   { accent: '#e6704a', blade: '#7f8794',  hi: C.steelHi, lo: C.iron,      guard: C.iron,  grip: C.wood,    glow: '#e6704a' },
  dragonfang: { accent: '#c04a5a', blade: '#684a4e',  hi: '#a87a78', lo: '#3d2b30',   guard: C.iron,  grip: '#4a2b2e', glow: '#c04a5a' },
  runeblade:  { accent: '#7f8cff', blade: '#7b84a2',  hi: C.steelHi, lo: C.iron,      guard: C.arcane, grip: '#3d3a58', glow: '#7f8cff' },
  splitblade: { accent: '#9ad6c8', blade: C.steel,    hi: C.steelHi, lo: C.iron,      guard: C.iron,  grip: '#35464a', glow: '#9ad6c8' },
  world_tree: { accent: '#84b35b', blade: '#7a5232',  hi: '#b98a58', lo: C.wood,      guard: C.wood,  grip: C.wood,    glow: '#84b35b' },
  fishblade:  { accent: '#59c3d6', blade: '#c9c3a8',  hi: '#eee6c8', lo: '#7f8a7e',   guard: C.iron,  grip: '#5c7568', glow: '#59c3d6' },
  funerary:   { accent: '#b09ac9', blade: '#6d6678',  hi: '#a89f86', lo: '#3f3a4a',   guard: C.iron,  grip: '#4a4058', glow: '#b09ac9' },
};

/* ------------------------------------------------------------------ */
/* shared sword parts                                                  */
/* ------------------------------------------------------------------ */
function drawBlade(x0, x1, half, f, { tip = 6, fuller = true, fill = null } = {}) {
  const top = 24 - half, bot = 24 + half;
  const d = `M${x0} ${top} L${x1 - tip} ${top} L${x1} 24 L${x1 - tip} ${bot} L${x0} ${bot}Z`;
  let s = PTH(d, fill || f.blade, { stroke: C.ink, sw: 2 });
  s += PTH(`M${x0} ${top + 1} L${x1 - tip} ${top + 1} L${x1 - tip - 2} ${top + 3} L${x0} ${top + 3}Z`, f.hi, { stroke: null, o: 0.9 });
  s += PTH(`M${x0} ${bot - 1} L${x1 - tip} ${bot - 1} L${x1 - tip - 2} ${bot - 3} L${x0} ${bot - 3}Z`, f.lo, { stroke: null, o: 0.95 });
  if (fuller && x1 - tip - x0 > 12) {
    s += R(x0 + 4, 23, x1 - tip - x0 - 9, 2, f.lo, 0.55);
    s += R(x0 + 4, 23, x1 - tip - x0 - 9, 1, f.hi, 0.45);
  }
  return s;
}

function drawHilt(f, { guardH = 16, flare = false, jewel = true, guardC = null } = {}) {
  const yc = 24, gx = 18, gc = guardC || f.guard;
  let s = '';
  // dark silhouette backing around grip/pommel
  s += R(2, yc - 5, 17, 10, C.ink);
  // pommel
  s += R(3, yc - 3, 4, 6, gc);
  s += R(3, yc - 3, 1, 6, f.hi);
  s += R(4, yc - 1, 2, 2, f.accent);
  // grip
  s += R(8, yc - 3, 10, 6, f.grip);
  s += R(8, yc - 3, 10, 1, f.hi, 0.35);
  for (let x = 10; x <= 17; x += 3) s += R(x, yc - 3, 1, 6, C.ink, 0.5);
  // guard
  s += R(gx - 1, yc - Math.ceil(guardH / 2) - 1, 6, guardH + 2, C.ink);
  s += R(gx, yc - Math.ceil(guardH / 2), 4, guardH, gc);
  s += R(gx, yc - Math.ceil(guardH / 2), 1, guardH, f.hi);
  s += R(gx + 3, yc - Math.ceil(guardH / 2), 1, guardH, f.lo, 0.8);
  if (flare) {
    s += R(gx - 3, yc - Math.ceil(guardH / 2), 8, 3, C.ink);
    s += R(gx - 2, yc - Math.ceil(guardH / 2) + 1, 7, 2, gc);
    s += R(gx - 3, yc + Math.ceil(guardH / 2) - 3, 8, 3, C.ink);
    s += R(gx - 2, yc + Math.ceil(guardH / 2) - 2, 7, 2, gc);
    s += R(gx - 4, yc - Math.ceil(guardH / 2) + 1, 2, 2, f.accent);
    s += R(gx - 4, yc + Math.ceil(guardH / 2) - 3, 2, 2, f.accent);
  }
  if (jewel) {
    s += R(gx, yc - 2, 4, 4, C.ink);
    s += R(gx + 1, yc - 1, 2, 2, f.accent);
  }
  return s;
}

function sawTeeth(x0, x1, half, f, size = 3, step = 8, o = 1) {
  const top = 24 - half, bot = 24 + half;
  let s = '';
  for (let x = x0 + 3; x < x1 - 7; x += step) {
    s += PTH(`M${x} ${top + 1} L${x + 3} ${top - size} L${x + 6} ${top + 1}Z`, f.blade, { sw: 1, o });
    s += R(x + 2, top - size + 1, 2, 1, f.hi, 0.8 * o);
    s += PTH(`M${x + 3} ${bot - 1} L${x + 6} ${bot + size} L${x + 9} ${bot - 1}Z`, f.lo, { sw: 1, o });
  }
  return s;
}

function scaleRow(x0, x1, y, f, o = 0.55) {
  let s = '';
  for (let x = x0; x < x1 - 3; x += 6) {
    s += PTH(`M${x} ${y} L${x + 3} ${y + 3} L${x + 6} ${y}Z`, f.accent, { stroke: null, o });
    s += R(x + 3, y + 1, 1, 1, C.ink, 0.5);
  }
  return s;
}

function familyBaseDecor(fam, stage, x0, x1, half, f) {
  const top = 24 - half, bot = 24 + half;
  let s = '';
  if (fam === 'sawblade') {
    if (stage >= 1) s += sawTeeth(x0 + 2, x1 - 4, half, f, stage === 2 ? 4 : 3, stage === 2 ? 7 : 9);
    for (let x = x0 + 10; x < x1 - 10; x += 14) s += R(x, 23, 2, 2, C.steelHi, 0.8);
    if (stage === 2) s += R(x1 - 22, 24 - half + 3, 6, 3, C.iron, 0.8) + R(x1 - 21, 24 - half + 4, 4, 1, f.accent, 0.8);
  }
  if (fam === 'dragonfang') {
    s += scaleRow(x0 + 5, x1 - 8, top + 4, f, 0.5);
    if (stage >= 1) s += scaleRow(x0 + 8, x1 - 6, bot - 6, f, 0.45);
    s += R(x0 + 3, 24 + half - 2, x1 - x0 - 9, 1, f.accent, 0.55);
    for (let x = x0 + 12; x < x1 - 6; x += 16) {
      s += PTH(`M${x} ${bot + 1} L${x + 3} ${bot + 4} L${x + 6} ${bot + 1}Z`, C.bone, { sw: 1, o: 0.85 });
    }
  }
  if (fam === 'runeblade') {
    const n = stage + 1;
    for (let i = 0; i < n; i++) {
      const gx = x0 + 10 + i * 16;
      if (gx > x1 - 14) break;
      s += glyph(gx, 20, f.accent, 1, 0.7 + 0.1 * stage, stage + i);
    }
    if (stage === 2) s += R(x0 + 4, 22, x1 - x0 - 12, 1, C.arcaneHi, 0.35);
  }
  if (fam === 'splitblade') {
    s += R(x0 + 2, 24, x1 - x0 - 8, 1, C.ink, 0.75);
    s += R(x0 + 2, 25, x1 - x0 - 8, 1, C.steelHi, 0.25);
    if (stage >= 1) {
      s += PTH(`M${x0 + 4} ${top - 3} L${x1 - 8} ${top - 3} L${x1 - 2} ${top} L${x0 + 4} ${top}Z`, f.blade, { o: 0.32, sw: 1 });
    }
    if (stage === 2) {
      s += PTH(`M${x0 + 4} ${bot} L${x1 - 8} ${bot} L${x1 - 2} ${bot + 3} L${x0 + 4} ${bot + 3}Z`, f.blade, { o: 0.32, sw: 1 });
    }
  }
  if (fam === 'world_tree') {
    for (let x = x0 + 7; x < x1 - 6; x += 9) s += R(x, top + 3, 1, half * 2 - 6, C.woodLo, 0.6);
    s += R(x0 + 3, 23, x1 - x0 - 10, 2, '#a97a4a', 0.5);
    if (stage >= 1) {
      s += leafCluster(x1 - 9, top - 2, stage === 1 ? 4 : 6);
      s += linePx(x1 - 10, 24, x1 - 4, top - 1, C.wood, 2);
    }
    if (stage === 2) {
      s += leafCluster(x0 + 18, bot + 3, 4);
      s += linePx(x0 + 20, 24, x0 + 18, bot + 2, C.wood, 1);
      s += glyph(x0 + 30, 21, C.brass, 1, 0.7, 2);
    }
  }
  if (fam === 'fishblade') {
    s += PTH(`M${x0 + 2} ${top} L${x0 + 8} ${top - 6} L${x0 + 14} ${top}Z`, C.sea, { sw: 1, o: 0.85 });
    s += R(x0 + 8, top - 5, 2, 2, C.seaHi, 0.9);
    for (let x = x0 + 14; x < x1 - 8; x += 15) {
      s += disc(x, 24, 2, C.boneLo, 1, 0.85) + R(x, 23, 1, 1, C.ink, 0.7);
    }
    if (stage >= 1) {
      s += PTH(`M${x0 + 20} ${bot - 2} L${x0 + 24} ${bot + 4} L${x0 + 28} ${bot - 2}Z`, C.sea, { sw: 1, o: 0.7 });
    }
    if (stage === 2) s += linePx(x0 + 12, 24, x1 - 8, 24, C.seaLo, 1, 0.6);
  }
  if (fam === 'funerary') {
    s += R(x0 + 9, 19, 2, 10, C.bone, 0.9);
    s += R(x0 + 5, 22, 10, 2, C.bone, 0.9);
    s += R(x0 + 9, 19, 1, 10, C.boneLo, 0.8);
    for (let x = x0 + 18; x < x1 - 8; x += 18) s += R(x, 24 - half + 3, 2, 2, C.boneLo, 0.7);
    if (stage >= 1) s += linePx(x0 + 26, 20, x0 + 30, 28, C.ink, 1, 0.6);
  }
  if (fam === 'citadel') {
    for (let x = x0 + 12; x < x1 - 8; x += 16) s += R(x, 24, 2, 2, C.steelHi, 0.65);
    s += R(x0 + 24, 24 - half + 2, 1, half * 2 - 4, C.iron, 0.55);
    if (stage >= 1) s += dither(x0 + 4, 24 - half + 2, x1 - x0 - 12, half * 2 - 4, C.steelHi, 4, 0.22);
    if (stage === 2) s += R(x0 + 8, 24 - half - 2, 6, 3, C.steel) + R(x0 + 30, 24 + half - 1, 6, 3, C.steel);
  }
  if (fam === 'holy') {
    s += R(x0 + 3, 23, x1 - x0 - 9, 2, C.brass, 0.75);
    s += R(x0 + 3, 23, x1 - x0 - 9, 1, C.brassHi, 0.8);
    if (stage >= 1) {
      s += R(x0 + 17, 18, 2, 12, C.brassHi, 0.85);
      s += R(x0 + 13, 22, 10, 2, C.brassHi, 0.85);
    }
    if (stage === 2) s += sparks([[x0 + 24, 15, 1, C.white, 0.85], [x0 + 34, 30, 1, C.brassHi, 0.8]]);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* generic early stages                                                */
/* ------------------------------------------------------------------ */
function baseStage(fam, stage) {
  const f = FAM[fam];
  const spec = [
    { x0: 21, x1: 80, half: 4, guardH: 14, tip: 5 },
    { x0: 21, x1: 84, half: 5, guardH: 18, tip: 6 },
    { x0: 21, x1: 87, half: 6, guardH: 22, tip: 7 },
  ][stage];
  let s = drawBlade(spec.x0, spec.x1, spec.half, f, { tip: spec.tip });
  s += familyBaseDecor(fam, stage, spec.x0, spec.x1, spec.half, f);
  s += drawHilt(f, { guardH: spec.guardH, flare: stage === 2, jewel: stage >= 1 });
  if (stage === 2) s += sparks([[30, 16, 1, f.glow, 0.6], [64, 31, 1, f.glow, 0.5]]);
  return s;
}

/* ------------------------------------------------------------------ */
/* route silhouettes (+6..+9)                                          */
/* ------------------------------------------------------------------ */
function route0(accent = C.steelHi) {
  const f = FAM.citadel;
  let s = '';
  // crenellated gate-blade
  const d = 'M22 13 L27 13 L27 8 L33 8 L33 13 L43 13 L43 8 L49 8 L49 13 L59 13 L59 8 L65 8 L65 13 L78 13 L88 24 L78 35 L22 35Z';
  s += PTH(d, C.stone, { stroke: C.ink, sw: 2 });
  s += R(24, 16, 52, 17, C.iron, 0.85);
  s += R(24, 16, 52, 2, C.steel, 0.9);
  s += R(24, 31, 52, 2, C.ironLo, 0.9);
  s += dither(24, 18, 52, 13, C.stone3, 4, 0.35);
  // stone courses
  for (let y = 21; y < 33; y += 6) s += R(24, y, 52, 1, C.ink, 0.45);
  for (let x = 32; x < 76; x += 12) s += R(x, 18, 1, 15, C.ink, 0.35);
  // gate opening
  s += R(52, 23, 14, 12, C.ink);
  s += R(54, 20, 10, 4, C.ink);
  s += R(52, 23, 2, 12, C.stone3);
  s += R(64, 23, 2, 12, C.stone3);
  for (let x = 55; x <= 63; x += 4) s += R(x, 20, 2, 15, C.ink) + R(x, 20, 1, 15, accent, 0.65);
  s += R(55, 25, 9, 2, accent, 0.5);
  // battlements lips + rivets
  s += R(26, 7, 8, 2, C.stone3) + R(42, 7, 8, 2, C.stone3) + R(58, 7, 8, 2, C.stone3);
  for (const [x, y] of [[28, 15], [44, 15], [72, 18], [72, 30], [26, 30]]) s += R(x, y, 2, 2, C.steelHi, 0.8);
  // tip edge
  s += PTH('M78 13 L88 24 L78 35 L80 28 L82 24 L80 20Z', accent, { stroke: null, o: 0.75 });
  s += drawHilt(f, { guardH: 24, flare: true, guardC: C.iron });
  s += sparks([[88, 10, 1, accent, 0.7], [86, 38, 1, C.ember, 0.55]]);
  return s;
}

function gear(cx, cy, r, fill, accent, rowH = 2) {
  let s = discRows(cx, cy, r + 2, C.ink, rowH);
  const teeth = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72],
  ];
  for (const [ux, uy] of teeth) {
    const x = Math.round(cx + ux * (r + 2));
    const y = Math.round(cy + uy * (r + 2));
    const z = r > 14 ? 6 : 5;
    s += R(x - Math.floor(z / 2), y - Math.floor(z / 2), z, z, C.ink);
    s += R(x - Math.floor(z / 2) + 1, y - Math.floor(z / 2) + 1, z - 2, z - 2, fill);
  }
  s += discRows(cx, cy, r, fill, rowH);
  s += discRows(cx, cy, Math.floor(r * 0.66), C.ironLo, rowH, 0.75);
  s += dither(cx - r + 2, cy - r + 2, r * 2 - 3, r * 2 - 3, accent, 4, 0.3);
  s += R(cx - r + 4, cy - 2, r * 2 - 7, 3, C.iron, 0.9);
  s += R(cx - 2, cy - r + 4, 3, r * 2 - 7, C.iron, 0.9);
  s += discRows(cx, cy, Math.max(3, Math.floor(r * 0.26)), C.ink, 1);
  s += discRows(cx, cy, Math.max(2, Math.floor(r * 0.19)), accent, 1);
  s += R(cx - Math.floor(r * 0.6), cy - Math.floor(r * 0.6), 2, 2, C.steelHi, 0.8);
  return s;
}

function route1(accent = C.ember) {
  const f = FAM.sawblade;
  let s = glowRect(74, 24, 16, 14, C.ember, 0.05);
  s += drawBlade(21, 70, 8, f, { tip: 4 });
  s += sawTeeth(24, 64, 8, f, 4, 7);
  s += R(25, 19, 42, 2, C.steelHi, 0.55);
  s += R(25, 27, 42, 2, C.ironLo, 0.8);
  for (let x = 28; x < 62; x += 11) s += R(x, 24, 3, 2, accent, 0.5);
  s += gear(74, 24, 12, C.iron, accent, 2);
  s += R(64, 21, 10, 6, C.ink);
  s += R(65, 22, 9, 4, C.iron);
  for (let x = 66; x < 74; x += 3) s += R(x, 22, 1, 4, C.steel, 0.8);
  s += drawHilt(f, { guardH: 24, flare: true, guardC: C.iron });
  s += R(17, 13, 3, 3, C.iron) + R(17, 32, 3, 3, C.iron);
  s += sparks([[56, 12, 1, C.emberHi, 0.9], [86, 8, 2, C.ember, 0.8], [88, 40, 1, C.emberHi, 0.7], [48, 36, 1, C.ember, 0.6]]);
  return s;
}

function route2(accent = C.arcane) {
  const f = FAM.runeblade;
  let s = glowRect(58, 24, 34, 14, C.arcane, 0.04);
  s += drawBlade(21, 84, 5, f, { tip: 8 });
  s += R(24, 22, 54, 1, C.arcaneHi, 0.75);
  s += R(24, 27, 54, 1, C.arcane, 0.5);
  s += glyph(38, 12, accent, 1, 0.95, 0);
  s += glyph(54, 34, C.arcaneHi, 1, 0.9, 2);
  s += glyph(68, 10, C.arcaneHi, 1, 0.85, 4);
  s += glyph(78, 31, accent, 1, 0.9, 5);
  s += glowRect(56, 24, 22, 10, C.arcaneHi, 0.03);
  // crystal guard
  s += PTH('M16 17 L23 17 L27 24 L23 31 L16 31 L20 24Z', C.arcane, { stroke: C.ink, sw: 2 });
  s += PTH('M18 19 L22 19 L24 24 L22 29 L18 29 L20 24Z', C.arcaneHi, { stroke: null, o: 0.55 });
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.arcane });
  s += sparks([[48, 8, 1, C.arcaneHi, 0.9], [82, 38, 1, C.arcaneHi, 0.8], [31, 36, 1, accent, 0.7]]);
  return s;
}

/* ------------------------------------------------------------------ */
/* merchant route (+6..+9)                                             */
/* ------------------------------------------------------------------ */
function treeRoute(accent = C.leaf) {
  const f = FAM.world_tree;
  let s = '';
  s += drawBlade(21, 78, 5, f, { tip: 6 });
  s += R(24, 22, 48, 1, '#c3915b', 0.7);
  s += R(24, 26, 48, 1, C.woodLo, 0.8);
  for (let x = 28; x < 72; x += 9) s += linePx(x, 20, x + 1, 28, C.woodLo, 1, 0.55);
  // fork at the tip
  s += linePx(76, 24, 84, 15, C.wood, 3) + linePx(76, 25, 84, 34, C.wood, 2);
  s += leafCluster(84, 14, 4) + leafCluster(84, 35, 4) + leafCluster(58, 12, 6);
  s += R(68, 8, 1, 4, C.wood) + linePx(58, 17, 67, 10, C.wood, 1);
  // roots around the guard
  s += linePx(24, 27, 20, 38, C.wood, 2) + linePx(25, 22, 22, 12, C.wood, 2);
  s += R(20, 37, 2, 3, C.woodLo) + R(21, 10, 2, 3, C.woodLo);
  s += drawHilt(f, { guardH: 20, flare: true, guardC: C.wood });
  s += R(18, 18, 4, 4, C.leaf);
  s += sparks([[48, 8, 1, accent, 0.8], [72, 6, 1, C.leafHi, 0.75]]);
  return s;
}

function fishRoute(accent = C.sea) {
  const f = FAM.fishblade;
  let s = '';
  s += PTH('M22 21 L44 14 L70 16 L84 11 L89 24 L80 34 L56 36 L22 29Z', f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M24 21 L44 16 L68 18 L82 13 L84 23 L76 31 L54 33 L24 28Z', f.hi, { stroke: null, o: 0.35 });
  s += PTH('M24 26 L48 31 L70 30 L80 32 L58 34 L24 28Z', C.seaLo, { stroke: null, o: 0.55 });
  // fin + gill
  s += PTH('M24 21 L30 10 L38 20Z', C.sea, { sw: 1 });
  s += R(29, 13, 2, 4, C.seaHi, 0.7);
  s += linePx(38, 20, 40, 28, C.seaLo, 1, 0.7);
  // serrations
  for (let x = 48; x < 76; x += 8) s += PTH(`M${x} 31 L${x + 3} 36 L${x + 6} 30Z`, C.bone, { sw: 1, o: 0.85 });
  for (let x = 44; x < 70; x += 12) s += disc(x, 21, 2, C.boneLo, 1, 0.9);
  s += drawHilt(f, { guardH: 20, flare: true, guardC: C.iron });
  s += linePx(10, 20, 17, 28, C.sea, 2);
  s += sparks([[74, 10, 1, C.seaHi, 0.9], [50, 38, 1, accent, 0.7]]);
  return s;
}

function funeraryRoute(accent = C.purple) {
  const f = FAM.funerary;
  let s = '';
  s += PTH('M22 14 L72 12 L82 16 L88 24 L82 32 L72 36 L22 34Z', f.blade, { stroke: C.ink, sw: 2 });
  s += R(24, 17, 48, 2, C.steel, 0.45);
  s += R(24, 31, 48, 2, C.ink, 0.6);
  // crossed bone inlay
  s += R(32, 19, 2, 10, C.bone, 0.9) + R(28, 23, 10, 2, C.bone, 0.9);
  s += R(32, 19, 1, 10, C.boneLo, 0.8);
  // gate bars near the tip
  for (let x = 58; x < 78; x += 5) s += R(x, 16, 2, 18, C.ink, 0.85) + R(x, 16, 1, 18, C.iron, 0.8);
  s += R(56, 23, 24, 2, C.iron, 0.75);
  s += glyph(48, 22, C.purple, 1, 0.8, 5);
  s += disc(48, 26, 2, C.purple, 1, 0.5);
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.iron });
  s += PTH('M16 16 L22 20 L22 28 L16 32 L18 24Z', C.bone, { sw: 1, o: 0.9 });
  s += sparks([[64, 9, 1, C.purple, 0.8], [82, 38, 1, C.purple, 0.7]]);
  return s;
}

/* ------------------------------------------------------------------ */
/* family stage 4                                                      */
/* ------------------------------------------------------------------ */
function citadel4() {
  const f = FAM.citadel;
  let s = '';
  const d = 'M22 12 L27 12 L27 8 L33 8 L33 12 L45 12 L45 8 L51 8 L51 12 L63 12 L63 8 L69 8 L69 12 L84 12 L92 24 L84 36 L22 36Z';
  s += PTH(d, C.stone2, { stroke: C.ink, sw: 2 });
  s += R(24, 15, 56, 18, C.stone, 0.9);
  s += R(24, 15, 56, 2, C.steel, 0.75);
  s += R(24, 31, 56, 2, C.ironLo, 0.9);
  s += dither(25, 17, 54, 13, C.stone3, 4, 0.4);
  // gate arch cut into the blade
  s += R(53, 24, 13, 12, C.ink);
  s += R(55, 21, 9, 4, C.ink);
  s += R(53, 24, 2, 12, C.stone3) + R(64, 24, 2, 12, C.stone3);
  for (let x = 56; x <= 63; x += 3) s += R(x, 21, 1, 15, C.iron) + R(x, 21, 1, 15, C.steelHi, 0.35);
  s += R(56, 26, 8, 2, C.brass, 0.55);
  // arrow slits + bricks
  s += R(38, 18, 2, 6, C.ink) + R(72, 18, 2, 6, C.ink);
  s += R(38, 18, 1, 6, C.steelHi, 0.25) + R(72, 18, 1, 6, C.steelHi, 0.25);
  for (let x = 30; x < 80; x += 12) s += R(x, 16, 1, 15, C.ink, 0.3);
  s += R(24, 21, 56, 1, C.ink, 0.3);
  // banner
  s += R(45, 15, 5, 12, C.blood) + R(45, 22, 7, 5, C.blood);
  s += PTH('M45 27 L52 27 L49 31Z', C.blood, { sw: 1 });
  s += R(47, 18, 1, 6, C.brass, 0.8);
  // merlon highlights
  for (const x of [26, 44, 62]) s += R(x, 7, 8, 2, C.stone3) + R(x, 7, 8, 1, C.steelHi, 0.4);
  s += PTH('M84 12 L92 24 L84 36 L86 28 L88 24 L86 20Z', C.steel, { stroke: null, o: 0.6 });
  s += drawHilt(f, { guardH: 30, flare: true, guardC: C.iron });
  s += R(17, 9, 4, 4, C.stone3) + R(17, 35, 4, 4, C.stone3);
  s += sparks([[58, 4, 2, C.ember, 0.8], [80, 6, 1, C.emberHi, 0.8], [34, 38, 1, C.ember, 0.5]]);
  return s;
}

function citadel5() {
  const f = FAM.citadel;
  let s = glowRect(66, 24, 34, 18, C.ember, 0.025);
  // mini fortress as the blade
  const d = 'M20 14 L25 14 L25 9 L33 9 L33 14 L41 14 L41 9 L49 9 L49 14 L57 14 L57 9 L65 9 L65 14 L73 14 L73 9 L81 9 L81 14 L88 18 L94 24 L88 30 L81 34 L81 39 L20 39Z';
  s += PTH(d, C.stone2, { stroke: C.ink, sw: 2 });
  s += R(22, 17, 68, 20, C.stone, 0.95);
  s += R(22, 17, 68, 2, C.steel, 0.55);
  s += R(22, 35, 68, 2, C.ironLo, 0.95);
  s += dither(23, 19, 66, 15, C.stone3, 4, 0.4);
  // towers
  for (const tx of [28, 70]) {
    s += R(tx, 8, 14, 12, C.stone3);
    s += R(tx, 8, 14, 2, C.steelHi, 0.35);
    s += R(tx + 2, 5, 4, 4, C.stone3) + R(tx + 8, 5, 4, 4, C.stone3);
    s += R(tx + 2, 5, 4, 1, C.steelHi, 0.4) + R(tx + 8, 5, 4, 1, C.steelHi, 0.4);
    s += R(tx + 6, 11, 2, 6, C.ink);
    s += R(tx + 6, 11, 1, 6, C.steelHi, 0.25);
    s += R(tx - 1, 19, 16, 2, C.iron);
  }
  // central gate + portcullis
  s += R(48, 25, 16, 14, C.ink);
  s += R(50, 21, 12, 5, C.ink);
  s += R(48, 25, 2, 14, C.brassLo) + R(62, 25, 2, 14, C.brassLo);
  s += R(50, 21, 12, 1, C.brass, 0.8);
  for (let x = 51; x <= 61; x += 3) s += R(x, 22, 1, 17, C.brass, 0.8) + R(x, 22, 1, 17, C.brassHi, 0.25);
  s += R(51, 29, 11, 2, C.brass, 0.7);
  s += R(54, 33, 4, 2, C.emberHi, 0.85);
  // arrow slits and stone courses
  for (let x = 32; x <= 76; x += 11) s += R(x, 19, 1, 15, C.ink, 0.28);
  for (let y = 22; y < 35; y += 6) s += R(22, y, 68, 1, C.ink, 0.28);
  s += R(38, 24, 2, 5, C.ink) + R(74, 24, 2, 5, C.ink);
  // banners
  s += R(44, 18, 5, 10, C.blood) + PTH('M44 28 L49 28 L46 32Z', C.blood, { sw: 1 });
  s += R(45, 20, 1, 5, C.brass, 0.8);
  s += R(58, 18, 5, 8, C.blood, 0.85) + PTH('M58 26 L63 26 L60 30Z', C.blood, { sw: 1 });
  // gate glow
  s += glowRect(56, 34, 9, 5, C.ember, 0.04);
  s += drawHilt(f, { guardH: 32, flare: true, guardC: C.iron });
  s += R(16, 8, 5, 5, C.stone3) + R(16, 35, 5, 5, C.stone3);
  s += R(17, 7, 3, 2, C.steelHi, 0.5) + R(17, 38, 3, 2, C.steelHi, 0.5);
  s += sparks([[30, 3, 2, C.ember, 0.9], [60, 3, 1, C.emberHi, 0.9], [86, 8, 2, C.ember, 0.8], [90, 40, 1, C.emberHi, 0.7], [40, 40, 1, C.ember, 0.5]]);
  return s;
}

function holy4() {
  const f = FAM.holy;
  let s = glowRect(62, 24, 32, 12, '#ffe08a', 0.035);
  s += drawBlade(22, 87, 6, f, { tip: 8 });
  s += R(26, 22, 54, 1, C.brassHi, 0.95);
  s += R(26, 25, 54, 1, C.brass, 0.55);
  // ornate cross guard
  s += PTH('M18 12 L24 14 L28 18 L30 24 L24 24 L20 20 L16 20Z', C.brass, { stroke: C.ink, sw: 1 });
  s += PTH('M18 36 L24 34 L28 30 L30 24 L24 24 L20 28 L16 28Z', C.brass, { stroke: C.ink, sw: 1 });
  s += R(20, 11, 3, 2, C.brassHi) + R(20, 35, 3, 2, C.brassHi);
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.brass });
  s += R(15, 8, 4, 4, C.brass) + R(15, 36, 4, 4, C.brass);
  // cross of light above the blade
  s += glowRect(62, 10, 9, 7, C.white, 0.05);
  s += R(61, 2, 3, 12, C.white, 0.9) + R(56, 6, 13, 3, C.white, 0.9);
  s += R(62, 3, 1, 10, C.brassHi) + R(57, 7, 11, 1, C.brassHi);
  s += sparks([[46, 16, 1, C.white, 0.9], [82, 14, 1, C.brassHi, 0.8], [76, 36, 1, C.white, 0.7], [40, 34, 1, C.brassHi, 0.7]]);
  return s;
}

function holy5() {
  const f = FAM.holy;
  let s = glowRect(60, 24, 42, 20, '#ffe08a', 0.03);
  s += glowRect(62, 24, 28, 12, C.white, 0.04);
  s += drawBlade(22, 92, 6, f, { tip: 9 });
  s += R(25, 21, 58, 1, C.brassHi, 0.95);
  s += R(25, 27, 58, 1, C.brass, 0.55);
  s += dither(30, 21, 48, 6, C.white, 2, 0.18);
  // curved ornate quillons
  s += PTH('M17 10 L23 12 L28 15 L32 20 L27 22 L22 18 L16 17Z', C.brass, { stroke: C.ink, sw: 2 });
  s += PTH('M17 38 L23 36 L28 33 L32 28 L27 26 L22 30 L16 31Z', C.brass, { stroke: C.ink, sw: 2 });
  s += R(20, 10, 3, 2, C.brassHi) + R(28, 16, 2, 2, C.brassHi);
  s += R(20, 36, 3, 2, C.brassHi) + R(28, 30, 2, 2, C.brassHi);
  // cross guard + ruby
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.brass });
  s += R(17, 22, 6, 5, C.brassLo) + R(18, 23, 4, 3, '#d4545e') + R(19, 23, 1, 1, C.white, 0.8);
  // sun pommel
  s += disc(7, 24, 5, C.brass, 1);
  s += disc(7, 24, 3, C.brassHi, 1);
  s += disc(7, 24, 1, C.white, 1);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const x = Math.round(7 + Math.cos(a) * 9), y = Math.round(24 + Math.sin(a) * 9);
    s += R(x, y, 1, 1, C.brassHi, 0.8);
  }
  // floating cross + rays
  s += glowRect(58, 8, 12, 8, C.white, 0.05);
  s += R(57, 0, 3, 13, C.white, 0.95) + R(51, 4, 15, 3, C.white, 0.95);
  s += R(58, 1, 1, 11, C.brassHi) + R(52, 5, 13, 1, C.brassHi);
  s += linePx(37, 10, 30, 5, C.brassHi, 1, 0.6) + linePx(80, 40, 88, 44, C.brassHi, 1, 0.6);
  s += sparks([[44, 14, 1, C.white, 0.95], [76, 12, 1, C.white, 0.9], [86, 20, 1, C.brassHi, 0.8], [70, 38, 1, C.white, 0.75], [36, 38, 1, C.brassHi, 0.7]]);
  return s;
}

function sawblade4() {
  const f = FAM.sawblade;
  let s = glowRect(74, 24, 17, 16, C.ember, 0.03);
  s += drawBlade(21, 66, 7, f, { tip: 3 });
  s += sawTeeth(24, 58, 7, f, 4, 7);
  s += R(24, 18, 38, 2, C.steelHi, 0.6);
  s += R(24, 29, 38, 2, C.ironLo, 0.8);
  for (let x = 30; x < 58; x += 10) s += R(x, 23, 2, 3, C.steelHi, 0.7);
  s += gear(74, 24, 13, C.iron, C.ember, 2);
  // mounting bracket
  s += R(61, 21, 10, 7, C.ink) + R(62, 22, 9, 5, C.iron);
  s += R(63, 23, 2, 3, C.steelHi, 0.6) + R(68, 23, 2, 3, C.steelHi, 0.6);
  s += drawHilt(f, { guardH: 24, flare: true, guardC: C.iron });
  s += R(16, 14, 4, 4, C.iron) + R(16, 30, 4, 4, C.iron);
  s += sparks([[56, 12, 1, C.emberHi, 0.9], [88, 9, 1, C.ember, 0.8], [48, 36, 1, C.emberHi, 0.7]]);
  return s;
}

function sawblade5() {
  const f = FAM.sawblade;
  let s = glowRect(64, 24, 34, 22, C.ember, 0.045);
  // drive arm
  s += R(19, 20, 30, 9, C.ink);
  s += R(20, 21, 29, 7, C.iron);
  s += R(20, 21, 29, 2, C.steel, 0.7);
  for (let x = 24; x < 46; x += 7) s += R(x, 23, 2, 3, C.steelHi, 0.6);
  // small aux gear
  s += gear(37, 12, 6, C.iron, C.ember, 1);
  // main gear blade
  s += gear(64, 24, 19, C.iron, C.ember, 2);
  // extra saw fangs on the rim
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    const x = Math.round(64 + Math.cos(a) * 22);
    const y = Math.round(24 + Math.sin(a) * 22);
    s += PTH(`M${x - 2} ${y} L${x} ${y - 3} L${x + 2} ${y}Z`, C.steelHi, { sw: 1, o: 0.55 });
  }
  s += glowRect(64, 24, 13, 13, C.emberHi, 0.03);
  s += drawHilt(f, { guardH: 28, flare: true, guardC: C.iron });
  s += R(16, 10, 5, 5, C.iron) + R(16, 34, 5, 5, C.iron);
  s += R(17, 11, 3, 3, C.ember, 0.5) + R(17, 35, 3, 3, C.ember, 0.5);
  s += sparks([[42, 4, 2, C.emberHi, 0.9], [88, 12, 1, C.ember, 0.9], [90, 38, 2, C.emberHi, 0.75], [30, 40, 1, C.ember, 0.7], [54, 42, 1, C.emberHi, 0.6]]);
  return s;
}

function dragonfang4() {
  const f = FAM.dragonfang;
  let s = glowRect(58, 24, 32, 14, C.blood, 0.035);
  const d = 'M22 20 L48 13 L76 16 L88 20 L92 24 L86 30 L62 33 L22 31Z';
  s += PTH(d, f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M24 20 L48 15 L74 18 L86 21 L88 24 L84 26 L60 25 L24 27Z', f.hi, { stroke: null, o: 0.3 });
  s += scaleRow(34, 78, 17, f, 0.65);
  s += scaleRow(38, 72, 26, f, 0.55);
  s += scaleRow(44, 68, 22, f, 0.45);
  // fang teeth
  for (let x = 42; x < 80; x += 10) s += PTH(`M${x} 31 L${x + 3} 38 L${x + 6} 31Z`, C.bone, { sw: 1, o: 0.95 });
  for (let x = 36; x < 72; x += 12) s += PTH(`M${x} 16 L${x + 3} 10 L${x + 6} 16Z`, C.bone, { sw: 1, o: 0.8 });
  // demon eye at the root
  s += PTH('M26 20 L34 18 L40 24 L34 30 L26 28 L29 24Z', C.ink, { stroke: C.ink, sw: 1 });
  s += PTH('M29 21 L35 20 L38 24 L34 27 L29 26 L31 24Z', C.blood, { stroke: null });
  s += R(33, 21, 2, 6, C.ink) + R(33, 23, 1, 2, C.bloodHi);
  s += R(30, 22, 1, 1, C.emberHi, 0.9);
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.iron });
  // horn guard
  s += PTH('M18 15 L25 10 L30 8 L26 14 L21 17Z', C.bone, { stroke: C.ink, sw: 1 });
  s += PTH('M18 33 L25 38 L30 40 L26 34 L21 31Z', C.bone, { stroke: C.ink, sw: 1 });
  s += sparks([[66, 8, 1, C.bloodHi, 0.8], [86, 34, 1, C.ember, 0.7], [46, 36, 1, C.bloodHi, 0.6]]);
  return s;
}

function dragonfang5() {
  const f = FAM.dragonfang;
  let s = glowRect(64, 24, 40, 20, C.blood, 0.04);
  // open maw: upper and lower jaws form the blade
  s += PTH('M21 18 L46 10 L72 9 L94 14 L90 20 L66 22 L21 24Z', f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M21 30 L46 38 L72 39 L90 34 L92 28 L68 26 L21 24Z', f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M21 24 L68 25 L90 20 L92 28 L72 38 L21 30Z', C.ink, { stroke: C.ink, sw: 1 });
  s += PTH('M21 24 L66 24 L88 22 L86 26 L66 31 L21 30Z', C.blood, { stroke: null, o: 0.7 });
  // upper scales and teeth
  s += scaleRow(34, 84, 12, f, 0.6);
  s += scaleRow(40, 78, 18, f, 0.5);
  for (let x = 38; x < 90; x += 9) s += PTH(`M${x} 22 L${x + 3} 29 L${x + 7} 22Z`, C.bone, { sw: 1, o: 0.95 });
  // lower teeth
  for (let x = 43; x < 88; x += 9) s += PTH(`M${x} 26 L${x + 3} 19 L${x + 7} 26Z`, C.bone, { sw: 1, o: 0.9 });
  // lower jaw scales
  s += scaleRow(36, 76, 33, f, 0.55);
  // eye
  s += PTH('M29 18 L38 16 L45 24 L38 32 L29 30 L33 24Z', C.ink, { stroke: C.ink, sw: 2 });
  s += PTH('M33 20 L39 19 L43 24 L38 29 L33 28 L35 24Z', C.blood, { stroke: null });
  s += R(38, 20, 2, 8, C.ink) + R(38, 23, 1, 2, C.emberHi, 0.95);
  s += R(34, 21, 1, 1, C.emberHi, 0.9);
  s += glowRect(38, 24, 7, 6, C.blood, 0.045);
  // horn guard
  s += drawHilt(f, { guardH: 30, flare: true, guardC: C.iron });
  s += PTH('M17 13 L26 6 L33 4 L27 12 L20 16Z', C.bone, { stroke: C.ink, sw: 2 });
  s += PTH('M17 35 L26 42 L33 44 L27 36 L20 32Z', C.bone, { stroke: C.ink, sw: 2 });
  s += linePx(22, 13, 29, 8, C.boneLo, 1, 0.7) + linePx(22, 35, 29, 40, C.boneLo, 1, 0.7);
  // cracks + embers
  s += linePx(52, 14, 58, 20, C.ink, 1, 0.75) + linePx(70, 10, 68, 16, C.ink, 1, 0.6);
  s += sparks([[60, 4, 2, C.emberHi, 0.9], [86, 7, 1, C.ember, 0.85], [92, 38, 2, C.bloodHi, 0.75], [46, 42, 1, C.ember, 0.6], [34, 5, 1, C.bloodHi, 0.7]]);
  return s;
}

function runeblade4() {
  const f = FAM.runeblade;
  let s = glowRect(58, 24, 34, 16, C.arcane, 0.04);
  s += drawBlade(22, 88, 6, f, { tip: 8 });
  s += R(26, 22, 52, 1, C.arcaneHi, 0.55);
  s += R(26, 27, 52, 1, C.arcane, 0.6);
  // carved runes on the blade + floating glyphs
  s += glyph(34, 21, C.arcaneHi, 1, 0.95, 0);
  s += glyph(48, 21, C.arcaneHi, 1, 0.9, 2);
  s += glyph(62, 21, C.arcaneHi, 1, 0.9, 4);
  s += glyph(43, 10, C.arcaneHi, 1, 0.95, 1);
  s += glyph(60, 35, C.arcane, 1, 0.9, 3);
  s += glyph(76, 9, C.arcane, 1, 0.85, 5);
  s += glowRect(58, 24, 26, 12, C.arcaneHi, 0.025);
  // crystal guard
  s += PTH('M15 16 L22 18 L26 24 L22 30 L15 32 L18 24Z', C.arcane, { stroke: C.ink, sw: 2 });
  s += PTH('M17 18 L21 19 L23 24 L21 29 L17 30 L19 24Z', C.arcaneHi, { stroke: null, o: 0.5 });
  s += drawHilt(f, { guardH: 24, flare: true, guardC: C.arcane });
  s += sparks([[50, 6, 1, C.arcaneHi, 0.9], [82, 38, 1, C.arcaneHi, 0.8], [30, 36, 1, C.arcane, 0.7], [68, 4, 1, C.arcane, 0.75]]);
  return s;
}

function runeblade5() {
  const f = FAM.runeblade;
  let s = glowRect(56, 24, 44, 22, C.arcane, 0.035);
  s += drawBlade(22, 92, 7, f, { tip: 9 });
  s += R(25, 21, 58, 1, C.arcaneHi, 0.85);
  s += R(25, 28, 58, 1, C.arcane, 0.75);
  // cosmic field
  const stars = [[32, 19], [38, 27], [45, 22], [52, 18], [59, 28], [66, 22], [73, 19], [80, 26], [86, 21]];
  for (let i = 0; i < stars.length; i++) {
    s += R(stars[i][0], stars[i][1], i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, i % 2 ? C.white : C.arcaneHi, 0.85);
  }
  s += dither(28, 20, 54, 8, C.arcaneHi, 4, 0.25);
  // orbit ring + glyphs
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24;
    const x = Math.round(56 + Math.cos(a) * 31);
    const y = Math.round(24 + Math.sin(a) * 18);
    s += R(x, y, 1, 1, C.arcaneHi, 0.28);
  }
  const ring = [[56, 3], [72, 6], [84, 14], [88, 26], [82, 38], [68, 43], [52, 42], [38, 36], [29, 26], [34, 12]];
  for (let i = 0; i < ring.length; i++) {
    s += glyph(ring[i][0], ring[i][1], i % 2 ? C.arcaneHi : C.white, 2, 0.85, i);
  }
  // shards
  s += PTH('M14 8 L20 6 L18 12Z', C.arcane, { sw: 1, o: 0.9 });
  s += PTH('M88 4 L93 2 L92 8Z', C.arcaneHi, { sw: 1, o: 0.85 });
  s += PTH('M89 42 L94 39 L93 46Z', C.arcane, { sw: 1, o: 0.8 });
  // crystal guard
  s += PTH('M14 14 L21 16 L26 24 L21 32 L14 34 L18 24Z', C.arcane, { stroke: C.ink, sw: 2 });
  s += PTH('M16 17 L20 18 L22 24 L20 30 L16 31 L18 24Z', C.arcaneHi, { stroke: null, o: 0.55 });
  s += drawHilt(f, { guardH: 28, flare: true, guardC: C.arcane });
  s += sparks([[46, 2, 1, C.white, 0.9], [90, 20, 1, C.arcaneHi, 0.9], [44, 45, 1, C.arcaneHi, 0.75], [72, 44, 1, C.white, 0.7]]);
  return s;
}

function splitblade4() {
  const f = FAM.splitblade;
  let s = glowRect(54, 24, 30, 16, C.arcaneHi, 0.025);
  // echo blades behind
  s += PTH('M30 18 L72 8 L78 11 L36 21Z', f.blade, { o: 0.35, sw: 1 });
  s += PTH('M30 30 L72 40 L78 37 L36 27Z', f.blade, { o: 0.35, sw: 1 });
  s += PTH('M31 20 L76 13 L82 16 L37 23Z', C.arcaneHi, { o: 0.22, sw: 1 });
  s += drawBlade(21, 80, 5, f, { tip: 6 });
  s += R(25, 22, 48, 1, C.arcaneHi, 0.55);
  s += R(25, 26, 48, 1, C.ink, 0.55);
  // split seam
  s += linePx(44, 19, 48, 29, C.ink, 1, 0.7);
  s += glyph(58, 20, C.arcaneHi, 1, 0.9, 2);
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.iron });
  s += R(16, 12, 4, 4, C.arcaneHi, 0.5) + R(16, 31, 4, 4, C.arcaneHi, 0.5);
  s += sparks([[62, 6, 1, C.arcaneHi, 0.85], [78, 34, 1, C.arcaneHi, 0.75]]);
  return s;
}

function splitblade5() {
  const f = FAM.splitblade;
  let s = glowRect(60, 24, 38, 22, C.arcaneHi, 0.03);
  // fan of ghost blades
  const ghosts = [
    ['M33 22 L86 2 L91 4 L37 25Z', 0.35],
    ['M33 20 L84 8 L88 11 L36 23Z', 0.28],
    ['M33 18 L86 14 L88 18 L36 22Z', 0.24],
    ['M33 26 L86 34 L88 30 L36 24Z', 0.28],
    ['M33 28 L84 40 L91 38 L37 25Z', 0.35],
    ['M33 30 L86 46 L91 44 L37 27Z', 0.25],
  ];
  for (const [d, o] of ghosts) {
    s += PTH(d, C.steel, { o, sw: 1, stroke: C.ink });
    s += PTH(d, C.arcaneHi, { o: o * 0.35, sw: 0, stroke: null });
  }
  // main sovereign blade
  s += drawBlade(21, 84, 5, f, { tip: 7 });
  s += R(25, 22, 52, 1, C.arcaneHi, 0.8);
  s += R(25, 26, 52, 1, C.ink, 0.6);
  s += dither(28, 21, 48, 6, C.arcaneHi, 4, 0.22);
  // crown guard
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.iron });
  s += PTH('M17 12 L20 6 L23 11 L26 4 L29 11 L33 6 L35 14 L28 18 L20 18Z', C.brass, { stroke: C.ink, sw: 1 });
  s += R(21, 8, 1, 3, C.brassHi) + R(25, 7, 1, 4, C.brassHi) + R(31, 9, 1, 3, C.brassHi);
  s += R(24, 20, 4, 3, C.arcaneHi, 0.9) + R(25, 20, 2, 2, C.white, 0.8);
  // spectral eye above
  s += PTH('M48 8 L56 5 L64 8 L56 11Z', C.ink, { sw: 1 });
  s += PTH('M51 8 L56 6 L61 8 L56 10Z', C.arcaneHi, { sw: null });
  s += R(55, 6, 2, 4, C.ink);
  s += sparks([[40, 4, 1, C.arcaneHi, 0.85], [90, 20, 1, C.arcaneHi, 0.85], [76, 44, 1, C.white, 0.7], [28, 40, 1, C.arcaneHi, 0.7]]);
  return s;
}

function worldTree4() {
  const f = FAM.world_tree;
  let s = glowRect(58, 20, 30, 16, C.leaf, 0.025);
  s += leafCluster(44, 13, 8) + leafCluster(60, 9, 9) + leafCluster(75, 15, 7) + leafCluster(66, 22, 5);
  s += drawBlade(21, 84, 5, f, { tip: 7, fill: C.woodHi });
  s += R(25, 21, 50, 1, '#b98a58', 0.9);
  s += R(25, 27, 50, 1, C.woodLo, 0.95);
  for (let x = 28; x < 78; x += 8) s += linePx(x, 20, x + 2, 28, C.woodLo, 1, 0.55);
  // branches and roots
  s += linePx(56, 22, 50, 16, C.wood, 2) + linePx(68, 22, 74, 15, C.wood, 2);
  s += linePx(24, 27, 20, 36, C.wood, 2) + linePx(23, 21, 18, 13, C.wood, 2);
  s += R(20, 35, 2, 3, C.woodLo) + R(17, 11, 3, 3, C.woodLo);
  s += leafCluster(82, 30, 5) + linePx(80, 25, 82, 29, C.wood, 2);
  s += glyph(40, 21, C.brass, 1, 0.8, 1);
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.wood });
  s += R(17, 17, 4, 5, C.leaf) + R(17, 26, 4, 5, C.leaf);
  s += sparks([[35, 5, 1, C.leafHi, 0.8], [82, 8, 1, C.brassHi, 0.7]]);
  return s;
}

function worldTree5() {
  const f = FAM.world_tree;
  let s = glowRect(58, 24, 38, 20, C.leaf, 0.03);
  // canopy
  s += leafCluster(36, 13, 10) + leafCluster(52, 7, 11) + leafCluster(68, 9, 11) + leafCluster(82, 15, 9) + leafCluster(60, 19, 8);
  s += dither(28, 4, 60, 18, C.leafHi, 4, 0.18);
  // hanging gold fruit / stars
  for (const [x, y] of [[33, 22], [47, 18], [62, 21], [78, 22], [88, 24]]) {
    s += R(x, y, 2, 2, C.brassHi, 0.9);
    s += R(x - 1, y - 1, 4, 4, C.brassHi, 0.12);
  }
  // trunk blade
  s += drawBlade(21, 92, 6, f, { tip: 8, fill: C.woodHi });
  s += R(24, 20, 60, 2, '#b98a58', 0.95);
  s += R(24, 28, 60, 2, C.woodLo, 0.95);
  s += R(28, 24, 58, 1, C.woodLo, 0.7);
  for (let x = 30; x < 86; x += 7) s += linePx(x, 20, x + 2, 28, C.woodLo, 1, 0.5);
  s += glyph(38, 21, C.brassHi, 1, 0.9, 0);
  s += glyph(56, 21, C.brass, 1, 0.85, 4);
  s += glyph(72, 21, C.brassHi, 1, 0.85, 2);
  // branches into canopy
  s += linePx(34, 21, 26, 12, C.wood, 3) + linePx(52, 20, 50, 10, C.wood, 3);
  s += linePx(68, 20, 72, 8, C.wood, 3) + linePx(82, 21, 90, 14, C.wood, 2);
  // roots
  s += linePx(28, 30, 20, 41, C.wood, 3) + linePx(38, 30, 33, 44, C.wood, 2);
  s += linePx(58, 30, 55, 43, C.wood, 3) + linePx(72, 30, 80, 42, C.wood, 2);
  s += linePx(84, 29, 91, 37, C.wood, 2);
  s += R(18, 40, 3, 3, C.woodLo) + R(32, 43, 3, 3, C.woodLo) + R(78, 41, 3, 3, C.woodLo);
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.wood });
  s += linePx(18, 18, 14, 10, C.wood, 2) + linePx(18, 30, 14, 38, C.wood, 2);
  s += leafCluster(13, 9, 4) + leafCluster(13, 39, 4);
  s += sparks([[42, 2, 2, C.leafHi, 0.85], [72, 3, 1, C.brassHi, 0.8], [92, 24, 1, C.leafHi, 0.7], [46, 39, 1, C.leafHi, 0.75]]);
  return s;
}

function fishblade4() {
  const f = FAM.fishblade;
  let s = glowRect(60, 24, 32, 16, C.sea, 0.03);
  const d = 'M22 21 L44 14 L66 17 L84 13 L91 20 L88 29 L70 33 L46 34 L22 29Z';
  s += PTH(d, f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M24 21 L44 16 L64 19 L82 15 L84 21 L76 28 L66 30 L46 31 L24 27Z', f.hi, { stroke: null, o: 0.5 });
  s += PTH('M24 26 L46 32 L70 31 L84 27 L66 33 L46 34 L24 29Z', C.seaLo, { stroke: null, o: 0.55 });
  // fin
  s += PTH('M24 20 L30 8 L40 19Z', C.sea, { sw: 1 });
  s += R(29, 11, 2, 5, C.seaHi, 0.7);
  s += linePx(40, 19, 42, 29, C.seaLo, 1, 0.7);
  // serrated fang edge + barnacles
  for (let x = 46; x < 82; x += 8) s += PTH(`M${x} 32 L${x + 3} 38 L${x + 6} 31Z`, C.bone, { sw: 1, o: 0.9 });
  for (const [x, y] of [[48, 18], [60, 30], [72, 19], [80, 27]]) {
    s += disc(x, y, 2, C.boneLo, 1, 0.95) + R(x, y - 1, 1, 1, C.ink, 0.75);
  }
  s += drawHilt(f, { guardH: 22, flare: true, guardC: C.iron });
  s += linePx(9, 20, 17, 28, C.sea, 2);
  s += sparks([[76, 9, 1, C.seaHi, 0.85], [52, 37, 1, C.sea, 0.7], [36, 8, 1, C.seaHi, 0.7]]);
  return s;
}

function fishblade5() {
  const f = FAM.fishblade;
  let s = glowRect(60, 24, 40, 20, C.sea, 0.035);
  // leviathan fang
  const d = 'M22 19 L40 12 L58 13 L74 9 L92 5 L94 13 L88 23 L89 33 L70 37 L48 39 L22 31Z';
  s += PTH(d, f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M24 19 L40 14 L58 15 L74 11 L90 8 L91 13 L84 22 L84 30 L68 34 L48 36 L24 29Z', f.hi, { stroke: null, o: 0.45 });
  s += PTH('M24 27 L48 36 L70 34 L86 29 L88 33 L70 37 L48 39 L22 31Z', C.seaLo, { stroke: null, o: 0.55 });
  // barnacle clusters
  for (const [x, y, r] of [[38, 22, 3], [52, 16, 2], [66, 27, 3], [78, 14, 2], [84, 31, 2], [46, 32, 2]]) {
    s += disc(x, y, r, C.boneLo, 1, 0.95);
    s += R(x - 1, y - 1, 2, 2, C.ink, 0.75);
    s += R(x, y - r, 1, 1, C.bone, 0.9);
  }
  // eye
  s += PTH('M30 17 L39 14 L46 21 L40 29 L30 29 L34 23Z', C.ink, { stroke: C.ink, sw: 2 });
  s += PTH('M33 19 L39 17 L43 22 L38 27 L33 27 L35 23Z', C.sea, { stroke: null });
  s += R(38, 18, 2, 8, C.ink) + R(38, 21, 1, 2, C.seaHi, 0.95);
  s += glowRect(38, 23, 7, 6, C.sea, 0.045);
  // fin ridge / tendrils
  s += PTH('M46 13 L50 4 L55 13Z', C.sea, { sw: 1 });
  s += PTH('M60 12 L64 5 L68 12Z', C.sea, { sw: 1 });
  s += linePx(50, 12, 52, 8, C.seaHi, 1, 0.7);
  s += linePx(22, 22, 14, 15, C.sea, 2) + linePx(22, 28, 13, 35, C.sea, 2);
  // serrations
  for (let x = 56; x < 86; x += 8) s += PTH(`M${x} 36 L${x + 3} 42 L${x + 6} 35Z`, C.bone, { sw: 1, o: 0.9 });
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.iron });
  s += PTH('M16 14 L22 10 L28 16 L22 20Z', C.sea, { sw: 1, o: 0.9 });
  s += sparks([[72, 3, 2, C.seaHi, 0.9], [92, 22, 1, C.seaHi, 0.8], [42, 42, 1, C.sea, 0.7], [56, 8, 1, C.white, 0.7]]);
  return s;
}

function funerary4() {
  const f = FAM.funerary;
  let s = glowRect(58, 24, 32, 16, C.purple, 0.035);
  // graveyard gate blade
  const d = 'M22 11 L70 10 L80 14 L88 24 L80 34 L68 38 L22 37Z';
  s += PTH(d, C.iron, { stroke: C.ink, sw: 2 });
  s += R(24, 14, 46, 2, C.steel, 0.5);
  s += R(24, 33, 46, 2, C.ink, 0.7);
  // gate arch opening
  s += R(50, 22, 18, 14, C.ink);
  s += R(52, 18, 14, 5, C.ink);
  s += R(50, 22, 2, 14, C.stone3) + R(66, 22, 2, 14, C.stone3);
  for (let x = 53; x <= 65; x += 4) s += R(x, 19, 2, 17, C.iron) + R(x, 19, 1, 17, C.steelHi, 0.3);
  s += R(51, 26, 17, 2, C.iron, 0.9) + R(51, 32, 17, 2, C.iron, 0.9);
  s += R(56, 34, 7, 2, C.purple, 0.35);
  // bone cross above + skull boss
  s += R(32, 16, 2, 12, C.bone, 0.95) + R(28, 20, 10, 2, C.bone, 0.95);
  s += R(32, 16, 1, 12, C.boneLo, 0.8);
  s += disc(40, 30, 4, C.bone, 1);
  s += R(38, 28, 1, 2, C.ink) + R(42, 28, 1, 2, C.ink) + R(40, 31, 1, 1, C.ink);
  // gate spikes
  for (let x = 53; x <= 65; x += 4) s += PTH(`M${x} 19 L${x + 1} 15 L${x + 2} 19Z`, C.iron, { sw: 1 });
  s += drawHilt(f, { guardH: 26, flare: true, guardC: C.iron });
  s += PTH('M16 14 L22 18 L22 30 L16 34 L18 24Z', C.bone, { sw: 1, o: 0.95 });
  s += sparks([[48, 7, 1, C.purple, 0.85], [78, 7, 1, C.purple, 0.75], [84, 40, 1, C.purple, 0.7]]);
  return s;
}

function funerary5() {
  const f = FAM.funerary;
  let s = glowRect(54, 24, 42, 20, C.purple, 0.04);
  // key shaft as blade
  s += PTH('M20 21 L80 21 L94 24 L80 28 L20 28Z', C.iron, { stroke: C.ink, sw: 2 });
  s += R(24, 22, 54, 1, C.bone, 0.85);
  s += R(24, 26, 54, 1, C.ink, 0.75);
  s += R(42, 23, 12, 2, C.bone, 0.95);
  // key bit / teeth
  s += R(78, 26, 16, 5, C.iron) + R(78, 26, 16, 1, C.steel, 0.7);
  s += R(84, 31, 4, 7, C.iron) + R(91, 31, 3, 5, C.iron);
  s += R(84, 31, 1, 7, C.bone, 0.65) + R(91, 31, 1, 5, C.bone, 0.65);
  s += R(78, 26, 2, 5, C.bone, 0.5);
  // ornate bow (ring)
  s += discRows(33, 24, 13, C.ink, 1);
  s += discRows(33, 24, 11, C.iron, 1);
  s += discRows(33, 24, 7, C.ink, 1);
  s += discRows(33, 24, 10, C.brassLo, 1, 0.9);
  s += discRows(33, 24, 9, C.iron, 1);
  s += discRows(33, 24, 6, C.ink, 1);
  s += R(26, 15, 2, 2, C.brassHi, 0.8) + R(38, 32, 2, 2, C.brassHi, 0.7);
  // skull boss inside bow
  s += R(29, 20, 9, 8, C.bone) + R(30, 28, 7, 3, C.bone);
  s += R(31, 22, 2, 3, C.ink) + R(35, 22, 2, 3, C.ink);
  s += R(33, 26, 1, 1, C.ink) + R(31, 29, 1, 2, C.ink) + R(34, 29, 1, 2, C.ink) + R(37, 29, 1, 2, C.ink);
  // purple soul flames
  s += PTH('M48 20 L51 12 L54 18 L57 10 L59 20Z', C.purple, { sw: 1, o: 0.85 });
  s += PTH('M50 15 L52 13 L53 18Z', C.purpleLo, { sw: null, o: 0.8 });
  s += PTH('M66 28 L69 36 L72 29 L75 38 L77 28Z', C.purple, { sw: 1, o: 0.75 });
  s += R(52, 18, 2, 2, C.purpleLo, 0.8);
  s += drawHilt(f, { guardH: 30, flare: true, guardC: C.iron });
  // skull pommel
  s += R(4, 20, 8, 8, C.bone);
  s += R(5, 28, 6, 2, C.bone);
  s += R(5, 21, 2, 2, C.ink) + R(9, 21, 2, 2, C.ink);
  s += R(7, 25, 1, 1, C.ink) + R(5, 28, 1, 2, C.ink) + R(8, 28, 1, 2, C.ink) + R(11, 28, 1, 2, C.ink);
  s += sparks([[45, 7, 1, C.purple, 0.9], [62, 6, 1, C.purpleLo, 0.8], [80, 14, 1, C.purple, 0.85], [88, 41, 1, C.purple, 0.7]]);
  return s;
}

/* ------------------------------------------------------------------ */
/* broken / remnant                                                    */
/* ------------------------------------------------------------------ */
function broken() {
  const f = FAM.citadel;
  let s = glowRect(56, 24, 32, 12, C.blood, 0.025);
  // snapped hilt and stub
  s += drawBlade(21, 52, 5, f, { tip: 2 });
  s += PTH('M50 19 L56 20 L53 24 L57 28 L51 29 L48 24Z', C.steelHi, { stroke: C.ink, sw: 1, o: 0.9 });
  s += R(50, 22, 6, 2, C.ink, 0.85);
  s += linePx(44, 20, 49, 28, C.ink, 1, 0.8);
  // flying tip
  s += PTH('M62 14 L86 22 L88 27 L80 30 L63 22Z', f.blade, { stroke: C.ink, sw: 2 });
  s += PTH('M64 16 L84 23 L84 25 L78 27 L64 20Z', C.steelHi, { stroke: null, o: 0.5 });
  s += linePx(70, 19, 76, 25, C.ink, 1, 0.65);
  // shards
  s += PTH('M56 10 L60 8 L61 12Z', C.steel, { sw: 1 });
  s += PTH('M60 36 L64 39 L59 41Z', C.steel, { sw: 1 });
  s += PTH('M70 35 L75 38 L71 41Z', C.iron, { sw: 1 });
  s += R(56, 10, 1, 1, C.steelHi, 0.8);
  s += drawHilt(f, { guardH: 20, flare: true, guardC: C.iron });
  s += sparks([[58, 24, 1, C.bloodHi, 0.8], [78, 34, 1, C.ember, 0.6], [66, 6, 1, C.emberHi, 0.6]]);
  return s;
}

function remnant() {
  let s = glowRect(48, 24, 30, 18, C.purple, 0.025);
  // jagged ceremonial chunk
  const d = 'M18 16 L36 8 L62 12 L76 22 L70 34 L54 42 L32 36 L22 28Z';
  s += PTH(d, C.iron, { stroke: C.ink, sw: 2 });
  s += PTH('M22 17 L37 11 L59 15 L71 23 L65 32 L52 38 L34 33 L25 27Z', C.stone3, { stroke: null });
  s += dither(26, 15, 40, 20, C.steelHi, 4, 0.22);
  // gold filigree + bone inlay
  s += R(30, 17, 2, 16, C.brass, 0.95) + R(28, 23, 22, 2, C.brass, 0.9);
  s += R(46, 19, 2, 13, C.bone, 0.9) + R(42, 26, 10, 2, C.bone, 0.85);
  s += R(30, 17, 1, 16, C.brassHi, 0.65) + R(28, 23, 22, 1, C.brassHi, 0.65);
  // broken ring / hilt stub
  s += discRows(19, 24, 8, C.ink, 1);
  s += discRows(19, 24, 6, C.brassLo, 1);
  s += discRows(19, 24, 3, C.stone, 1);
  s += R(15, 16, 3, 3, C.brassHi, 0.85);
  // cracks and chips
  s += linePx(38, 14, 44, 26, C.ink, 1, 0.7) + linePx(44, 26, 41, 36, C.ink, 1, 0.55);
  s += PTH('M70 22 L76 24 L71 28Z', C.bone, { sw: 1, o: 0.85 });
  s += PTH('M32 36 L28 41 L36 39Z', C.stone2, { sw: 1 });
  s += sparks([[55, 9, 1, C.purple, 0.75], [68, 38, 1, C.brassHi, 0.7], [26, 6, 1, C.purple, 0.6]]);
  return s;
}

/* ------------------------------------------------------------------ */
/* assemble                                                            */
/* ------------------------------------------------------------------ */
function svgDoc(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-label="${title}">\n<title>${title}</title>\n${body}\n</svg>\n`;
}

const STAGE_DRAW = {
  citadel:    [null, null, null, null, citadel4, citadel5],
  holy:       [null, null, null, null, holy4, holy5],
  sawblade:   [null, null, null, null, sawblade4, sawblade5],
  dragonfang: [null, null, null, null, dragonfang4, dragonfang5],
  runeblade:  [null, null, null, null, runeblade4, runeblade5],
  splitblade: [null, null, null, null, splitblade4, splitblade5],
  world_tree: [null, null, null, null, worldTree4, worldTree5],
  fishblade:  [null, null, null, null, fishblade4, fishblade5],
  funerary:   [null, null, null, null, funerary4, funerary5],
};

const ROUTE_OF = {
  citadel: 0, holy: 0, sawblade: 1, dragonfang: 1, runeblade: 2, splitblade: 2,
};
const ROUTE_DRAW = [route0, route1, route2];

const files = [];
function emit(name, body, title = name) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, svgDoc(96, 48, title, body), 'utf8');
  files.push(name);
}

for (const [fam, data] of Object.entries(SWORD_FAMILIES)) {
  for (let stage = 0; stage < 6; stage++) {
    let body;
    if (stage <= 2) body = baseStage(fam, stage);
    else if (stage === 3) {
      if (fam === 'world_tree') body = treeRoute(data.accent);
      else if (fam === 'fishblade') body = fishRoute(data.accent);
      else if (fam === 'funerary') body = funeraryRoute(data.accent);
      else body = ROUTE_DRAW[ROUTE_OF[fam]](data.accent);
    } else body = STAGE_DRAW[fam][stage]();
    const title = `${data.en} ${data.enStages[stage]} (${data.zh} ${data.stages[stage]}) - ForgeTax sword stage ${stage}`;
    emit(`${fam}_s${stage}.svg`, body, title);
  }
}

const routes = [
  ['route0_s3.svg', route0(C.steelHi), 'Bastion gate route silhouette (+6 to +9) - ForgeTax'],
  ['route1_s3.svg', route1(C.ember), 'Saw and rage route silhouette (+6 to +9) - ForgeTax'],
  ['route2_s3.svg', route2(C.arcane), 'Arcane glow route silhouette (+6 to +9) - ForgeTax'],
];
for (const [name, body, title] of routes) emit(name, body, title);
emit('broken.svg', broken(), 'Broken sword with flying shards - ForgeTax');
emit('remnant.svg', remnant(), 'Broken ceremonial remnant - ForgeTax');

/* ------------------------------------------------------------------ */
/* verify                                                              */
/* ------------------------------------------------------------------ */
const expected = [];
for (const fam of Object.keys(SWORD_FAMILIES)) for (let i = 0; i < 6; i++) expected.push(`${fam}_s${i}.svg`);
expected.push('route0_s3.svg', 'route1_s3.svg', 'route2_s3.svg', 'broken.svg', 'remnant.svg');

const problems = [];
for (const name of expected) {
  const file = path.join(OUT, name);
  if (!fs.existsSync(file)) { problems.push(`MISSING ${name}`); continue; }
  const txt = fs.readFileSync(file, 'utf8');
  if (!txt.startsWith('<svg')) problems.push(`${name}: does not start with <svg`);
  if (!txt.trimEnd().endsWith('</svg>')) problems.push(`${name}: does not end with </svg`);
  if (/NaN/.test(txt)) problems.push(`${name}: contains NaN`);
  if (/\shref\s*=/.test(txt) || /<image\b/.test(txt)) problems.push(`${name}: external reference`);
  if (!/<title>/.test(txt)) problems.push(`${name}: missing <title>`);
  if (!txt.includes('viewBox="0 0 96 48"')) problems.push(`${name}: wrong viewBox`);
}
const extra = fs.readdirSync(OUT).filter(n => n.endsWith('.svg') && !expected.includes(n));
console.log(`swords: wrote ${files.length} files, expected ${expected.length}`);
console.log(`families: ${Object.keys(SWORD_FAMILIES).length} x 6 = ${Object.keys(SWORD_FAMILIES).length * 6}`);
console.log(`routes: 3  broken/remnant: 2`);
if (extra.length) console.log(`extra svg files: ${extra.join(', ')}`);
if (problems.length) {
  console.error('VALIDATION FAILED');
  for (const p of problems) console.error(' - ' + p);
  process.exitCode = 1;
} else {
  console.log('sword validation OK: svg envelope, viewBox, title, no NaN, no external href');
}
