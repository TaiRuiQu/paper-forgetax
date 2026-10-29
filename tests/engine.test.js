import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine/engine.js';
import { baseQuotaForDay, dayInfo, SWORD_FAMILIES } from '../shared/data/gameData.js';
import { RELIC_BY_ID, RELICS } from '../shared/data/relics.js';

function fresh(seed = 20261028, relics = []) {
  const state = E.createRun({ seed, profile: E.emptyProfile() });
  const res = E.chooseStartingRelic(state, state.startingChoices[0]);
  assert.equal(res.ok, true);
  state.relics = [...relics];
  state.cooldownUntil = 0;
  return state;
}

function clearBoard(state) {
  state.swords = [];
  state.anvilSwordId = null;
  state.hammerSnapshot = null;
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  state.cooldownUntil = 0;
}

function anvil(state, level = 0, opts = {}) {
  clearBoard(state);
  const s = E.makeSword(state, { route: opts.route ?? 0, level });
  s.level = level;
  s.historyMaxLevel = level;
  s.baseValue = opts.baseValue ?? SWORD_FAMILIES[s.family].baseValue;
  s.valueHistoryMax = E.swordValue(state, s);
  s.charge = opts.charge ?? 0;
  const placed = E.placeOnAnvil(state, s.id);
  assert.equal(placed.ok, true);
  s.heat = opts.heat ?? true;
  state.cooldownUntil = 0;
  return s;
}

function hammer(state, raw, now = 100000) {
  state.cooldownUntil = 0;
  return E.hammer(state, { forceRaw: raw, now, ignoreCooldown: true });
}

test('sword value follows the documented 1.5^level curve', () => {
  const state = fresh(1);
  const cases = [[0, 320], [1, 480], [2, 720], [3, 1080], [4, 1620], [5, 2430], [6, 3645], [10, 18453], [12, 41519], [15, 140126], [20, 1064082]];
  for (const [level, expected] of cases) {
    const s = anvil(state, level);
    assert.equal(E.swordValue(state, s), expected, `level +${level}`);
  }
});

test('a great success from +8 to +10 is worth 20,503 G', () => {
  const state = fresh(2);
  const s = anvil(state, 8);
  const before = E.swordValue(state, s);
  assert.equal(before, 8201);
  const res = hammer(state, 'great');
  assert.equal(res.ok, true);
  assert.equal(s.level, 10);
  assert.equal(E.swordValue(state, s), 20503);
});

test('base break chances match the public table at key levels', () => {
  const state = fresh(3);
  const expect = { 0: 0, 1: 1.8, 2: 5.9, 3: 12.9, 4: 24.8, 5: 29.7, 6: 34.7, 7: 38.3, 8: 41.8, 9: 44.3, 10: 46.7, 12: 50.5, 15: 54.5, 20: 63.0, 25: 67.5, 30: 72.0 };
  for (const [level, p] of Object.entries(expect)) {
    assert.ok(Math.abs(E.breakChanceBase(Number(level)) - p) < 1e-9, `base +${level}`);
    const s = anvil(state, Number(level));
    const dist = E.computeDistribution(state, s);
    assert.ok(Math.abs(dist.percents.break - p) <= 0.11, `distribution +${level}: ${dist.percents.break} vs ${p}`);
    assert.equal(Object.values(dist.slots).reduce((a, b) => a + b, 0), 1000);
  }
});

test('relative break reduction uses multiplication, not percentage points', () => {
  const state = fresh(4);
  const s = anvil(state, 10);
  const base = E.computeDistribution(state, s).percents.break;
  state.relics = ['black-knot'];
  const reduced = E.computeDistribution(state, s).percents.break;
  assert.ok(Math.abs(reduced - base * 0.9) < 0.12, `${reduced} should be ~90% of ${base}`);
  state.relics = ['black-knot', 'dragonscale-tongs'];
  const stacked = E.computeDistribution(state, s).percents.break;
  assert.ok(Math.abs(stacked - base * 0.9 * 0.75) < 0.12);
});

