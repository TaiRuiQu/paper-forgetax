#!/usr/bin/env node
// Generates 32x32 pixel-art SVG icons for relics, consumables and achievements.
// Pure Node ESM, no dependencies. Art is drawn on a 32x32 integer pixel grid,
// then a 1px ink silhouette outline is added automatically.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELICS } from '../shared/data/relics.js';
import { CONSUMABLES, ACHIEVEMENTS } from '../shared/data/gameData.js';

const W = 32;
const H = 32;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const C = {
  ink: '#0d0b10',
  soot: '#1b1820',
  stone: '#3a3441',
  stoneDark: '#2a2531',
  stoneLight: '#4d4657',
  steel: '#87909e',
  steelDark: '#59626e',
  steelMid: '#6f7885',
  bright: '#c8d2da',
  white: '#eef3f5',
  wood: '#6b4428',
  woodDark: '#4a2e1a',
  woodLight: '#8a5a35',
  leather: '#8a5a35',
  leatherDark: '#5c3a20',
  leatherLight: '#a8734a',
  brass: '#c9973f',
  brassDark: '#8e6423',
  brassLight: '#e0b968',
  gold: '#f1cc71',
  goldDark: '#b07d2a',
  goldLight: '#ffe9ae',
  ember: '#ff7a2f',
  emberDark: '#b33d12',
  emberLight: '#ffb066',
  blood: '#a8323e',
  bloodDark: '#6e1f2a',
  bloodLight: '#d0545f',
  arcane: '#6f7bd6',
  arcaneDark: '#3c4590',
  arcaneLight: '#9aa4f0',
  teal: '#9ff6e8',
  tealMid: '#5fbfb4',
  tealDark: '#3d7f78',
  bone: '#d8cfb4',
  boneLight: '#f0e8cf',
  boneDark: '#a89a7c',
  pink: '#d98ba0',
  pinkDark: '#9c5668',
  pinkLight: '#f0b8c8',
  glass: '#2b4a5e',
  glassLight: '#4f7d92',
  ash: '#8c8578',
  ashDark: '#5f5a51',
  rare: '#6db8e8',
  rareDark: '#3a7fae',
  rareLight: '#b5e4fa',
  legend: '#f0b04a',
};

// ---------------------------------------------------------------- pixel grid
const blank = () => Array.from({ length: H }, () => Array(W).fill(null));

function set(g, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (c && x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c;
}

function erase(g, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = null;
}

function rect(g, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, c);
}

function box(g, x, y, w, h, fill, edge = C.ink) {
  rect(g, x, y, w, h, edge);
  rect(g, x + 1, y + 1, w - 2, h - 2, fill);
}

function hline(g, x0, x1, y, c) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(g, x, y, c);
}

function vline(g, x, y0, y1, c) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(g, x, y, c);
}

function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function poly(g, pts, c) {
  if (!pts.length) return;
  const ys = pts.map(p => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
        xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - 0.5);
      const xb = Math.floor(xs[k + 1] - 0.5);
      for (let x = xa; x <= xb; x++) set(g, x, y, c);
    }
  }
}

// polygon from points relative to (cx,cy), scaled
function polyAt(g, cx, cy, pts, s, c) {
  poly(g, pts.map(([x, y]) => [cx + x * s, cy + y * s]), c);
}

function disc(g, cx, cy, r, c) {
  const rr = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rr) set(g, x, y, c);
    }
  }
}

function ring(g, cx, cy, rOut, rIn, c) {
  const ro = rOut * rOut;
  const ri = rIn * rIn;
  for (let y = Math.floor(cy - rOut); y <= Math.ceil(cy + rOut); y++) {
    for (let x = Math.floor(cx - rOut); x <= Math.ceil(cx + rOut); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = dx * dx + dy * dy;
      if (d <= ro && d >= ri) set(g, x, y, c);
    }
  }
}

function ellipse(g, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(g, x, y, c);
    }
  }
}

function ellipseRing(g, cx, cy, rx, ry, thick, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const no = nx * nx + ny * ny;
      const ix = (x + 0.5 - cx) / Math.max(0.5, rx - thick);
      const iy = (y + 0.5 - cy) / Math.max(0.5, ry - thick);
      const ni = ix * ix + iy * iy;
      if (no <= 1 && ni >= 1) set(g, x, y, c);
    }
  }
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const den = dx * dx + dy * dy || 1;
  let t = ((px - x0) * dx + (py - y0) * dy) / den;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function stroke(g, pts, w, c) {
  const r = w / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const pad = Math.ceil(r);
    for (let y = Math.floor(Math.min(y0, y1) - pad); y <= Math.ceil(Math.max(y0, y1) + pad); y++) {
      for (let x = Math.floor(Math.min(x0, x1) - pad); x <= Math.ceil(Math.max(x0, x1) + pad); x++) {
        if (segDist(x + 0.5, y + 0.5, x0, y0, x1, y1) <= r) set(g, x, y, c);
      }
    }
  }
}

function stamp(g, cx, cy, w, h, c) {
  rect(g, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h, c);
}

function arcPix(g, cx, cy, r, a0, a1, c, step = 0.06) {
  const dir = a1 >= a0 ? 1 : -1;
  for (let a = a0; dir > 0 ? a <= a1 : a >= a1; a += step * dir) {
    const rad = (a * Math.PI) / 180;
    set(g, Math.round(cx + Math.cos(rad) * r - 0.5), Math.round(cy + Math.sin(rad) * r - 0.5), c);
  }
}

function chain(g, pts, col = C.steel, dark = C.steelDark) {
  stroke(g, pts, 3, dark);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      set(g, x0 + (x1 - x0) * t - 0.5, y0 + (y1 - y0) * t - 0.5, col);
      set(g, x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t + 0.5, col);
    }
  }
}

function outline(g, col = C.ink) {
  const out = g.map(row => row.slice());
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x]) continue;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && g[ny][nx]) {
          out[y][x] = col;
          break;
        }
      }
    }
  }
  return out;
}

function build(fn) {
  const g = blank();
  const fx = [];
  fn(g, fx);
  const out = outline(g);
  for (const [x, y, c] of fx) set(out, x, y, c);
  return out;
}

// ------------------------------------------------------------------ motifs
function sword(g, o = {}) {
  const cx = o.cx ?? 16;
  const tip = o.tip ?? 3;
  const guardY = o.guardY ?? 21;
  const half = o.half ?? 3;
  const blade = o.blade ?? C.steel;
  const light = o.light ?? C.bright;
  const dark = o.dark ?? C.steelDark;
  const guard = o.guard ?? C.brass;
  const guardDark = o.guardDark ?? C.brassDark;
  const grip = o.grip ?? C.leather;
  const pommel = o.pommel ?? C.brass;
  const gHalf = o.guardHalf ?? 7;
  const gripLen = o.gripLen ?? 6;

  poly(g, [
    [cx, tip], [cx + half, tip + 5], [cx + half, guardY],
    [cx - half, guardY], [cx - half, tip + 5],
  ], blade);
  for (let y = tip + 5; y < guardY; y++) {
    set(g, cx + half, y, dark);
    if (y > tip + 8) set(g, cx + half - 1, y, dark);
  }
  line(g, cx, tip + 4, cx, guardY - 1, light);
  line(g, cx - half + 1, tip + 8, cx - half + 1, guardY - 1, C.white);

  box(g, cx - gHalf, guardY, gHalf * 2 + 1, 3, guard, guardDark);
  set(g, cx - gHalf, guardY - 1, guard);
  set(g, cx + gHalf, guardY - 1, guard);
  set(g, cx - gHalf + 1, guardY + 1, C.goldLight);
  set(g, cx + gHalf - 1, guardY + 1, C.goldDark);

  box(g, cx - 2, guardY + 3, 5, gripLen, grip, C.ink);
  for (let y = guardY + 4; y < guardY + 3 + gripLen; y += 2) {
    rect(g, cx - 2, y, 5, 1, C.leatherDark);
    set(g, cx - 1, y, C.leatherLight);
  }
  const py = guardY + gripLen + 5;
  disc(g, cx, py, 3, pommel);
  set(g, cx - 1, py - 2, C.goldLight);
  set(g, cx + 1, py + 1, C.goldDark);
  if (o.gem) {
    set(g, cx, guardY + 1, o.gem);
    set(g, cx, guardY + 2, C.goldLight);
  }
  return { guardY, pommelY: py };
}

function bellBody(g, o = {}) {
  const cx = o.cx ?? 16;
  const top = o.top ?? 6;
  const base = o.base ?? 22;
  const col = o.col ?? C.brass;
  const light = o.light ?? C.brassLight;
  const dark = o.dark ?? C.brassDark;
  const lipDark = o.lipDark ?? C.woodDark;
  poly(g, [
    [cx - 2, top], [cx + 2, top], [cx + 3, top + 4],
    [cx + 4, base - 7], [cx + 9, base - 2], [cx + 9, base],
    [cx - 9, base], [cx - 9, base - 2], [cx - 4, base - 7], [cx - 3, top + 4],
  ], col);
  rect(g, cx - 9, base - 2, 19, 3, dark);
  hline(g, cx - 8, cx + 8, base - 1, light);
  line(g, cx - 4, top + 3, cx - 6, base - 4, light);
  line(g, cx - 2, top + 2, cx - 3, base - 5, C.goldLight);
  line(g, cx + 4, top + 5, cx + 7, base - 3, dark);
  // crown loop
  if (o.loop !== false) ring(g, cx, top - 2, 2.5, 1, o.loop ?? C.steelDark);
  if (o.clapper !== false) {
    stroke(g, [[cx, base], [cx, base + 4]], 1, C.steelDark);
    disc(g, cx, base + 5, 2, C.steelDark);
    set(g, cx - 1, base + 4, C.steel);
  }
  return { cx, top, base };
}

function hourglass(g, o = {}) {
  const cx = o.cx ?? 16;
  const top = o.top ?? 4;
  const bottom = o.bottom ?? 28;
  const mid = Math.round((top + bottom) / 2);
  const frame = o.frame ?? C.brass;
  const frameDark = o.frameDark ?? C.brassDark;
  const sand = o.sand ?? C.gold;
  const glass = o.glass ?? C.glass;
  const glassLight = o.glassLight ?? C.glassLight;

  // glass chambers
  poly(g, [[cx - 7, top + 3], [cx + 7, top + 3], [cx + 2, mid - 1], [cx - 2, mid - 1]], glass);
  poly(g, [[cx - 2, mid + 1], [cx + 2, mid + 1], [cx + 7, bottom - 3], [cx - 7, bottom - 3]], glass);

  // sand
  poly(g, [[cx - 6, top + 8], [cx + 6, top + 8], [cx + 1, mid - 2], [cx - 1, mid - 2]], sand);
  poly(g, [[cx - 1, mid + 2], [cx + 1, mid + 2], [cx + 6, bottom - 4], [cx - 6, bottom - 4]], sand);
  vline(g, cx, mid - 2, bottom - 5, o.stream ?? sand);
  set(g, cx - 2, bottom - 5, C.emberLight);

  // glass glints
  line(g, cx - 5, top + 5, cx - 2, mid - 5, glassLight);
  line(g, cx - 6, bottom - 7, cx - 3, bottom - 5, glassLight);
  line(g, cx + 4, top + 5, cx + 2, mid - 6, C.ink);

  // frame
  rect(g, cx - 10, top, 21, 3, frame);
  hline(g, cx - 9, cx + 9, top, C.goldLight);
  rect(g, cx - 10, bottom - 2, 21, 3, frame);
  hline(g, cx - 9, cx + 9, bottom + 1, frameDark);
  rect(g, cx - 10, top + 2, 2, bottom - top - 1, frameDark);
  rect(g, cx + 9, top + 2, 2, bottom - top - 1, frameDark);
  set(g, cx - 9, top + 5, frame);
  set(g, cx + 9, bottom - 5, frame);
  if (o.crack) {
    line(g, cx + 4, top + 5, cx + 2, mid - 4, C.ink);
    line(g, cx + 2, mid - 4, cx + 5, mid - 1, C.ink);
    set(g, cx + 5, top + 6, C.white);
  }
  return { cx, top, bottom, mid };
}

function goblet(g, o = {}) {
  const cx = o.cx ?? 16;
  const top = o.top ?? 6;
  const bowlH = o.bowlH ?? 10;
  const metal = o.metal ?? C.brass;
  const light = o.light ?? C.goldLight;
  const dark = o.dark ?? C.brassDark;
  const stem = o.stem ?? C.brass;
  const foot = o.foot ?? C.brass;
  const bowlW = o.bowlW ?? 8;

  poly(g, [
    [cx - bowlW, top], [cx + bowlW, top], [cx + bowlW - 3, top + bowlH],
    [cx - bowlW + 3, top + bowlH],
  ], metal);
  // open rim + empty interior
  rect(g, cx - bowlW, top, bowlW * 2, 2, light);
  rect(g, cx - bowlW + 2, top + 1, bowlW * 2 - 4, 3, C.soot);
  hline(g, cx - bowlW + 2, cx + bowlW - 2, top + 4, dark);
  // shading
  line(g, cx - bowlW + 2, top + 5, cx - bowlW + 4, top + bowlH - 1, light);
  line(g, cx + bowlW - 1, top + 2, cx + bowlW - 3, top + bowlH - 1, dark);
  line(g, cx - bowlW + 4, top + 1, cx - 4, top + bowlH - 1, C.goldLight);
  // stem + knop + foot
  box(g, cx - 2, top + bowlH, 5, 8, stem, C.ink);
  set(g, cx - 1, top + bowlH + 1, light);
  disc(g, cx, top + bowlH + 5, 3, foot);
  set(g, cx - 1, top + bowlH + 3, light);
  const fy = top + bowlH + 10;
  poly(g, [[cx - 2, fy - 2], [cx + 2, fy - 2], [cx + 9, fy + 2], [cx + 9, fy + 4], [cx - 9, fy + 4], [cx - 9, fy + 2]], foot);
  hline(g, cx - 7, cx + 7, fy + 3, dark);
  return { cx, top, bowlH, fy };
}

function scroll(g, x, y, w, h, o = {}) {
  const paper = o.paper ?? C.bone;
  const edge = o.edge ?? C.boneDark;
  const roll = o.roll ?? C.wood;
  const rollLight = o.rollLight ?? C.woodLight;
  box(g, x, y, w, h, paper, edge);
  if (o.vertical !== false) {
    rect(g, x - 1, y - 2, w + 2, 3, roll);
    hline(g, x - 1, x + w, y - 2, rollLight);
    rect(g, x - 1, y + h - 1, w + 2, 3, roll);
    hline(g, x - 1, x + w, y + h + 1, C.woodDark);
  } else {
    rect(g, x - 2, y - 1, 3, h + 2, roll);
    rect(g, x + w - 1, y - 1, 3, h + 2, roll);
    vline(g, x - 2, y, y + h - 1, rollLight);
  }
  for (let yy = y + 3; yy < y + h - 2; yy += 3) {
    hline(g, x + 2, x + w - 3, yy, edge);
  }
}

function openBook(g, cx, cy, w, h, o = {}) {
  const cover = o.cover ?? C.leatherDark;
  const pages = o.pages ?? C.bone;
  const edge = o.edge ?? C.boneDark;
  const half = Math.round(w / 2);
  // covers
  poly(g, [[cx - half - 2, cy - 1], [cx, cy + 2], [cx, cy + h + 1], [cx - half - 2, cy + h - 2]], cover);
  poly(g, [[cx + half + 2, cy - 1], [cx, cy + 2], [cx, cy + h + 1], [cx + half + 2, cy + h - 2]], cover);
  // pages
  poly(g, [[cx - half, cy], [cx - 1, cy + 3], [cx - 1, cy + h], [cx - half + 1, cy + h - 2]], pages);
  poly(g, [[cx + half, cy], [cx + 1, cy + 3], [cx + 1, cy + h], [cx + half - 1, cy + h - 2]], pages);
  // page lines
  for (let i = 1; i < 4; i++) {
    line(g, cx - half + 3, cy + 2 + i * 2, cx - 3, cy + 4 + i * 2, edge);
    line(g, cx + half - 3, cy + 2 + i * 2, cx + 3, cy + 4 + i * 2, edge);
  }
  // spine
  line(g, cx, cy + 2, cx, cy + h, C.ink);
  line(g, cx - 1, cy + 2, cx - 1, cy + h - 1, C.goldDark);
  // gold corners
  set(g, cx - half + 1, cy + 1, C.gold);
  set(g, cx + half - 1, cy + 1, C.gold);
  set(g, cx - half + 1, cy + h - 2, C.gold);
  set(g, cx + half - 1, cy + h - 2, C.gold);
}

function coin(g, cx, cy, r, o = {}) {
  const face = o.face ?? C.gold;
  const edge = o.edge ?? C.goldDark;
  const glint = o.glint ?? C.goldLight;
  disc(g, cx, cy, r, edge);
  disc(g, cx, cy, r - 1, face);
  arcPix(g, cx, cy, r - 1.5, 190, 260, glint);
  set(g, cx - 1, cy - 1, glint);
  if (o.mark) {
    set(g, cx, cy - 1, edge);
    set(g, cx, cy + 1, edge);
    set(g, cx - 1, cy, edge);
    set(g, cx + 1, cy, edge);
  }
  if (o.hole) disc(g, cx, cy, 1.2, o.hole);
}

function padlock(g, cx, cy, o = {}) {
  const body = o.body ?? C.steelDark;
  const edge = o.edge ?? C.steel;
  const metal = o.metal ?? C.steel;
  ellipseRing(g, cx, cy - 3, 4, 4, 2, edge);
  box(g, cx - 4, cy - 1, 9, 9, body, C.ink);
  rect(g, cx - 3, cy, 7, 6, body);
  hline(g, cx - 3, cx + 3, cy, metal);
  set(g, cx, cy + 2, C.ink);
  set(g, cx, cy + 3, C.ink);
  set(g, cx, cy + 4, metal);
}

function crown(g, cx, baseY, w, h, o = {}) {
  const col = o.col ?? C.gold;
  const light = o.light ?? C.goldLight;
  const dark = o.dark ?? C.goldDark;
  const hw = Math.round(w / 2);
  poly(g, [
    [cx - hw, baseY], [cx - hw, baseY - Math.round(h * 0.45)],
    [cx - Math.round(w * 0.28), baseY - Math.round(h * 0.18)],
    [cx, baseY - h],
    [cx + Math.round(w * 0.28), baseY - Math.round(h * 0.18)],
    [cx + hw, baseY - Math.round(h * 0.45)],
    [cx + hw, baseY],
  ], col);
  rect(g, cx - hw, baseY - 3, w + 1, 4, dark);
  hline(g, cx - hw + 1, cx + hw - 1, baseY - 2, col);
  line(g, cx - hw + 2, baseY - 5, cx - hw + 3, baseY - Math.round(h * 0.4), light);
  line(g, cx - 1, baseY - 4, cx, baseY - h + 2, light);
  line(g, cx + hw - 2, baseY - 5, cx + hw - 3, baseY - Math.round(h * 0.4), dark);
  for (const [dx, dy] of [[-hw, -Math.round(h * 0.45)], [0, -h], [hw, -Math.round(h * 0.45)]]) {
    disc(g, cx + dx, baseY + dy, 1.6, col);
    set(g, cx + dx - 1, baseY + dy - 1, light);
  }
  const jy = baseY - 4;
  set(g, cx - Math.round(w * 0.25), jy, o.jewel ?? C.blood);
  set(g, cx, jy, o.jewel2 ?? C.rare);
  set(g, cx + Math.round(w * 0.25), jy, o.jewel ?? C.blood);
}

function heartShape(g, cx, cy, s, o = {}) {
  const col = o.col ?? C.blood;
  const light = o.light ?? C.bloodLight;
  const dark = o.dark ?? C.bloodDark;
  const pts = [
    [0, 12], [-4, 9], [-7, 7], [-9, 3], [-9, -1], [-7, -4], [-4, -5],
    [-2, -4], [0, -1], [2, -4], [4, -5], [7, -4], [9, -1], [9, 3], [7, 7], [4, 9],
  ];
  polyAt(g, cx, cy, pts, s, col);
  polyAt(g, cx, cy, [[-9, 1], [-8, -2], [-6, -4], [-3, -4], [-1, -1], [-4, 4], [-7, 6]], s, light);
  polyAt(g, cx, cy, [[4, -3], [7, -3], [8, 0], [7, 5], [3, 8], [1, 3]], s, dark);
  line(g, Math.round(cx - 5 * s), Math.round(cy - 1 * s), Math.round(cx - 3 * s), Math.round(cy + 5 * s), C.ink);
  line(g, Math.round(cx - 4 * s), Math.round(cy + 1 * s), Math.round(cx - 2 * s), Math.round(cy + 6 * s), C.ink);
  line(g, Math.round(cx + 1 * s), Math.round(cy - 2 * s), Math.round(cx + 4 * s), Math.round(cy + 3 * s), C.ink);
}

function flame(g, cx, cy, s, o = {}) {
  const outer = o.outer ?? C.ember;
  const mid = o.mid ?? C.emberLight;
  const core = o.core ?? C.goldLight;
  polyAt(g, cx, cy, [[0, -10], [4, -5], [5, 0], [3, 6], [0, 9], [-3, 6], [-5, 0], [-4, -5]], s, outer);
  polyAt(g, cx, cy, [[0, -5], [3, -1], [3, 3], [0, 7], [-3, 3], [-3, -1]], s, mid);
  polyAt(g, cx, cy, [[0, 1], [2, 3], [0, 6], [-2, 3]], s, core);
}

function eyeAlmond(g, cx, cy, w, h, o = {}) {
  const sclera = o.sclera ?? C.bone;
  const iris = o.iris ?? C.arcane;
  const pupil = o.pupil ?? C.ink;
  const hw = w / 2, hh = h / 2;
  poly(g, [
    [cx - hw, cy], [cx - hw / 2, cy - hh], [cx, cy - hh - 1],
    [cx + hw / 2, cy - hh], [cx + hw, cy], [cx + hw / 2, cy + hh],
    [cx, cy + hh + 1], [cx - hw / 2, cy + hh],
  ], sclera);
  disc(g, cx, cy, Math.max(1.5, hh - 1), iris);
  disc(g, cx, cy, Math.max(1, hh - 2.2), pupil);
  set(g, cx - 1, cy - 1, C.white);
  line(g, cx - hw + 2, cy - hh + 1, cx - hw + 4, cy - 1, o.lid ?? C.boneDark);
}

function skullAt(g, cx, cy, s, o = {}) {
  const bone = o.bone ?? C.bone;
  const dark = o.dark ?? C.boneDark;
  disc(g, cx, cy - 1, 5.5 * s, bone);
  rect(g, Math.round(cx - 4 * s), Math.round(cy + 2 * s), Math.round(8 * s), Math.round(3 * s), bone);
  set(g, Math.round(cx - 3 * s), Math.round(cy + 5 * s), bone);
  set(g, Math.round(cx + 3 * s), Math.round(cy + 5 * s), bone);
  disc(g, Math.round(cx - 2 * s), Math.round(cy - 1 * s), Math.max(1, 1.6 * s), C.ink);
  disc(g, Math.round(cx + 2 * s), Math.round(cy - 1 * s), Math.max(1, 1.6 * s), C.ink);
  set(g, Math.round(cx), Math.round(cy + 1 * s), C.ink);
  set(g, Math.round(cx), Math.round(cy + 2 * s), C.ink);
  for (let i = -2; i <= 2; i += 2) set(g, Math.round(cx + i * s), Math.round(cy + 3 * s), dark);
  set(g, Math.round(cx - 3 * s), Math.round(cy - 4 * s), C.boneLight);
  if (o.glow) {
    set(g, Math.round(cx - 2 * s), Math.round(cy - 1 * s), o.glow);
    set(g, Math.round(cx + 2 * s), Math.round(cy - 1 * s), o.glow);
  }
}

function gear(g, cx, cy, r, teeth, o = {}) {
  const col = o.col ?? C.brass;
  const dark = o.dark ?? C.brassDark;
  const light = o.light ?? C.brassLight;
  const hub = o.hub ?? C.steelDark;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tx = cx + Math.cos(a) * (r + 1);
    const ty = cy + Math.sin(a) * (r + 1);
    stamp(g, tx, ty, 3, 3, col);
  }
  disc(g, cx, cy, r, dark);
  disc(g, cx, cy, r - 1, col);
  ring(g, cx, cy, r - 1, r - 3, light);
  arcPix(g, cx, cy, r - 2, 180, 265, light);
  arcPix(g, cx, cy, r - 2, 10, 80, dark);
  disc(g, cx, cy, Math.max(2, r - 4), dark);
  disc(g, cx, cy, Math.max(1, r - 5), hub);
  set(g, cx - 1, cy - r + 3, C.goldLight);
  if (o.gem) {
    disc(g, cx, cy, 2, o.gem);
    set(g, cx - 1, cy - 1, C.white);
  }
}

