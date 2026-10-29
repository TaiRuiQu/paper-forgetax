// Generates the workshop backdrop, station art, dragon, title logo and UI icons.
// All artwork is procedural pixel art (integer-aligned SVG rectangles/polygons).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SCENE = path.join(ROOT, 'client/assets/scene');
const UI = path.join(ROOT, 'client/assets/ui');
fs.mkdirSync(SCENE, { recursive: true });
fs.mkdirSync(UI, { recursive: true });

const C = {
  ink: '#0b090e', ink2: '#141018', stone0: '#19151d', stone1: '#241f28', stone2: '#322b36',
  stone3: '#443a46', stone4: '#5a4d57', wood0: '#2a1b13', wood1: '#4a2d1b', wood2: '#6b4326',
  wood3: '#8f5c34', steel0: '#3b4350', steel1: '#5f6b79', steel2: '#8796a6', steel3: '#bcc8d2',
  steel4: '#e3eaee', brass0: '#6e4a19', brass1: '#a8762c', brass2: '#d6a344', brass3: '#f4cf76',
  ember0: '#5a1b0f', ember1: '#a83616', ember2: '#e86120', ember3: '#ff9a3c', ember4: '#ffd166',
  blood: '#8f2f39', teal0: '#153b39', teal1: '#215f57', teal2: '#3f9b85', teal3: '#9fe8d0',
  blue0: '#0d1724', blue1: '#132a40', blue2: '#235077', blue3: '#6d9dc0', moon: '#cfe0e6',
  bone: '#cfc3a4', boneD: '#8b7d60', gold: '#e8b45a', goldD: '#9b6a24', goldL: '#ffe6a0',
  purple: '#5d4b82', purpleL: '#9d86c7', white: '#f4efe2', grey: '#8b8378',
};