test('frenzy removes break and charges are per-sword', () => {
  const state = fresh(5);
  const s = anvil(state, 5, { charge: 10 });
  const res = hammer(state, 'hold');
  assert.equal(res.frenzyStarted, true);
  assert.equal(res.distribution.percents.break, 0);
  assert.equal(s.charge, 0);
  assert.ok(state.frenzy.active);
});

test('sword must be heated before hammering; heat persists after taking it off', () => {
  const state = fresh(6);
  const s = anvil(state, 0, { heat: false });
  const bad = E.hammer(state, { forceRaw: 'success', now: 1, ignoreCooldown: true });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'not-heated');
  E.heatAnvilSword(state);
  assert.equal(s.heat, true);
  E.takeAnvilSword(state);
  E.placeOnAnvil(state, s.id);
  assert.equal(s.heat, true);
  assert.equal(hammer(state, 'success').ok, true);
});

test('success, damage and value-loss relic interactions', () => {
  const state = fresh(7);
  const s = anvil(state, 4);
  const startValue = E.swordValue(state, s);
  hammer(state, 'damage');
  assert.equal(s.level, 3);
  assert.ok(E.swordValue(state, s) < startValue);
  state.relics = ['patched-apron', 'cracked-splice'];
  hammer(state, 'damage');
  assert.equal(s.level, 2);
  assert.equal(s.layers.splice, 1);
  assert.ok(s.flat >= 140);
});

test('sealing stone rewards every second consecutive hold', () => {
  const state = fresh(8, ['sealing-stone']);
  const s = anvil(state, 0);
  hammer(state, 'hold');
  assert.equal(s.level, 0);
  assert.equal(s.counters.holdChain, 1);
  hammer(state, 'hold');
  assert.equal(s.counters.holdChain, 2);
  assert.equal(s.level, 1);
  hammer(state, 'success');
  assert.equal(s.counters.holdChain, 0);
});

test('great sign multipliers and extra levels apply', () => {
  const state = fresh(9, ['golden-nail', 'silver-tuning-fork']);
  const s = anvil(state, 0);
  const dist = E.computeDistribution(state, s);
  assert.equal(dist.counts.great, 2 + 2);
  hammer(state, 'great');
  assert.equal(s.level, 3);
});

test('phoenix ash prevents a break, keeps level and costs 40% value', () => {
  const state = fresh(10, ['phoenix-ash']);
  const s = anvil(state, 5);
  const before = E.swordValue(state, s);
  const res = hammer(state, 'break');
  assert.equal(res.trueBreak, false);
  assert.equal(res.result, 'break');
  assert.equal(s.level, 5);
  assert.equal(s.protections.phoenixUsed, true);
  assert.equal(E.swordValue(state, s), Math.round(before * 0.6));
});

test('crumble protections consume in order and can convert to damage', () => {
  const state = fresh(11, ['cracked_dragon_scale']);
  const s = anvil(state, 3);
  state.consumables.cracked_dragon_scale = 1;
  const use = E.useConsumable(state, 'cracked_dragon_scale');
  assert.equal(use.ok, true);
  const res = hammer(state, 'break');
  assert.equal(res.trueBreak, false);
  assert.equal(res.protectedBy, 'scale');
  assert.ok(E.getSword(state, s.id));
  assert.equal(state.consumables.cracked_dragon_scale, 0);
});

test('powder pouch turns a hold into a true break (without protection)', () => {
  const state = fresh(12);
  const s = anvil(state, 2);
  state.consumables.powder_pouch = 1;
  assert.equal(E.useConsumable(state, 'powder_pouch').ok, true);
  const res = hammer(state, 'hold');
  assert.equal(res.trueBreak, true);
  assert.equal(E.getSword(state, s.id), null);
});