function feather(g, o = {}) {
  const cx = o.cx ?? 16;
  const top = o.top ?? 3;
  const bottom = o.bottom ?? 28;
  const col = o.col ?? C.bone;
  const shade = o.shade ?? C.boneDark;
  const spine = o.spine ?? C.woodLight;
  poly(g, [
    [cx, top], [cx + 3, top + 5], [cx + 5, top + 11], [cx + 4, top + 17],
    [cx + 2, bottom - 4], [cx, bottom], [cx - 2, bottom - 4],
    [cx - 4, top + 17], [cx - 5, top + 11], [cx - 3, top + 5],
  ], col);
  poly(g, [[cx, top + 3], [cx + 3, top + 9], [cx + 3, top + 16], [cx, bottom - 2]], shade);
  line(g, cx, top + 1, cx, bottom - 1, spine);
  for (let y = top + 5; y < bottom - 4; y += 3) {
    line(g, cx - 1, y, cx - 4, y + 2, shade);
    line(g, cx + 1, y, cx + 4, y + 2, shade);
  }
  // notched barbs
  for (let y = top + 6; y < bottom - 5; y += 4) {
    erase(g, cx - 5, y);
    erase(g, cx + 5, y + 2);
  }
}

function chainLink(g, cx, cy, rx, ry, col = C.steel, dark = C.steelDark) {
  ellipseRing(g, cx, cy, rx, ry, 2, dark);
  arcPix(g, cx, cy, rx - 0.5, 190, 260, col);
}

function drawAnvil(g, cx, cy, s = 1, o = {}) {
  const col = o.col ?? C.steelDark;
  const light = o.light ?? C.steel;
  const dark = o.dark ?? C.ink;
  polyAt(g, cx, cy, [[-8, -4], [6, -4], [8, -2], [8, 0], [2, 1], [2, 4], [6, 6], [-6, 6], [-4, 4], [-4, 1], [-8, 0]], s, col);
  polyAt(g, cx, cy, [[-7, -3], [6, -3], [7, -1], [1, 0], [1, 2], [-3, 2], [-3, -1], [-6, -1]], s, light);
  polyAt(g, cx, cy, [[-5, 2], [5, 2], [5, 5], [-4, 5]], s, dark);
  set(g, Math.round(cx - 8 * s), Math.round(cy - 3 * s), light);
}

// ------------------------------------------------------------------ commons
const RELIC_DRAWERS = {};

RELIC_DRAWERS['ash-sieve'] = (g, fx) => {
  disc(g, 16, 14, 10, C.woodDark);
  disc(g, 16, 14, 9, C.wood);
  disc(g, 16, 14, 7, C.soot);
  for (let y = 8; y <= 20; y++) {
    for (let x = 10; x <= 22; x++) {
      if ((x - 16) ** 2 + (y - 14) ** 2 > 49) continue;
      if ((x - 16) % 3 === 0) set(g, x, y, C.steelMid);
      if ((y - 14) % 3 === 0) set(g, x, y, C.stoneLight);
    }
  }
  arcPix(g, 16, 14, 8.5, 185, 265, C.woodLight);
  arcPix(g, 16, 14, 9.5, 185, 265, C.leatherLight);
  arcPix(g, 16, 14, 9, 30, 120, C.woodDark);
  // handle
  rect(g, 24, 12, 7, 4, C.woodDark);
  rect(g, 24, 12, 7, 2, C.wood);
  hline(g, 25, 30, 12, C.leatherLight);
  rect(g, 29, 12, 2, 4, C.woodDark);
  // ash in the sieve
  poly(g, [[9, 18], [12, 15], [16, 16], [20, 15], [23, 18], [22, 21], [10, 21]], C.ash);
  poly(g, [[11, 18], [15, 17], [20, 18], [19, 20], [12, 20]], C.boneDark);
  for (let i = 0; i < 8; i++) set(g, 11 + ((i * 5) % 11), 17 + (i % 3), C.bone);
  fx.push([7, 24, C.ash], [24, 23, C.ash], [20, 28, C.ashDark], [12, 29, C.ash]);
};

RELIC_DRAWERS['bent-nail'] = (g, fx) => {
  // flat head
  poly(g, [[5, 4], [12, 2], [14, 6], [7, 9]], C.steelDark);
  poly(g, [[6, 4], [12, 3], [12, 6], [7, 7]], C.steel);
  hline(g, 7, 11, 3, C.bright);
  // upper shaft
  stroke(g, [[9, 6], [13, 11], [18, 18]], 3, C.steel);
  stroke(g, [[8.5, 5.5], [12.5, 10.5], [17.5, 17.5]], 1, C.bright);
  stroke(g, [[10, 7], [14, 12], [19, 18]], 1, C.steelDark);
  // bent lower shaft
  stroke(g, [[18, 18], [21, 21], [24, 24]], 3, C.steel);
  stroke(g, [[18, 18], [21, 21], [24, 24]], 1, C.bright);
  // tapered point
  poly(g, [[23, 23], [27, 27], [21, 26]], C.steel);
  set(g, 25, 25, C.bright);
  // bend shadow
  set(g, 18, 19, C.ink);
  set(g, 19, 20, C.steelDark);
  // rust
  fx.push([15, 15, C.bloodDark], [19, 22, C.bloodDark], [11, 9, C.bloodDark], [6, 8, C.bloodDark]);
};

RELIC_DRAWERS['black-knot'] = (g, fx) => {
  const path = [[4, 6], [7, 11], [6, 17], [10, 21], [16, 22], [22, 19], [24, 13], [21, 8], [15, 7], [11, 11], [13, 15], [18, 16], [20, 13]];
  stroke(g, path, 5, C.soot);
  stroke(g, path, 3, C.stoneDark);
  // highlight along upper side
  stroke(g, [[5, 5], [8, 10], [7, 16], [11, 19.5], [16, 20.5], [21, 18], [22.5, 13], [20, 9], [15, 8.5], [12, 11.5]], 1, C.stoneLight);
  // central knot wrap
  stroke(g, [[13, 15], [19, 16]], 6, C.soot);
  stroke(g, [[13, 14], [19, 15]], 3, C.stoneDark);
  stroke(g, [[14, 14], [18, 15]], 1, C.stoneLight);
  // frayed ends
  fx.push([3, 4, C.ash], [4, 3, C.ash], [2, 6, C.ashDark], [21, 12, C.ash], [22, 11, C.ashDark]);
};

RELIC_DRAWERS['blunt-mallet'] = (g, fx) => {
  // handle
  poly(g, [[14, 13], [18, 13], [19, 29], [13, 29]], C.wood);
  line(g, 15, 14, 14, 28, C.woodLight);
  line(g, 17, 14, 18, 28, C.woodDark);
  // head
  poly(g, [[4, 8], [27, 5], [29, 14], [5, 17]], C.woodDark);
  poly(g, [[5, 8], [26, 6], [27, 13], [6, 15]], C.wood);
  hline(g, 6, 26, 7, C.woodLight);
  line(g, 6, 9, 26, 7, C.leatherLight);
  hline(g, 6, 27, 14, C.woodDark);
  // iron bands
  for (const bx of [8, 21]) {
    rect(g, bx, 6, 3, 10, C.steelDark);
    vline(g, bx, 7, 14, C.steel);
    set(g, bx, 6, C.steelMid);
  }
  rect(g, 27, 6, 2, 9, C.steelDark);
  // chipped striking face
  erase(g, 28, 6); erase(g, 27, 7); erase(g, 29, 8);
  set(g, 27, 6, C.steel);
  set(g, 28, 9, C.steelMid);
  // butt cap
  rect(g, 12, 28, 8, 3, C.steelDark);
  hline(g, 12, 18, 28, C.steel);
  fx.push([3, 2, C.steelMid], [9, 3, C.steelMid]);
};

RELIC_DRAWERS['bound-idol'] = (g, fx) => {
  // body
  poly(g, [[11, 11], [21, 11], [24, 26], [8, 26]], C.stone);
  poly(g, [[19, 12], [21, 11], [24, 26], [17, 26]], C.stoneDark);
  line(g, 11, 13, 9, 24, C.stoneLight);
  // head
  poly(g, [[12, 4], [20, 4], [22, 7], [20, 13], [12, 13], [10, 7]], C.bone);
  poly(g, [[18, 4], [20, 4], [22, 7], [20, 13], [18, 13]], C.boneDark);
  set(g, 14, 8, C.tealDark); set(g, 18, 8, C.tealDark);
  set(g, 15, 8, C.teal); set(g, 17, 8, C.teal);
  hline(g, 14, 17, 11, C.soot);
  set(g, 12, 5, C.boneLight);
  // arms
  stroke(g, [[10, 13], [7, 20]], 3, C.stone);
  stroke(g, [[22, 13], [25, 20]], 3, C.stoneDark);
  // rope bindings
  for (const y of [16, 20, 24]) {
    stroke(g, [[8, y], [24, y - 1]], 3, C.leatherDark);
    stroke(g, [[9, y - 1], [23, y - 2]], 1, C.leatherLight);
  }
  // knot with trailing cord
  disc(g, 21, 19, 2, C.leather);
  fx.push([23, 21, C.leather], [24, 23, C.leatherDark], [25, 25, C.leather]);
  // base
  rect(g, 7, 25, 18, 3, C.stoneDark);
  hline(g, 8, 23, 25, C.stoneLight);
  set(g, 16, 6, C.teal);
};

RELIC_DRAWERS['charcoal-pouch'] = (g, fx) => {
  poly(g, [[8, 13], [24, 13], [26, 20], [22, 28], [10, 28], [6, 20]], C.leather);
  poly(g, [[18, 14], [24, 13], [26, 20], [22, 28], [17, 27]], C.leatherDark);
  line(g, 10, 14, 8, 20, C.leatherLight);
  line(g, 11, 15, 10, 25, C.leatherLight);
  // cinched neck
  rect(g, 11, 9, 10, 5, C.leatherDark);
  hline(g, 11, 20, 9, C.leatherLight);
  rect(g, 10, 11, 12, 2, C.woodDark);
  hline(g, 10, 21, 11, C.brass);
  // coals poking out
  poly(g, [[12, 4], [17, 3], [19, 8], [13, 9]], C.soot);
  poly(g, [[18, 2], [23, 4], [22, 9], [18, 8]], C.stoneDark);
  poly(g, [[20, 5], [24, 6], [23, 9], [19, 9]], C.stone);
  set(g, 16, 5, C.steelDark); set(g, 21, 6, C.steel);
  // soot stains
  poly(g, [[9, 21], [14, 24], [12, 27], [7, 24]], C.soot);
  poly(g, [[20, 22], [24, 24], [22, 27], [18, 25]], C.stoneDark);
  // drawstring ends
  fx.push([10, 14, C.boneDark], [9, 17, C.boneDark], [22, 14, C.boneDark], [23, 17, C.boneDark], [8, 24, C.ash], [24, 26, C.ash]);
};

RELIC_DRAWERS['first-brand'] = (g, fx) => {
  // handle
  stroke(g, [[5, 28], [15, 18]], 4, C.woodDark);
  stroke(g, [[6, 27], [15, 18]], 2, C.wood);
  stroke(g, [[7, 28], [16, 19]], 1, C.leatherLight);
  rect(g, 3, 27, 5, 4, C.steelDark);
  // iron neck and brand head
  stroke(g, [[15, 19], [19, 15]], 4, C.steelDark);
  poly(g, [[17, 5], [27, 7], [26, 15], [18, 13]], C.steelDark);
  poly(g, [[18, 6], [26, 8], [25, 14], [19, 12]], C.steel);
  hline(g, 19, 25, 8, C.steelMid);
  // glowing rune cut-out
  poly(g, [[22, 7], [25, 9], [22, 13], [20, 10]], C.ember);
  set(g, 22, 9, C.emberLight); set(g, 22, 10, C.goldLight);
  set(g, 22, 11, C.emberDark);
  // heat sparks / smoke
  fx.push([28, 4, C.ember], [29, 2, C.emberLight], [24, 2, C.ember], [26, 1, C.emberDark], [30, 9, C.steelMid]);
  fx.push([8, 22, C.emberDark], [9, 20, C.ash]);
};

RELIC_DRAWERS['heavy-paperweight'] = (g, fx) => {
  // papers
  poly(g, [[4, 25], [28, 23], [29, 27], [5, 29]], C.boneDark);
  poly(g, [[5, 24], [27, 22], [28, 25], [6, 27]], C.bone);
  for (let x = 7; x < 26; x += 4) line(g, x, 24, x, 26, C.boneDark);
  // dome
  poly(g, [[9, 23], [23, 23], [21, 13], [16, 6], [11, 13]], C.stoneDark);
  poly(g, [[9, 23], [16, 23], [16, 7], [11, 13]], C.stone);
  poly(g, [[16, 23], [23, 23], [21, 13], [16, 7]], C.stoneDark);
  poly(g, [[12, 14], [16, 8], [19, 12], [17, 17], [13, 18]], C.stoneLight);
  line(g, 12, 15, 15, 9, C.bright);
  line(g, 20, 14, 18, 18, C.steelDark);
  // brass collar
  rect(g, 8, 21, 17, 3, C.brassDark);
  hline(g, 9, 23, 21, C.brass);
  set(g, 11, 22, C.goldLight); set(g, 20, 22, C.goldDark);
  // knob
  disc(g, 16, 5, 2, C.brassDark);
  set(g, 15, 4, C.goldLight);
  fx.push([24, 8, C.white], [25, 7, C.goldLight]);
};

RELIC_DRAWERS['inspection-stamp'] = (g, fx) => {
  // knob and neck
  disc(g, 16, 5, 3, C.woodDark);
  set(g, 15, 4, C.leatherLight);
  rect(g, 14, 8, 5, 5, C.brassDark);
  vline(g, 15, 8, 12, C.brass);
  // body
  rect(g, 10, 13, 13, 7, C.steelDark);
  hline(g, 10, 22, 13, C.steelMid);
  hline(g, 10, 22, 14, C.brassDark);
  rect(g, 11, 15, 11, 4, C.steel);
  set(g, 12, 16, C.bright);
  // base
  rect(g, 7, 20, 19, 4, C.steelDark);
  hline(g, 8, 23, 20, C.steel);
  hline(g, 8, 23, 22, C.steelMid);
  rect(g, 8, 23, 17, 1, C.bright);
  // paper with ink check
  poly(g, [[3, 25], [29, 25], [28, 30], [5, 30]], C.bone);
  poly(g, [[4, 26], [28, 26], [27, 29], [6, 29]], C.boneLight);
  stroke(g, [[12, 27], [14, 28], [20, 25]], 2, C.blood);
  set(g, 11, 27, C.bloodDark);
  fx.push([9, 27, C.boneDark], [24, 27, C.boneDark]);
};

RELIC_DRAWERS['iron-signet'] = (g, fx) => {
  // band
  ellipseRing(g, 16, 20, 9, 8, 4, C.steelDark);
  ellipseRing(g, 16, 20, 8, 7, 2, C.steel);
  arcPix(g, 16, 20, 7.5, 185, 265, C.bright);
  arcPix(g, 16, 20, 8.5, 20, 100, C.ink);
  // bezel
  poly(g, [[11, 3], [21, 3], [23, 6], [21, 12], [11, 12], [9, 6]], C.steelDark);
  poly(g, [[12, 4], [20, 4], [21, 6], [20, 10], [12, 10], [10, 6]], C.steel);
  hline(g, 12, 20, 4, C.bright);
  // engraved anvil mark
  rect(g, 13, 7, 6, 1, C.ink);
  rect(g, 14, 8, 4, 1, C.ink);
  rect(g, 15, 9, 2, 1, C.ink);
  set(g, 16, 6, C.bright);
  // join
  rect(g, 14, 11, 5, 3, C.steelDark);
  set(g, 14, 11, C.steel);
  fx.push([22, 5, C.bright]);
};

RELIC_DRAWERS['leather-loop'] = (g, fx) => {
  ellipseRing(g, 16, 17, 9, 11, 4, C.leatherDark);
  ellipseRing(g, 16, 17, 8, 10, 2, C.leather);
  arcPix(g, 16, 17, 7.5, 200, 300, C.leatherLight);
  arcPix(g, 16, 17, 8.5, 20, 130, C.woodDark);
  // stitching
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    set(g, Math.round(16 + Math.cos(rad) * 6.6 - 0.5), Math.round(17 + Math.sin(rad) * 8.6 - 0.5), C.bone);
  }
  // buckle at the top
  rect(g, 12, 2, 9, 6, C.brassDark);
  rect(g, 13, 3, 7, 4, C.soot);
  hline(g, 13, 19, 3, C.brass);
  rect(g, 15, 3, 2, 4, C.brass);
  // strap end and rivets
  rect(g, 20, 6, 3, 7, C.leatherDark);
  set(g, 21, 7, C.brassLight); set(g, 21, 10, C.brass);
  fx.push([8, 13, C.bone], [9, 14, C.boneDark], [24, 22, C.bone]);
};

RELIC_DRAWERS['lucky-coal'] = (g, fx) => {
  poly(g, [[9, 15], [12, 7], [20, 6], [26, 12], [25, 21], [19, 26], [11, 24]], C.soot);
  poly(g, [[12, 8], [19, 7], [24, 12], [20, 15], [14, 14]], C.stoneDark);
  poly(g, [[10, 16], [13, 9], [15, 15], [13, 21], [10, 22]], C.stone);
  poly(g, [[20, 15], [25, 13], [24, 20], [19, 24], [16, 21]], C.stoneDark);
  poly(g, [[14, 15], [18, 15], [20, 19], [16, 23], [13, 20]], C.stoneLight);
  hline(g, 11, 14, 9, C.steelMid);
  line(g, 16, 8, 21, 11, C.steelMid);
  // lucky four-point sparkle (post-outline for crispness)
  fx.push([24, 6, C.gold], [24, 5, C.goldLight], [24, 4, C.gold], [24, 7, C.gold], [24, 8, C.gold],
    [22, 6, C.gold], [23, 6, C.gold], [25, 6, C.gold], [26, 6, C.gold], [24, 6, C.goldLight]);
  fx.push([18, 4, C.gold], [18, 3, C.goldLight], [17, 4, C.goldDark]);
  fx.push([12, 25, C.steelMid], [23, 23, C.steelMid]);
};

RELIC_DRAWERS['patched-apron'] = (g, fx) => {
  // straps
  stroke(g, [[11, 2], [10, 9]], 2, C.leatherDark);
  stroke(g, [[21, 2], [22, 9]], 2, C.leatherDark);
  set(g, 10, 3, C.leatherLight);
  // bib
  poly(g, [[10, 7], [22, 7], [23, 15], [9, 15]], C.leather);
  poly(g, [[19, 8], [22, 7], [23, 15], [18, 15]], C.leatherDark);
  hline(g, 10, 21, 8, C.leatherLight);
  // skirt
  poly(g, [[9, 14], [23, 14], [26, 28], [6, 28]], C.leather);
  poly(g, [[18, 15], [23, 14], [26, 28], [18, 28]], C.leatherDark);
  line(g, 10, 16, 8, 27, C.leatherLight);
  // waist ties
  stroke(g, [[8, 15], [3, 18]], 3, C.leatherDark);
  stroke(g, [[24, 15], [29, 19]], 3, C.leatherDark);
  set(g, 4, 18, C.leatherLight);
  // pocket / patch with stitches
  rect(g, 16, 17, 8, 7, C.leatherLight);
  rect(g, 17, 18, 6, 5, C.leather);
  for (let x = 17; x <= 22; x += 2) set(g, x, 17, C.bone);
  for (let y = 18; y <= 22; y += 2) set(g, 16, y, C.bone);
  line(g, 18, 19, 21, 21, C.boneDark);
  line(g, 21, 19, 18, 21, C.boneDark);
  // soot smudges
  poly(g, [[8, 21], [14, 23], [13, 27], [7, 26]], C.soot);
  poly(g, [[20, 24], [24, 25], [23, 27], [19, 27]], C.stoneDark);
  fx.push([5, 24, C.ash]);
};

RELIC_DRAWERS['patient-weight'] = (g, fx) => {
  // chain
  for (let y = 2; y < 10; y += 3) ellipseRing(g, 16, y, 1.5, 2, 1, C.steelDark);
  arcPix(g, 16, 4, 1.5, 0, 360, C.steel);
  // handle
  ring(g, 16, 11, 3, 1.5, C.steelDark);
  set(g, 14, 9, C.steel);
  // weight body
  poly(g, [[16, 12], [21, 15], [22, 22], [16, 28], [10, 22], [11, 15]], C.steelDark);
  poly(g, [[16, 13], [19, 16], [20, 21], [16, 26], [12, 22], [13, 16]], C.steel);
  poly(g, [[13, 16], [16, 14], [16, 25], [12, 21]], C.steelMid);
  line(g, 14, 17, 13, 21, C.bright);
  line(g, 18, 17, 19, 22, C.ink);
  // engraved line
  hline(g, 13, 19, 19, C.stone);
  set(g, 16, 20, C.stoneLight);
  fx.push([9, 12, C.steelMid], [23, 15, C.steelMid]);
};

RELIC_DRAWERS['red-thread'] = (g, fx) => {
  // spool ends
  ellipse(g, 16, 8, 6, 2.5, C.woodDark);
  ellipse(g, 16, 8, 5, 1.6, C.wood);
  ellipse(g, 16, 24, 6, 2.5, C.woodDark);
  ellipse(g, 16, 24, 5, 1.6, C.wood);
  // thread body
  rect(g, 11, 8, 11, 16, C.bloodDark);
  rect(g, 12, 8, 9, 15, C.blood);
  for (let y = 9; y < 23; y += 2) {
    hline(g, 12, 20, y, C.bloodLight);
    hline(g, 12, 20, y + 1, C.bloodDark);
  }
  vline(g, 12, 9, 22, C.pink);
  vline(g, 20, 9, 22, C.bloodDark);
  // top hole
  disc(g, 16, 8, 1.5, C.soot);
  // loose thread and needle (fx keeps them 1px crisp)
  const thread = [[20, 21], [25, 22], [27, 25], [26, 28], [29, 29]];
  for (let i = 0; i + 1 < thread.length; i++) {
    const [x0, y0] = thread[i];
    const [x1, y1] = thread[i + 1];
    for (let t = 0; t <= 1; t += 0.2) fx.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, C.blood]);
  }
  // needle
  for (let i = 0; i < 6; i++) fx.push([23 + i, 29 - Math.round(i * 0.4), C.steel]);
  fx.push([23, 28, C.bright], [28, 26, C.steelDark]);
  fx.push([22, 7, C.bone]);
};

RELIC_DRAWERS['sealing-stone'] = (g, fx) => {
  poly(g, [[10, 3], [21, 2], [24, 22], [20, 28], [9, 27], [7, 21]], C.stoneDark);
  poly(g, [[10, 3], [21, 2], [23, 21], [16, 25], [9, 26], [8, 21]], C.stone);
  poly(g, [[10, 4], [16, 3], [15, 25], [9, 26], [8, 20]], C.stoneLight);
  poly(g, [[20, 3], [21, 2], [23, 21], [18, 24], [17, 18]], C.stoneDark);
  // chipped top
  erase(g, 21, 2); erase(g, 22, 3);
  // carved seal
  disc(g, 16, 14, 6, C.soot);
  ring(g, 16, 14, 6, 5, C.tealDark);
  disc(g, 16, 14, 4, C.arcaneDark);
  ring(g, 16, 14, 4, 3, C.teal);
  line(g, 16, 10, 16, 18, C.teal);
  line(g, 12, 14, 20, 14, C.teal);
  set(g, 14, 12, C.tealMid); set(g, 18, 16, C.tealMid);
  // cracks and rubble
  line(g, 10, 6, 12, 9, C.ink);
  line(g, 21, 17, 22, 21, C.ink);
  poly(g, [[6, 28], [10, 26], [12, 29]], C.stoneDark);
  poly(g, [[20, 28], [25, 27], [24, 30], [19, 30]], C.stone);
  fx.push([12, 12, C.teal], [20, 18, C.tealMid], [16, 22, C.tealDark]);
};