const r = (x, y, w, h, fill, opacity = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
const pl = (pts, fill, opacity = 1) =>
  `<polygon points="${pts}" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
const svg = (w, h, title, body, background = 'none') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img"><title>${title}</title>${background !== 'none' ? `<rect width="${w}" height="${h}" fill="${background}"/>` : ''}${body}</svg>\n`;

let rnd = 987654321;
function rand() { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; }

// ------------------------------------------------------------------ background
function workshopBackground() {
  let b = '';
  // wall
  b += r(0, 0, 800, 450, C.stone0);
  for (let y = 24; y < 310; y += 28) {
    for (let x = -35; x < 800; x += 70) {
      const off = ((y / 28) % 2) * 35;
      const shade = [C.stone1, C.stone1, C.stone2, '#1e1a22'][Math.floor(rand() * 4)];
      b += r(x + off, y, 67, 25, shade);
      b += r(x + off, y, 67, 2, C.stone3, 0.35);
      b += r(x + off, y + 23, 67, 2, C.ink, 0.6);
      if (rand() < 0.25) b += r(x + off + 12 + Math.floor(rand() * 40), y + 8, 2, 10, C.ink, 0.35);
    }
  }
  // ceiling beams
  b += r(0, 0, 800, 26, C.wood0);
  b += r(0, 0, 800, 4, C.wood2);
  b += r(0, 24, 800, 4, C.ink);
  for (const x of [52, 740]) {
    b += r(x, 0, 20, 330, C.wood0);
    b += r(x, 0, 3, 330, C.wood2);
    b += r(x + 16, 0, 4, 330, C.ink);
  }
  b += r(0, 120, 800, 8, C.wood0);
  b += r(0, 120, 800, 2, C.wood1);
  // distant window
  b += r(505, 44, 220, 250, C.stone2);
  b += r(511, 50, 208, 238, C.stone1);
  // gothic arch
  b += `<path d="M520 272 L520 120 Q520 70 620 54 Q720 70 720 120 L720 272 Z" fill="${C.blue0}"/>`;
  b += `<path d="M526 272 L526 122 Q526 78 620 62 Q714 78 714 122 L714 272 Z" fill="${C.blue1}"/>`;
  // moon and clouds
  b += r(642, 92, 30, 30, C.moon, 0.85);
  b += r(636, 98, 6, 18, C.moon, 0.85);
  b += r(672, 100, 6, 14, C.moon, 0.85);
  b += r(548, 140, 80, 4, C.blue2, 0.5);
  b += r(566, 132, 52, 4, C.blue2, 0.35);
  b += r(640, 196, 90, 5, C.blue2, 0.3);
  // distant towers
  b += r(536, 220, 18, 52, '#091019');
  b += r(540, 196, 8, 24, '#091019');
  b += r(690, 214, 14, 58, '#091019');
  // dragon shadow outside window (behind glass)
  b += pl('596,86 612,54 626,66 644,40 656,62 676,50 686,78 676,96 650,104 620,100', '#05080c');
  b += pl('612,74 622,60 628,72 640,52 648,72 660,58 668,80 656,92 632,94', '#080d13');
  b += r(636, 70, 12, 5, C.ember2, 0.9);
  b += r(639, 71, 5, 3, C.ember4);
  b += r(642, 86, 24, 3, C.blue2, 0.4);
  // window mullions
  b += r(617, 54, 6, 218, C.stone1);
  b += r(617, 150, 106, 6, C.stone1);
  b += r(511, 50, 208, 4, C.stone3, 0.4);
  b += r(505, 288, 220, 8, C.ink);
  b += r(500, 294, 230, 6, C.stone2);
  // hearth glow left
  for (let i = 7; i >= 1; i--) {
    b += pl(`0,${150 + i * 12} ${140 + i * 24},${150 + i * 12} ${140 + i * 24},${440 - i * 16} 0,${440 - i * 16}`, C.ember1, 0.035 * (8 - i));
  }
  b += r(0, 270, 190, 60, C.ember2, 0.05);
  // tool wall
  b += r(250, 180, 160, 6, C.wood1);
  b += r(250, 186, 160, 3, C.ink);
  b += r(262, 150, 7, 30, C.wood2);
  b += r(256, 144, 19, 10, C.steel1);
  b += r(258, 146, 15, 3, C.steel3);
  b += r(300, 158, 28, 4, C.steel1);
  b += r(324, 150, 5, 22, C.wood2);
  b += r(348, 152, 4, 36, C.steel1);
  b += r(344, 148, 12, 4, C.steel1);
  b += r(342, 180, 16, 4, C.steel0);
  b += r(384, 154, 30, 3, C.wood2);
  b += r(408, 154, 4, 30, C.steel1);
  b += r(404, 180, 12, 4, C.steel1);
  // shelf and jars left of window
  b += r(360, 250, 130, 6, C.wood1);
  b += r(360, 256, 130, 4, C.ink);
  b += r(372, 226, 14, 24, C.stone3);
  b += r(374, 232, 10, 3, C.stone4);
  b += r(394, 232, 18, 18, C.teal0);
  b += r(394, 232, 18, 3, C.teal2, 0.6);
  b += r(424, 218, 12, 32, C.blood);
  b += r(427, 222, 6, 4, C.bone, 0.3);
  b += r(448, 236, 22, 14, C.wood1);
  // banner
  b += pl('596,150 634,150 634,235 615,224 596,235', '#3a1a1e');
  b += pl('600,156 630,156 630,226 615,217 600,226', '#54252a');
  b += r(610, 168, 10, 22, C.brass1);
  b += r(612, 170, 6, 18, C.brass2);
  b += r(614, 190, 2, 14, C.brass1);
  b += r(610, 188, 10, 2, C.brass1);
  // chains
  for (const x of [200, 470, 730]) {
    for (let y = 26; y < 26 + 90 + rand() * 80; y += 7) {
      b += r(x, y, 4, 4, C.steel0);
      b += r(x + 1, y + 1, 2, 2, C.steel1);
    }
  }
  // lanterns
  for (const [x, y] of [[200, 134], [730, 174]]) {
    b += r(x - 10, y, 24, 4, C.steel0);
    b += r(x - 4, y + 4, 12, 2, C.ink);
    b += r(x - 6, y + 6, 16, 16, C.brass1);
    b += r(x - 3, y + 8, 10, 12, C.ember3, 0.9);
    b += r(x - 1, y + 10, 6, 8, C.ember4);
    b += r(x - 4, y + 22, 12, 3, C.brass1);
    for (let i = 1; i < 5; i++) b += r(x - 24 - i * 4, y + 10 + i * 2, 18 + i * 4, 3, C.ember1, 0.04 * (5 - i));
  }
  // floor
  b += r(0, 300, 800, 150, '#151116');
  b += r(0, 300, 800, 5, C.stone2);
  b += r(0, 305, 800, 3, C.ink);
  for (let row = 0; row < 4; row++) {
    const y = 315 + row * 34;
    for (let x = -40 + (row % 2) * 40; x < 800; x += 80) {
      b += r(x, y, 76, 30, ['#1b161d', '#18141a', '#1d171e', '#161218'][row]);
      b += r(x, y, 76, 2, C.stone2, 0.35);
      b += r(x, y + 28, 76, 2, C.ink, 0.7);
      if (rand() < 0.3) b += r(x + 20 + Math.floor(rand() * 30), y + 8, 10, 2, C.stone3, 0.2);
    }
  }
  // floor reflections / debris
  b += r(80, 340, 280, 14, C.ember2, 0.045);
  b += r(120, 333, 100, 6, C.ember3, 0.03);
  b += r(650, 330, 100, 8, C.blue3, 0.04);
  for (const [x, y] of [[240, 390], [250, 396], [610, 360], [618, 365], [150, 420], [560, 420]]) {
    b += r(x, y, 3, 2, C.ink);
    b += r(x + 1, y - 1, 2, 1, C.stone3, 0.4);
  }
  // foreground vignette bands
  b += r(0, 400, 800, 50, C.ink, 0.25);
  b += r(0, 0, 800, 8, C.ink, 0.4);
  return svg(1600, 900, 'ForgeTax pixel-art workshop backdrop', b);
}

function selectBackground() {
  let b = '';
  b += r(0, 0, 1600, 900, '#08070c');
  for (let i = 0; i < 12; i++) {
    b += r(0, 220 + i * 34, 1600, 20, '#0e0c13', 0.5 - i * 0.02);
  }
  // giant moon
  b += r(690, 40, 260, 260, '#151b25');
  b += r(706, 56, 228, 228, '#1b2734');
  b += r(722, 72, 196, 196, '#24384a', 0.7);
  // dragon silhouette across moon
  b += pl('620,260 660,180 700,210 740,110 790,190 840,100 880,170 930,130 980,240 900,330 760,350 660,320', '#05070a');
  b += pl('700,240 740,200 760,240 800,180 830,240 870,200 900,260 850,300 760,310', '#090c12');
  b += r(758, 236, 22, 8, C.ember2, 0.8);
  b += r(852, 228, 18, 7, C.ember2, 0.65);
  // forge glow horizon
  for (let i = 6; i >= 1; i--) {
    b += pl(`0,${640 + i * 18} 1600,${600 + i * 12} 1600,${760} 0,${780}`, C.ember1, 0.035 * (7 - i));
  }
  // silhouetted workshop towers
  b += pl('0,640 180,560 300,640 430,600 540,680 0,760', '#0b0910');
  b += pl('1100,660 1240,570 1380,620 1600,540 1600,780 1150,760', '#0b0910');
  // window glows
  for (const x of [90, 260, 1180, 1420]) {
    b += r(x, 660, 30, 50, C.ember2, 0.08);
    b += r(x + 6, 670, 18, 30, C.ember3, 0.1);
  }
  // fog bands
  for (let i = 0; i < 14; i++) {
    b += r(0, 600 + i * 20, 1600, 8, '#131019', 0.32);
  }
  // floating embers
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rand() * 1600), y = Math.floor(rand() * 700) + 100;
    b += r(x, y, 2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 3), rand() < 0.3 ? C.ember4 : C.ember2, 0.3 + rand() * 0.5);
  }
  b += r(0, 820, 1600, 80, '#07060a');
  return svg(1600, 900, 'ForgeTax title backdrop with sleeping dragon', b);
}