test('broken holy sword passes 30% levels and 3 charge to the next +0 sword', () => {
  const state = fresh(13, ['broken-holy-sword']);
  const s = anvil(state, 10);
  hammer(state, 'break');
  assert.equal(state.pending.inheritLevels, 3);
  assert.equal(state.pending.inheritCharge, 3);
  const next = E.makeSword(state, { route: 0, level: 0 });
  assert.equal(next.level, 3);
  assert.equal(next.charge, 3);
});

test("undertaker's chalice creates a remnant worth 30% of historical peak and places it on tribute", () => {
  const state = fresh(14, ['undertakers-chalice']);
  const s = anvil(state, 10);
  s.valueHistoryMax = E.swordValue(state, s);
  const expected = Math.floor(s.valueHistoryMax * 0.3);
  hammer(state, 'break');
  const remnant = state.swords.find(x => x.remnant);
  assert.ok(remnant);
  assert.equal(remnant.remnantValue, expected);
  assert.equal(remnant.location, 'tribute');
  assert.equal(E.tributeTotal(state), expected);
});

test('ash sieve pays 500 gold on a true break', () => {
  const state = fresh(15, ['ash-sieve']);
  anvil(state, 1);
  const before = state.gold;
  hammer(state, 'break');
  assert.equal(state.gold, before + 500);
});

test('hungry molar gives the next un-forged sword four permanent success signs', () => {
  const state = fresh(16, ['hungry-molar']);
  anvil(state, 5);
  hammer(state, 'break');
  assert.equal(state.pending.hungrySigns, 4);
  const next = E.makeSword(state, { route: 0, level: 0 });
  assert.equal(next.layers.successSigns, 4);
});

test('full tribute pays gold, advances day and keeps three base swords', () => {
  const state = fresh(17);
  clearBoard(state);
  const s = E.makeSword(state, { level: 6 });
  s.level = 6;
  s.historyMaxLevel = 6;
  assert.equal(E.placeOnTribute(state, s.id).ok, true);
  const quota = E.currentQuota(state);
  assert.equal(quota, 1800);
  assert.equal(E.tributeTotal(state), 3645);
  const res = E.ringBell(state);
  assert.equal(res.ok, true);
  assert.equal(res.summary.full, true);
  assert.equal(state.gold, 3645);
  assert.equal(state.anger, 0);
  assert.equal(state.day, 2);
  assert.equal(E.inventorySwords(state).length, 3);
  assert.equal(E.currentQuota(state), 2100);
});

test('short tribute raises anger and still grants three swords next day', () => {
  const state = fresh(18);
  clearBoard(state);
  const s = E.makeSword(state, { level: 0 });
  E.placeOnTribute(state, s.id);
  const res = E.ringBell(state);
  assert.equal(res.summary.full, false);
  assert.equal(state.anger, 1);
  assert.equal(state.day, 2);
  assert.equal(E.inventorySwords(state).length, 3);
  assert.equal(state.gold, 320);
});

test('third anger stage kills, unless a pardon is held', () => {
  const state = fresh(19);
  clearBoard(state);
  state.anger = 2;
  let s = E.makeSword(state, { level: 0 });
  E.placeOnTribute(state, s.id);
  let res = E.ringBell(state);
  assert.equal(state.phase, 'dead');
  assert.equal(res.summary.death, true);
  assert.ok(state.unlockedAchievements.includes('now_hiring'));

  const state2 = fresh(20, ['dragons-pardon']);
  clearBoard(state2);
  state2.anger = 2;
  s = E.makeSword(state2, { level: 0 });
  E.placeOnTribute(state2, s.id);
  res = E.ringBell(state2);
  assert.equal(res.summary.death, false);
  assert.equal(res.summary.pardonUsed, true);
  assert.equal(state2.phase, 'playing');
  assert.equal(state2.anger, 2);
  assert.equal(state2.relics.includes('dragons-pardon'), false);
});