RELIC_DRAWERS['wax-effigy'] = (g, fx) => {
  // head
  disc(g, 16, 8, 4, C.pinkLight);
  disc(g, 18, 9, 3, C.pink);
  set(g, 14, 8, C.ink); set(g, 18, 8, C.ink);
  set(g, 14, 7, C.boneLight);
  hline(g, 15, 17, 10, C.pinkDark);
  // body
  poly(g, [[12, 12], [20, 12], [21, 21], [18, 25], [14, 25], [11, 21]], C.bone);
  poly(g, [[17, 12], [20, 12], [21, 21], [18, 25], [16, 24]], C.pink);
  line(g, 12, 13, 11, 20, C.boneLight);
  // arms and legs
  stroke(g, [[12, 14], [7, 19]], 3, C.bone);
  stroke(g, [[20, 14], [25, 18]], 3, C.pink);
  stroke(g, [[14, 24], [12, 29]], 3, C.bone);
  stroke(g, [[18, 24], [20, 29]], 3, C.pink);
  // wax drips
  rect(g, 9, 19, 2, 4, C.pinkLight);
  rect(g, 22, 21, 2, 3, C.bone);
  disc(g, 12, 29, 1.5, C.pink);
  disc(g, 20, 29, 1.5, C.bone);
  // pin
  stroke(g, [[25, 4], [15, 16]], 2, C.steel);
  disc(g, 26, 3, 2, C.steelDark);
  set(g, 25, 3, C.bright);
  set(g, 15, 15, C.blood);
  fx.push([16, 18, C.bloodDark], [15, 20, C.blood]);
  fx.push([7, 5, C.pinkLight], [25, 9, C.bone]);
};

RELIC_DRAWERS['worn-whetstone'] = (g, fx) => {
  poly(g, [[4, 21], [18, 6], [28, 13], [14, 27]], C.stone);
  poly(g, [[4, 21], [18, 6], [23, 9], [9, 24]], C.stoneLight);
  poly(g, [[18, 6], [28, 13], [23, 17], [13, 10]], C.boneDark);
  // worn groove
  stroke(g, [[8, 20], [14, 12], [22, 13]], 2, C.ashDark);
  stroke(g, [[9, 20], [15, 13], [22, 14]], 1, C.bone);
  stroke(g, [[7, 21], [13, 14]], 1, C.ink);
  // chips
  erase(g, 4, 21); erase(g, 5, 22); erase(g, 27, 13); erase(g, 28, 13);
  // water droplets
  fx.push([25, 18, C.teal], [26, 19, C.tealDark], [10, 8, C.tealMid], [24, 22, C.teal]);
  // small steel shavings
  fx.push([16, 20, C.steel], [17, 21, C.steelDark], [20, 16, C.steel]);
};

RELIC_DRAWERS['blind-die'] = (g, fx) => {
  // top face
  poly(g, [[9, 11], [15, 6], [27, 7], [22, 12]], C.bone);
  // front
  rect(g, 9, 11, 14, 13, C.boneLight);
  rect(g, 10, 12, 12, 11, C.bone);
  // right face
  poly(g, [[22, 12], [27, 7], [27, 19], [22, 23]], C.boneDark);
  // pips
  const pip = (x, y) => { rect(g, x - 1, y - 1, 2, 2, C.ink); rect(g, x, y, 1, 1, C.soot); };
  pip(12, 17); pip(16, 17); pip(20, 17);
  pip(12, 21); pip(20, 21);
  pip(18, 9); pip(23, 9);
  pip(24, 15); pip(24, 19);
  // blindfold
  stroke(g, [[5, 14], [12, 11], [21, 14], [27, 12]], 4, C.soot);
  stroke(g, [[6, 13], [12, 10], [21, 13], [26, 11]], 1, C.stone);
  stroke(g, [[5, 15], [12, 12], [21, 15], [27, 13]], 1, C.leatherDark);
  // knot and tails
  disc(g, 27, 14, 2, C.stoneDark);
  fx.push([29, 16, C.stone], [28, 18, C.stoneDark], [30, 20, C.stoneDark]);
  fx.push([13, 15, C.bone], [18, 15, C.boneDark]);
  set(g, 10, 12, C.white);
};

RELIC_DRAWERS['chained-hourglass'] = (g, fx) => {
  hourglass(g, { top: 4, bottom: 27, frame: C.brass, sand: C.gold });
  // chain across
  chain(g, [[3, 5], [9, 9], [16, 13], [24, 18], [28, 22]], C.steel, C.steelDark);
  // padlock
  padlock(g, 24, 24, { body: C.steelDark, edge: C.steel, metal: C.bright });
  set(g, 24, 25, C.goldLight);
  fx.push([29, 18, C.steelMid], [2, 8, C.steelMid]);
};

RELIC_DRAWERS['closed-third-eye'] = (g, fx) => {
  // lower closed eye, set in a shadowed socket
  poly(g, [[5, 22], [10, 17], [16, 16], [22, 17], [27, 22], [22, 26], [16, 28], [10, 26]], C.stoneDark);
  poly(g, [[7, 22], [11, 18], [16, 17], [21, 18], [25, 22], [21, 25], [16, 27], [11, 25]], C.bone);
  poly(g, [[7, 22], [11, 18], [16, 17], [16, 27], [11, 25]], C.boneLight);
  poly(g, [[16, 17], [21, 18], [25, 22], [21, 25], [16, 27]], C.boneDark);
  // closed lid and lashes
  stroke(g, [[8, 22], [12, 20], [16, 20], [20, 20], [24, 22]], 1, C.bloodDark);
  stroke(g, [[9, 19], [12, 18], [16, 17.5], [20, 18], [23, 19]], 1, C.boneDark);
  line(g, 10, 23, 9, 26, C.ink);
  line(g, 13, 23, 12, 26, C.ink);
  line(g, 19, 23, 20, 26, C.ink);
  line(g, 22, 23, 23, 26, C.ink);
  set(g, 13, 21, C.boneLight);
  // brow above the eye
  stroke(g, [[6, 15], [11, 13], [16, 13], [21, 13], [26, 15]], 2, C.stoneLight);
  set(g, 12, 13, C.boneDark);
  // vertical third eye, closed
  poly(g, [[16, 1], [20, 6], [20, 11], [16, 15], [12, 11], [12, 6]], C.stoneDark);
  poly(g, [[16, 2], [19, 6], [19, 10], [16, 13], [13, 10], [13, 6]], C.bone);
  poly(g, [[16, 2], [19, 6], [19, 10], [16, 13], [16, 8]], C.boneLight);
  poly(g, [[16, 13], [19, 10], [18, 8], [16, 10]], C.boneDark);
  vline(g, 16, 3, 12, C.bloodDark);
  // stitched shut
  line(g, 13, 7, 19, 7, C.arcaneDark);
  line(g, 13, 9, 19, 9, C.arcaneDark);
  line(g, 14, 11, 18, 11, C.arcaneDark);
  set(g, 14, 7, C.arcane); set(g, 18, 9, C.arcane); set(g, 16, 11, C.arcaneLight);
  // arcane marks
  set(g, 8, 8, C.arcane); set(g, 24, 8, C.arcane);
  set(g, 6, 11, C.arcaneDark); set(g, 26, 12, C.arcaneDark);
  fx.push([10, 4, C.arcane], [22, 3, C.arcaneLight], [3, 20, C.arcaneDark], [29, 18, C.arcaneDark]);
};

RELIC_DRAWERS['cold-teacup'] = (g, fx) => {
  // saucer
  ellipse(g, 16, 27, 11, 2.5, C.boneDark);
  ellipse(g, 16, 27, 9, 1.6, C.bone);
  hline(g, 8, 23, 27, C.boneLight);
  // cup
  poly(g, [[9, 15], [23, 15], [21, 25], [11, 25]], C.bone);
  poly(g, [[18, 15], [23, 15], [21, 25], [17, 25]], C.boneDark);
  // rim and cold tea
  ellipse(g, 16, 15, 7.5, 2, C.boneLight);
  ellipse(g, 16, 15, 6, 1.2, C.tealDark);
  hline(g, 11, 20, 14, C.teal);
  // ice cubes
  rect(g, 12, 13, 3, 3, C.teal);
  rect(g, 18, 12, 2, 2, C.tealMid);
  set(g, 13, 13, C.white); set(g, 18, 12, C.white);
  // handle
  ellipseRing(g, 24, 19, 4, 3, 1.5, C.boneDark);
  arcPix(g, 24, 19, 3.5, 250, 100, C.boneLight);
  // frost
  fx.push([10, 18, C.teal], [9, 20, C.tealMid], [23, 22, C.teal], [20, 25, C.tealMid], [14, 16, C.teal]);
  fx.push([6, 16, C.tealMid], [7, 14, C.teal]);
  // no steam, just cold flecks
  fx.push([16, 9, C.tealMid], [17, 8, C.tealDark], [15, 7, C.teal]);
};

RELIC_DRAWERS['cracked-wristwatch'] = (g, fx) => {
  // strap
  rect(g, 12, 1, 7, 8, C.leatherDark);
  rect(g, 13, 1, 5, 7, C.leather);
  for (let y = 2; y < 7; y += 2) hline(g, 13, 17, y, C.boneDark);
  rect(g, 12, 23, 7, 7, C.leatherDark);
  rect(g, 13, 24, 5, 6, C.leather);
  for (let y = 25; y < 30; y += 2) hline(g, 13, 17, y, C.boneDark);
  // case
  disc(g, 16, 16, 9, C.brassDark);
  disc(g, 16, 16, 8, C.brass);
  ring(g, 16, 16, 8, 7, C.goldLight);
  disc(g, 16, 16, 6, C.bone);
  // ticks
  for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) set(g, 16 + dx, 16 + dy, C.steelDark);
  // hands
  line(g, 16, 16, 16, 12, C.ink);
  line(g, 16, 16, 19, 18, C.ink);
  set(g, 16, 16, C.blood);
  // crown
  rect(g, 25, 15, 3, 3, C.brass);
  hline(g, 25, 27, 15, C.goldLight);
  // crack
  line(g, 11, 11, 14, 15, C.ink);
  line(g, 14, 15, 12, 19, C.ink);
  line(g, 12, 19, 16, 22, C.ink);
  set(g, 13, 11, C.white); set(g, 13, 16, C.white); set(g, 15, 22, C.white);
  fx.push([20, 12, C.bright], [10, 18, C.brassDark]);
};

RELIC_DRAWERS['double-knot'] = (g, fx) => {
  const left = [[9, 9], [5, 14], [7, 20], [12, 22], [16, 18], [14, 12], [9, 9]];
  const right = [[23, 9], [27, 14], [25, 20], [20, 22], [16, 18], [18, 12], [23, 9]];
  stroke(g, left, 4, C.bloodDark);
  stroke(g, right, 4, C.bloodDark);
  stroke(g, left, 2, C.blood);
  stroke(g, right, 2, C.blood);
  // highlights
  stroke(g, [[9, 8], [6, 13], [9, 19], [13, 20]], 1, C.pink);
  stroke(g, [[23, 8], [26, 13], [23, 19], [19, 20]], 1, C.pink);
  // central knot
  rect(g, 14, 15, 5, 5, C.bloodDark);
  rect(g, 15, 16, 3, 3, C.blood);
  line(g, 15, 16, 17, 18, C.pink);
  // ends
  stroke(g, [[9, 9], [7, 5]], 3, C.bloodDark);
  stroke(g, [[23, 9], [25, 5]], 3, C.bloodDark);
  fx.push([6, 4, C.pink], [26, 4, C.pink], [15, 21, C.pinkDark], [17, 21, C.bloodLight]);
};

RELIC_DRAWERS['hungry-molar'] = (g, fx) => {
  // crown
  poly(g, [[10, 8], [14, 5], [19, 5], [23, 9], [22, 16], [19, 19], [13, 19], [10, 16]], C.bone);
  poly(g, [[10, 8], [14, 5], [16, 5], [15, 19], [13, 19], [10, 16]], C.boneLight);
  poly(g, [[18, 5], [19, 5], [23, 9], [22, 16], [19, 19], [18, 15]], C.boneDark);
  // roots
  poly(g, [[12, 18], [15, 18], [15, 25], [12, 28], [11, 24]], C.bone);
  poly(g, [[17, 18], [20, 18], [21, 24], [19, 28], [17, 25]], C.bone);
  poly(g, [[17, 18], [20, 18], [20, 23], [18, 26]], C.boneDark);
  set(g, 13, 21, C.ink); set(g, 18, 22, C.ink);
  // hungry chomp out of the crown
  poly(g, [[19, 7], [23, 9], [22, 14], [19, 13]], C.ink);
  poly(g, [[20, 9], [22, 10], [21, 12], [19, 11]], C.bloodDark);
  set(g, 20, 10, C.pink);
  // jagged teeth around bite
  set(g, 19, 7, C.boneLight); set(g, 22, 9, C.bone); set(g, 22, 13, C.bone);
  // drool
  fx.push([23, 15, C.teal], [23, 16, C.tealMid], [22, 17, C.tealDark]);
  // crumbs
  fx.push([25, 19, C.bone], [26, 21, C.boneDark], [8, 22, C.boneDark]);
  fx.push([14, 9, C.white]);
};

RELIC_DRAWERS['iron-comb'] = (g, fx) => {
  // spine
  rect(g, 5, 7, 22, 6, C.steelDark);
  rect(g, 6, 8, 20, 3, C.steel);
  hline(g, 6, 25, 7, C.bright);
  hline(g, 6, 25, 12, C.steelMid);
  // rivets
  for (const x of [7, 16, 24]) {
    disc(g, x, 10, 1.5, C.brass);
    set(g, x - 1, 9, C.goldLight);
  }
  // teeth
  const lens = [14, 16, 15, 18, 16, 14, 17];
  for (let i = 0; i < 7; i++) {
    const x = 6 + i * 3;
    const len = lens[i];
    rect(g, x, 13, 2, len, C.steelDark);
    vline(g, x, 14, 12 + len, C.steel);
    set(g, x, 13, C.steelMid);
    set(g, x + 1, 13 + len, C.ink);
  }
  // one bent tooth
  rect(g, 26, 13, 2, 9, C.steelDark);
  set(g, 27, 22, C.steel);
  set(g, 26, 22, C.steelMid);
  fx.push([8, 6, C.bright], [21, 6, C.bright]);
};

RELIC_DRAWERS['iron-hoop'] = (g, fx) => {
  // barrel staves behind
  rect(g, 10, 7, 5, 20, C.woodDark);
  rect(g, 17, 6, 5, 21, C.wood);
  rect(g, 12, 7, 1, 19, C.woodLight);
  rect(g, 18, 7, 1, 19, C.leatherLight);
  // hoop
  ellipseRing(g, 16, 17, 11, 10, 4, C.steelDark);
  ellipseRing(g, 16, 17, 10, 9, 2, C.steel);
  arcPix(g, 16, 17, 9.2, 190, 280, C.bright);
  arcPix(g, 16, 17, 8.8, 20, 110, C.ink);
  // rivets
  for (const a of [200, 240, 300, 340, 20, 60, 120, 160]) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(16 + Math.cos(rad) * 9.5);
    const y = Math.round(17 + Math.sin(rad) * 8.5);
    set(g, x, y, C.brass);
    set(g, x, y - 1, C.goldLight);
  }
  fx.push([5, 16, C.steelMid], [27, 19, C.steelMid]);
};

RELIC_DRAWERS['little-wind-bell'] = (g, fx) => {
  // hanging cord
  vline(g, 16, 1, 4, C.woodDark);
  ring(g, 16, 6, 2, 1, C.brassDark);
  // bell
  poly(g, [[14, 8], [18, 8], [19, 11], [20, 15], [24, 20], [8, 20], [12, 15], [13, 11]], C.brass);
  rect(g, 7, 19, 18, 3, C.brassDark);
  hline(g, 8, 23, 19, C.brassLight);
  line(g, 13, 9, 11, 18, C.brassLight);
  line(g, 18, 9, 21, 18, C.brassDark);
  line(g, 15, 9, 14, 18, C.goldLight);
  // clapper
  vline(g, 16, 21, 23, C.steelDark);
  disc(g, 16, 24, 2, C.steelDark);
  set(g, 15, 23, C.steel);
  // wind curls (thin, post-outline)
  const curls = [
    [[28, 8], [30, 9], [30, 11], [28, 12]],
    [[2, 14], [4, 15], [4, 17], [2, 18]],
    [[26, 22], [28, 23], [29, 25]],
  ];
  for (const curl of curls) {
    for (let i = 0; i + 1 < curl.length; i++) {
      const [x0, y0] = curl[i], [x1, y1] = curl[i + 1];
      for (let t = 0; t <= 1; t += 0.25) fx.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, C.teal]);
    }
  }
  fx.push([24, 6, C.tealMid], [3, 8, C.tealMid], [28, 16, C.tealDark]);
};

RELIC_DRAWERS['thorn-weight'] = (g, fx) => {
  // chain
  for (let y = 1; y < 7; y += 3) ellipseRing(g, 16, y, 1.5, 2, 1, C.steelDark);
  ring(g, 16, 7, 2.5, 1, C.steelDark);
  // weight
  poly(g, [[16, 7], [22, 11], [23, 19], [19, 26], [13, 26], [9, 19], [10, 11]], C.steelDark);
  poly(g, [[16, 8], [20, 12], [21, 18], [17, 24], [13, 24], [11, 18], [12, 12]], C.steel);
  poly(g, [[12, 13], [16, 9], [16, 23], [13, 23], [11, 18]], C.steelMid);
  line(g, 13, 14, 12, 19, C.bright);
  hline(g, 13, 19, 20, C.stone);
  // thorn vine
  stroke(g, [[9, 15], [12, 12], [17, 13], [21, 17], [20, 22], [15, 24]], 2, C.woodDark);
  for (const [x, y, dx, dy] of [[10, 12, -2, -3], [17, 12, 2, -3], [22, 18, 3, 1], [20, 23, 2, 2], [14, 24, -2, 2], [11, 18, -3, 0]]) {
    poly(g, [[x, y], [x + dx, y + dy], [x + 1, y + 1]], C.boneDark);
    set(g, x + dx, y + dy, C.bone);
  }
  // blood on one thorn
  set(g, 24, 19, C.blood);
  fx.push([24, 20, C.bloodDark], [10, 9, C.steelMid]);
};

// -------------------------------------------------------------------- rares
RELIC_DRAWERS['undertakers-chalice'] = (g, fx) => {
  goblet(g, {
    top: 5, bowlH: 11, bowlW: 8,
    metal: C.steelDark, light: C.steel, dark: C.ink,
    stem: C.steelDark, foot: C.steel,
  });
  // skull motif on the bowl
  skullAt(g, 16, 10, 0.72, { bone: C.bone, dark: C.boneDark, glow: C.rare });
  // engraved ribs on the bowl
  line(g, 9, 8, 11, 14, C.steelMid);
  line(g, 23, 8, 21, 14, C.steelMid);
  // rare gem at the knop
  disc(g, 16, 21, 1.5, C.rareDark);
  set(g, 15, 20, C.rareLight);
  set(g, 16, 22, C.rare);
  // base engravings
  hline(g, 11, 21, 26, C.boneDark);
  set(g, 9, 27, C.rare);
  fx.push([24, 6, C.rareLight], [7, 16, C.rareDark], [26, 20, C.rare]);
};

RELIC_DRAWERS['broken-holy-sword'] = (g, fx) => {
  // radiant rays (post-outline, thin)
  const rays = [[-170, 13], [-145, 14], [-115, 15], [-55, 15], [-25, 14], [10, 13], [155, 13], [125, 14]];
  for (const [a, len] of rays) {
    const rad = (a * Math.PI) / 180;
    const cx = 16, cy = 16;
    for (let r = 10; r <= len; r++) fx.push([Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), r > len - 2 ? C.goldLight : C.goldDark]);
  }
  // upper snapped fragment
  poly(g, [[18, 2], [20, 6], [20, 11], [19, 13], [18, 11], [17, 13], [16, 11], [16, 6]], C.bright);
  poly(g, [[18, 2], [20, 6], [20, 11], [19, 13], [18, 11], [18, 7]], C.steel);
  line(g, 18, 3, 18, 11, C.white);
  set(g, 19, 7, C.rareLight);
  // lower blade with jagged break
  poly(g, [[13, 23], [13, 19], [15, 16], [17, 18], [19, 16], [19, 23]], C.steel);
  poly(g, [[13, 23], [13, 19], [15, 16], [17, 18], [17, 23]], C.bright);
  line(g, 16, 17, 16, 22, C.white);
  set(g, 14, 20, C.steelDark); set(g, 18, 21, C.steelDark);
  // hilt
  rect(g, 9, 23, 15, 3, C.goldDark);
  hline(g, 9, 23, 23, C.gold);
  set(g, 10, 24, C.goldLight); set(g, 22, 24, C.goldLight);
  disc(g, 16, 24, 1.6, C.rare);
  box(g, 14, 26, 5, 4, C.leather, C.ink);
  rect(g, 15, 27, 3, 1, C.goldDark);
  disc(g, 16, 30, 2.5, C.gold);
  set(g, 15, 29, C.goldLight);
  // floating shard
  poly(g, [[11, 15], [13, 13], [14, 16], [12, 17]], C.bright);
  set(g, 12, 15, C.rare);
  fx.push([15, 14, C.gold], [20, 15, C.goldDark], [8, 12, C.rareLight]);
};

RELIC_DRAWERS['cracked-crown'] = (g, fx) => {
  crown(g, 16, 25, 22, 11, {
    col: C.gold, light: C.goldLight, dark: C.goldDark,
    jewel: C.blood, jewel2: C.rare,
  });
  // jagged crack from apex through band
  const crack = [[16, 14], [15, 17], [18, 19], [17, 22], [19, 24], [18, 27]];
  for (let i = 0; i + 1 < crack.length; i++) line(g, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], C.ink);
  set(g, 17, 15, C.goldLight); set(g, 16, 18, C.goldLight); set(g, 18, 21, C.goldLight);
  // chipped rim
  erase(g, 25, 21); erase(g, 25, 22); erase(g, 26, 22);
  set(g, 24, 21, C.goldLight);
  // fallen chip
  poly(g, [[25, 27], [28, 26], [27, 29]], C.gold);
  set(g, 26, 27, C.goldLight);
  fx.push([26, 5, C.goldLight], [6, 22, C.gold], [14, 12, C.rareLight]);
};

RELIC_DRAWERS['cracked-splice'] = (g, fx) => {
  // iron splice plate
  poly(g, [[4, 10], [27, 9], [28, 21], [5, 23]], C.steelDark);
  poly(g, [[5, 11], [26, 10], [27, 20], [6, 22]], C.steel);
  poly(g, [[6, 12], [15, 11], [14, 20], [7, 20]], C.steelMid);
  // bevels
  hline(g, 6, 26, 11, C.bright);
  hline(g, 6, 27, 21, C.steelDark);
  // rivets
  for (const [x, y] of [[8, 14], [8, 19], [24, 13], [24, 18], [13, 12], [20, 20]]) {
    disc(g, x, y, 1.5, C.brassDark);
    set(g, x - 1, y - 1, C.goldLight);
  }
  // jagged crack with rare glow
  const crack = [[17, 10], [15, 13], [18, 15], [16, 18], [18, 20], [17, 22]];
  for (let i = 0; i + 1 < crack.length; i++) line(g, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], C.ink);
  set(g, 16, 12, C.rare); set(g, 17, 14, C.rareDark); set(g, 17, 17, C.rareLight); set(g, 17, 19, C.rare);
  // chipped corner
  erase(g, 27, 20); erase(g, 28, 19);
  fx.push([5, 9, C.rareDark], [22, 23, C.steelMid]);
};

RELIC_DRAWERS['golden-nail'] = (g, fx) => {
  // broad flat head
  poly(g, [[10, 3], [21, 2], [22, 6], [11, 7]], C.goldDark);
  poly(g, [[11, 4], [21, 3], [21, 6], [11, 6]], C.gold);
  hline(g, 12, 20, 3, C.goldLight);
  // shaft
  rect(g, 14, 6, 4, 20, C.goldDark);
  rect(g, 14, 6, 3, 19, C.gold);
  vline(g, 14, 7, 23, C.goldLight);
  vline(g, 17, 8, 24, C.goldDark);
  // engraved rings
  hline(g, 14, 17, 11, C.goldDark);
  hline(g, 14, 17, 18, C.goldDark);
  // point
  poly(g, [[13, 24], [19, 24], [16, 29]], C.gold);
  line(g, 16, 25, 16, 28, C.goldLight);
  set(g, 15, 26, C.goldDark);
  // sparkles
  fx.push([24, 8, C.gold], [25, 8, C.goldLight], [24, 7, C.gold], [24, 9, C.gold], [23, 8, C.gold]);
  fx.push([8, 16, C.goldDark], [26, 21, C.goldLight]);
};

RELIC_DRAWERS['grudge-nail'] = (g, fx) => {
  heartShape(g, 16, 19, 0.9, { col: C.bloodDark, light: C.blood, dark: C.ink });
  // nail head
  poly(g, [[9, 3], [21, 2], [22, 6], [10, 7]], C.steelDark);
  hline(g, 11, 20, 4, C.steel);
  // shaft through heart
  rect(g, 14, 6, 4, 18, C.steelDark);
  rect(g, 14, 6, 2, 17, C.steelMid);
  vline(g, 14, 7, 21, C.steel);
  // point
  poly(g, [[13, 23], [19, 23], [16, 28]], C.steelMid);
  set(g, 16, 25, C.bright);
  // wound
  poly(g, [[13, 17], [19, 17], [18, 22], [14, 22]], C.ink);
  set(g, 15, 18, C.blood); set(g, 17, 20, C.blood);
  // rust & blood drips
  fx.push([12, 9, C.bloodDark], [20, 13, C.bloodDark], [18, 26, C.blood], [17, 27, C.bloodDark]);
  fx.push([9, 22, C.blood], [22, 24, C.bloodDark]);
};