// ------------------------------------------------------------------ stations
function forgeArt() {
  let b = '';
  // glow
  for (let i = 5; i >= 1; i--) b += r(26 - i * 4, 50 - i * 4, 36 + i * 8, 44 + i * 6, C.ember2, 0.04);
  // chimney and hood
  b += r(26, 2, 28, 8, C.stone2);
  b += r(22, 10, 36, 6, C.stone2);
  b += r(18, 16, 44, 8, C.stone3);
  b += r(18, 24, 44, 4, C.ink);
  b += r(14, 28, 52, 8, C.stone2);
  b += r(18, 36, 44, 4, C.ink);
  // body
  b += r(12, 40, 56, 58, C.stone1);
  b += r(12, 40, 4, 58, C.stone2);
  b += r(64, 40, 4, 58, C.ink);
  for (let y = 46; y < 96; y += 10) b += r(16, y, 48, 2, C.stone2, 0.35);
  // mouth arch
  b += `<path d="M26 96 L26 68 Q26 54 40 54 Q54 54 54 68 L54 96 Z" fill="${C.ink}"/>`;
  b += `<path d="M30 96 L30 70 Q30 60 40 60 Q50 60 50 70 L50 96 Z" fill="${C.ember0}"/>`;
  // flames
  b += pl('34,94 38,74 42,84 44,66 48,92', C.ember2);
  b += pl('36,94 40,78 43,88 45,72 47,94', C.ember3);
  b += pl('38,94 41,84 44,90 45,80 46,94', C.ember4);
  b += r(33, 90, 14, 4, C.ember4, 0.8);
  // embers
  for (const [x, y] of [[28, 48], [52, 42], [34, 34], [46, 30], [22, 60], [58, 56]]) {
    b += r(x, y, 2, 2, C.ember3, 0.8);
  }
  // base stones
  b += r(8, 98, 64, 10, C.stone2);
  b += r(8, 98, 64, 2, C.stone3, 0.6);
  b += r(4, 108, 72, 2, C.ink);
  // bellows right
  b += pl('66,64 78,58 78,78 66,74', C.wood1);
  b += pl('68,66 76,62 76,74 68,72', C.wood3);
  b += r(78, 62, 4, 12, C.steel1);
  // tools leaning
  b += r(6, 44, 3, 56, C.wood1);
  b += r(2, 40, 10, 5, C.steel1);
  return svg(160, 220, 'Pixel-art forge', b);
}

function anvilArt() {
  let b = '';
  // shadow
  b += r(18, 108, 164, 8, C.ink, 0.6);
  // stump
  b += r(66, 74, 70, 32, C.wood1);
  b += r(70, 78, 62, 26, C.wood2);
  b += r(74, 82, 54, 3, C.wood3, 0.5);
  b += r(62, 102, 78, 6, C.wood0);
  b += r(66, 74, 6, 32, C.ink, 0.4);
  for (const y of [88, 96]) b += r(72, y, 58, 2, C.wood1, 0.7);
  // anvil base
  b += pl('78,72 120,72 124,80 74,80', C.steel0);
  b += r(86, 58, 30, 16, C.steel0);
  b += r(84, 50, 36, 10, C.steel1);
  // anvil face and horn
  b += pl('40,32 118,32 132,38 118,44 44,44 36,38', C.steel1);
  b += pl('44,32 116,32 126,37 116,41 44,41 39,37', C.steel2);
  b += r(46, 32, 64, 3, C.steel3);
  b += r(50, 33, 30, 1, C.steel4);
  b += pl('132,36 152,30 166,36 150,40 134,41', C.steel0);
  b += pl('136,36 150,33 160,36 149,38', C.steel2);
  b += pl('36,38 28,42 38,45 44,42', C.steel0);
  // waist
  b += pl('88,44 106,44 112,52 82,52', C.steel1);
  b += r(82, 52, 30, 6, C.steel0);
  // highlights and scratches
  b += r(58, 36, 22, 1, C.steel4, 0.7);
  b += r(96, 38, 14, 1, C.steel0, 0.8);
  b += r(70, 50, 8, 1, C.ink, 0.5);
  b += r(108, 56, 8, 1, C.ink, 0.5);
  // rivets
  for (const x of [54, 90, 112]) b += r(x, 42, 2, 2, C.ink);
  // sparks at base
  b += r(160, 104, 4, 2, C.ember3, 0.7);
  b += r(30, 100, 3, 2, C.ember2, 0.5);
  return svg(200, 120, 'Pixel-art anvil', b);
}

