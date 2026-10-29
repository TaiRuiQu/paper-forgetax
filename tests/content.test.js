import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../shared/engine/engine.js';
import {
  RELICS, RELIC_BY_ID } from '../shared/data/relics.js';
import {
  ACHIEVEMENTS, CONSUMABLES, STARTING_RELIC_POOL, SWORD_FAMILIES, FAMILY_ORDER,
  TRIBUTE_DAYS, CONTRACT_DAYS,
} from '../shared/data/gameData.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'client/assets');

function fresh(seed, relics = []) {
  const state = E.createRun({ seed, profile: E.emptyProfile() });
  E.chooseStartingRelic(state, state.startingChoices[0]);
  state.relics = [...relics];
  state.cooldownUntil = 0;
  return state;
}

function anvil(state, level = 8) {
  state.swords = [];
  state.anvilSwordId = null;
  state.hammerSnapshot = null;
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  const s = E.makeSword(state, { route: 0, level });
  s.level = level;
  s.historyMaxLevel = level;
  s.valueHistoryMax = E.swordValue(state, s);
  E.placeOnAnvil(state, s.id);
  s.heat = true;
  state.cooldownUntil = 0;
  return s;
}

test('all 94 relic icons, descriptions and shop metadata exist', () => {
  assert.equal(RELICS.length, 94);
  assert.equal(new Set(RELICS.map(r => r.id)).size, 94);
  for (const r of RELICS) {
    assert.ok(RELIC_BY_ID[r.id]);
    assert.ok(r.zh && r.en && r.desc.length >= 6, r.id);
    assert.ok(['common', 'rare', 'legendary'].includes(r.rarity), r.id);
    assert.ok(r.minDay >= 2 && r.minDay <= 9, r.id);
    assert.ok(r.cost >= 1 && r.cost <= 5, r.id);
    const icon = path.join(ASSETS, 'relics', `${r.id}.svg`);
    assert.ok(fs.existsSync(icon), icon);
    const svg = fs.readFileSync(icon, 'utf8');
    assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'), r.id);
    assert.ok(!/NaN|undefined/.test(svg), r.id);
  }
});

test('every relic survives all five hammer outcomes without throwing', () => {
  let runs = 0;
  for (const relic of RELICS) {
    for (const raw of ['success', 'great', 'hold', 'damage', 'break']) {
      const state = fresh(1000 + runs, [relic.id]);
      const s = anvil(state, 8);
      s.charge = 0;
      const res = E.hammer(state, { forceRaw: raw, now: Date.now() + 60000, ignoreCooldown: true });
      assert.equal(res.ok, true, `${relic.id} / ${raw}`);
      assert.doesNotThrow(() => JSON.stringify(state), `${relic.id} / ${raw} serializable`);
      assert.ok(['playing', 'victory', 'dead'].includes(state.phase));
      runs++;
    }
  }
  assert.equal(runs, 94 * 5);
});

test('all nine families have six generated stages, routes, broken and remnant art', () => {
  assert.equal(FAMILY_ORDER.length, 9);
  for (const fam of FAMILY_ORDER) {
    assert.equal(SWORD_FAMILIES[fam].stages.length, 6, fam);
    assert.equal(SWORD_FAMILIES[fam].baseValue, SWORD_FAMILIES[fam].source === 'merchant' ? 640 : 320, fam);
    for (let stage = 0; stage < 6; stage++) {
      const file = path.join(ASSETS, 'swords', `${fam}_s${stage}.svg`);
      assert.ok(fs.existsSync(file), file);
    }
  }
  for (const route of [0, 1, 2]) {
    assert.ok(fs.existsSync(path.join(ASSETS, 'swords', `route${route}_s3.svg`)));
  }
  for (const file of ['broken.svg', 'remnant.svg']) {
    assert.ok(fs.existsSync(path.join(ASSETS, 'swords', file)));
  }
});

test('scene, UI, consumable and achievement art is complete', () => {
  const scene = ['background.svg', 'select_bg.svg', 'forge.svg', 'anvil.svg', 'vending.svg', 'tribute.svg', 'bell.svg', 'rack.svg', 'hammer.svg', 'merchant.svg', 'dragon_calm.svg', 'dragon_warn.svg', 'dragon_rage.svg', 'title.svg', 'frenzy_overlay.svg'];
  for (const f of scene) assert.ok(fs.existsSync(path.join(ASSETS, 'scene', f)), f);
  const ui = ['gold.svg', 'swordcoin.svg', 'tribute.svg', 'quota.svg', 'charge.svg', 'flame.svg', 'anvil.svg', 'shield.svg', 'lock.svg', 'star.svg', 'calendar.svg', 'codex.svg', 'trophy.svg', 'arrow.svg', 'hammer.svg', 'refresh.svg', 'sword.svg', 'skull.svg', 'eye.svg', 'clock.svg', 'heat.svg', 'trash.svg', 'plus.svg', 'check.svg', 'x.svg', 'settings.svg', 'save.svg', 'logout.svg'];
  for (const f of ui) assert.ok(fs.existsSync(path.join(ASSETS, 'ui', f)), f);
  for (const key of Object.keys(CONSUMABLES)) assert.ok(fs.existsSync(path.join(ASSETS, 'consumables', `${key}.svg`)), key);
  for (const a of ACHIEVEMENTS) assert.ok(fs.existsSync(path.join(ASSETS, 'achievements', `${a.id}.svg`)), a.id);
  assert.ok(fs.existsSync(path.join(ASSETS, 'fonts', 'press-start-2p.woff2')));
  assert.ok(fs.existsSync(path.join(ASSETS, 'fonts', 'fusion-pixel-12px-zh_hans.woff2')));
});

test('content counts and unlock mapping match the reference', () => {
  assert.equal(ACHIEVEMENTS.length, 19);
  assert.equal(ACHIEVEMENTS.filter(a => a.family).length, 9);
  assert.equal(ACHIEVEMENTS.filter(a => a.unlock).length, 16);
  assert.equal(Object.keys(CONSUMABLES).length, 7);
  assert.equal(CONSUMABLES.cracked_dragon_scale.minDay, 3);
  assert.equal(CONSUMABLES.incense_of_oblivion.minDay, 9);
  assert.equal(TRIBUTE_DAYS.length, 21);
  assert.equal(CONTRACT_DAYS, 21);
  for (const a of ACHIEVEMENTS) {
    if (a.unlock) assert.ok(RELIC_BY_ID[a.unlock], `missing relic for ${a.id}`);
  }
  assert.equal(STARTING_RELIC_POOL.length, 8);
  assert.ok(STARTING_RELIC_POOL.includes('undertakers-chalice'));
  assert.ok(!STARTING_RELIC_POOL.includes('leather-loop'));
  for (const removed of ['interest', 'copper-ledger', 'small-safe', 'relief-sack', 'burial-coin']) {
    assert.equal(RELIC_BY_ID[removed], undefined, removed);
  }
});

test('every sword family reaches the +20 appearance and reveals its final name', () => {
  const state = fresh(77);
  for (const fam of FAMILY_ORDER) {
    state.pending = { supplyExtra: 0, supplyMinLevel: 0, inheritLevels: 0, inheritCharge: 0, hungrySigns: 0, smithLevels: 0 };
    const s = E.makeSword(state, { family: fam, level: 20 });
    assert.equal(E.swordStage(s), 5, fam);
    assert.equal(E.swordRevealed(s), true, fam);
    assert.equal(E.swordDisplayName(s), SWORD_FAMILIES[fam].stages[5], fam);
    assert.equal(E.swordArtKey(s), `${fam}_s5`, fam);
  }
});