RELIC_DRAWERS['mourning-knot'] = (g, fx) => {
  // bow loops
  poly(g, [[13, 10], [6, 6], [3, 12], [7, 17], [14, 14]], C.stoneDark);
  poly(g, [[13, 10], [7, 8], [5, 12], [9, 15]], C.stone);
  poly(g, [[19, 10], [26, 6], [29, 12], [25, 17], [18, 14]], C.stoneDark);
  poly(g, [[19, 10], [25, 8], [27, 12], [23, 15]], C.stone);
  line(g, 6, 8, 9, 15, C.steel);
  line(g, 26, 8, 23, 15, C.steel);
  // trailing ribbons
  poly(g, [[13, 14], [9, 20], [7, 29], [11, 27], [14, 18]], C.stoneDark);
  poly(g, [[19, 14], [23, 20], [25, 29], [21, 27], [18, 18]], C.stoneDark);
  line(g, 9, 21, 8, 28, C.steelDark);
  line(g, 23, 21, 24, 28, C.steelDark);
  // knot
  poly(g, [[14, 10], [18, 10], [19, 14], [16, 16], [13, 14]], C.steelDark);
  set(g, 15, 11, C.steel);
  // bone lily at the knot
  for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) disc(g, 16 + dx, 13 + dy, 1.4, C.bone);
  disc(g, 16, 13, 1.2, C.gold);
  set(g, 15, 12, C.boneLight);
  fx.push([7, 22, C.teal], [8, 24, C.tealDark], [24, 24, C.tealMid]);
};

RELIC_DRAWERS['scorched-charm'] = (g, fx) => {
  // cord
  stroke(g, [[4, 1], [10, 5], [16, 6], [22, 5], [28, 1]], 2, C.leatherDark);
  ring(g, 16, 6, 2, 1, C.brassDark);
  // disc amulet
  disc(g, 16, 17, 8, C.boneDark);
  disc(g, 16, 17, 7, C.bone);
  ring(g, 16, 17, 7, 6, C.steelDark);
  // charring
  poly(g, [[18, 10], [23, 14], [23, 21], [18, 24], [16, 20]], C.soot);
  poly(g, [[9, 15], [13, 11], [14, 16], [11, 22], [9, 20]], C.stoneDark);
  // ember cracks
  const cracks = [[[9, 16], [13, 18], [12, 22]], [[20, 12], [19, 16], [22, 19]]];
  for (const c of cracks) {
    for (let i = 0; i + 1 < c.length; i++) line(g, c[i][0], c[i][1], c[i + 1][0], c[i + 1][1], C.emberDark);
  }
  // rune
  vline(g, 16, 13, 20, C.steelDark);
  line(g, 14, 15, 16, 13, C.steelDark);
  line(g, 18, 15, 16, 13, C.steelDark);
  set(g, 16, 13, C.ember); set(g, 13, 20, C.ember); set(g, 21, 19, C.ember);
  // hanging bead
  set(g, 16, 27, C.brass);
  // soot flecks
  fx.push([11, 11, C.emberLight], [22, 23, C.ember], [8, 21, C.soot], [24, 10, C.ash]);
};

RELIC_DRAWERS['sealed-heart'] = (g, fx) => {
  heartShape(g, 16, 15, 1.2, { col: C.blood, light: C.bloodLight, dark: C.bloodDark });
  // veins
  line(g, 10, 9, 12, 14, C.ink);
  line(g, 12, 14, 10, 19, C.ink);
  line(g, 22, 9, 20, 15, C.ink);
  line(g, 20, 15, 22, 20, C.ink);
  // small chains draped at the sides
  chainLink(g, 5, 16, 2, 2.5, C.steel, C.steelDark);
  chainLink(g, 27, 16, 2, 2.5, C.steel, C.steelDark);
  // padlock sealing the heart
  padlock(g, 16, 19, { body: C.steelDark, edge: C.steel, metal: C.bright });
  set(g, 16, 22, C.rare);
  set(g, 15, 21, C.rareLight);
  // chain from the lock to the heart edge
  stroke(g, [[12, 21], [8, 19]], 2, C.steelDark);
  stroke(g, [[20, 21], [24, 19]], 2, C.steelDark);
  set(g, 9, 19, C.bright); set(g, 23, 19, C.bright);
  fx.push([9, 8, C.bloodLight], [23, 7, C.blood], [27, 24, C.rareLight]);
};

RELIC_DRAWERS['third-hand'] = (g, fx) => {
  // cuff
  rect(g, 9, 24, 15, 5, C.steelDark);
  rect(g, 10, 25, 13, 3, C.steel);
  for (const x of [11, 16, 21]) set(g, x, 26, C.brass);
  // palm
  poly(g, [[11, 15], [21, 15], [21, 25], [11, 25]], C.steel);
  poly(g, [[11, 15], [16, 15], [16, 25], [11, 25]], C.steelMid);
  // three fingers
  for (const [x, y] of [[11, 8], [15, 6], [19, 8]]) {
    rect(g, x, y, 3, 16 - y, C.steel);
    vline(g, x, y + 1, 15, C.bright);
    vline(g, x + 2, y + 2, 15, C.steelDark);
    disc(g, x + 1, y, 1.5, C.steelMid);
    set(g, x, y + 2, C.steelDark);
  }
  // thumb
  poly(g, [[21, 18], [25, 17], [26, 20], [22, 22]], C.steel);
  line(g, 22, 18, 25, 18, C.bright);
  set(g, 21, 19, C.steelDark);
  // arcane palm rune
  const gem = [[16, 19], [18, 21], [16, 23], [14, 21]];
  for (let i = 0; i < gem.length; i++) line(g, gem[i][0], gem[i][1], gem[(i + 1) % 4][0], gem[(i + 1) % 4][1], C.arcaneDark);
  disc(g, 16, 21, 1.4, C.rare);
  set(g, 15, 20, C.rareLight);
  // knuckle studs
  for (const x of [12, 16, 20]) set(g, x, 16, C.steelDark);
  fx.push([9, 12, C.arcane], [23, 10, C.arcaneLight], [8, 20, C.rareDark]);
};

RELIC_DRAWERS['worn-voucher'] = (g, fx) => {
  // ticket with torn / notched edges
  poly(g, [[4, 9], [28, 9], [28, 22], [4, 22]], C.boneDark);
  poly(g, [[5, 10], [27, 10], [27, 21], [5, 21]], C.bone);
  // notches
  erase(g, 4, 15); erase(g, 5, 15); erase(g, 4, 16);
  erase(g, 28, 15); erase(g, 27, 15); erase(g, 28, 16);
  // torn corner
  erase(g, 27, 9); erase(g, 26, 9); erase(g, 27, 10);
  set(g, 26, 10, C.boneDark);
  // perforation
  for (let y = 11; y < 21; y += 2) set(g, 21, y, C.stoneDark);
  line(g, 21, 10, 21, 20, C.boneDark);
  // red stamp
  ring(g, 11, 16, 4.5, 3.5, C.bloodDark);
  ring(g, 11, 16, 3.5, 2.5, C.blood);
  set(g, 11, 15, C.bloodDark); set(g, 11, 17, C.bloodDark);
  set(g, 10, 16, C.bloodDark); set(g, 12, 16, C.bloodDark);
  // fold crease / wear
  line(g, 6, 20, 19, 11, C.boneDark);
  set(g, 8, 12, C.boneLight);
  // rare blue trim
  hline(g, 6, 25, 10, C.rareDark);
  set(g, 7, 10, C.rare);
  // coin
  coin(g, 26, 25, 3.5, { face: C.gold, edge: C.goldDark });
  // tear in paper
  poly(g, [[15, 21], [17, 19], [18, 22]], C.boneDark);
  fx.push([12, 24, C.boneDark], [20, 12, C.rare], [29, 12, C.bone]);
};

RELIC_DRAWERS['collectors-hook'] = (g, fx) => {
  // handle
  stroke(g, [[4, 28], [10, 21], [14, 17]], 4, C.woodDark);
  stroke(g, [[5, 27], [10, 20], [14, 17]], 2, C.wood);
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 2, y = 27 - i * 2;
    line(g, x - 1, y, x + 1, y - 1, C.leatherLight);
  }
  // hook shank and curl
  const hook = [[14, 17], [18, 18], [20, 22], [20, 26], [17, 29], [13, 28], [11, 25], [13, 22], [17, 20], [21, 20]];
  stroke(g, hook, 4, C.steelDark);
  stroke(g, hook, 2, C.steel);
  stroke(g, [[14, 16], [18, 17], [19, 21], [19, 25], [17, 27]], 1, C.bright);
  // barb
  poly(g, [[21, 20], [24, 18], [23, 22]], C.steel);
  set(g, 22, 20, C.bright);
  // coin on a ring at the tip
  ring(g, 22, 22, 2, 1, C.brassDark);
  coin(g, 23, 26, 3, { face: C.gold, edge: C.goldDark, mark: true });
  fx.push([16, 13, C.rareLight], [9, 24, C.steelMid], [6, 30, C.steelDark]);
};

RELIC_DRAWERS['cracked-bell'] = (g, fx) => {
  bellBody(g, { top: 5, base: 23, col: C.brass, light: C.brassLight, dark: C.brassDark });
  // jagged crack from lip upward
  const crack = [[20, 23], [18, 20], [21, 17], [19, 14], [21, 11], [20, 8]];
  for (let i = 0; i + 1 < crack.length; i++) line(g, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], C.ink);
  set(g, 19, 21, C.goldLight); set(g, 20, 18, C.goldLight); set(g, 20, 15, C.goldLight); set(g, 19, 12, C.goldLight);
  // chipped lip
  erase(g, 22, 21); erase(g, 23, 22); erase(g, 22, 22);
  set(g, 21, 20, C.goldDark);
  // rare glow deep in the crack
  set(g, 19, 16, C.rare);
  // chips on floor
  poly(g, [[5, 27], [8, 26], [8, 29]], C.brassDark);
  poly(g, [[25, 28], [28, 27], [27, 30]], C.brass);
  set(g, 26, 27, C.goldLight);
  fx.push([23, 15, C.emberDark], [10, 10, C.gold]);
};

RELIC_DRAWERS['defeated-kings-seal'] = (g, fx) => {
  // jade seal block (3/4 view)
  poly(g, [[10, 16], [25, 16], [28, 19], [28, 27], [13, 27], [10, 24]], C.stoneDark);
  poly(g, [[10, 16], [25, 16], [22, 19], [7, 19]], C.stoneLight);
  rect(g, 8, 19, 16, 8, C.stone);
  poly(g, [[25, 16], [28, 19], [28, 27], [24, 24]], C.soot);
  // jade sheen
  hline(g, 9, 23, 19, C.tealDark);
  line(g, 9, 22, 9, 25, C.tealMid);
  set(g, 12, 22, C.teal); set(g, 23, 23, C.tealDark);
  // carved crown on the face
  const cy = 23;
  poly(g, [[10, cy + 3], [10, cy], [12, cy + 1], [14, cy - 1], [16, cy], [18, cy - 1], [20, cy + 1], [22, cy], [22, cy + 3]], C.stoneDark);
  set(g, 12, cy + 1, C.teal); set(g, 16, cy, C.teal); set(g, 20, cy + 1, C.teal);
  hline(g, 11, 21, cy + 4, C.tealDark);
  // rectangular knob handle with an opening
  rect(g, 12, 6, 9, 11, C.stoneDark);
  rect(g, 13, 7, 7, 9, C.stone);
  rect(g, 15, 9, 3, 5, C.soot);
  hline(g, 13, 19, 7, C.stoneLight);
  set(g, 14, 8, C.tealMid);
  // neck joining knob and block
  rect(g, 14, 14, 5, 3, C.stoneDark);
  // crack and missing corner
  line(g, 24, 16, 22, 20, C.ink);
  line(g, 22, 20, 24, 23, C.ink);
  erase(g, 27, 26); erase(g, 26, 27);
  // red seal ink smudge on the base
  rect(g, 10, 26, 4, 2, C.bloodDark);
  set(g, 11, 26, C.blood);
  fx.push([8, 27, C.teal], [24, 13, C.tealMid], [21, 27, C.tealDark], [26, 18, C.rareDark]);
};

RELIC_DRAWERS['ember-locket'] = (g, fx) => {
  // chain
  for (let y = 1; y < 8; y += 3) ellipseRing(g, 16, y, 1.5, 2, 1, C.steelDark);
  arcPix(g, 16, 4, 1.5, 0, 360, C.brass);
  // locket
  ellipse(g, 16, 18, 8, 9, C.goldDark);
  ellipse(g, 16, 18, 7, 8, C.gold);
  ellipse(g, 16, 18, 5, 6, C.soot);
  ring(g, 16, 18, 5, 4, C.goldLight);
  // ember inside
  poly(g, [[16, 12], [19, 16], [19, 20], [16, 24], [13, 20], [13, 16]], C.emberDark);
  poly(g, [[16, 14], [18, 17], [18, 20], [16, 22], [14, 20], [14, 17]], C.ember);
  poly(g, [[16, 16], [17, 18], [16, 21], [15, 18]], C.goldLight);
  // filigree
  line(g, 16, 6, 16, 10, C.brassDark);
  line(g, 11, 13, 14, 15, C.brassDark);
  line(g, 21, 13, 18, 15, C.brassDark);
  // clasp gem
  disc(g, 16, 8, 1.4, C.rare);
  set(g, 15, 7, C.rareLight);
  // hinge / bail
  ring(g, 16, 2, 1.5, 0.5, C.brassDark);
  fx.push([23, 11, C.goldLight], [9, 23, C.goldDark], [16, 26, C.emberLight]);
};

RELIC_DRAWERS['interlocking-weights'] = (g, fx) => {
  // left weight
  ellipseRing(g, 10, 13, 4, 4, 2, C.steelDark);
  poly(g, [[6, 17], [14, 17], [16, 26], [4, 26]], C.steelDark);
  poly(g, [[7, 17], [13, 17], [14, 24], [6, 24]], C.steel);
  hline(g, 7, 12, 18, C.bright);
  // right weight (in front)
  ellipseRing(g, 22, 13, 4, 4, 2, C.steelDark);
  poly(g, [[18, 17], [26, 17], [28, 27], [16, 27]], C.steelDark);
  poly(g, [[19, 17], [25, 17], [26, 25], [18, 25]], C.steel);
  hline(g, 19, 24, 18, C.bright);
  // linked handles
  stroke(g, [[13, 14], [19, 14]], 2, C.steelMid);
  set(g, 16, 13, C.steelDark);
  // stamped dots
  disc(g, 10, 21, 1.3, C.steelDark);
  disc(g, 22, 22, 1.3, C.rareDark);
  set(g, 21, 21, C.rare);
  // wear
  line(g, 8, 22, 10, 24, C.ink);
  line(g, 20, 20, 24, 20, C.ink);
  fx.push([5, 25, C.steelMid], [27, 17, C.steelMid], [23, 12, C.bright]);
};

RELIC_DRAWERS['journeyman-badge'] = (g, fx) => {
  // shield
  poly(g, [[8, 4], [24, 4], [24, 18], [16, 27], [8, 18]], C.goldDark);
  poly(g, [[9, 5], [23, 5], [23, 17], [16, 25], [9, 17]], C.gold);
  poly(g, [[11, 7], [21, 7], [21, 16], [16, 22], [11, 16]], C.arcaneDark);
  poly(g, [[12, 8], [16, 8], [16, 21], [12, 16]], C.arcane);
  // hammer emblem
  rect(g, 11, 9, 10, 3, C.steel);
  hline(g, 11, 20, 9, C.bright);
  rect(g, 15, 12, 2, 7, C.leatherDark);
  // chevron
  line(g, 12, 18, 16, 20, C.goldLight);
  line(g, 16, 20, 20, 18, C.goldLight);
  // ribbon tails
  poly(g, [[12, 24], [16, 27], [16, 31], [11, 29]], C.bloodDark);
  poly(g, [[20, 24], [16, 27], [16, 31], [21, 29]], C.blood);
  hline(g, 12, 15, 28, C.goldDark);
  // rivets
  for (const [x, y] of [[10, 6], [22, 6], [10, 16], [22, 16]]) set(g, x, y, C.goldLight);
  fx.push([25, 10, C.goldLight], [7, 20, C.rareDark]);
};

RELIC_DRAWERS['lightning-mark'] = (g, fx) => {
  // iron brand ring
  disc(g, 16, 15, 10, C.steelDark);
  disc(g, 16, 15, 8, C.soot);
  ring(g, 16, 15, 10, 8, C.steel);
  arcPix(g, 16, 15, 9, 190, 280, C.bright);
  ring(g, 16, 15, 7, 6, C.steelDark);
  // bolt
  poly(g, [[18, 6], [11, 15], [15, 15], [12, 26], [21, 14], [17, 14], [22, 7]], C.rareDark);
  poly(g, [[17, 7], [12, 14], [16, 14], [14, 24], [20, 14], [16, 14], [20, 8]], C.rare);
  line(g, 15, 12, 15, 17, C.rareLight);
  set(g, 18, 8, C.white);
  // scorch cracks
  line(g, 8, 9, 11, 11, C.steelDark);
  line(g, 24, 21, 22, 19, C.steelDark);
  // sparks
  fx.push([25, 6, C.rare], [8, 24, C.rareLight], [7, 8, C.rareDark], [26, 24, C.rare]);
};

RELIC_DRAWERS['silver-tuning-fork'] = (g, fx) => {
  // prongs
  for (const x of [10, 19]) {
    rect(g, x, 3, 4, 15, C.steelDark);
    rect(g, x + 0, 4, 3, 13, C.steel);
    vline(g, x, 5, 16, C.bright);
    set(g, x, 3, C.steelMid);
  }
  // U base
  rect(g, 10, 16, 13, 3, C.steel);
  rect(g, 13, 18, 7, 4, C.steel);
  hline(g, 11, 21, 17, C.bright);
  // stem
  rect(g, 15, 21, 3, 5, C.steelDark);
  vline(g, 15, 22, 25, C.steel);
  // base knob
  disc(g, 16, 27, 3, C.steelDark);
  disc(g, 16, 27, 2, C.steel);
  set(g, 15, 26, C.bright);
  // vibration waves
  for (const r of [8, 11]) {
    for (let a = -55; a <= 55; a += 1) {
      const rad = (a * Math.PI) / 180;
      const x = 16 + Math.cos(rad) * r;
      const y = 12 + Math.sin(rad) * r;
      if (x < 4 || x > 28) continue;
      fx.push([Math.round(x), Math.round(y), r === 8 ? C.rare : C.rareDark]);
    }
  }
  fx.push([5, 6, C.rare], [27, 6, C.rareLight], [6, 18, C.rareDark]);
};

RELIC_DRAWERS['sleeping-ember'] = (g, fx) => {
  poly(g, [[8, 19], [10, 11], [16, 7], [23, 9], [27, 15], [25, 23], [19, 28], [12, 26]], C.soot);
  poly(g, [[10, 12], [16, 8], [22, 10], [24, 15], [20, 18], [14, 17]], C.stoneDark);
  poly(g, [[13, 18], [17, 12], [22, 16], [21, 22], [16, 26], [12, 23]], C.emberDark);
  poly(g, [[15, 18], [18, 15], [21, 18], [19, 22], [16, 24], [14, 21]], C.ember);
  // closed sleeping eye
  line(g, 13, 18, 16, 17, C.ink);
  line(g, 16, 17, 19, 18, C.ink);
  line(g, 13, 19, 14, 21, C.ink);
  line(g, 16, 18, 16, 21, C.ink);
  line(g, 19, 19, 18, 21, C.ink);
  set(g, 15, 16, C.goldLight);
  // soft glow
  set(g, 16, 21, C.emberLight);
  // smoke curls (thin)
  const smoke = [[[23, 7], [25, 5], [24, 3]], [[21, 6], [22, 4], [21, 2]]];
  for (const s of smoke) {
    for (let i = 0; i + 1 < s.length; i++) {
      const [x0, y0] = s[i], [x1, y1] = s[i + 1];
      for (let t = 0; t <= 1; t += 0.25) fx.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, C.ash]);
    }
  }
  fx.push([11, 23, C.ember], [24, 18, C.emberDark], [8, 15, C.steelMid]);
};

RELIC_DRAWERS['soot-censer'] = (g, fx) => {
  // chain
  vline(g, 16, 1, 5, C.steelDark);
  ring(g, 16, 6, 2, 1, C.brassDark);
  vline(g, 16, 8, 10, C.brassDark);
  // lid
  disc(g, 16, 11, 5, C.brassDark);
  poly(g, [[11, 11], [21, 11], [19, 8], [13, 8]], C.brass);
  ring(g, 16, 11, 5, 4, C.gold);
  set(g, 16, 7, C.goldLight);
  // holes
  for (const [x, y] of [[14, 9], [18, 9], [16, 12]]) set(g, x, y, C.soot);
  // bowl
  poly(g, [[9, 13], [23, 13], [21, 22], [11, 22]], C.brassDark);
  poly(g, [[10, 14], [22, 14], [20, 21], [12, 21]], C.brass);
  hline(g, 10, 21, 14, C.goldLight);
  ring(g, 16, 16, 4, 3, C.ink);
  for (const [x, y] of [[13, 18], [19, 18], [16, 20]]) set(g, x, y, C.soot);
  // soot stains
  poly(g, [[11, 18], [15, 19], [14, 22], [10, 22]], C.soot);
  // foot
  rect(g, 13, 22, 7, 3, C.brassDark);
  hline(g, 12, 19, 24, C.brass);
  // embers
  set(g, 15, 19, C.ember); set(g, 17, 19, C.emberDark);
  // smoke
  const smoke = [[[19, 8], [22, 5], [21, 2]], [[15, 6], [13, 3], [15, 1]]];
  for (const s of smoke) {
    for (let i = 0; i + 1 < s.length; i++) {
      const [x0, y0] = s[i], [x1, y1] = s[i + 1];
      for (let t = 0; t <= 1; t += 0.25) fx.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, C.ash]);
    }
  }
  fx.push([7, 10, C.ashDark], [26, 16, C.ash], [24, 7, C.ashDark]);
};

RELIC_DRAWERS['unbroken-oath'] = (g, fx) => {
  // crossed blades
  stroke(g, [[6, 28], [25, 6]], 4, C.steelDark);
  stroke(g, [[6, 28], [25, 6]], 2, C.steel);
  stroke(g, [[7, 27], [25, 7]], 1, C.bright);
  stroke(g, [[26, 28], [7, 6]], 4, C.steelDark);
  stroke(g, [[26, 28], [7, 6]], 2, C.steel);
  stroke(g, [[25, 27], [8, 7]], 1, C.bright);
  // crossguards
  line(g, 3, 24, 9, 30, C.goldDark);
  line(g, 4, 24, 9, 29, C.gold);
  line(g, 23, 29, 29, 23, C.goldDark);
  line(g, 23, 28, 28, 23, C.gold);
  // grips and pommels
  stroke(g, [[4, 29], [1, 31]], 3, C.leatherDark);
  stroke(g, [[27, 29], [30, 31]], 3, C.leatherDark);
  disc(g, 2, 30, 1.5, C.gold);
  disc(g, 29, 30, 1.5, C.gold);
  // unbroken chain ring binding the crossing
  ellipseRing(g, 16, 17, 5, 5, 2, C.steel);
  arcPix(g, 16, 17, 4, 190, 300, C.bright);
  ring(g, 16, 17, 3, 2, C.steelDark);
  disc(g, 16, 17, 1.5, C.rare);
  set(g, 15, 16, C.rareLight);
  // runes
  set(g, 12, 13, C.gold); set(g, 20, 21, C.gold);
  fx.push([10, 8, C.goldLight], [22, 26, C.goldLight], [4, 20, C.rareDark]);
};