function vendingArt() {
  let b = '';
  // glow
  for (let i = 4; i >= 1; i--) b += r(10 - i * 3, 10 - i * 3, 140 + i * 6, 220 + i * 6, C.purple, 0.025);
  // top ornament
  b += pl('62,4 80,0 98,4 102,16 80,24 58,16', C.brass0);
  b += pl('66,7 80,3 94,7 96,14 80,20 64,14', C.brass2);
  b += r(76, 8, 8, 5, C.ember2);
  b += r(78, 9, 4, 3, C.ember4);
  // cabinet
  b += r(22, 20, 116, 200, C.wood0);
  b += r(26, 24, 108, 192, C.stone1);
  b += r(26, 24, 108, 4, C.stone2);
  b += r(20, 20, 6, 204, C.ink);
  b += r(134, 20, 6, 204, C.ink);
  // glass panes
  for (let i = 0; i < 3; i++) {
    const y = 38 + i * 56;
    b += r(34, y, 92, 46, C.ink);
    b += r(36, y + 2, 88, 42, '#111a21');
    b += r(36, y + 2, 88, 4, C.teal1, 0.35);
    b += r(38, y + 34, 84, 8, C.stone1, 0.5);
    b += r(38, y + 8, 3, 22, C.blue3, 0.12);
    b += r(42, y + 42, 76, 2, C.brass0);
    b += r(126, y + 10, 2, 26, C.brass2);
    b += r(122, y + 22, 6, 4, C.brass3);
  }
  // lower panel
  b += r(32, 208, 96, 34, C.stone0);
  b += r(36, 212, 88, 26, C.wood1);
  b += r(44, 218, 40, 12, C.ink);
  b += r(48, 222, 32, 4, C.ember2, 0.7);
  b += r(100, 216, 16, 18, C.brass1);
  b += r(103, 219, 10, 3, C.ink);
  b += r(103, 224, 10, 2, C.ink);
  // legs
  b += r(30, 220, 12, 16, C.wood0);
  b += r(118, 220, 12, 16, C.wood0);
  b += r(24, 234, 24, 4, C.ink);
  b += r(112, 234, 24, 4, C.ink);
  // side pipes
  b += r(140, 40, 4, 160, C.brass0);
  b += r(144, 48, 8, 4, C.brass1);
  b += r(144, 192, 8, 4, C.brass1);
  b += r(12, 52, 4, 130, C.steel0);
  b += r(8, 60, 8, 4, C.steel1);
  return svg(160, 240, 'Pixel-art relic vending machine', b);
}

function tributeArt() {
  let b = '';
  // shadow
  b += r(10, 84, 200, 10, C.ink, 0.6);
  // top
  b += pl('16,20 204,20 214,30 6,30', C.stone3);
  b += pl('20,22 200,22 206,28 14,28', C.stone4);
  b += r(24, 20, 152, 2, C.steel3, 0.25);
  // gold edge
  b += r(10, 30, 200, 4, C.brass1);
  b += r(14, 30, 192, 1, C.brass3);
  // front slab
  b += pl('10,34 210,34 198,82 22,82', C.stone1);
  b += pl('20,40 200,40 192,76 28,76', C.stone2);
  b += pl('24,44 196,44 188,72 32,72', C.stone1);
  // dragon relief
  b += pl('70,50 86,40 104,46 118,40 134,50 144,66 120,72 92,72 64,64', C.stone0);
  b += r(82, 52, 10, 4, C.ember2, 0.8);
  b += r(112, 50, 10, 4, C.ember2, 0.8);
  b += r(84, 53, 4, 2, C.ember4);
  b += r(114, 51, 4, 2, C.ember4);
  b += pl('88,60 104,56 120,60 112,68 96,68', C.stone0);
  b += r(92, 62, 4, 4, C.stone4, 0.4);
  b += r(108, 62, 4, 4, C.stone4, 0.4);
  // gold band and studs
  b += r(22, 76, 176, 4, C.brass0);
  for (let x = 30; x < 200; x += 24) b += r(x, 77, 2, 2, C.brass3);
  // legs
  b += r(34, 82, 16, 14, C.stone1);
  b += r(170, 82, 16, 14, C.stone1);
  b += r(28, 94, 28, 4, C.ink);
  b += r(164, 94, 28, 4, C.ink);
  return svg(220, 100, 'Pixel-art tribute table', b);
}

function bellArt() {
  let b = '';
  // frame
  b += r(6, 2, 6, 78, C.wood1);
  b += r(52, 2, 6, 78, C.wood1);
  b += r(2, 76, 60, 6, C.wood0);
  b += r(8, 2, 48, 5, C.wood2);
  // mount dragon
  b += pl('16,8 26,2 32,8 40,2 48,8 44,16 20,16', C.brass0);
  b += r(24, 8, 6, 3, C.ember2);
  b += r(36, 8, 6, 3, C.ember2);
  // bell
  b += pl('22,16 42,16 48,40 46,58 18,58 16,40', C.brass0);
  b += pl('24,18 40,18 45,40 43,55 21,55 19,40', C.brass2);
  b += r(28, 20, 8, 2, C.brass3);
  b += r(20, 44, 24, 3, C.brass1);
  b += r(22, 54, 20, 4, C.brass1);
  b += r(14, 56, 36, 4, C.brass0);
  b += r(16, 57, 32, 1, C.brass3);
  // clapper
  b += r(28, 60, 6, 8, C.brass1);
  b += r(25, 68, 12, 6, C.brass2);
  b += r(28, 69, 6, 2, C.brass3);
  // rope
  b += r(41, 30, 3, 20, C.boneD);
  b += r(42, 50, 5, 6, C.bone);
  return svg(80, 96, 'Pixel-art tribute bell', b);
}