test('final day shortfall can still complete the contract if alive', () => {
  const state = fresh(21);
  clearBoard(state);
  state.day = 21;
  state.quotaBase = 232000;
  state.anger = 1;
  const s = E.makeSword(state, { level: 0 });
  E.placeOnTribute(state, s.id);
  const res = E.ringBell(state);
  assert.equal(res.summary.full, false);
  assert.equal(res.summary.death, false);
  assert.equal(res.summary.contractComplete, true);
  assert.equal(state.phase, 'victory');
  assert.equal(state.anger, 2);
  assert.ok(state.unlockedAchievements.includes('clocking_out'));
});

test('royal change carries 30% of excess into next quota', () => {
  const state = fresh(22, ['royal-change']);
  clearBoard(state);
  const s = E.makeSword(state, { level: 5 });
  E.placeOnTribute(state, s.id);
  assert.equal(E.tributeTotal(state), 2430);
  E.ringBell(state);
  assert.equal(state.day, 2);
  // excess 630, 30% = 189; next base 2100 -> 1911
  assert.equal(state.royalChangeCarry, 189);
  assert.equal(E.currentQuota(state), 1911);
});

test('keep the change and one last chance achievements', () => {
  const state = fresh(23);
  clearBoard(state);
  state.anger = 2;
  const s = E.makeSword(state, { level: 10 });
  E.placeOnTribute(state, s.id);
  const total = E.tributeTotal(state);
  assert.ok(total >= 1800 * 3);
  const res = E.ringBell(state);
  assert.equal(res.summary.full, true);
  assert.ok(state.unlockedAchievements.includes('keep_change'));
  assert.ok(state.unlockedAchievements.includes('one_last_chance'));
});

test('shop sells three relics, respects slots and rerolls', () => {
  const state = fresh(24);
  state.day = 2;
  E.setupDay(state, 2);
  assert.equal(state.shop.items.length, 3);
  assert.ok(state.shop.items.every(i => i && RELIC_BY_ID[i.relicId]));
  state.coins = 100;
  const first = state.shop.items.find(i => i && !i.sold);
  const idx = state.shop.items.indexOf(first);
  const buy = E.buyRelic(state, idx);
  assert.equal(buy.ok, true);
  assert.equal(state.relics.length, 1);
  assert.equal(state.shop.items[idx].sold, true);
  state.relics = RELICS.slice(0, 8).map(r => r.id);
  const second = state.shop.items.findIndex(i => i && !i.sold);
  const full = E.buyRelic(state, second);
  assert.equal(full.ok, false);
  assert.equal(full.error, 'slots-full');
  state.relics = state.relics.slice(0, 1);
  state.gold = 10000;
  const rr = E.rerollShop(state);
  assert.equal(rr.ok, true);
  assert.equal(state.shop.paidRerolls, 1);
});

test('worn voucher gives a free daily reroll without raising paid price', () => {
  const state = fresh(25, ['worn-voucher']);
  state.day = 2;
  E.setupDay(state, 2);
  state.gold = 0;
  const rr = E.rerollShop(state);
  assert.equal(rr.ok, true);
  assert.equal(rr.free, true);
  assert.equal(state.shop.paidRerolls, 0);
  assert.equal(state.shop.freeRerollUsed, true);
  const paid = E.rerollShop(state);
  assert.equal(paid.ok, false);
  assert.equal(paid.error, 'no-gold');
});

test('merchant visits, sells swords and triples repeat base sword price', () => {
  const state = fresh(26);
  state.gold = 1_000_000;
  E.setupDay(state, 6);
  assert.ok(state.merchant);
  assert.equal(state.merchant.visit, 2);
  const base = state.merchant.items.find(i => i.sub === 'base');
  assert.ok(base.stock >= 2);
  const beforeGold = state.gold;
  const price = base.price;
  const res = E.buyMerchantItem(state, state.merchant.items.indexOf(base));
  assert.equal(res.ok, true);
  assert.equal(state.gold, beforeGold - price);
  assert.equal(base.stock, base.initialStock - 1);
  assert.equal(base.price, Math.round(price * 3 / 10) * 10);
});