RELIC_DRAWERS['wirebound-scabbard'] = (g, fx) => {
  stroke(g, [[6, 27], [24, 8]], 8, C.leatherDark);
  stroke(g, [[6, 27], [24, 8]], 6, C.leather);
  stroke(g, [[7, 26], [24, 9]], 1, C.leatherLight);
  stroke(g, [[5, 27], [22, 9]], 1, C.woodDark);
  // gold throat and chape
  rect(g, 20, 5, 6, 6, C.brassDark);
  hline(g, 20, 25, 6, C.gold);
  rect(g, 4, 24, 6, 6, C.brassDark);
  hline(g, 4, 9, 25, C.gold);
  // rare gem at the throat
  disc(g, 22, 8, 1.4, C.rare);
  set(g, 21, 7, C.rareLight);
  // wire wraps
  for (let i = 0; i < 5; i++) {
    const t = 0.18 + i * 0.15;
    const cx = 6 + (24 - 6) * t;
    const cy = 27 - (27 - 8) * t;
    line(g, cx - 4, cy - 4, cx + 4, cy + 4, C.steelDark);
    line(g, cx - 3, cy - 3, cx + 3, cy + 3, C.steel);
    set(g, cx - 3, cy - 3, C.bright);
  }
  // loose wire end
  fx.push([10, 18, C.steel], [9, 16, C.steel], [10, 14, C.steelDark], [19, 26, C.steel]);
  // hilt stub above throat
  stroke(g, [[25, 5], [28, 2]], 3, C.leatherDark);
  line(g, 23, 4, 29, 2, C.brass);
  fx.push([29, 1, C.goldLight], [25, 12, C.steelMid]);
};

RELIC_DRAWERS['worn-grip'] = (g, fx) => {
  // pommel
  disc(g, 16, 4, 3, C.brassDark);
  disc(g, 15, 3, 2, C.brass);
  set(g, 14, 2, C.goldLight);
  // grip
  rect(g, 13, 6, 7, 16, C.leatherDark);
  rect(g, 14, 6, 5, 16, C.leather);
  // leather wraps, worn spots
  for (let y = 7; y < 21; y += 3) {
    hline(g, 14, 18, y, C.leatherDark);
    hline(g, 14, 18, y + 1, C.leatherLight);
  }
  // exposed wooden core
  rect(g, 15, 12, 3, 6, C.wood);
  set(g, 15, 12, C.woodLight);
  set(g, 17, 16, C.woodDark);
  // frayed strips
  fx.push([19, 10, C.leatherLight], [20, 12, C.leather], [20, 13, C.leatherDark], [12, 17, C.leatherLight], [11, 19, C.leather]);
  // crossguard
  rect(g, 8, 22, 17, 3, C.brassDark);
  hline(g, 9, 23, 22, C.brass);
  set(g, 9, 23, C.goldLight);
  set(g, 22, 23, C.goldDark);
  // blade stub
  poly(g, [[13, 25], [19, 25], [19, 30], [13, 30]], C.steel);
  vline(g, 16, 25, 29, C.bright);
  set(g, 14, 26, C.steelMid);
  fx.push([10, 20, C.steelDark], [21, 7, C.leatherDark]);
};

RELIC_DRAWERS['black-iron-stone'] = (g, fx) => {
  // chunky black whetstone block, 3/4 view
  poly(g, [[7, 11], [13, 6], [26, 9], [20, 14]], C.stoneDark);
  poly(g, [[7, 11], [20, 14], [20, 28], [7, 24]], C.stone);
  poly(g, [[20, 14], [26, 9], [26, 23], [20, 28]], C.soot);
  // bevels and top sheen
  poly(g, [[8, 11], [13, 7], [24, 10], [19, 13]], C.soot);
  line(g, 9, 9, 18, 7, C.stoneLight);
  line(g, 20, 14, 20, 27, C.ink);
  line(g, 8, 12, 8, 23, C.stoneLight);
  // sharpening groove
  line(g, 9, 13, 19, 16, C.ink);
  line(g, 9, 12, 19, 15, C.steelMid);
  line(g, 10, 12, 18, 15, C.rareDark);
  // metallic sheen / highlights
  set(g, 12, 8, C.steel);
  set(g, 15, 8, C.rareLight);
  set(g, 17, 10, C.steelMid);
  line(g, 9, 16, 9, 22, C.steelDark);
  // honed edge and second groove on the block face
  line(g, 8, 17, 18, 21, C.steelDark);
  line(g, 8, 18, 18, 22, C.steel);
  set(g, 13, 20, C.bright); set(g, 16, 21, C.steelMid);
  line(g, 8, 10, 19, 7, C.steel);
  // chipped edges
  erase(g, 13, 6); erase(g, 26, 10); erase(g, 7, 23); erase(g, 20, 28);
  // sparks off the honed edge
  fx.push([27, 6, C.steel], [29, 7, C.rareLight], [26, 4, C.goldLight], [5, 18, C.steelMid]);
};

RELIC_DRAWERS['bronze-cog'] = (g, fx) => {
  gear(g, 16, 16, 8, 8, { col: C.brass, dark: C.brassDark, light: C.brassLight, hub: C.soot });
  // center axle
  disc(g, 16, 16, 2, C.steelDark);
  set(g, 15, 15, C.steel);
  // teeth detail / chip
  erase(g, 25, 9); erase(g, 26, 9);
  set(g, 24, 10, C.brassLight);
  // patina
  fx.push([10, 10, C.tealDark], [11, 9, C.tealMid], [22, 22, C.tealDark], [9, 21, C.tealMid], [21, 12, C.tealDark]);
  // crack
  line(g, 12, 19, 14, 22, C.ink);
  fx.push([26, 24, C.brassLight], [6, 14, C.brassDark]);
};

RELIC_DRAWERS['dragonscale-tongs'] = (g, fx) => {
  // dragon scale held at the top
  poly(g, [[16, 1], [21, 3], [22, 8], [19, 12], [16, 10], [13, 12], [10, 8], [11, 3]], C.gold);
  poly(g, [[16, 2], [19, 4], [20, 8], [18, 11], [16, 9], [14, 11], [12, 8], [13, 4]], C.brass);
  line(g, 16, 10, 16, 2, C.goldDark);
  line(g, 16, 10, 11, 4, C.goldLight);
  line(g, 16, 10, 21, 4, C.goldLight);
  line(g, 13, 5, 15, 4, C.goldLight);
  line(g, 19, 5, 17, 4, C.goldLight);
  set(g, 16, 8, C.emberDark);
  // left and right tong arms
  stroke(g, [[8, 29], [16, 19], [10, 7]], 3, C.steelDark);
  stroke(g, [[8, 28], [16, 18], [10, 7]], 1, C.steel);
  stroke(g, [[24, 29], [16, 19], [22, 7]], 3, C.steelDark);
  stroke(g, [[24, 28], [16, 18], [22, 7]], 1, C.steel);
  line(g, 9, 26, 15, 19, C.steelDark);
  line(g, 23, 26, 17, 19, C.steelDark);
  // pivot pin
  disc(g, 16, 19, 2.5, C.brassDark);
  disc(g, 16, 18, 1.2, C.brass);
  set(g, 15, 17, C.goldLight);
  // jaw hooks gripping the scale
  poly(g, [[9, 8], [12, 6], [13, 8], [10, 9]], C.steel);
  poly(g, [[23, 8], [20, 6], [19, 8], [22, 9]], C.steel);
  set(g, 11, 6, C.bright); set(g, 21, 6, C.bright);
  // handle loops
  ring(g, 7, 30, 2.5, 1, C.steelDark);
  ring(g, 25, 30, 2.5, 1, C.steelDark);
  fx.push([16, 9, C.emberLight], [9, 4, C.goldLight], [24, 4, C.goldLight], [16, 20, C.steelMid]);
};

RELIC_DRAWERS['echo-hammer'] = (g, fx) => {
  // head
  rect(g, 7, 6, 18, 7, C.steelDark);
  rect(g, 8, 7, 16, 4, C.steel);
  hline(g, 8, 23, 7, C.bright);
  hline(g, 8, 23, 11, C.steelMid);
  rect(g, 20, 7, 3, 4, C.steelDark);
  line(g, 9, 9, 19, 9, C.brass);
  // handle
  rect(g, 14, 13, 5, 15, C.woodDark);
  rect(g, 15, 13, 3, 14, C.wood);
  vline(g, 15, 14, 26, C.woodLight);
  for (let y = 16; y < 27; y += 4) hline(g, 15, 17, y, C.leatherDark);
  disc(g, 16, 29, 2.5, C.steelDark);
  // echo arcs
  for (const r of [8, 11, 14]) {
    for (let a = -65; a <= 65; a += 2) {
      const rad = (a * Math.PI) / 180;
      const x = 25 + Math.cos(rad) * r;
      const y = 9 + Math.sin(rad) * r;
      if (x > 30 || y < 1 || y > 30) continue;
      fx.push([Math.round(x), Math.round(y), r === 8 ? C.rare : C.rareDark]);
    }
  }
  fx.push([28, 19, C.rareLight], [30, 9, C.rare], [5, 5, C.steelMid]);
};

RELIC_DRAWERS['giants-spine'] = (g, fx) => {
  // spinal cord behind
  rect(g, 15, 4, 2, 24, C.boneDark);
  for (let i = 0; i < 3; i++) {
    const cy = 8 + i * 8;
    // vertebral body
    ellipse(g, 16, cy, 4.5, 3, C.boneDark);
    ellipse(g, 16, cy - 0.5, 3.5, 2.2, C.bone);
    // transverse processes
    poly(g, [[12, cy - 1], [7, cy - 4], [5, cy - 1], [11, cy + 2]], C.bone);
    poly(g, [[20, cy - 1], [25, cy - 4], [27, cy - 1], [21, cy + 2]], C.bone);
    line(g, 8, cy - 3, 6, cy - 1, C.boneLight);
    line(g, 24, cy - 3, 26, cy - 1, C.boneLight);
    // spinous process
    poly(g, [[15, cy + 2], [17, cy + 2], [18, cy + 6], [14, cy + 6]], C.boneDark);
    set(g, 16, cy + 4, C.bone);
    // joint shadow
    hline(g, 12, 20, cy + 3, C.ink);
  }
  // cracked vertebra
  line(g, 12, 15, 14, 17, C.ink);
  set(g, 11, 7, C.boneLight); set(g, 20, 23, C.boneLight);
  fx.push([7, 5, C.boneDark], [26, 21, C.bone], [9, 26, C.tealDark]);
};

RELIC_DRAWERS['glass-hourglass'] = (g, fx) => {
  hourglass(g, {
    top: 4, bottom: 28,
    frame: C.steel, frameDark: C.steelDark,
    sand: C.rare, stream: C.rareLight,
    glass: C.glass, glassLight: C.teal,
  });
  // bright glass edges
  line(g, 11, 8, 13, 13, C.teal);
  line(g, 12, 18, 10, 23, C.teal);
  line(g, 20, 9, 18, 13, C.glassLight);
  // ornate side curls
  arcPix(g, 6, 16, 3, 100, 260, C.steelDark);
  arcPix(g, 26, 16, 3, -80, 80, C.steelDark);
  set(g, 5, 14, C.rareLight); set(g, 27, 18, C.rareLight);
  fx.push([17, 5, C.rareLight], [15, 26, C.rare], [10, 29, C.rareDark]);
};

RELIC_DRAWERS['golden-cog'] = (g, fx) => {
  gear(g, 16, 16, 8, 10, {
    col: C.gold, dark: C.goldDark, light: C.goldLight, hub: C.soot,
  });
  // axle and gem hub
  disc(g, 16, 16, 2.2, C.soot);
  disc(g, 16, 16, 1.4, C.rare);
  set(g, 15, 15, C.rareLight);
  // engraved rim
  ring(g, 16, 16, 5, 4, C.goldDark);
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    set(g, Math.round(16 + Math.cos(rad) * 6), Math.round(16 + Math.sin(rad) * 6), C.goldLight);
  }
  // sparkle
  fx.push([26, 5, C.goldLight], [27, 5, C.gold], [25, 5, C.gold], [26, 4, C.gold], [26, 6, C.gold]);
  fx.push([5, 24, C.gold], [7, 6, C.goldDark]);
};

RELIC_DRAWERS['ossuary-kings-scabbard'] = (g, fx) => {
  // bone sheath
  stroke(g, [[6, 27], [23, 9]], 9, C.boneDark);
  stroke(g, [[6, 27], [23, 9]], 7, C.bone);
  stroke(g, [[7, 26], [23, 10]], 1, C.boneLight);
  stroke(g, [[5, 27], [21, 10]], 1, C.stoneDark);
  // rib bindings
  for (let i = 0; i < 5; i++) {
    const t = 0.18 + i * 0.16;
    const cx = 6 + (23 - 6) * t;
    const cy = 27 - (27 - 9) * t;
    line(g, cx - 4, cy - 4, cx + 4, cy + 4, C.boneDark);
    line(g, cx - 3, cy - 3, cx + 3, cy + 3, C.boneLight);
    set(g, cx - 3, cy - 3, C.boneLight);
  }
  // gold bands
  for (const [x, y] of [[9, 24], [20, 12]]) {
    rect(g, x - 3, y - 3, 7, 3, C.brassDark);
    hline(g, x - 3, x + 3, y - 3, C.gold);
  }
  // skull at the throat
  skullAt(g, 22, 8, 0.72, { bone: C.bone, dark: C.boneDark, glow: C.rare });
  // chape
  poly(g, [[4, 26], [8, 24], [8, 30], [5, 30]], C.boneDark);
  set(g, 6, 26, C.boneLight);
  // cracks
  line(g, 12, 20, 13, 22, C.ink);
  fx.push([25, 12, C.goldLight], [5, 22, C.tealDark], [17, 11, C.rareLight]);
};

RELIC_DRAWERS['sealed-rebate'] = (g, fx) => {
  // envelope
  poly(g, [[5, 10], [27, 10], [27, 23], [5, 23]], C.boneDark);
  rect(g, 6, 11, 20, 11, C.bone);
  // flap
  line(g, 6, 11, 16, 18, C.boneDark);
  line(g, 26, 11, 16, 18, C.boneDark);
  line(g, 7, 12, 16, 18, C.boneLight);
  line(g, 25, 12, 16, 18, C.boneLight);
  // wax seal
  disc(g, 16, 18, 4.5, C.bloodDark);
  disc(g, 16, 18, 3.5, C.blood);
  ring(g, 16, 18, 3, 2, C.bloodLight);
  set(g, 16, 17, C.rare); set(g, 15, 16, C.rareLight);
  // coin peeking out
  coin(g, 25, 24, 3.5, { face: C.gold, edge: C.goldDark });
  // rare trim
  hline(g, 6, 25, 22, C.rareDark);
  fx.push([6, 24, C.bone], [28, 14, C.rare], [9, 8, C.boneDark]);
};

RELIC_DRAWERS['smiths-testament'] = (g, fx) => {
  scroll(g, 9, 4, 14, 23, { paper: C.bone, edge: C.boneDark, roll: C.woodDark, rollLight: C.wood });
  // hammer emblem
  rect(g, 12, 9, 9, 3, C.steelDark);
  hline(g, 13, 20, 9, C.steel);
  rect(g, 16, 12, 2, 7, C.woodDark);
  set(g, 15, 13, C.leather);
  // hammer head highlight
  set(g, 13, 10, C.bright); set(g, 19, 10, C.steelMid);
  // anvil mark below
  poly(g, [[12, 20], [20, 20], [19, 22], [13, 22]], C.stoneDark);
  hline(g, 13, 19, 20, C.steel);
  // wax seal
  disc(g, 20, 24, 3, C.bloodDark);
  disc(g, 20, 24, 2, C.blood);
  set(g, 20, 23, C.bloodLight);
  // rare seal gem
  set(g, 20, 24, C.rareDark);
  // torn edge
  erase(g, 9, 21); erase(g, 9, 22);
  fx.push([7, 8, C.goldLight], [24, 13, C.rare], [12, 16, C.boneDark]);
};

RELIC_DRAWERS['tax-tally'] = (g, fx) => {
  // tally stick
  rect(g, 11, 3, 9, 26, C.woodDark);
  rect(g, 12, 3, 7, 25, C.wood);
  vline(g, 15, 4, 27, C.woodLight);
  // split line
  vline(g, 16, 5, 26, C.ink);
  // carved notches
  for (let y = 7; y < 24; y += 3) {
    line(g, 11, y, 14, y + 2, C.ink);
    line(g, 18, y, 21, y + 2, C.ink);
    set(g, 12, y + 2, C.leatherLight);
  }
  // cord
  ring(g, 16, 3, 2, 1, C.boneDark);
  fx.push([9, 6, C.boneDark], [23, 7, C.boneDark]);
  // coin
  coin(g, 24, 24, 3.5, { face: C.gold, edge: C.goldDark });
  // count marks (strokes) on the coin edge
  set(g, 23, 23, C.goldLight);
  // rare blue seal on the stick
  disc(g, 16, 25, 2, C.rareDark);
  set(g, 15, 24, C.rare);
  fx.push([25, 12, C.goldLight], [8, 20, C.rare]);
};

RELIC_DRAWERS['bell-collar'] = (g, fx) => {
  // wide leather collar band across the top
  rect(g, 5, 6, 23, 7, C.leatherDark);
  rect(g, 6, 7, 21, 5, C.leather);
  hline(g, 6, 26, 7, C.leatherLight);
  hline(g, 6, 26, 11, C.woodDark);
  // stitching
  for (let x = 8; x <= 25; x += 3) {
    set(g, x, 8, C.bone);
    set(g, x, 10, C.bone);
  }
  // buckle at the left end
  rect(g, 3, 6, 5, 7, C.brassDark);
  rect(g, 4, 7, 3, 5, C.soot);
  hline(g, 4, 7, 6, C.brassLight);
  set(g, 5, 8, C.brass);
  // steel studs
  for (const x of [10, 14, 18, 22, 26]) {
    disc(g, x, 9, 1.2, C.steelDark);
    set(g, x, 8, C.bright);
  }
  // D-ring and hanging bell
  ring(g, 16, 14, 2, 1, C.steelDark);
  vline(g, 16, 16, 18, C.steelDark);
  poly(g, [[14, 19], [18, 19], [19, 22], [21, 26], [11, 26], [13, 22]], C.brass);
  rect(g, 10, 25, 13, 3, C.brassDark);
  hline(g, 11, 21, 25, C.brassLight);
  line(g, 14, 20, 13, 24, C.goldLight);
  line(g, 18, 20, 19, 24, C.brassDark);
  set(g, 16, 19, C.brassDark);
  vline(g, 16, 27, 29, C.steelDark);
  disc(g, 16, 30, 1.5, C.steelDark);
  set(g, 15, 29, C.steel);
  fx.push([24, 5, C.leatherLight], [7, 13, C.steelMid], [20, 28, C.gold]);
};

RELIC_DRAWERS['headless-bell'] = (g, fx) => {
  bellBody(g, { top: 8, base: 24, col: C.brass, light: C.brassLight, dark: C.brassDark, loop: false });
  // broken open top
  rect(g, 13, 6, 7, 4, C.soot);
  poly(g, [[13, 6], [15, 4], [16, 6], [18, 3], [20, 6], [19, 8], [14, 8]], C.steelDark);
  set(g, 14, 5, C.steelMid); set(g, 18, 5, C.steelMid);
  // jagged rim remnants
  set(g, 12, 7, C.brassDark); set(g, 21, 6, C.brassDark);
  // broken chain above
  ellipseRing(g, 16, 2, 1.5, 1.5, 1, C.steelDark);
  set(g, 16, 3, C.steel);
  // arcane glow in the void
  set(g, 16, 7, C.arcane);
  fx.push([16, 5, C.arcaneLight], [13, 3, C.arcane], [20, 2, C.arcaneDark], [18, 9, C.rareLight]);
  // chipped lip
  erase(g, 24, 22); erase(g, 25, 23);
  fx.push([26, 28, C.brassDark], [7, 27, C.brass]);
};

RELIC_DRAWERS['obsidian-eye'] = (g, fx) => {
  // gold setting
  poly(g, [[3, 16], [8, 9], [16, 7], [24, 9], [29, 16], [24, 23], [16, 25], [8, 23]], C.goldDark);
  poly(g, [[5, 16], [9, 10], [16, 8], [23, 10], [27, 16], [23, 22], [16, 24], [9, 22]], C.soot);
  // black glass eye
  poly(g, [[6, 16], [10, 11], [16, 10], [22, 11], [26, 16], [22, 21], [16, 22], [10, 21]], C.stoneDark);
  poly(g, [[7, 16], [11, 12], [16, 11], [15, 16], [12, 18]], C.stone);
  // iris
  disc(g, 16, 16, 4, C.rareDark);
  disc(g, 16, 16, 2.4, C.ink);
  ring(g, 16, 16, 3.2, 2.4, C.rare);
  set(g, 14, 14, C.rareLight);
  set(g, 17, 18, C.rareDark);
  // glass highlights
  line(g, 8, 14, 12, 11, C.steelMid);
  set(g, 10, 13, C.white);
  set(g, 21, 20, C.white);
  // obsidian facet crack
  line(g, 21, 13, 23, 16, C.ink);
  set(g, 22, 15, C.stoneLight);
  fx.push([16, 6, C.goldLight], [6, 20, C.rare], [26, 12, C.rareLight]);
};

RELIC_DRAWERS['red-hourglass'] = (g, fx) => {
  hourglass(g, {
    top: 4, bottom: 28,
    frame: C.steelDark, frameDark: C.ink,
    sand: C.blood, stream: C.bloodLight,
    glass: C.stoneDark, glassLight: C.bloodDark,
  });
  // blood drip at the base
  set(g, 19, 29, C.blood);
  set(g, 20, 30, C.bloodDark);
  // cracked frame
  line(g, 7, 20, 9, 22, C.steel);
  // skull-ish shadow in the bottom bulb
  disc(g, 16, 23, 2, C.bloodDark);
  set(g, 15, 22, C.ink); set(g, 17, 22, C.ink);
  // pulse glow
  fx.push([13, 12, C.bloodLight], [20, 17, C.blood], [6, 11, C.bloodDark], [26, 24, C.blood]);
};

RELIC_DRAWERS['royal-spike'] = (g, fx) => {
  // crown head
  crown(g, 16, 10, 18, 8, { col: C.gold, light: C.goldLight, dark: C.goldDark, jewel: C.blood, jewel2: C.rare });
  // spike
  poly(g, [[12, 12], [20, 12], [18, 26], [16, 30], [14, 26]], C.steel);
  poly(g, [[13, 12], [16, 12], [16, 29], [14, 26]], C.bright);
  poly(g, [[17, 12], [19, 12], [18, 25], [17, 28]], C.steelDark);
  line(g, 15, 13, 15, 25, C.white);
  // collar
  rect(g, 10, 12, 13, 3, C.brassDark);
  hline(g, 10, 22, 12, C.gold);
  set(g, 11, 13, C.goldLight);
  // engraved bands
  hline(g, 13, 19, 18, C.steelDark);
  hline(g, 14, 18, 22, C.steelDark);
  // rare gem
  disc(g, 16, 14, 1.3, C.rare);
  set(g, 15, 13, C.rareLight);
  fx.push([27, 4, C.goldLight], [5, 8, C.gold], [16, 31, C.blood]);
};

RELIC_DRAWERS['silver-supply-writ'] = (g, fx) => {
  scroll(g, 7, 10, 18, 12, {
    vertical: false, paper: C.bone, edge: C.boneDark,
    roll: C.steelDark, rollLight: C.steel,
  });
  // silver shine on rolls
  vline(g, 5, 10, 21, C.bright);
  vline(g, 27, 10, 21, C.steel);
  // blue ribbon band
  rect(g, 15, 8, 3, 16, C.rareDark);
  rect(g, 16, 8, 1, 16, C.rare);
  // wax seal
  disc(g, 16, 19, 3, C.rareDark);
  disc(g, 16, 19, 2, C.rare);
  set(g, 16, 18, C.rareLight);
  // small sword emblem on the parchment
  vline(g, 11, 12, 18, C.steelDark);
  hline(g, 9, 13, 17, C.goldDark);
  set(g, 11, 11, C.bright);
  // folded corner
  poly(g, [[23, 10], [25, 10], [25, 13]], C.boneDark);
  fx.push([6, 8, C.white], [26, 24, C.rare], [10, 21, C.steelMid]);
};

RELIC_DRAWERS['pocket-hearth'] = (g, fx) => {
  // chimney
  rect(g, 12, 2, 8, 6, C.stoneDark);
  rect(g, 13, 3, 6, 4, C.stone);
  rect(g, 11, 2, 10, 2, C.stoneLight);
  // hearth arch
  poly(g, [[7, 27], [8, 12], [12, 7], [20, 7], [24, 12], [25, 27]], C.stoneDark);
  poly(g, [[8, 26], [9, 13], [13, 8], [19, 8], [23, 13], [24, 26]], C.stone);
  // stone joints
  line(g, 8, 14, 24, 14, C.stoneDark);
  line(g, 9, 20, 23, 20, C.stoneDark);
  line(g, 13, 8, 13, 14, C.stoneDark);
  line(g, 19, 14, 19, 20, C.stoneDark);
  line(g, 12, 20, 12, 26, C.stoneDark);
  // opening
  poly(g, [[11, 26], [11, 17], [14, 13], [18, 13], [21, 17], [21, 26]], C.ink);
  poly(g, [[12, 26], [12, 18], [15, 14], [17, 14], [20, 18], [20, 26]], C.soot);
  // logs
  rect(g, 12, 23, 8, 2, C.woodDark);
  hline(g, 12, 19, 23, C.wood);
  // fire
  flame(g, 16, 19, 0.8, { outer: C.ember, mid: C.emberLight, core: C.goldLight });
  // embers
  fx.push([14, 12, C.ember], [18, 10, C.emberLight], [15, 9, C.emberDark]);
  // feet
  rect(g, 6, 26, 6, 3, C.stoneDark);
  rect(g, 20, 26, 6, 3, C.stoneDark);
  fx.push([5, 24, C.stoneLight], [26, 22, C.stoneLight]);
};