function rackArt() {
  let b = '';
  // shadow
  b += r(10, 96, 140, 6, C.ink, 0.6);
  // frame
  b += r(12, 12, 8, 84, C.wood0);
  b += r(140, 12, 8, 84, C.wood0);
  b += r(12, 12, 136, 7, C.wood2);
  b += r(14, 19, 132, 3, C.ink);
  b += r(16, 84, 128, 8, C.wood1);
  b += r(16, 92, 128, 3, C.ink);
  // rail
  b += r(20, 40, 120, 6, C.wood2);
  b += r(20, 46, 120, 2, C.ink);
  // pegs
  for (let i = 0; i < 3; i++) {
    const x = 32 + i * 40;
    b += r(x, 26, 4, 20, C.wood3);
    b += r(x - 3, 26, 10, 4, C.wood2);
    b += r(x - 6, 58, 16, 3, C.wood1, 0.5);
  }
  // empty slot outlines
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 40;
    b += r(x, 52, 24, 2, C.stone2, 0.25);
    b += r(x, 68, 24, 2, C.stone2, 0.2);
  }
  // feet
  b += r(8, 88, 16, 8, C.wood1);
  b += r(136, 88, 16, 8, C.wood1);
  return svg(160, 110, 'Pixel-art sword rack', b);
}

function hammerArt() {
  let b = '';
  // handle vertical
  b += r(22, 20, 6, 26, C.wood1);
  b += r(23, 21, 3, 24, C.wood2);
  b += r(22, 36, 6, 2, C.boneD);
  b += r(22, 42, 6, 2, C.boneD);
  // head
  b += r(8, 10, 34, 12, C.steel0);
  b += r(10, 8, 30, 4, C.steel1);
  b += r(10, 10, 30, 3, C.steel2);
  b += r(6, 12, 6, 9, C.steel1);
  b += r(38, 12, 6, 9, C.steel1);
  b += r(8, 20, 34, 3, C.steel0);
  b += r(13, 9, 14, 2, C.steel3);
  b += r(6, 20, 6, 2, C.ink);
  b += r(38, 20, 6, 2, C.ink);
  // grip wrap
  b += r(21, 28, 8, 2, C.ink, 0.5);
  b += r(21, 34, 8, 2, C.ink, 0.5);
  // soot and sparks
  b += r(12, 15, 3, 2, C.ink, 0.6);
  b += r(33, 17, 2, 2, C.ember3, 0.8);
  b += r(42, 24, 2, 2, C.ember2, 0.6);
  return svg(96, 96, 'Pixel-art hammer', b);
}

function merchantArt() {
  let b = '';
  // lantern glow
  for (let i = 4; i >= 1; i--) b += r(30 - i * 5, 60 - i * 5, 70 + i * 10, 90 + i * 10, C.teal2, 0.025);
  // staff
  b += r(30, 28, 5, 120, C.wood0);
  b += pl('22,24 32,14 42,24 32,32', C.brass0);
  b += r(28, 22, 9, 3, C.teal3, 0.7);
  // lantern
  b += r(36, 62, 2, 16, C.steel0);
  b += r(28, 78, 20, 4, C.brass1);
  b += r(30, 82, 16, 20, C.brass0);
  b += r(33, 85, 10, 14, C.teal2, 0.65);
  b += r(35, 87, 6, 10, C.teal3, 0.8);
  b += r(28, 102, 20, 4, C.brass1);
  b += r(34, 106, 8, 3, C.brass2);
  // robe
  b += pl('45,38 75,30 102,42 108,100 96,140 60,140 42,100', C.teal0);
  b += pl('49,44 73,36 96,46 100,98 90,132 58,132 46,98', C.teal1);
  b += pl('56,50 72,44 88,52 92,94 84,124 60,124 50,94', '#1b4b47');
  // trim / folds
  b += pl('50,46 52,100 60,128 64,126 56,96 56,50', C.teal2, 0.6);
  b += pl('96,46 94,100 86,128 82,126 90,96 90,50', C.teal2, 0.4);
  b += r(60, 58, 22, 2, C.brass1, 0.6);
  // hood
  b += pl('44,40 60,16 88,20 104,42 98,56 82,46 62,48 48,58', C.teal0);
  b += pl('50,40 62,22 84,26 97,43 92,52 80,42 64,44 53,53', C.teal1);
  // hood shadow
  b += pl('56,38 66,28 82,31 90,42 80,46 66,44 59,48', C.ink);
  // skull face
  b += r(65, 36, 16, 10, C.bone);
  b += r(67, 44, 12, 5, C.boneD);
  b += r(66, 32, 14, 5, C.bone, 0.6);
  b += r(68, 39, 4, 3, C.ink);
  b += r(75, 39, 4, 3, C.ink);
  b += r(69, 40, 2, 1, C.teal3);
  b += r(76, 40, 2, 1, C.teal3);
  b += r(69, 46, 2, 2, C.ink);
  b += r(73, 46, 2, 2, C.ink);
  b += r(77, 46, 2, 2, C.ink);
  // floating coins
  b += r(108, 70, 8, 3, C.brass3);
  b += r(110, 73, 4, 2, C.brass1);
  b += r(20, 116, 8, 3, C.brass2);
  b += r(114, 118, 6, 2, C.brass2);
  // ghostly dither bottom
  for (let i = 0; i < 20; i++) {
    const x = 48 + Math.floor(rand() * 50);
    const y = 128 + Math.floor(rand() * 24);
    if (rand() > 0.4) b += r(x, y, 2, 4, C.teal1, 0.5);
  }
  // scale texture
  for (let i = 0; i < 14; i++) {
    b += r(54 + Math.floor(rand() * 36), 62 + Math.floor(rand() * 50), 3, 2, C.teal2, 0.25);
  }
  return svg(220, 320, 'Pixel-art ghost merchant', b);
}