test('buying out a merchant grants the hidden achievement', () => {
  const state = fresh(27);
  state.gold = 1_000_000_000;
  E.setupDay(state, 6);
  let guard = 0;
  while (state.merchant.items.some(i => i.stock > 0) && guard < 50) {
    const idx = state.merchant.items.findIndex(i => i.stock > 0);
    const r = E.buyMerchantItem(state, idx);
    assert.equal(r.ok, true);
    guard++;
  }
  assert.ok(state.merchant.items.every(i => i.stock === 0));
  assert.ok(state.unlockedAchievements.includes('take_everything'));
});

test('merchant purchases record swords and consumables in their own codex buckets', () => {
  const state = fresh(27);
  state.gold = 1_000_000_000;
  E.setupDay(state, 6);
  state.codex.consumables = {};
  state.codex.merchant = {};
  for (const [index, item] of state.merchant.items.entries()) {
    assert.equal(E.buyMerchantItem(state, index).ok, true);
    const key = item.kind === 'sword' ? `${item.sub}-sword` : item.key;
    assert.equal(state.codex.merchant[key], true);
    if (item.kind === 'consumable') assert.equal(state.codex.consumables[key], true);
  }
  assert.deepEqual(Object.keys(state.codex.consumables).sort(), state.merchant.items
    .filter(item => item.kind === 'consumable').map(item => item.key).sort());
  assert.equal(Object.hasOwn(state.codex.merchant, 'undefined'), false);
});

test('loading and merging old codex progress removes undefined entries without losing discoveries', () => {
  const state = fresh(27);
  state.codex.consumables = { undefined: true, regret_clockwork: true };
  state.codex.merchant = { undefined: true, 'base-sword': true };
  const expected = structuredClone(state.codex);
  delete expected.consumables.undefined;
  delete expected.merchant.undefined;
  assert.deepEqual(E.hydrateState(E.prepareSave(state)).codex, expected);
  const profile = E.emptyProfile();
  profile.codex = structuredClone(state.codex);
  assert.deepEqual(E.mergeProfile(profile).codex, expected);
  assert.deepEqual(E.mergeCodex(E.emptyProfile().codex, state.codex), expected);
  assert.deepEqual(E.mergeCodex(structuredClone(state.codex), state.codex), expected);
});

test('codex recorders ignore missing and unknown item keys', () => {
  const state = fresh(27);
  const before = structuredClone(state.codex);
  for (const key of [undefined, null, '', 'undefined', 'unknown-item', 'constructor']) {
    E.markSeenConsumable(state, key);
    E.markSeenMerchantItem(state, key);
  }
  assert.deepEqual(state.codex, before);
});

test('incense is only sold when angry and lowers anger once', () => {
  const state = fresh(28);
  state.day = 9;
  state.anger = 1;
  E.setupDay(state, 9);
  const item = state.merchant.items.find(i => i.key === 'incense_of_oblivion');
  if (item) {
    const idx = state.merchant.items.indexOf(item);
    state.gold = item.price;
    const res = E.buyMerchantItem(state, idx);
    assert.equal(res.ok, true);
    assert.equal(state.anger, 0);
    assert.equal(state.flags.incenseUsed, true);
  }
});

test('consumables enforce frenzy / charge restrictions', () => {
  const state = fresh(29);
  const s = anvil(state, 3, { charge: 10 });
  state.consumables.cold_star_shard = 1;
  const shard = E.useConsumable(state, 'cold_star_shard');
  assert.equal(shard.ok, false);
  state.consumables.cracked_dragon_scale = 1;
  const scale = E.useConsumable(state, 'cracked_dragon_scale');
  assert.equal(scale.ok, false);
  // start frenzy with the next hammer
  hammer(state, 'success');
  assert.ok(state.frenzy.active);
  const chalk = E.useConsumable(state, 'cold_star_shard');
  assert.equal(chalk.ok, false);
  state.consumables.red_chalk = 1;
  assert.equal(E.useConsumable(state, 'red_chalk').ok, true);
  const dist = E.computeDistribution(state, s, { inFrenzy: true, redChalk: true });
  assert.equal(dist.percents.break, 0);
});