RELIC_DRAWERS['supply-permit'] = (g, fx) => {
  // sheet with folded corner
  poly(g, [[8, 4], [22, 4], [24, 7], [24, 28], [8, 28]], C.boneDark);
  poly(g, [[9, 5], [21, 5], [23, 8], [23, 27], [9, 27]], C.bone);
  // fold
  poly(g, [[21, 5], [23, 8], [21, 8]], C.boneDark);
  line(g, 21, 5, 21, 8, C.boneDark);
  // document lines
  for (let y = 9; y <= 17; y += 3) hline(g, 11, 20, y, C.boneDark);
  // small crate / supply mark
  rect(g, 11, 19, 6, 5, C.woodDark);
  rect(g, 12, 20, 4, 3, C.wood);
  line(g, 11, 19, 16, 23, C.leatherDark);
  line(g, 16, 19, 11, 23, C.leatherDark);
  // blue approval stamp
  ring(g, 18, 21, 4, 3, C.rareDark);
  ring(g, 18, 21, 3, 2, C.rare);
  line(g, 16, 21, 20, 21, C.rareLight);
  line(g, 18, 19, 18, 23, C.rareLight);
  // ribbon
  rect(g, 8, 24, 3, 8, C.goldDark);
  hline(g, 7, 11, 24, C.gold);
  // rare seal
  disc(g, 18, 26, 2, C.rareDark);
  set(g, 17, 25, C.rareLight);
  fx.push([25, 10, C.rare], [6, 18, C.boneDark], [13, 7, C.steelMid]);
};

// --------------------------------------------------------------- legendaries
RELIC_DRAWERS['butterfingers'] = (g, fx) => {
  // gauntlet palm
  box(g, 5, 10, 10, 9, C.steel, C.ink);
  rect(g, 6, 11, 8, 6, C.steel);
  vline(g, 6, 12, 16, C.bright);
  vline(g, 13, 12, 17, C.steelDark);
  // three fingers
  for (const x of [5, 9, 13]) {
    rect(g, x, 4, 3, 8, C.steel);
    vline(g, x, 5, 10, C.bright);
    vline(g, x + 2, 5, 11, C.steelDark);
    set(g, x + 1, 3, C.steelMid);
    set(g, x, 3, C.bone);
  }
  // thumb
  poly(g, [[14, 12], [18, 13], [18, 17], [14, 17]], C.steel);
  line(g, 15, 13, 17, 14, C.bright);
  // butter pat melting over the fingers
  rect(g, 5, 1, 9, 4, C.gold);
  hline(g, 5, 13, 1, C.goldLight);
  poly(g, [[7, 5], [9, 5], [9, 8], [7, 7]], C.gold);
  poly(g, [[11, 5], [13, 5], [12, 7]], C.gold);
  set(g, 6, 2, C.goldLight);
  // dropped sword, falling
  poly(g, [[22, 20], [26, 20], [26, 28], [24, 31], [22, 28]], C.steel);
  poly(g, [[22, 21], [24, 21], [24, 28], [23, 29]], C.bright);
  line(g, 24, 21, 24, 28, C.white);
  rect(g, 20, 18, 9, 2, C.goldDark);
  hline(g, 20, 28, 18, C.gold);
  rect(g, 23, 14, 3, 4, C.leatherDark);
  set(g, 24, 15, C.leatherLight);
  disc(g, 25, 13, 1.5, C.gold);
  // slip motion
  fx.push([19, 16, C.gold], [19, 15, C.goldLight], [21, 13, C.gold], [17, 18, C.steelMid]);
  fx.push([27, 11, C.goldLight], [27, 10, C.gold], [28, 12, C.goldDark]);
};

RELIC_DRAWERS['dawn-scabbard'] = (g, fx) => {
  // scabbard
  stroke(g, [[6, 27], [22, 10]], 8, C.leatherDark);
  stroke(g, [[6, 27], [22, 10]], 6, C.leather);
  stroke(g, [[7, 26], [22, 11]], 1, C.leatherLight);
  // gold fittings
  for (const [x, y] of [[9, 24], [18, 14]]) {
    rect(g, x - 3, y - 3, 7, 4, C.goldDark);
    hline(g, x - 3, x + 3, y - 3, C.gold);
  }
  // rising sun at the throat
  disc(g, 24, 8, 5, C.goldDark);
  disc(g, 24, 8, 4, C.gold);
  disc(g, 24, 8, 2, C.goldLight);
  set(g, 23, 7, C.white);
  // sun rays
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    for (let r = 6; r <= 9; r++) {
      const x = Math.round(24 + Math.cos(rad) * r);
      const y = Math.round(8 + Math.sin(rad) * r);
      if (x > 31 || y < 0) continue;
      fx.push([x, y, r === 9 ? C.goldLight : C.gold]);
    }
  }
  // hilt above
  rect(g, 22, 5, 4, 3, C.brass);
  set(g, 23, 5, C.goldLight);
  // horizon reflection
  fx.push([11, 20, C.rareLight], [7, 24, C.rare], [16, 12, C.rareDark]);
};

RELIC_DRAWERS['dragons-pardon'] = (g, fx) => {
  // pardon scroll
  scroll(g, 5, 9, 22, 14, { vertical: true, paper: C.bone, edge: C.boneDark, roll: C.goldDark, rollLight: C.gold });
  // dragon eye seal
  poly(g, [[8, 16], [12, 13], [16, 13], [20, 13], [24, 16], [20, 19], [16, 19], [12, 19]], C.emberDark);
  poly(g, [[9, 16], [13, 14], [16, 14], [19, 14], [23, 16], [19, 18], [16, 18], [13, 18]], C.gold);
  disc(g, 16, 16, 2.2, C.ember);
  set(g, 16, 16, C.ink);
  vline(g, 16, 14, 18, C.ink);
  set(g, 14, 15, C.white);
  // broken chain beneath the decree
  chainLink(g, 5, 26, 2.5, 2, C.steel, C.steelDark);
  chainLink(g, 10, 27, 2.5, 2, C.steel, C.steelDark);
  chainLink(g, 22, 27, 2.5, 2, C.steel, C.steelDark);
  chainLink(g, 27, 26, 2.5, 2, C.steel, C.steelDark);
  set(g, 16, 26, C.steelDark);
  // wax seal
  disc(g, 23, 21, 3, C.bloodDark);
  disc(g, 23, 21, 2, C.blood);
  set(g, 23, 20, C.rareLight);
  // gold sparkles
  fx.push([28, 6, C.goldLight], [4, 7, C.gold], [16, 21, C.ember], [12, 23, C.goldDark]);
};

RELIC_DRAWERS['kings-empty-cup'] = (g, fx) => {
  goblet(g, {
    top: 4, bowlH: 13, bowlW: 9,
    metal: C.gold, light: C.goldLight, dark: C.goldDark,
    stem: C.goldDark, foot: C.gold,
  });
  // empty interior, dry highlight
  rect(g, 10, 5, 13, 2, C.goldLight);
  rect(g, 11, 6, 11, 2, C.soot);
  line(g, 12, 7, 15, 14, C.ink);
  // crown engraving on the bowl
  poly(g, [[12, 12], [12, 9], [14, 10], [16, 8], [18, 10], [20, 9], [20, 12]], C.gold);
  set(g, 14, 11, C.blood); set(g, 16, 10, C.rare); set(g, 18, 11, C.blood);
  hline(g, 11, 21, 13, C.goldDark);
  // stem jewels
  disc(g, 16, 23, 1.5, C.rare);
  set(g, 15, 22, C.rareLight);
  // base engraving
  hline(g, 10, 22, 28, C.goldDark);
  // shine
  fx.push([25, 5, C.goldLight], [6, 16, C.gold], [24, 26, C.goldLight]);
};

RELIC_DRAWERS['phoenix-ash'] = (g, fx) => {
  feather(g, {
    cx: 16, top: 3, bottom: 23,
    col: C.ember, shade: C.emberDark, spine: C.gold,
  });
  // flight feather highlights
  line(g, 15, 6, 13, 19, C.emberLight);
  line(g, 17, 6, 19, 19, C.goldDark);
  // flame at the tip
  flame(g, 16, 5, 0.65, { outer: C.gold, mid: C.emberLight, core: C.goldLight });
  // ash pile at the base
  poly(g, [[7, 28], [11, 24], [16, 25], [21, 24], [26, 27], [23, 30], [9, 30]], C.ashDark);
  poly(g, [[10, 28], [14, 26], [19, 26], [23, 28], [20, 29], [12, 29]], C.ash);
  set(g, 13, 27, C.ember); set(g, 18, 28, C.emberDark);
  // sparks
  fx.push([8, 8, C.goldLight], [25, 12, C.ember], [4, 20, C.gold], [27, 22, C.emberLight], [12, 3, C.goldLight]);
};

RELIC_DRAWERS['sickle-and-hammer'] = (g, fx) => {
  // sickle
  poly(g, [
    [14, 4], [8, 6], [4, 12], [3, 19], [7, 25], [13, 27],
    [13, 23], [9, 21], [7, 17], [8, 12], [12, 9], [15, 8],
  ], C.gold);
  poly(g, [[13, 5], [8, 7], [5, 12], [5, 18], [8, 22], [11, 23], [9, 19], [8, 15], [9, 11], [13, 8]], C.goldDark);
  line(g, 12, 8, 6, 17, C.goldLight);
  // sickle handle
  stroke(g, [[12, 25], [17, 29]], 4, C.woodDark);
  stroke(g, [[12, 24], [16, 28]], 2, C.wood);
  set(g, 13, 25, C.leatherLight);
  // hammer head
  poly(g, [[18, 5], [28, 7], [28, 12], [17, 11]], C.gold);
  hline(g, 18, 27, 6, C.goldLight);
  hline(g, 18, 27, 10, C.goldDark);
  // hammer handle crossing
  stroke(g, [[21, 11], [10, 28]], 4, C.woodDark);
  stroke(g, [[21, 10], [11, 27]], 2, C.wood);
  line(g, 20, 12, 12, 25, C.woodLight);
  // rivets
  set(g, 20, 8, C.goldDark); set(g, 25, 9, C.goldLight);
  fx.push([29, 4, C.goldLight], [4, 8, C.gold], [7, 28, C.goldLight], [16, 3, C.gold]);
};

RELIC_DRAWERS['split-twin-mirror'] = (g, fx) => {
  // handle
  rect(g, 16, 24, 4, 7, C.goldDark);
  rect(g, 17, 24, 2, 6, C.gold);
  disc(g, 18, 30, 2, C.goldDark);
  // frame
  ellipse(g, 16, 14, 10, 11, C.goldDark);
  ellipse(g, 16, 14, 9, 10, C.gold);
  ellipse(g, 16, 14, 7, 8, C.arcaneDark);
  ring(g, 16, 14, 7, 6, C.arcane);
  // twin reflections
  poly(g, [[11, 14], [12, 10], [14, 9], [14, 14], [13, 17]], C.arcaneLight);
  poly(g, [[21, 14], [20, 10], [18, 9], [18, 14], [19, 17]], C.arcaneLight);
  set(g, 13, 12, C.ink); set(g, 19, 12, C.ink);
  // split crack
  const crack = [[16, 3], [15, 8], [17, 12], [15, 16], [17, 20], [16, 25], [17, 31]];
  for (let i = 0; i + 1 < crack.length; i++) line(g, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], C.ink);
  set(g, 17, 10, C.rare); set(g, 16, 14, C.rareLight); set(g, 16, 19, C.rareDark);
  // gold filigree
  line(g, 8, 8, 11, 10, C.goldLight);
  line(g, 24, 8, 21, 10, C.goldLight);
  fx.push([16, 6, C.rareLight], [7, 20, C.rare], [25, 18, C.rareDark]);
};

RELIC_DRAWERS['wandering-ghosts-ledger'] = (g, fx) => {
  // ghost
  poly(g, [[16, 2], [21, 5], [22, 11], [21, 16], [18, 14], [16, 17], [14, 14], [11, 16], [10, 11], [11, 5]], C.bone);
  poly(g, [[16, 3], [20, 5], [21, 11], [20, 14], [18, 13], [17, 8], [15, 8], [13, 12], [12, 15], [11, 10], [12, 5]], C.teal);
  poly(g, [[11, 5], [16, 2], [16, 8], [13, 7]], C.tealMid);
  // eyes and mouth
  set(g, 14, 9, C.ink); set(g, 18, 9, C.ink);
  set(g, 14, 10, C.soot); set(g, 18, 10, C.soot);
  set(g, 16, 13, C.ink);
  // wispy tail
  poly(g, [[13, 16], [16, 14], [19, 16], [18, 20], [20, 23], [16, 21], [12, 23], [14, 20]], C.tealDark);
  // open ledger
  openBook(g, 16, 19, 24, 10, { cover: C.leatherDark, pages: C.bone, edge: C.boneDark });
  // gold corners
  for (const [x, y] of [[9, 19], [23, 19], [9, 27], [23, 27]]) set(g, x, y, C.gold);
  // glow wisps
  fx.push([7, 8, C.teal], [25, 6, C.tealMid], [6, 16, C.tealDark], [26, 15, C.teal], [16, 1, C.rareLight]);
};

RELIC_DRAWERS['abyssal-pearl'] = (g, fx) => {
  // open shell, lower valve
  poly(g, [[3, 20], [8, 25], [16, 28], [24, 25], [29, 20], [26, 29], [16, 31], [6, 29]], C.tealDark);
  poly(g, [[4, 21], [9, 26], [16, 29], [23, 26], [28, 21], [25, 27], [16, 30], [7, 27]], C.stoneDark);
  // shell ridges
  for (let i = -4; i <= 4; i++) {
    line(g, 16, 29, 16 + i * 3, 20 + Math.abs(i), i % 2 === 0 ? C.tealMid : C.tealDark);
  }
  hline(g, 8, 24, 26, C.teal);
  // upper valve behind the pearl
  poly(g, [[4, 20], [9, 13], [16, 11], [23, 13], [28, 20], [23, 17], [16, 16], [9, 17]], C.stoneDark);
  poly(g, [[6, 19], [10, 14], [16, 12], [22, 14], [26, 19], [22, 17], [16, 16], [10, 17]], C.tealDark);
  // pearl
  disc(g, 16, 16, 7, C.boneDark);
  disc(g, 16, 16, 6, C.bone);
  disc(g, 15, 15, 4, C.boneLight);
  disc(g, 14, 14, 2, C.white);
  set(g, 18, 19, C.rare); set(g, 19, 18, C.rareLight);
  // gold hinge
  rect(g, 14, 28, 5, 3, C.goldDark);
  hline(g, 15, 17, 28, C.gold);
  // bubbles and glow
  fx.push([25, 10, C.teal], [27, 8, C.tealDark], [5, 11, C.tealMid], [24, 22, C.rareLight]);
  fx.push([16, 6, C.white], [20, 12, C.rare], [10, 22, C.teal]);
};

RELIC_DRAWERS['ceaseless-driveshaft'] = (g, fx) => {
  // shaft
  rect(g, 7, 14, 18, 5, C.steelDark);
  rect(g, 8, 15, 16, 3, C.steel);
  hline(g, 8, 23, 15, C.bright);
  hline(g, 8, 23, 17, C.steelMid);
  // yokes
  for (const x of [8, 23]) {
    rect(g, x - 1, 12, 3, 9, C.steelDark);
    vline(g, x, 12, 20, C.steel);
    set(g, x, 12, C.bright);
  }
  // joints / bolts
  for (const x of [10, 16, 22]) {
    disc(g, x, 16, 1.5, C.brassDark);
    set(g, x, 15, C.goldLight);
  }
  // end couplings
  for (const x of [4, 27]) {
    disc(g, x, 16, 4, C.steelDark);
    disc(g, x, 16, 3, C.steel);
    ring(g, x, 16, 3, 2, C.brass);
    set(g, x, 15, C.goldLight);
  }
  // motion arcs
  for (const [cx, cy, dir] of [[4, 16, -1], [27, 16, 1]]) {
    for (const r of [7, 9]) {
      for (let a = -70; a <= 70; a += 3) {
        const rad = (a * Math.PI) / 180;
        const x = cx + dir * Math.cos(rad) * r;
        const y = cy + Math.sin(rad) * r;
        if (x < 0 || x > 31 || y < 1 || y > 30) continue;
        fx.push([Math.round(x), Math.round(y), r === 7 ? C.gold : C.goldDark]);
      }
    }
  }
  // gold bands
  for (const x of [13, 19]) {
    rect(g, x, 13, 2, 7, C.goldDark);
    vline(g, x, 14, 18, C.gold);
  }
  fx.push([16, 12, C.goldLight], [30, 8, C.gold], [1, 24, C.goldDark]);
};

RELIC_DRAWERS['eternal-seed'] = (g, fx) => {
  // glow rays
  for (const a of [-90, -60, -30, 0, 30, 60, 90, 120, 150, 180, 210, 240]) {
    const rad = (a * Math.PI) / 180;
    for (let r = 9; r <= 13; r++) {
      fx.push([Math.round(16 + Math.cos(rad) * r), Math.round(17 + Math.sin(rad) * r), r === 13 ? C.goldLight : C.goldDark]);
    }
  }
  // seed
  poly(g, [[16, 8], [22, 14], [21, 23], [16, 28], [11, 23], [10, 14]], C.gold);
  poly(g, [[16, 9], [20, 14], [19, 22], [16, 26], [13, 22], [12, 14]], C.brass);
  poly(g, [[16, 11], [18, 15], [18, 21], [16, 24], [14, 21], [14, 15]], C.tealDark);
  poly(g, [[16, 13], [17, 16], [17, 20], [16, 22], [15, 20], [15, 16]], C.teal);
  line(g, 15, 12, 13, 19, C.goldLight);
  set(g, 16, 15, C.white);
  // sprout
  stroke(g, [[16, 9], [16, 4]], 2, C.tealMid);
  poly(g, [[16, 5], [11, 3], [10, 6], [15, 8]], C.teal);
  poly(g, [[16, 4], [20, 1], [22, 4], [17, 7]], C.teal);
  set(g, 12, 4, C.goldLight); set(g, 20, 3, C.goldLight);
  // roots
  stroke(g, [[16, 27], [12, 30], [8, 30]], 2, C.tealDark);
  stroke(g, [[16, 27], [20, 30], [25, 31]], 2, C.tealDark);
  stroke(g, [[16, 28], [16, 31]], 1, C.goldDark);
  fx.push([8, 12, C.goldLight], [24, 18, C.teal], [16, 2, C.goldLight]);
};

RELIC_DRAWERS['perfect-mana-core'] = (g, fx) => {
  // arcane orb
  disc(g, 16, 16, 8, C.arcaneDark);
  disc(g, 16, 16, 7, C.arcane);
  disc(g, 15, 15, 4, C.arcaneLight);
  disc(g, 14, 14, 2, C.white);
  set(g, 18, 19, C.arcaneDark);
  // gold cage
  rect(g, 11, 3, 11, 3, C.goldDark);
  hline(g, 12, 21, 3, C.gold);
  rect(g, 11, 26, 11, 3, C.goldDark);
  hline(g, 12, 21, 27, C.gold);
  for (const x of [8, 16, 24]) {
    rect(g, x - 1, 6, 3, 20, C.goldDark);
    vline(g, x, 7, 25, C.gold);
    set(g, x, 7, C.goldLight);
  }
  ellipseRing(g, 16, 16, 9, 7, 1.5, C.gold);
  arcPix(g, 16, 16, 8.5, 190, 280, C.goldLight);
  // caps and rivets
  set(g, 12, 4, C.goldLight); set(g, 20, 4, C.goldDark);
  set(g, 12, 27, C.goldDark); set(g, 20, 27, C.goldLight);
  // arcane sparks
  fx.push([16, 2, C.arcaneLight], [29, 10, C.arcane], [3, 20, C.arcaneLight], [26, 28, C.arcane], [16, 16, C.white]);
};

RELIC_DRAWERS['possessed-bellows'] = (g, fx) => {
  // leather fan bag, wide at the handles, narrowing to the nozzle
  poly(g, [[5, 8], [22, 14], [23, 16], [22, 18], [5, 24], [3, 16]], C.leatherDark);
  poly(g, [[5, 9], [21, 14], [22, 16], [21, 18], [5, 23], [4, 16]], C.leather);
  // accordion pleats radiating from the hinge
  for (const [x, y] of [[5, 10], [5, 13], [5, 16], [5, 19], [5, 22]]) {
    line(g, 22, 16, x, y, C.leatherDark);
    set(g, x + 1, y, C.leatherLight);
  }
  for (let i = 0; i < 4; i++) {
    line(g, 21 - i * 4, 15 - i, 20 - i * 4, 17 + i, C.leatherDark);
  }
  // top and bottom wooden boards meeting at the hinge
  poly(g, [[4, 7], [20, 13], [20, 16], [4, 14]], C.wood);
  poly(g, [[5, 8], [19, 13], [19, 15], [5, 13]], C.woodLight);
  poly(g, [[4, 25], [20, 19], [20, 16], [4, 18]], C.woodDark);
  poly(g, [[5, 24], [19, 19], [19, 17], [5, 19]], C.wood);
  // handle extensions
  poly(g, [[4, 7], [1, 8], [1, 11], [4, 14]], C.woodDark);
  poly(g, [[4, 25], [1, 24], [1, 21], [4, 18]], C.woodDark);
  ring(g, 2, 16, 2, 1, C.woodDark);
  set(g, 2, 12, C.leatherLight);
  // hinge and nozzle
  disc(g, 22, 16, 2.5, C.brassDark);
  disc(g, 22, 16, 1.2, C.brass);
  set(g, 21, 15, C.goldLight);
  poly(g, [[22, 14], [27, 15], [30, 16], [27, 17], [22, 18]], C.brassDark);
  poly(g, [[23, 15], [27, 16], [28, 16], [26, 16], [23, 17]], C.brass);
  ring(g, 27, 16, 2, 1, C.gold);
  hline(g, 23, 25, 15, C.goldLight);
  // ghost face on the top board
  set(g, 11, 11, C.teal); set(g, 15, 11, C.teal);
  set(g, 11, 12, C.tealDark); set(g, 15, 12, C.tealDark);
  line(g, 12, 13, 14, 13, C.ink);
  set(g, 13, 12, C.tealMid);
  // possessed breath
  for (let i = 0; i < 6; i++) fx.push([30 - i, 10 - i, i % 2 ? C.ember : C.emberDark]);
  fx.push([30, 20, C.ember], [28, 22, C.emberLight], [3, 5, C.ash], [26, 4, C.ash]);
};

RELIC_DRAWERS['royal-change'] = (g, fx) => {
  // coin purse
  poly(g, [[8, 12], [24, 12], [26, 20], [21, 28], [11, 28], [6, 20]], C.goldDark);
  poly(g, [[9, 13], [23, 13], [24, 20], [20, 26], [12, 26], [8, 20]], C.gold);
  poly(g, [[17, 14], [23, 13], [24, 20], [20, 26], [17, 26]], C.brass);
  // drawstring neck
  rect(g, 10, 10, 12, 4, C.goldDark);
  hline(g, 10, 21, 10, C.goldLight);
  hline(g, 10, 21, 12, C.brassDark);
  // crown emblem on the purse
  poly(g, [[11, 22], [11, 18], [13, 19], [16, 17], [19, 19], [21, 18], [21, 22]], C.goldLight);
  rect(g, 11, 21, 11, 2, C.goldDark);
  set(g, 13, 20, C.blood); set(g, 16, 19, C.rare); set(g, 19, 20, C.blood);
  // drawstring cord
  stroke(g, [[10, 11], [5, 8]], 1, C.goldLight);
  stroke(g, [[22, 11], [27, 8]], 1, C.goldLight);
  // spilling coins
  coin(g, 7, 26, 3, { face: C.gold, edge: C.goldDark });
  coin(g, 26, 25, 3, { face: C.gold, edge: C.goldDark });
  coin(g, 15, 29, 3, { face: C.goldLight, edge: C.goldDark, mark: true });
  fx.push([6, 8, C.goldLight], [28, 14, C.gold], [16, 15, C.white], [9, 16, C.goldLight]);
};