function dragonArt(state = 'calm') {
  const eye = state === 'rage' ? '#ff4030' : state === 'warn' ? '#ff8a2a' : '#ffc857';
  const eye2 = state === 'rage' ? '#ffd0c0' : state === 'warn' ? '#ffe0a0' : '#fff3c4';
  const scale = state === 'rage' ? '#4a1f22' : state === 'warn' ? '#3d252c' : '#2c2329';
  let b = '';
  // horns
  b += pl('22,72 48,10 62,20 46,80', '#171015');
  b += pl('150,64 176,8 190,18 166,78', '#171015');
  b += pl('32,64 50,22 58,28 44,72', '#2a1c1d');
  b += pl('158,58 174,18 182,24 166,68', '#2a1c1d');
  // head mass
  b += pl('45,70 75,34 115,28 150,40 172,64 166,100 146,122 118,134 84,128 58,112 40,92', C.ink);
  b += pl('52,74 78,42 114,36 144,46 163,66 158,94 140,114 114,124 88,119 66,104 48,88', scale);
  // brow ridges
  b += pl('58,72 88,52 118,50 144,58 156,72 148,80 126,68 102,66 80,72 64,82', '#1a1419');
  // snout
  b += pl('58,90 90,78 124,80 148,92 140,116 114,126 88,120 66,108', '#241a1f');
  b += pl('64,94 92,86 120,88 138,96 132,110 112,118 92,112 72,104', scale);
  // nostrils
  b += r(78, 100, 8, 5, C.ink);
  b += r(112, 100, 8, 5, C.ink);
  b += r(80, 100, 4, 2, '#553c3c');
  b += r(114, 100, 4, 2, '#553c3c');
  // eye sockets
  b += pl('66,66 92,60 94,76 72,82', C.ink);
  b += pl('116,60 142,66 136,82 114,76', C.ink);
  b += r(72, 68, 16, 8, eye);
  b += r(120, 68, 16, 8, eye);
  b += r(75, 69, 6, 4, eye2);
  b += r(123, 69, 6, 4, eye2);
  b += r(80, 70, 2, 4, C.ink);
  b += r(128, 70, 2, 4, C.ink);
  // teeth
  for (let i = 0; i < 5; i++) b += pl(`${76 + i * 14},114 ${82 + i * 14},114 ${79 + i * 14},126`, C.bone);
  // jaw highlight
  b += pl('54,86 62,80 66,84 60,92', '#5a3a33', 0.6);
  // scales
  for (let i = 0; i < 28; i++) {
    const x = 58 + Math.floor(rand() * 100), y = 44 + Math.floor(rand() * 70);
    b += r(x, y, 5, 3, state === 'rage' ? '#6a2a2b' : '#443038', 0.35);
    b += r(x + 1, y, 3, 1, '#6d5058', 0.25);
  }
  // cracks for warn/rage
  if (state !== 'calm') {
    b += r(96, 32, 2, 18, C.ink, 0.6);
    b += r(100, 46, 12, 2, C.ink, 0.5);
    b += r(44, 58, 2, 14, C.ink, 0.5);
  }
  if (state === 'rage') {
    b += pl('60,124 70,116 80,130 92,118 104,132 116,120 128,134 140,122 148,128 142,140 60,140', C.ember1);
    b += r(72, 126, 4, 8, C.ember3, 0.7);
    b += r(126, 126, 4, 8, C.ember3, 0.7);
  }
  // glow
  for (let i = 4; i >= 1; i--) {
    b += r(64 - i * 2, 64 - i * 2, 18 + i * 4, 14 + i * 4, eye, 0.04);
    b += r(112 - i * 2, 64 - i * 2, 18 + i * 4, 14 + i * 4, eye, 0.04);
  }
  return svg(380, 220, `Pixel-art dragon head (${state})`, b);
}

function frenzyRing() {
  let b = '';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = 200 + Math.cos(a) * 168;
    const y = 200 + Math.sin(a) * 168;
    b += r(Math.round(x / 4) * 4, Math.round(y / 4) * 4, 8, 8, i % 3 === 0 ? C.ember4 : C.ember2, 0.5);
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const x = 200 + Math.cos(a) * 150, y = 200 + Math.sin(a) * 150;
    b += r(x, y, 4, 12, C.ember3, 0.5);
  }
  return svg(400, 400, 'Frenzy ember ring overlay', b);
}

// ------------------------------------------------------------------ title
const FONT5 = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function titleArt() {
  const title = 'FORGE TAX';
  let b = '';
  // backdrop horns
  b += pl('90,300 130,120 210,150 190,330', '#171019');
  b += pl('910,300 870,110 790,150 810,330', '#171019');
  b += pl('120,260 150,150 200,175 180,300', '#22161c');
  b += pl('880,260 850,150 800,175 820,300', '#22161c');
  // anvil silhouette behind lower text
  b += pl('380,380 660,380 700,410 620,430 620,470 740,470 760,520 240,520 260,470 380,470 380,430 300,410', '#0b080d');
  // embers
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * 1000), y = 40 + Math.floor(rand() * 430);
    b += r(x, y, 3, 3, rand() < 0.4 ? C.ember4 : C.ember2, 0.35 + rand() * 0.4);
  }
  // draw word
  const cell = 26;
  const word = 'FORGE';
  const totalW = word.length * 5 * cell + (word.length - 1) * cell * 1.2;
  let x0 = (1000 - totalW) / 2;
  const drawLetter = (ch, ox, oy, cell) => {
    const glyph = FONT5[ch];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== '1') continue;
        const x = ox + col * cell, y = oy + row * cell;
        b += r(x + 8, y + 8, cell, cell, '#4a2a12');
        b += r(x, y, cell, cell, C.goldD);
        b += r(x, y, cell, cell / 4, C.gold);
        b += r(x, y + cell * 0.75, cell, cell / 4, '#8f561a');
        b += r(x + 4, y + 4, cell - 8, 4, C.goldL, 0.55);
        if ((row * 5 + col) % 7 === 0) b += r(x + cell / 2, y + cell / 2, 4, 4, '#b37b2e');
      }
    }
  };
  for (let i = 0; i < word.length; i++) {
    drawLetter(word[i], x0 + i * cell * (5 + 1.2), 96, cell);
  }
  const word2 = 'TAX';
  const totalW2 = word2.length * 5 * 36 + (word2.length - 1) * 36 * 1.4;
  let x2 = (1000 - totalW2) / 2;
  for (let i = 0; i < word2.length; i++) {
    drawLetter(word2[i], x2 + i * 36 * (5 + 1.4), 320, 36);
  }
  // sword motif through letters
  b += r(478, 60, 8, 30, C.steel2);
  b += r(480, 90, 4, 12, C.wood1);
  b += r(466, 102, 32, 5, C.brass1);
  b += r(478, 62, 3, 26, C.steel4, 0.8);
  return svg(1000, 600, 'FORGE TAX pixel-art logo', b);
}