test('a full rewind restores sword, gold and consumables', () => {
  const state = fresh(30);
  const s = anvil(state, 6);
  state.consumables.regret_clockwork = 1;
  const v = E.swordValue(state, s);
  hammer(state, 'break');
  assert.equal(E.getSword(state, s.id), null);
  const rew = E.rewindHammer(state);
  assert.equal(rew.ok, true);
  const restored = E.getSword(state, s.id);
  assert.ok(restored);
  assert.equal(restored.level, 6);
  assert.equal(E.swordValue(state, restored), v);
  assert.equal(state.consumables.regret_clockwork, 0);
});

test('achievements +10, mastery and codex reveal trigger correctly', () => {
  const state = fresh(31);
  let s = anvil(state, 9);
  hammer(state, 'success');
  assert.equal(s.level, 10);
  assert.ok(state.unlockedAchievements.includes('one_more_hit'));
  assert.ok((state.codex.swords[s.family] || 0) >= 4);

  s.level = 19;
  s.historyMaxLevel = 19;
  E.refreshAllValues(state);
  hammer(state, 'success');
  assert.equal(s.level, 20);
  assert.ok(state.unlockedAchievements.includes(`mastery_${s.family}`));
});

test('all thumbs fires at ten true breaks in one run', () => {
  const state = fresh(32);
  for (let i = 0; i < 10; i++) {
    anvil(state, 1);
    hammer(state, 'break');
  }
  assert.equal(state.run.breaks, 10);
  assert.ok(state.unlockedAchievements.includes('all_thumbs'));
});

test('save preparation drops the rewind snapshot and hydration restores timers', () => {
  const state = fresh(33);
  const s = anvil(state, 3, { charge: 10 });
  hammer(state, 'hold', Date.now()); // starts frenzy
  const saved = E.prepareSave(state);
  assert.equal(saved.hammerSnapshot, null);
  assert.equal(saved.frenzy.active, true);
  const restored = E.hydrateState(saved);
  assert.ok(restored.frenzy.endsAt > Date.now());
  assert.equal(restored.swords.length, state.swords.length);
});

test('endless quota grows by 20% and extra tributes count toward job for life', () => {
  const state = fresh(34);
  clearBoard(state);
  state.phase = 'victory';
  state.contractCompleted = true;
  state.day = 21;
  state.quotaBase = 232000;
  E.continueEndless(state);
  assert.equal(state.day, 22);
  assert.equal(E.currentQuota(state), 278400);
  state.phase = 'playing';
  // three full tributes after contract
  for (let i = 0; i < 3; i++) {
    clearBoard(state);
    const s = E.makeSword(state, { level: 20 });
    E.placeOnTribute(state, s.id);
    const r = E.ringBell(state);
    assert.equal(r.summary.full, true);
    state.phase = 'playing';
  }
  assert.ok(state.unlockedAchievements.includes('job_for_life'));
});

test('all 94 relic definitions are present and mapped to an icon', async () => {
  const fs = await import('node:fs');
  assert.equal(RELICS.length, 94);
  for (const r of RELICS) {
    assert.ok(RELIC_BY_ID[r.id]);
    assert.ok(fs.existsSync(new URL(`../client/assets/relics/${r.id}.svg`, import.meta.url)), r.id);
  }
});

test('quota table matches the reference calendar', () => {
  assert.equal(baseQuotaForDay(1), 1800);
  assert.equal(baseQuotaForDay(21), 232000);
  assert.equal(dayInfo(3).merchant, true);
  assert.equal(dayInfo(4).merchant, false);
  assert.equal(dayInfo(21).merchant, true);
  assert.equal(dayInfo(22).merchant, false);
  assert.equal(dayInfo(24).merchant, true);
});