RELIC_DRAWERS['unyielding-cornerstone'] = (g, fx) => {
  // stone block
  poly(g, [[7, 11], [19, 6], [29, 11], [17, 17]], C.stoneLight);
  poly(g, [[7, 11], [17, 17], [17, 29], [7, 23]], C.stone);
  poly(g, [[17, 17], [29, 11], [29, 23], [17, 29]], C.stoneDark);
  // bevels
  line(g, 8, 12, 17, 7, C.boneDark);
  line(g, 18, 18, 28, 12, C.ink);
  line(g, 8, 12, 8, 22, C.boneDark);
  // gold corner brackets
  for (const [x, y, dx, dy] of [[7, 11, 1, 1], [29, 11, -1, 1], [7, 23, 1, -1], [17, 29, 1, -1], [29, 23, -1, -1], [17, 17, 1, 1]]) {
    line(g, x, y, x + dx * 4, y + dy * 2, C.gold);
    set(g, x, y, C.goldLight);
  }
  rect(g, 9, 14, 6, 2, C.goldDark);
  hline(g, 9, 14, 14, C.gold);
  // rune on the front
  const rune = [[12, 18], [15, 20], [12, 22], [12, 18]];
  for (let i = 0; i + 1 < rune.length; i++) line(g, rune[i][0], rune[i][1], rune[i + 1][0], rune[i + 1][1], C.teal);
  vline(g, 12, 18, 22, C.tealDark);
  set(g, 13, 20, C.teal);
  // unyielding base rubble
  poly(g, [[4, 28], [8, 26], [10, 30], [5, 30]], C.stoneDark);
  poly(g, [[24, 29], [29, 27], [29, 31], [23, 31]], C.stoneDark);
  fx.push([16, 30, C.teal], [6, 10, C.goldLight], [30, 8, C.gold], [16, 5, C.rareLight]);
};

RELIC_DRAWERS['dragon-heart'] = (g, fx) => {
  heartShape(g, 16, 17, 1.08, { col: C.blood, light: C.bloodLight, dark: C.bloodDark });
  // horns
  poly(g, [[11, 10], [8, 4], [11, 3], [14, 9]], C.bone);
  poly(g, [[21, 10], [24, 4], [21, 3], [18, 9]], C.bone);
  set(g, 9, 4, C.goldLight); set(g, 23, 4, C.goldLight);
  // scales
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const x = 11 + j * 4 + (i % 2) * 2;
      const y = 13 + i * 3;
      if ((x - 16) ** 2 / 9 + (y - 17) ** 2 / 10 > 1.1) continue;
      arcPix(g, x, y, 1.4, 200, 340, C.goldDark);
      set(g, x, y, C.emberDark);
    }
  }
  // molten veins
  line(g, 12, 12, 15, 17, C.gold);
  line(g, 15, 17, 13, 22, C.goldDark);
  line(g, 20, 13, 18, 18, C.ember);
  // side spikes
  poly(g, [[7, 18], [4, 16], [6, 22]], C.goldDark);
  poly(g, [[25, 18], [28, 16], [26, 22]], C.goldDark);
  // ember core
  set(g, 16, 20, C.ember); set(g, 17, 21, C.emberLight); set(g, 15, 21, C.goldLight);
  fx.push([16, 8, C.ember], [9, 13, C.goldLight], [24, 24, C.emberDark], [16, 29, C.gold]);
};

RELIC_DRAWERS['seal-of-twins'] = (g, fx) => {
  // two mirrored signet rings
  for (const [cx, dir] of [[9, -1], [23, 1]]) {
    ellipseRing(g, cx, 20, 6, 7, 3, C.goldDark);
    ellipseRing(g, cx, 20, 5, 6, 1.5, C.gold);
    arcPix(g, cx, 20, 5.5, 190, 280, C.goldLight);
    // bezel
    const bx = cx - 4;
    poly(g, [[bx, 8], [bx + 8, 8], [bx + 9, 11], [bx + 8, 15], [bx, 15], [bx - 1, 11]], C.goldDark);
    poly(g, [[bx + 1, 9], [bx + 7, 9], [bx + 8, 11], [bx + 7, 14], [bx + 1, 14], [bx, 11]], C.gold);
    disc(g, bx + 4, 11, 2, C.rareDark);
    set(g, bx + 3, 10, C.rareLight);
    set(g, bx + 1, 11, C.goldLight);
    // neck
    rect(g, cx - 1, 15, 3, 3, C.goldDark);
  }
  // tiny chain linking the twins
  chainLink(g, 16, 25, 2, 1.5, C.gold, C.goldDark);
  // mirrored engraving
  set(g, 13, 21, C.goldLight); set(g, 19, 21, C.goldLight);
  fx.push([7, 6, C.goldLight], [25, 6, C.goldLight], [16, 16, C.rareLight], [16, 29, C.gold]);
};

RELIC_DRAWERS['undertakers-ledger'] = (g, fx) => {
  // closed ledger
  rect(g, 6, 8, 21, 20, C.leatherDark);
  rect(g, 7, 9, 19, 18, C.leather);
  // spine
  rect(g, 6, 8, 3, 20, C.woodDark);
  vline(g, 8, 9, 26, C.leatherLight);
  // page edges
  rect(g, 26, 10, 2, 16, C.boneDark);
  for (let y = 11; y < 25; y += 2) set(g, 27, y, C.bone);
  // gold border and corners
  rect(g, 9, 10, 16, 1, C.goldDark);
  rect(g, 9, 25, 16, 1, C.goldDark);
  hline(g, 9, 24, 10, C.gold);
  for (const [x, y] of [[9, 10], [24, 10], [9, 25], [24, 25]]) set(g, x, y, C.goldLight);
  // skull emblem
  skullAt(g, 16, 17, 0.85, { bone: C.bone, dark: C.boneDark, glow: C.rare });
  // bone quill
  stroke(g, [[23, 26], [27, 13]], 1, C.boneDark);
  for (let y = 15; y <= 23; y += 3) line(g, 26, y, 24, y + 2, C.bone);
  set(g, 27, 12, C.boneLight);
  // clasp
  rect(g, 24, 18, 3, 4, C.goldDark);
  set(g, 25, 19, C.goldLight);
  fx.push([5, 7, C.gold], [29, 22, C.goldLight], [12, 28, C.rareLight]);
};

RELIC_DRAWERS['undying-wick'] = (g, fx) => {
  // halo/rays
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    for (let r = 9; r <= 12; r++) {
      fx.push([Math.round(16 + Math.cos(rad) * r), Math.round(13 + Math.sin(rad) * r), r === 12 ? C.goldLight : C.goldDark]);
    }
  }
  // candle
  rect(g, 11, 19, 10, 9, C.boneDark);
  rect(g, 12, 19, 8, 8, C.bone);
  vline(g, 12, 20, 26, C.boneLight);
  // drips
  poly(g, [[11, 22], [13, 22], [13, 27], [11, 26]], C.bone);
  poly(g, [[19, 21], [21, 21], [21, 26], [19, 25]], C.bone);
  set(g, 14, 23, C.boneDark); set(g, 18, 20, C.boneDark);
  // wick
  vline(g, 16, 15, 19, C.ink);
  set(g, 16, 15, C.emberDark);
  // eternal flame
  flame(g, 16, 11, 1.15, { outer: C.ember, mid: C.gold, core: C.goldLight });
  // iron drip pan
  rect(g, 7, 27, 18, 3, C.steelDark);
  hline(g, 8, 23, 27, C.steel);
  set(g, 9, 28, C.brass);
  fx.push([16, 2, C.goldLight], [10, 8, C.ember], [23, 9, C.emberLight], [16, 18, C.white]);
};

RELIC_DRAWERS['dragon-signet'] = (g, fx) => {
  // ring
  ellipseRing(g, 16, 21, 9, 7, 4, C.goldDark);
  ellipseRing(g, 16, 21, 8, 6, 2, C.gold);
  arcPix(g, 16, 21, 7.5, 190, 280, C.goldLight);
  // bezel
  poly(g, [[9, 4], [23, 4], [25, 7], [23, 13], [9, 13], [7, 7]], C.goldDark);
  poly(g, [[10, 5], [22, 5], [23, 7], [22, 11], [10, 11], [9, 7]], C.gold);
  // dragon head crest
  poly(g, [[11, 9], [12, 6], [15, 7], [18, 6], [20, 8], [19, 10], [15, 11]], C.steelDark);
  poly(g, [[12, 8], [14, 7], [17, 7], [18, 9], [15, 10]], C.steel);
  set(g, 13, 8, C.ember); set(g, 12, 8, C.emberLight);
  poly(g, [[10, 6], [8, 3], [12, 5]], C.goldDark);
  poly(g, [[20, 6], [24, 3], [21, 7]], C.goldDark);
  // wing flanges
  poly(g, [[7, 7], [4, 9], [8, 11]], C.gold);
  poly(g, [[25, 7], [28, 9], [24, 11]], C.gold);
  // neck
  rect(g, 13, 12, 6, 3, C.goldDark);
  // gem sparks
  fx.push([16, 3, C.goldLight], [6, 15, C.rare], [26, 22, C.goldLight], [16, 28, C.rareLight]);
};

RELIC_DRAWERS['oracle-die'] = (g, fx) => {
  // die faces
  poly(g, [[9, 11], [16, 5], [28, 7], [22, 12]], C.gold);
  rect(g, 9, 11, 14, 14, C.goldLight);
  poly(g, [[22, 12], [28, 7], [28, 20], [22, 25]], C.goldDark);
  hline(g, 9, 22, 11, C.white);
  line(g, 22, 12, 22, 25, C.goldDark);
  // pips on top and side
  for (const [x, y] of [[14, 9], [18, 9], [23, 9]]) {
    set(g, x, y, C.goldDark); set(g, x, y + 1, C.goldDark);
  }
  for (const [x, y] of [[24, 14], [26, 18]]) {
    set(g, x, y, C.goldDark); set(g, x + 1, y, C.goldDark);
  }
  // eye on the front face
  poly(g, [[10, 18], [13, 15], [16, 15], [19, 15], [22, 18], [19, 21], [16, 21], [13, 21]], C.arcaneDark);
  poly(g, [[11, 18], [14, 16], [16, 16], [18, 16], [21, 18], [18, 20], [16, 20], [14, 20]], C.arcane);
  disc(g, 16, 18, 2, C.arcaneLight);
  set(g, 16, 18, C.ink);
  set(g, 15, 17, C.white);
  // arcane glow
  for (const [x, y] of [[28, 4], [5, 7], [3, 20], [26, 27]]) fx.push([x, y, C.arcane]);
  fx.push([16, 3, C.goldLight], [30, 14, C.arcaneLight]);
};

RELIC_DRAWERS['lifetime-contract'] = (g, fx) => {
  // rolled contract, diagonal
  stroke(g, [[6, 27], [25, 8]], 11, C.boneDark);
  stroke(g, [[6, 27], [25, 8]], 9, C.bone);
  stroke(g, [[7, 26], [24, 9]], 2, C.boneLight);
  // rolled ends
  for (const [x, y] of [[5, 28], [26, 7]]) {
    disc(g, x, y, 4.5, C.goldDark);
    disc(g, x, y, 3.5, C.gold);
    set(g, x - 1, y - 1, C.goldLight);
  }
  // parchment lines
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const cx = 6 + (25 - 6) * t;
    const cy = 27 - (27 - 8) * t;
    line(g, cx - 2, cy - 2, cx + 2, cy + 2, C.boneDark);
  }
  // red ribbon across
  const rx = 16, ry = 17;
  line(g, rx - 4, ry - 3, rx + 4, ry + 3, C.bloodDark);
  line(g, rx - 4, ry - 2, rx + 4, ry + 4, C.blood);
  // wax seal
  disc(g, 16, 18, 3.5, C.bloodDark);
  disc(g, 16, 18, 2.5, C.blood);
  ring(g, 16, 18, 2, 1, C.goldDark);
  set(g, 16, 17, C.gold); set(g, 16, 18, C.rare);
  // quill
  stroke(g, [[25, 8], [29, 3]], 1, C.boneDark);
  line(g, 27, 6, 29, 6, C.bone);
  line(g, 28, 5, 29, 4, C.boneLight);
  // seal ribbon tails
  poly(g, [[19, 20], [22, 24], [20, 26], [18, 21]], C.blood);
  poly(g, [[14, 21], [12, 26], [14, 25], [16, 21]], C.bloodDark);
  fx.push([8, 20, C.goldLight], [22, 12, C.rare], [28, 24, C.gold]);
};

// --------------------------------------------------------------- consumables
const CONSUMABLE_DRAWERS = {};

CONSUMABLE_DRAWERS['cracked_dragon_scale'] = (g, fx) => {
  // large scale
  poly(g, [[16, 2], [25, 7], [27, 17], [22, 26], [16, 30], [10, 26], [5, 17], [7, 7]], C.goldDark);
  poly(g, [[16, 4], [23, 8], [25, 17], [21, 24], [16, 27], [11, 24], [7, 17], [9, 8]], C.brass);
  poly(g, [[16, 4], [21, 8], [16, 12], [12, 9], [9, 8]], C.brassLight);
  // scale ridges
  for (const [x, y] of [[11, 24], [8, 17], [9, 8], [16, 4], [23, 8], [24, 17], [21, 24]]) {
    line(g, 16, 27, x, y, C.goldDark);
  }
  line(g, 16, 27, 16, 5, C.goldLight);
  // cracked edge
  poly(g, [[22, 8], [27, 17], [23, 15], [24, 11]], C.goldDark);
  // jagged crack
  const crack = [[22, 6], [19, 11], [21, 15], [18, 19], [16, 24]];
  for (let i = 0; i + 1 < crack.length; i++) line(g, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], C.ink);
  set(g, 20, 10, C.ember); set(g, 20, 14, C.emberLight); set(g, 17, 20, C.emberDark);
  // rim highlight
  line(g, 10, 8, 7, 16, C.goldLight);
  line(g, 16, 27, 21, 24, C.goldLight);
  fx.push([26, 5, C.goldLight], [29, 12, C.ember], [5, 22, C.gold], [16, 29, C.goldLight]);
};

CONSUMABLE_DRAWERS['regret_clockwork'] = (g, fx) => {
  gear(g, 14, 18, 7, 8, { col: C.brass, dark: C.brassDark, light: C.brassLight, hub: C.soot });
  // clock face in the hub
  disc(g, 14, 18, 3, C.boneDark);
  disc(g, 14, 18, 2, C.bone);
  line(g, 14, 18, 14, 15, C.ink);
  line(g, 14, 18, 16, 19, C.ink);
  set(g, 14, 18, C.blood);
  // rewind arc and arrow
  const pts = [];
  for (let a = 200; a >= -70; a -= 4) {
    const rad = (a * Math.PI) / 180;
    pts.push([Math.round(14 + Math.cos(rad) * 11), Math.round(18 + Math.sin(rad) * 11)]);
  }
  for (const [x, y] of pts) fx.push([x, y, C.teal]);
  // arrowhead at the tail of the arc
  fx.push([2, 15, C.teal], [3, 14, C.teal], [3, 17, C.teal], [4, 16, C.tealDark]);
  // backward ticks
  fx.push([26, 7, C.rare], [6, 8, C.rareLight], [27, 23, C.rareDark]);
  fx.push([9, 24, C.goldLight], [20, 11, C.goldLight]);
};

CONSUMABLE_DRAWERS['red_chalk'] = (g, fx) => {
  // chalk stick
  stroke(g, [[7, 28], [20, 8]], 6, C.bloodDark);
  stroke(g, [[7, 28], [20, 8]], 4, C.blood);
  stroke(g, [[8, 27], [20, 9]], 1, C.pink);
  poly(g, [[20, 8], [22, 5], [23, 8], [21, 10]], C.pinkLight);
  // paper wrapper
  rect(g, 10, 19, 7, 4, C.boneDark);
  rect(g, 11, 20, 5, 2, C.bone);
  hline(g, 11, 15, 20, C.boneLight);
  set(g, 13, 21, C.bloodDark);
  // chalk dust
  fx.push([5, 27, C.pink], [9, 29, C.blood], [4, 24, C.bloodDark], [13, 27, C.pinkLight]);
  // chalk line on the ground
  for (let x = 6; x <= 14; x++) fx.push([x, 30, C.blood]);
  fx.push([16, 30, C.pink], [19, 30, C.bloodDark]);
  fx.push([24, 6, C.pink], [22, 4, C.white]);
};

CONSUMABLE_DRAWERS['powder_pouch'] = (g, fx) => {
  // pouch
  poly(g, [[8, 14], [24, 14], [26, 21], [21, 28], [11, 28], [6, 21]], C.leather);
  poly(g, [[18, 15], [24, 14], [26, 21], [21, 28], [17, 27]], C.leatherDark);
  line(g, 10, 15, 8, 21, C.leatherLight);
  line(g, 11, 16, 10, 26, C.leatherLight);
  // neck and tie
  rect(g, 11, 10, 10, 5, C.leatherDark);
  hline(g, 11, 20, 10, C.leatherLight);
  hline(g, 10, 21, 12, C.brass);
  // burst of powder
  for (const [x, y, r, c] of [[12, 6, 3, C.ash], [18, 4, 4, C.bone], [24, 7, 3, C.ash], [26, 11, 2, C.ashDark], [7, 9, 2, C.boneDark]]) {
    disc(g, x, y, r, c);
  }
  disc(g, 16, 9, 3, C.boneLight);
  set(g, 16, 6, C.white);
  // powder spilling
  poly(g, [[14, 12], [19, 12], [18, 17], [15, 17]], C.boneDark);
  fx.push([6, 6, C.ash], [28, 5, C.bone], [29, 14, C.ash], [4, 16, C.boneDark], [21, 2, C.white]);
};

CONSUMABLE_DRAWERS['cold_star_shard'] = (g, fx) => {
  // eight-point ice shard
  poly(g, [
    [16, 1], [19, 11], [28, 7], [21, 14], [31, 17], [21, 20],
    [27, 28], [19, 23], [16, 31], [13, 23], [5, 28], [11, 20],
    [1, 17], [11, 14], [4, 7], [13, 11],
  ], C.rareDark);
  poly(g, [
    [16, 3], [18, 12], [26, 9], [20, 15], [28, 17], [20, 19],
    [25, 26], [18, 22], [16, 28], [14, 22], [7, 26], [12, 19],
    [4, 17], [12, 15], [6, 9], [14, 12],
  ], C.rare);
  poly(g, [[16, 5], [18, 13], [16, 27], [14, 13]], C.rareLight);
  poly(g, [[8, 16], [15, 14], [16, 17], [11, 19]], C.teal);
  poly(g, [[24, 16], [17, 14], [16, 17], [21, 19]], C.tealMid);
  line(g, 16, 5, 16, 26, C.white);
  fx.push([9, 6, C.teal], [24, 25, C.teal], [4, 24, C.rare], [29, 10, C.white], [16, 30, C.rareLight]);
};

CONSUMABLE_DRAWERS['incense_of_oblivion'] = (g, fx) => {
  // bowl holder
  poly(g, [[9, 23], [23, 23], [21, 29], [11, 29]], C.brassDark);
  poly(g, [[10, 24], [22, 24], [20, 28], [12, 28]], C.brass);
  hline(g, 10, 21, 24, C.goldLight);
  rect(g, 14, 28, 5, 2, C.steelDark);
  // stick
  rect(g, 15, 12, 2, 12, C.boneDark);
  vline(g, 15, 13, 23, C.bone);
  // ember tip
  set(g, 16, 11, C.ember);
  set(g, 15, 12, C.emberLight);
  set(g, 16, 10, C.emberDark);
  // violet smoke curls
  const curls = [
    [[16, 8], [18, 5], [16, 3], [13, 2], [12, 5]],
    [[17, 7], [20, 4], [23, 3], [24, 6], [22, 8]],
  ];
  for (const curl of curls) {
    for (let i = 0; i + 1 < curl.length; i++) {
      const [x0, y0] = curl[i], [x1, y1] = curl[i + 1];
      for (let t = 0; t <= 1; t += 0.2) fx.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, i % 2 ? C.arcaneLight : C.pink]);
    }
  }
  fx.push([10, 9, C.arcane], [22, 10, C.pink], [16, 1, C.arcaneLight], [6, 20, C.arcaneDark]);
};

CONSUMABLE_DRAWERS['ghost_delivery_note'] = (g, fx) => {
  // note
  poly(g, [[6, 4], [22, 4], [26, 8], [26, 28], [6, 28]], C.boneDark);
  poly(g, [[7, 5], [21, 5], [25, 9], [25, 27], [7, 27]], C.bone);
  poly(g, [[21, 5], [25, 9], [21, 9]], C.boneDark);
  line(g, 8, 10, 23, 10, C.boneDark);
  line(g, 8, 12, 23, 12, C.boneDark);
  // small ghost
  poly(g, [[16, 14], [20, 16], [21, 21], [19, 20], [17, 22], [15, 20], [13, 21], [12, 16]], C.teal);
  poly(g, [[16, 15], [19, 17], [19, 20], [17, 19], [16, 21], [14, 19], [13, 17]], C.tealMid);
  set(g, 15, 17, C.ink); set(g, 18, 17, C.ink);
  // crate
  rect(g, 11, 23, 10, 4, C.woodDark);
  rect(g, 12, 23, 8, 3, C.wood);
  line(g, 12, 23, 19, 25, C.leatherDark);
  line(g, 20, 23, 13, 25, C.leatherDark);
  // teal seal
  disc(g, 23, 24, 2, C.tealDark);
  set(g, 22, 23, C.teal);
  // ghostly wisps
  fx.push([7, 8, C.teal], [27, 13, C.tealMid], [5, 22, C.tealDark], [26, 20, C.teal], [16, 30, C.teal]);
};

// -------------------------------------------------------------- achievements
const ACHIEVEMENT_DRAWERS = {};

function medallion(g, shape, o = {}) {
  const rim = o.rim ?? C.gold;
  const rimDark = o.rimDark ?? C.goldDark;
  const field = o.field ?? C.soot;
  if (shape === 'round') {
    disc(g, 16, 16, 14, rimDark);
    disc(g, 16, 16, 13, rim);
    disc(g, 16, 16, 11.5, field);
    ring(g, 16, 16, 11.5, 10.5, rimDark);
    arcPix(g, 16, 16, 13, 190, 280, o.shine ?? C.goldLight);
    for (let a = 30; a < 360; a += 60) {
      const rad = (a * Math.PI) / 180;
      set(g, Math.round(16 + Math.cos(rad) * 12.2), Math.round(16 + Math.sin(rad) * 12.2), rimDark);
    }
  } else {
    poly(g, [[3, 4], [29, 4], [29, 18], [16, 30], [3, 18]], rimDark);
    poly(g, [[4, 5], [28, 5], [28, 18], [16, 29], [4, 18]], rim);
    poly(g, [[6, 8], [26, 8], [26, 17], [16, 26], [6, 17]], field);
    line(g, 5, 7, 5, 17, o.shine ?? C.goldLight);
    line(g, 6, 8, 15, 9, o.shine ?? C.goldLight);
    for (const [x, y] of [[5, 6], [27, 6], [5, 16], [27, 16]]) {
      set(g, x, y, rimDark);
      set(g, x, y + 1, rim);
    }
  }
}

ACHIEVEMENT_DRAWERS['mastery_citadel'] = (g, fx) => {
  medallion(g, 'round', { field: C.stoneDark });
  // keep
  rect(g, 8, 10, 17, 14, C.stoneDark);
  rect(g, 9, 11, 15, 12, C.stone);
  for (const [x, y] of [[8, 7], [14, 6], [21, 7]]) {
    rect(g, x, y, 4, 4, C.stoneDark);
    hline(g, x, x + 3, y, C.stoneLight);
  }
  // gate
  poly(g, [[13, 24], [13, 18], [16, 15], [19, 18], [19, 24]], C.soot);
  poly(g, [[14, 24], [14, 19], [16, 17], [18, 19], [18, 24]], C.stoneDark);
  // sword in front
  sword(g, { cx: 16, tip: 8, guardY: 19, half: 2, guardHalf: 4, gripLen: 3, blade: C.bright, light: C.white, guard: C.gold, grip: C.leather });
  fx.push([7, 8, C.goldLight], [24, 9, C.rareLight], [6, 25, C.stoneLight]);
};

ACHIEVEMENT_DRAWERS['mastery_holy'] = (g, fx) => {
  medallion(g, 'round', { field: C.arcaneDark });
  // halo
  ring(g, 16, 8, 5, 4, C.gold);
  arcPix(g, 16, 8, 4.5, 190, 280, C.goldLight);
  // wings
  poly(g, [[8, 15], [12, 10], [13, 14], [11, 18], [8, 19]], C.boneLight);
  poly(g, [[24, 15], [20, 10], [19, 14], [21, 18], [24, 19]], C.boneLight);
  line(g, 10, 13, 8, 17, C.boneDark);
  line(g, 22, 13, 24, 17, C.boneDark);
  // radiant sword
  sword(g, { cx: 16, tip: 7, guardY: 19, half: 2, guardHalf: 5, gripLen: 3, blade: C.bright, light: C.white, guard: C.gold, grip: C.boneDark, pommel: C.gold });
  set(g, 16, 20, C.rare);
  // rays
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    for (let r = 12; r <= 14; r++) fx.push([Math.round(16 + Math.cos(rad) * r), Math.round(16 + Math.sin(rad) * r), C.goldLight]);
  }
};