// ------------------------------------------------------------------ UI icons
const icon = (name, body) => svg(24, 24, `UI icon ${name}`, body);

const icons = {
  gold: icon('gold', r(7, 5, 10, 14, C.brass0) + r(8, 4, 8, 16, C.brass2) + r(10, 6, 4, 12, C.brass3) + r(9, 7, 2, 8, C.goldL)),
  swordcoin: icon('swordcoin', pl('12,2 20,7 20,16 12,22 4,16 4,7', C.steel1) + pl('12,4 18,8 18,15 12,20 6,15 6,8', C.steel3) + r(11, 6, 2, 10, C.steel0) + r(9, 11, 6, 2, C.brass1) + r(11, 5, 2, 2, C.white)),
  tribute: icon('tribute', r(4, 10, 16, 8, C.wood1) + r(4, 8, 16, 3, C.wood3) + r(7, 14, 10, 2, C.brass1) + pl('9,4 15,4 15,8 13,11 11,11 9,8', C.steel2) + r(11, 7, 2, 6, C.brass2)),
  quota: icon('quota', r(5, 3, 14, 18, C.boneD) + r(6, 4, 12, 16, C.bone) + r(8, 7, 8, 2, C.ink) + r(8, 11, 8, 2, C.ink) + r(8, 15, 5, 2, C.ink) + r(16, 16, 4, 4, C.blood)),
  charge: icon('charge', pl('13,2 6,13 11,13 9,22 18,10 13,10', C.ember3) + pl('13,4 8,12 12,12 11,18 16,10 12,10', C.ember4)),
  flame: icon('flame', pl('12,2 7,11 10,10 8,18 14,20 17,13 14,14 16,8', C.ember2) + pl('12,7 10,12 12,11 11,16 14,15 15,11 13,12', C.ember4)),
  anvil: icon('anvil', pl('4,8 16,8 20,11 16,13 6,13 4,11', C.steel2) + r(9, 13, 6, 4, C.steel1) + r(6, 17, 12, 3, C.steel0) + r(4, 8, 12, 2, C.steel4)),
  shield: icon('shield', pl('12,2 20,5 19,14 12,22 5,14 4,5', C.steel1) + pl('12,4 18,6 17,13 12,19 7,13 6,6', C.steel3) + r(11, 7, 2, 7, C.teal3) + r(8, 10, 8, 2, C.teal3)),
  lock: icon('lock', r(6, 10, 12, 10, C.brass1) + r(7, 11, 10, 8, C.brass2) + r(8, 4, 8, 7, C.steel1) + r(10, 5, 4, 6, C.steel2) + r(11, 13, 2, 4, C.ink)),
  star: icon('star', pl('12,2 14,9 21,9 15,13 17,21 12,16 7,21 9,13 3,9 10,9', C.gold)) ,
  calendar: icon('calendar', r(3, 5, 18, 16, C.boneD) + r(4, 6, 16, 14, C.bone) + r(3, 5, 18, 4, C.blood) + r(7, 2, 2, 5, C.steel1) + r(15, 2, 2, 5, C.steel1) + r(6, 11, 3, 3, C.ink) + r(11, 11, 3, 3, C.ink) + r(16, 11, 2, 3, C.ink) + r(6, 16, 3, 2, C.ink)),
  codex: icon('codex', r(5, 3, 14, 18, C.blood) + r(6, 4, 12, 16, C.bone) + r(8, 6, 8, 2, C.ink) + r(8, 10, 8, 1, C.ink, 0.6) + r(8, 13, 6, 1, C.ink, 0.6) + r(6, 4, 2, 16, C.brass1)),
  trophy: icon('trophy', r(6, 3, 12, 3, C.brass3) + r(7, 6, 10, 7, C.brass2) + r(9, 13, 6, 3, C.brass1) + r(7, 16, 10, 3, C.brass1) + r(11, 19, 2, 3, C.brass0) + r(4, 5, 3, 6, C.brass1) + r(17, 5, 3, 6, C.brass1)),
  arrow: icon('arrow', pl('4,10 14,10 14,4 21,12 14,20 14,14 4,14', C.bone)),
  hammer: icon('hammer', r(11, 10, 3, 12, C.wood1) + r(4, 4, 16, 6, C.steel2) + r(5, 5, 14, 3, C.steel4) + r(2, 6, 4, 4, C.steel1) + r(18, 6, 4, 4, C.steel1)),
  refresh: icon('refresh', `<path d="M6 9 A6 6 0 1 1 5 14" fill="none" stroke="${C.bone}" stroke-width="3"/><path d="M4 5 L6 10 L11 8 Z" fill="${C.bone}"/>`),
  sword: icon('sword', pl('6,20 8,16 17,5 20,8 9,17 5,19', C.steel2) + r(16, 3, 5, 5, C.steel3) + r(4, 15, 7, 2, C.brass1) + r(5, 18, 3, 3, C.wood1)),
  skull: icon('skull', r(6, 5, 12, 10, C.bone) + r(8, 15, 8, 4, C.bone) + r(8, 8, 3, 4, C.ink) + r(13, 8, 3, 4, C.ink) + r(11, 13, 2, 2, C.ink) + r(9, 16, 1, 2, C.ink) + r(12, 16, 1, 2, C.ink) + r(14, 16, 1, 2, C.ink)),
  eye: icon('eye', pl('2,12 8,6 16,6 22,12 16,18 8,18', C.boneD) + pl('5,12 10,8 14,8 19,12 14,16 10,16', C.bone) + r(10, 9, 4, 6, C.blood) + r(11, 10, 2, 3, C.ink)),
  clock: icon('clock', r(4, 4, 16, 16, C.brass1) + r(5, 5, 14, 14, C.bone) + r(11, 7, 2, 7, C.ink) + r(11, 11, 6, 2, C.ink) + r(4, 4, 16, 2, C.brass2)),
  heat: icon('heat', pl('7,12 12,4 17,12 15,12 17,20 7,20 9,12', C.ember2) + pl('10,14 12,9 14,14 13,18 11,18', C.ember4) + r(3, 6, 2, 4, C.ember1) + r(19, 5, 2, 5, C.ember1)),
  trash: icon('trash', r(5, 6, 14, 15, C.steel1) + r(6, 7, 12, 13, C.steel2) + r(3, 3, 18, 3, C.steel0) + r(9, 2, 6, 3, C.steel1) + r(9, 10, 2, 7, C.ink, 0.5) + r(13, 10, 2, 7, C.ink, 0.5)),
  plus: icon('plus', r(10, 4, 4, 16, C.bone) + r(4, 10, 16, 4, C.bone)),
  check: icon('check', pl('3,12 8,18 21,5 18,2 8,13 5,10', C.teal3)),
  x: icon('x', pl('5,3 9,3 12,8 15,3 19,3 14,11 20,19 16,19 12,13 8,19 4,19 10,11', C.blood)),
  settings: icon('settings', r(9, 2, 6, 4, C.steel2) + r(9, 18, 6, 4, C.steel2) + r(2, 9, 4, 6, C.steel2) + r(18, 9, 4, 6, C.steel2) + r(7, 7, 10, 10, C.steel1) + r(9, 9, 6, 6, C.bone) + r(10, 10, 4, 4, C.ink)),
  save: icon('save', r(3, 3, 18, 18, C.wood1) + r(5, 4, 14, 8, C.steel1) + r(7, 5, 10, 5, C.bone) + r(6, 14, 12, 6, C.wood2) + r(8, 4, 3, 4, C.ink)),
  logout: icon('logout', pl('4,4 12,4 12,8 6,8 6,16 12,16 12,20 4,20', C.bone) + pl('11,12 17,12 17,7 22,12 17,17 17,12', C.teal3)),
  coin: icon('coin', r(5, 5, 14, 14, C.brass1) + r(6, 6, 12, 12, C.brass2) + r(9, 8, 6, 8, C.brass3) + r(10, 10, 3, 4, C.goldL)),
  bag: icon('bag', pl('5,8 19,8 21,21 3,21', C.wood1) + r(8, 4, 8, 4, C.wood2) + r(7, 12, 10, 6, C.wood0) + r(10, 13, 4, 3, C.brass2)),
  arrowUp: icon('arrowUp', pl('12,2 21,12 15,12 15,22 9,22 9,12 3,12', C.teal3)),
  arrowDown: icon('arrowDown', pl('12,22 3,12 9,12 9,2 15,2 15,12 21,12', C.blood)),
};