ACHIEVEMENT_DRAWERS['mastery_sawblade'] = (g, fx) => {
  medallion(g, 'round', { field: C.woodDark });
  sword(g, { cx: 15, tip: 6, guardY: 19, half: 2, guardHalf: 5, gripLen: 3, blade: C.steel, light: C.bright, guard: C.brass, grip: C.leather });
  // saw teeth on the right edge
  for (let y = 9; y <= 16; y += 3) {
    poly(g, [[18, y], [21, y + 1], [18, y + 2]], C.bright);
    set(g, 20, y + 1, C.steelDark);
  }
  // saw back spine
  line(g, 12, 8, 12, 18, C.steelDark);
  set(g, 16, 15, C.brassLight);
  fx.push([24, 8, C.steelMid], [7, 24, C.brass], [22, 23, C.steel]);
};

ACHIEVEMENT_DRAWERS['mastery_dragonfang'] = (g, fx) => {
  medallion(g, 'round', { field: C.bloodDark });
  // curved fang blade
  poly(g, [[19, 4], [24, 9], [24, 16], [20, 23], [15, 26], [17, 19], [18, 12], [16, 7]], C.bone);
  poly(g, [[19, 5], [22, 9], [22, 15], [19, 21], [17, 23], [18, 18], [19, 12], [17, 8]], C.boneLight);
  poly(g, [[20, 11], [22, 15], [20, 21], [18, 22], [19, 17], [19, 13]], C.boneDark);
  // fang radial ridges
  line(g, 19, 7, 21, 13, C.boneDark);
  // hilt
  rect(g, 12, 23, 10, 3, C.goldDark);
  hline(g, 12, 21, 23, C.gold);
  box(g, 14, 26, 4, 3, C.leather, C.ink);
  disc(g, 16, 30, 2, C.gold);
  // dragon eye guard
  disc(g, 20, 20, 2, C.emberDark);
  set(g, 20, 19, C.emberLight);
  set(g, 20, 20, C.ink);
  fx.push([24, 5, C.ember], [8, 12, C.goldLight], [16, 28, C.emberLight]);
};

ACHIEVEMENT_DRAWERS['mastery_runeblade'] = (g, fx) => {
  medallion(g, 'round', { field: C.arcaneDark });
  sword(g, { cx: 16, tip: 6, guardY: 19, half: 3, guardHalf: 5, gripLen: 3, blade: C.bright, light: C.white, dark: C.steelMid, guard: C.gold, grip: C.leather });
  // dark runes carved into the bright blade
  set(g, 16, 8, C.arcaneDark);
  set(g, 15, 9, C.rareDark); set(g, 17, 9, C.rareDark);
  set(g, 16, 10, C.arcaneDark);
  line(g, 14, 12, 16, 14, C.rareDark);
  line(g, 18, 12, 16, 14, C.rareDark);
  vline(g, 16, 14, 17, C.arcaneDark);
  line(g, 14, 18, 18, 18, C.rareDark);
  set(g, 16, 17, C.arcaneDark);
  set(g, 16, 9, C.arcane);
  set(g, 16, 15, C.rare);
  // arcane glow along the edges
  fx.push([12, 9, C.arcane], [20, 9, C.arcane], [12, 14, C.arcaneLight], [20, 14, C.arcaneLight]);
  fx.push([7, 8, C.arcane], [25, 10, C.arcaneLight], [8, 24, C.arcane], [24, 23, C.arcaneLight], [16, 4, C.white]);
};

ACHIEVEMENT_DRAWERS['mastery_splitblade'] = (g, fx) => {
  medallion(g, 'round', { field: C.stoneDark });
  // two blades splitting from one hilt
  poly(g, [[15, 22], [10, 5], [13, 4], [17, 22]], C.bright);
  poly(g, [[17, 22], [22, 5], [19, 4], [15, 22]], C.steel);
  line(g, 13, 6, 15, 19, C.white);
  line(g, 19, 6, 17, 19, C.bright);
  // hilt
  rect(g, 10, 22, 12, 2, C.goldDark);
  hline(g, 10, 21, 22, C.gold);
  box(g, 14, 24, 4, 3, C.leather, C.ink);
  disc(g, 16, 28, 2, C.gold);
  set(g, 12, 23, C.goldLight); set(g, 20, 23, C.goldDark);
  fx.push([16, 2, C.goldLight], [7, 14, C.rare], [25, 17, C.rareLight]);
};

ACHIEVEMENT_DRAWERS['mastery_world_tree'] = (g, fx) => {
  medallion(g, 'round', { field: C.glass });
  // canopy
  for (const [x, y, r, c] of [[16, 7, 4, C.teal], [11, 9, 3, C.tealDark], [21, 9, 3, C.tealDark], [13, 13, 3, C.tealMid], [19, 13, 3, C.tealMid]]) {
    disc(g, x, y, r, c);
  }
  // trunk and branches
  stroke(g, [[16, 25], [16, 9]], 3, C.wood);
  stroke(g, [[16, 15], [10, 10]], 2, C.woodDark);
  stroke(g, [[16, 13], [22, 9]], 2, C.woodDark);
  stroke(g, [[16, 19], [22, 16]], 2, C.wood);
  // roots
  stroke(g, [[16, 25], [11, 28]], 2, C.woodDark);
  stroke(g, [[16, 25], [21, 28]], 2, C.woodDark);
  // sword hilt at the base
  rect(g, 10, 25, 13, 2, C.goldDark);
  hline(g, 10, 22, 25, C.gold);
  box(g, 14, 27, 4, 2, C.leather, C.ink);
  disc(g, 16, 30, 1.5, C.gold);
  // leaves and sparkles
  set(g, 16, 5, C.goldLight); set(g, 9, 8, C.teal); set(g, 23, 7, C.teal);
  fx.push([5, 16, C.teal], [27, 15, C.tealMid], [16, 2, C.rareLight], [12, 20, C.goldLight]);
};

ACHIEVEMENT_DRAWERS['mastery_fishblade'] = (g, fx) => {
  medallion(g, 'round', { field: C.glass });
  // fish body / blade
  poly(g, [[6, 16], [10, 10], [18, 9], [24, 13], [27, 16], [24, 19], [18, 23], [10, 22]], C.teal);
  poly(g, [[6, 16], [10, 11], [16, 10], [16, 16], [10, 18]], C.tealMid);
  poly(g, [[18, 10], [24, 13], [27, 16], [24, 19], [18, 22]], C.tealDark);
  // tail
  poly(g, [[6, 16], [2, 11], [4, 16], [2, 21]], C.tealDark);
  // fins
  poly(g, [[14, 10], [17, 5], [19, 11]], C.tealDark);
  poly(g, [[12, 21], [15, 26], [17, 21]], C.tealMid);
  // eye and gills
  set(g, 21, 14, C.boneLight);
  set(g, 22, 14, C.ink);
  line(g, 18, 11, 18, 21, C.tealDark);
  line(g, 17, 12, 17, 20, C.teal);
  // sword hilt at the tail
  rect(g, 5, 12, 2, 9, C.goldDark);
  vline(g, 5, 12, 20, C.gold);
  box(g, 2, 14, 4, 4, C.leather, C.ink);
  // scales
  for (const [x, y] of [[12, 13], [15, 12], [13, 17], [16, 16]]) arcPix(g, x, y, 1.3, 200, 340, C.gold);
  fx.push([26, 9, C.rareLight], [9, 7, C.goldLight], [23, 24, C.teal]);
};

ACHIEVEMENT_DRAWERS['mastery_funerary'] = (g, fx) => {
  medallion(g, 'round', { field: C.stoneDark });
  // bone wings
  poly(g, [[7, 14], [13, 10], [12, 16], [8, 20], [6, 18]], C.boneDark);
  poly(g, [[25, 14], [19, 10], [20, 16], [24, 20], [26, 18]], C.boneDark);
  for (const [x, y] of [[9, 14], [11, 13], [23, 14], [21, 13]]) set(g, x, y, C.bone);
  // sword
  sword(g, { cx: 16, tip: 5, guardY: 20, half: 2, guardHalf: 4, gripLen: 3, blade: C.steel, light: C.bright, guard: C.gold, grip: C.leather });
  // skull on the guard
  skullAt(g, 16, 16, 0.7, { bone: C.bone, dark: C.boneDark, glow: C.rare });
  // shroud
  poly(g, [[11, 25], [21, 25], [22, 29], [10, 29]], C.soot);
  set(g, 14, 27, C.bone); set(g, 18, 27, C.bone);
  fx.push([6, 10, C.rareLight], [26, 9, C.goldLight], [16, 3, C.bone]);
};

ACHIEVEMENT_DRAWERS['clocking_out'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.brass, rimDark: C.brassDark, field: C.stoneDark });
  // clock
  disc(g, 16, 13, 8, C.brassDark);
  disc(g, 16, 13, 7, C.bone);
  ring(g, 16, 13, 7, 6, C.brass);
  for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) set(g, 16 + dx, 13 + dy, C.steelDark);
  line(g, 16, 13, 16, 9, C.ink);
  line(g, 16, 13, 20, 15, C.ink);
  set(g, 16, 13, C.blood);
  // punch-out hammer
  rect(g, 17, 22, 9, 3, C.steelDark);
  hline(g, 18, 25, 22, C.steel);
  stroke(g, [[18, 25], [13, 29]], 2, C.woodDark);
  set(g, 25, 23, C.brass);
  fx.push([6, 8, C.goldLight], [26, 12, C.steel], [7, 23, C.brassLight]);
};

ACHIEVEMENT_DRAWERS['all_thumbs'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.brass, rimDark: C.brassDark, field: C.leatherDark });
  // broken blade shards behind
  poly(g, [[7, 22], [9, 13], [11, 14], [10, 23]], C.steelDark);
  poly(g, [[25, 22], [23, 12], [21, 13], [22, 23]], C.steelDark);
  // fist
  box(g, 9, 16, 10, 9, C.steel, C.ink);
  rect(g, 10, 17, 8, 7, C.steel);
  for (let y = 18; y <= 22; y += 2) line(g, 10, y, 16, y, C.steelDark);
  vline(g, 10, 17, 22, C.bright);
  // thumb sticking up, separated from the steel rim
  poly(g, [[19, 16], [23, 15], [23, 11], [21, 9], [19, 11]], C.steel);
  line(g, 20, 15, 20, 11, C.bright);
  line(g, 19, 11, 19, 15, C.steelDark);
  set(g, 21, 9, C.steelMid);
  // thumb bandage
  hline(g, 19, 23, 12, C.bone);
  hline(g, 19, 23, 14, C.boneDark);
  set(g, 21, 13, C.boneLight);
  // cuff
  rect(g, 8, 24, 14, 3, C.steelDark);
  hline(g, 9, 20, 24, C.steel);
  set(g, 12, 25, C.brass); set(g, 18, 25, C.brass);
  fx.push([6, 8, C.goldLight], [27, 8, C.steelMid], [16, 29, C.gold], [24, 16, C.rareLight]);
};

ACHIEVEMENT_DRAWERS['no_rest'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.emberDark });
  // hammer
  rect(g, 8, 7, 16, 5, C.steelDark);
  rect(g, 9, 8, 14, 3, C.steel);
  hline(g, 9, 22, 8, C.bright);
  rect(g, 14, 12, 4, 14, C.woodDark);
  vline(g, 15, 13, 25, C.woodLight);
  disc(g, 16, 27, 2.5, C.steelDark);
  // motion afterimages
  for (const x of [5, 26]) {
    line(g, x, 6, x + 2, 12, C.gold);
    line(g, x, 16, x + 2, 22, C.gold);
  }
  // sparks
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    fx.push([Math.round(16 + Math.cos(rad) * 11), Math.round(16 + Math.sin(rad) * 11), C.goldLight]);
  }
  fx.push([16, 4, C.ember], [5, 19, C.gold], [27, 24, C.emberLight]);
};

ACHIEVEMENT_DRAWERS['keep_change'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.soot });
  // one big kept coin, plus the change behind it
  coin(g, 16, 15, 6, { face: C.gold, edge: C.goldDark, mark: true });
  coin(g, 23, 10, 2.5, { face: C.goldLight, edge: C.goldDark });
  coin(g, 8, 20, 2, { face: C.gold, edge: C.goldDark });
  arcPix(g, 20, 17, 5, 250, 40, C.gold);
  // shine and sparkles
  fx.push([8, 12, C.goldLight], [26, 6, C.gold], [6, 25, C.gold], [25, 26, C.goldLight], [16, 6, C.white]);
};

ACHIEVEMENT_DRAWERS['one_last_chance'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.steel, rimDark: C.steelDark, field: C.bloodDark });
  // small hourglass
  rect(g, 10, 6, 13, 3, C.steelDark);
  hline(g, 11, 21, 6, C.steel);
  rect(g, 10, 25, 13, 3, C.steelDark);
  hline(g, 11, 21, 27, C.steel);
  vline(g, 10, 8, 26, C.steelDark);
  vline(g, 22, 8, 26, C.steelDark);
  poly(g, [[11, 9], [21, 9], [17, 15], [15, 15]], C.glass);
  poly(g, [[15, 18], [17, 18], [21, 24], [11, 24]], C.glass);
  // one last grain falling
  poly(g, [[12, 10], [20, 10], [17, 14], [15, 14]], C.emberDark);
  set(g, 16, 16, C.gold);
  set(g, 16, 17, C.goldLight);
  poly(g, [[13, 23], [19, 23], [16, 21]], C.ember);
  // crack
  line(g, 19, 9, 17, 14, C.bone);
  line(g, 17, 14, 19, 19, C.boneDark);
  // glow
  fx.push([16, 15, C.goldLight], [8, 22, C.ember], [24, 10, C.bloodLight]);
};

ACHIEVEMENT_DRAWERS['take_everything'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.arcaneDark });
  // open crate
  rect(g, 7, 15, 18, 12, C.woodDark);
  rect(g, 8, 16, 16, 10, C.wood);
  poly(g, [[7, 15], [2, 9], [7, 6], [14, 12]], C.woodDark);
  poly(g, [[8, 14], [4, 9], [8, 7], [13, 12]], C.wood);
  // straps
  rect(g, 11, 15, 2, 12, C.steelDark);
  rect(g, 20, 15, 2, 12, C.steelDark);
  hline(g, 7, 24, 20, C.steel);
  // loot spilling
  coin(g, 16, 12, 3, { face: C.gold, edge: C.goldDark });
  coin(g, 23, 10, 2.5, { face: C.goldLight, edge: C.goldDark });
  disc(g, 21, 15, 2.2, C.rare);
  set(g, 21, 14, C.rareLight);
  poly(g, [[12, 10], [15, 7], [17, 11]], C.teal);
  // sparkles
  fx.push([6, 5, C.goldLight], [27, 6, C.gold], [26, 19, C.rareLight], [4, 25, C.gold], [16, 3, C.white]);
};

ACHIEVEMENT_DRAWERS['job_for_life'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.leatherDark });
  // contract scroll
  rect(g, 10, 7, 12, 19, C.boneDark);
  rect(g, 11, 8, 10, 17, C.bone);
  rect(g, 9, 5, 14, 3, C.woodDark);
  rect(g, 9, 24, 14, 3, C.woodDark);
  hline(g, 10, 21, 5, C.wood);
  hline(g, 10, 21, 26, C.woodDark);
  // document lines, only above the lock
  for (let y = 9; y <= 13; y += 2) hline(g, 13, 20, y, C.boneDark);
  // wax seal at the top
  disc(g, 16, 9, 2.2, C.blood);
  set(g, 15, 8, C.bloodLight);
  // chain draped at the sides, not across the face
  chainLink(g, 7, 18, 2.5, 3, C.steel, C.steelDark);
  chainLink(g, 25, 18, 2.5, 3, C.steel, C.steelDark);
  stroke(g, [[9, 17], [13, 20]], 2, C.steelDark);
  stroke(g, [[23, 17], [19, 20]], 2, C.steelDark);
  // padlock over the lower scroll
  padlock(g, 16, 21, { body: C.steelDark, edge: C.steel, metal: C.bright });
  set(g, 16, 23, C.rare);
  set(g, 15, 22, C.rareLight);
  fx.push([8, 8, C.goldLight], [24, 8, C.gold], [16, 3, C.rareLight], [6, 25, C.gold]);
};

ACHIEVEMENT_DRAWERS['one_more_hit'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.stoneDark });
  sword(g, { cx: 16, tip: 8, guardY: 20, half: 2, guardHalf: 5, gripLen: 3, blade: C.steel, light: C.bright, guard: C.gold, grip: C.leather });
  // notch marks along the blade
  for (const y of [11, 14, 17]) {
    set(g, 14, y, C.ink);
    set(g, 17, y + 1, C.ink);
  }
  // star at the tip
  set(g, 16, 4, C.goldLight);
  set(g, 16, 5, C.gold);
  set(g, 16, 6, C.gold);
  set(g, 15, 5, C.gold);
  set(g, 17, 5, C.gold);
  set(g, 14, 5, C.goldDark);
  set(g, 18, 5, C.goldDark);
  set(g, 16, 3, C.white);
  fx.push([7, 10, C.gold], [25, 13, C.goldLight], [16, 27, C.goldLight]);
};

ACHIEVEMENT_DRAWERS['now_hiring'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.steel, rimDark: C.steelDark, field: C.soot });
  // gravestone
  disc(g, 15, 12, 7, C.stoneDark);
  rect(g, 8, 12, 14, 13, C.stoneDark);
  disc(g, 15, 11, 6, C.stone);
  rect(g, 9, 12, 12, 12, C.stone);
  // carved hammer
  rect(g, 12, 12, 6, 2, C.steel);
  rect(g, 14, 14, 2, 6, C.steelDark);
  hline(g, 9, 20, 22, C.stoneDark);
  // leaning hammer
  rect(g, 20, 18, 6, 3, C.steelDark);
  stroke(g, [[22, 21], [23, 27]], 2, C.wood);
  // dragon eye above
  poly(g, [[22, 6], [25, 4], [28, 6], [25, 9]], C.emberDark);
  poly(g, [[23, 6], [25, 5], [27, 6], [25, 8]], C.ember);
  set(g, 25, 6, C.ink);
  set(g, 25, 6, C.ink);
  set(g, 26, 5, C.emberLight);
  // grave dirt
  poly(g, [[6, 26], [25, 25], [27, 29], [5, 29]], C.woodDark);
  fx.push([7, 8, C.steelMid], [27, 14, C.ember], [12, 28, C.ash], [16, 3, C.rareLight]);
};

ACHIEVEMENT_DRAWERS['hammer_time'] = (g, fx) => {
  medallion(g, 'shield', { rim: C.gold, rimDark: C.goldDark, field: C.emberDark });
  // anvil
  drawAnvil(g, 16, 24, 0.95, { col: C.steelDark, light: C.steel, dark: C.ink });
  hline(g, 10, 22, 24, C.steel);
  // hammer swinging in
  stroke(g, [[7, 6], [15, 15]], 3, C.woodDark);
  stroke(g, [[7, 6], [15, 15]], 1, C.woodLight);
  rect(g, 14, 12, 9, 5, C.steelDark);
  rect(g, 15, 13, 7, 3, C.steel);
  hline(g, 15, 21, 13, C.bright);
  // impact burst
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    for (let r = 3; r <= 6; r++) fx.push([Math.round(17 + Math.cos(rad) * r), Math.round(18 + Math.sin(rad) * r), r > 5 ? C.goldLight : C.gold]);
  }
  // lightning
  for (const [x, y] of [[26, 6], [27, 8], [25, 9], [28, 11], [26, 13]]) fx.push([x, y, C.rare]);
  fx.push([16, 18, C.white], [8, 22, C.ember], [24, 20, C.emberLight]);
};

const ALL_RELIC_DRAW = id => {
  const fn = RELIC_DRAWERS[id];
  if (!fn) throw new Error(`Missing relic drawer: ${id}`);
  return fn;
};

const ALL_CONSUMABLE_DRAW = id => {
  const fn = CONSUMABLE_DRAWERS[id];
  if (!fn) throw new Error(`Missing consumable drawer: ${id}`);
  return fn;
};

const ALL_ACHIEVEMENT_DRAW = id => {
  const fn = ACHIEVEMENT_DRAWERS[id];
  if (!fn) throw new Error(`Missing achievement drawer: ${id}`);
  return fn;
};

// ------------------------------------------------------------------- output
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgFor(grid, title) {
  const rects = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = grid[y][x];
      if (!c) { x++; continue; }
      let w = 1;
      while (x + w < W && grid[y][x + w] === c) w++;
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`);
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" role="img"><title>${escapeXml(title)}</title>${rects.join('')}</svg>\n`;
}

function rarityAccent(grid, rarity) {
  if (!rarity || rarity === 'common') return;
  const col = rarity === 'legendary' ? C.legend : C.rare;
  const candidates = [[29, 2], [2, 2], [29, 29], [2, 29], [30, 7], [1, 7], [30, 24], [1, 24]];
  for (const [x, y] of candidates) {
    if (grid[y][x]) continue;
    grid[y][x] = col;
    if (rarity === 'legendary') {
      if (y + 1 < H && !grid[y + 1][x]) grid[y + 1][x] = C.goldLight;
      else if (x - 1 >= 0 && !grid[y][x - 1]) grid[y][x - 1] = C.goldLight;
    }
    return;
  }
}

function writeSet(dir, items, drawFor, titleFor) {
  fs.mkdirSync(dir, { recursive: true });
  const ids = new Set(items.map(it => it.id));
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.svg') && !ids.has(file.slice(0, -4))) fs.unlinkSync(path.join(dir, file));
  }
  for (const item of items) {
    const grid = build(drawFor(item));
    if (item.item?.rarity) rarityAccent(grid, item.item.rarity);
    const svg = svgFor(grid, titleFor(item));
    fs.writeFileSync(path.join(dir, `${item.id}.svg`), svg, 'utf8');
  }
}

const relicItems = RELICS.map(r => ({ id: r.id, item: r, title: `${r.en} (${r.zh})` }));
const consumableItems = Object.entries(CONSUMABLES).map(([id, item]) => ({ id, item, title: `${item.en} (${item.zh})` }));
const achievementItems = ACHIEVEMENTS.map(a => ({ id: a.id, item: a, title: `${a.en} (${a.zh})` }));

writeSet(path.join(ROOT, 'client/assets/relics'), relicItems, it => (g, fx) => ALL_RELIC_DRAW(it.id)(g, fx), it => it.title);
writeSet(path.join(ROOT, 'client/assets/consumables'), consumableItems, it => (g, fx) => ALL_CONSUMABLE_DRAW(it.id)(g, fx), it => it.title);
writeSet(path.join(ROOT, 'client/assets/achievements'), achievementItems, it => (g, fx) => ALL_ACHIEVEMENT_DRAW(it.id)(g, fx), it => it.title);

// ------------------------------------------------------------------ verify
function verifySet(dir, items, label) {
  const expected = new Set(items.map(i => i.id));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
  const missing = [...expected].filter(id => !files.includes(id));
  const extra = files.filter(id => !expected.has(id));
  let minShapes = Infinity;
  let minColors = Infinity;
  const problems = [];
  for (const id of expected) {
    const file = path.join(dir, `${id}.svg`);
    if (!fs.existsSync(file)) continue;
    const svg = fs.readFileSync(file, 'utf8');
    const shapes = (svg.match(/<rect /g) || []).length;
    const colors = new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1])).size;
    minShapes = Math.min(minShapes, shapes);
    minColors = Math.min(minColors, colors);
    if (!svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>') || !svg.includes('<title>') ||
        /NaN|undefined|null/.test(svg) || shapes < 10 || colors < 3) {
      problems.push(`${id} shapes=${shapes} colors=${colors}`);
    }
  }
  console.log(`${label}: ${items.length} expected, ${files.length} files, missing=[${missing.join(',')}] extra=[${extra.join(',')}] minShapes=${minShapes} minColors=${minColors}`);
  if (missing.length || extra.length || files.length !== items.length || problems.length) {
    if (problems.length) console.log(`  format problems: ${problems.join('; ')}`);
    process.exitCode = 1;
  }
}

verifySet(path.join(ROOT, 'client/assets/relics'), relicItems, 'relics');
verifySet(path.join(ROOT, 'client/assets/consumables'), consumableItems, 'consumables');
verifySet(path.join(ROOT, 'client/assets/achievements'), achievementItems, 'achievements');