// ------------------------------------------------------------------ write
const files = {
  'scene/background.svg': workshopBackground(),
  'scene/select_bg.svg': selectBackground(),
  'scene/forge.svg': forgeArt(),
  'scene/anvil.svg': anvilArt(),
  'scene/vending.svg': vendingArt(),
  'scene/tribute.svg': tributeArt(),
  'scene/bell.svg': bellArt(),
  'scene/rack.svg': rackArt(),
  'scene/hammer.svg': hammerArt(),
  'scene/merchant.svg': merchantArt(),
  'scene/dragon_calm.svg': dragonArt('calm'),
  'scene/dragon_warn.svg': dragonArt('warn'),
  'scene/dragon_rage.svg': dragonArt('rage'),
  'scene/title.svg': titleArt(),
  'scene/frenzy_overlay.svg': frenzyRing(),
};
// HUD/button artwork needs its own visible bounds; scene canvases include
// positioning space used by the workshop and ending illustrations.
files['ui/hammer-forge.svg'] = files['scene/hammer.svg'].replace(
  'width="96" height="96" viewBox="0 0 96 96"',
  'width="42" height="42" viewBox="4 6 42 42"',
);
for (const mood of ['calm', 'warn', 'rage']) {
  files[`ui/dragon_${mood}.svg`] = files[`scene/dragon_${mood}.svg`].replace(
    'width="380" height="220" viewBox="0 0 380 220"',
    'width="184" height="144" viewBox="14 0 184 144"',
  );
}
for (const [rel, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(ROOT, 'client/assets', rel), content);
}
for (const [name, content] of Object.entries(icons)) {
  fs.writeFileSync(path.join(UI, `${name}.svg`), content);
}
console.log(`Generated ${Object.keys(files).length} scene/framed assets and ${Object.keys(icons).length} UI icons.`);
