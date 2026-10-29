import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine/engine.js';

function fresh(seed = 1234, relics = []) {
  const state = E.createRun({ seed, profile: E.emptyProfile() });
  E.chooseStartingRelic(state, state.startingChoices[0]);
  state.relics = [...relics];
  state.cooldownUntil = 0;
  return state;
}

function clear(state) {
  state.swords = [];
  state.anvilSwordId = null;
  state.hammerSnapshot = null;
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  state.cooldownUntil = 0;
}

function anvil(state, level = 0, opts = {}) {
  clear(state);
  const s = E.makeSword(state, { route: 0, level });
  s.level = level;
  s.historyMaxLevel = level;
  s.valueHistoryMax = E.swordValue(state, s);
  s.charge = opts.charge ?? 0;
  E.placeOnAnvil(state, s.id);
  s.heat = true;
  if (opts.lastResult) s.lastResult = opts.lastResult;
  state.cooldownUntil = 0;
  return s;
}

function hammer(state, raw, now = Date.now() + 10000) {
  state.cooldownUntil = 0;
  return E.hammer(state, { forceRaw: raw, now, ignoreCooldown: true });
}

test('sealed rebate lowers the current quota by 10%', () => {
  const state = fresh(200, ['sealed-rebate']);
  assert.equal(E.currentQuota(state), 1620);
});

test('supply permit, journeyman, lifetime contract and ghost delivery modify next supply', () => {
  const state = fresh(201, ['supply-permit']);
  clear(state);
  E.setupDay(state, 2);
  assert.equal(E.inventorySwords(state).length, 4);

  state.pending.supplyExtra = 2;
  clear(state);
  E.setupDay(state, 3);
  assert.equal(E.inventorySwords(state).length, 6); // 3 base + permit + 2 queued

  state.relics = ['lifetime-contract'];
  clear(state);
  E.setupDay(state, 4);
  assert.ok(E.inventorySwords(state).every(s => s.level === 7));

  state.relics = [];
  state.pending.supplyMinLevel = 2;
  clear(state);
  E.setupDay(state, 5);
  assert.ok(E.inventorySwords(state).every(s => s.level >= 2));
});

test("smith's testament carries 30% of the offered highest level into the next supply", () => {
  const state = fresh(202, ['smiths-testament']);
  clear(state);
  const s = E.makeSword(state, { level: 10 });
  s.level = 10;
  s.historyMaxLevel = 10;
  E.placeOnTribute(state, s.id);
  E.ringBell(state);
  // setupDay already ran inside ringBell; the pending inheritance should be consumed into one of the new swords.
  assert.equal(state.pending.smithLevels, 0);
  assert.ok(E.inventorySwords(state).some(x => x.level >= 3));
});

test('ossuary and undertaker ledger react to a high-level true break', () => {
  const state = fresh(203, ['ossuary-kings-scabbard', 'undertakers-ledger']);
  const s = anvil(state, 7, { lastResult: 'hold' });
  hammer(state, 'break');
  assert.equal(state.runSigns.hold, 1);
  assert.equal(state.pending.supplyExtra, 1);
  assert.equal(state.daily.ledgerExtra, 1);
});

test('grudge nail stores level-count great signs and spends them on a great', () => {
  const state = fresh(204, ['grudge-nail']);
  anvil(state, 7);
  hammer(state, 'break');
  assert.equal(state.pendingGreatSigns, 7);
  const s = anvil(state, 0);
  const counts = E.computeDistribution(state, s).counts;
  assert.ok(counts.great >= 2 + 7);
  hammer(state, 'great');
  assert.equal(state.pendingGreatSigns, 0);
});

test('cornerstone and wirebound scabbard convert breaks to damage', () => {
  const state = fresh(205, ['unyielding-cornerstone']);
  let s = anvil(state, 5);
  let res = hammer(state, 'break');
  assert.equal(res.trueBreak, false);
  assert.equal(res.result, 'damage');
  assert.equal(s.level, 4);
  assert.equal(s.protections.cornerstoneUsed, true);

  state.relics = ['wirebound-scabbard'];
  s = anvil(state, 5);
  res = hammer(state, 'break');
  assert.equal(res.result, 'damage');
  assert.equal(state.daily.wireboundUsed, true);
  assert.equal(s.level, 4);
  E.setupDay(state, 2);
  assert.equal(state.daily.wireboundUsed, false);
});

test("giant's spine prepares after two damages and does not recharge from its own protection", () => {
  const state = fresh(206, ['giants-spine']);
  const s = anvil(state, 5);
  hammer(state, 'damage');
  assert.equal(s.protections.spineCharges, 0);
  hammer(state, 'damage');
  assert.equal(s.protections.spineCharges, 1);
  const counterBefore = s.counters.spineCounter;
  const res = hammer(state, 'break');
  assert.equal(res.result, 'damage');
  assert.equal(res.protectedBy, 'spine');
  assert.equal(s.protections.spineCharges, 0);
  assert.equal(s.counters.spineCounter, counterBefore);
});

test('abyssal pearl blocks the first two level losses but not the third', () => {
  const state = fresh(207, ['abyssal-pearl']);
  const s = anvil(state, 5);
  hammer(state, 'damage');
  assert.equal(s.level, 5);
  hammer(state, 'damage');
  assert.equal(s.level, 5);
  hammer(state, 'damage');
  assert.equal(s.level, 4);
  const dist = E.computeDistribution(state, s);
  assert.ok(dist.counts.damage >= 2 + 3);
});

test('headless bell gives +1 level at frenzy end', () => {
  const state = fresh(208, ['headless-bell']);
  const s = anvil(state, 0, { charge: 10 });
  const now = Date.now();
  const res = hammer(state, 'hold', now);
  assert.equal(res.frenzyStarted, true);
  assert.equal(s.level, 0);
  E.tick(state, now + E.frenzyDuration(state) + 100);
  assert.equal(state.frenzy.active, false);
  assert.equal(s.level, 1);
});

test('glass hourglass and silver tuning fork alter great-success level counts', () => {
  const state = fresh(209, ['silver-tuning-fork']);
  let s = anvil(state, 0);
  hammer(state, 'great');
  assert.equal(s.level, 3);

  state.relics = ['glass-hourglass'];
  s = anvil(state, 0, { charge: 10 });
  hammer(state, 'great');
  assert.equal(s.level, 3);
});

test('stored great levels and small wind bell levels are consumed correctly', () => {
  const state = fresh(210, ['sealed-heart', 'little-wind-bell']);
  let s = anvil(state, 0);
  hammer(state, 'hold');
  hammer(state, 'hold');
  assert.equal(s.store.sealedGreatLevels, 2);
  assert.equal(s.store.successLevels, 2);
  const dist = E.computeDistribution(state, s);
  assert.ok(dist);
  hammer(state, 'success');
  assert.equal(s.level, 3); // base 1 + little wind bell 2 (sealed heart is for great only)
  assert.equal(s.store.successLevels, 0);
  assert.equal(s.store.sealedGreatLevels, 2);
  hammer(state, 'great');
  assert.equal(s.store.sealedGreatLevels, 0);
});

test('interlocking weights gives +2 levels after damage', () => {
  const state = fresh(211, ['interlocking-weights']);
  const s = anvil(state, 2);
  hammer(state, 'damage');
  const before = s.level;
  hammer(state, 'success');
  assert.equal(s.level, before + 3);
});

test('obsidian eye converts success signs to great signs at +8', () => {
  const state = fresh(212, ['obsidian-eye']);
  const s = anvil(state, 8);
  const counts = E.computeDistribution(state, s).counts;
  assert.equal(counts.success, 10);
  assert.equal(counts.great, 4);
});

test('red thread and lightning mark reduce the next break by their stated relative amounts', () => {
  const state = fresh(213, ['red-thread', 'lightning-mark']);
  const s = anvil(state, 10);
  s.lastResult = null;
  const base = E.computeDistribution(state, s).percents.break;
  s.lastResult = 'hold';
  const red = E.computeDistribution(state, s).percents.break;
  assert.ok(Math.abs(red - base * 0.8) < 0.12);
  s.lastResult = 'great';
  const lightning = E.computeDistribution(state, s).percents.break;
  assert.ok(Math.abs(lightning - base * 0.6) < 0.12);
});

test('collector hook pays 2 coins for the first eligible +0 sword after a reroll, once per day', () => {
  const state = fresh(214, ['collectors-hook']);
  clear(state);
  const a = E.makeSword(state, { level: 0 });
  const b = E.makeSword(state, { level: 0 });
  state.shop.firstRerollDone = true;
  const first = E.sellSword(state, a.id);
  assert.equal(first.coins, 2);
  assert.equal(first.hook, true);
  const second = E.sellSword(state, b.id);
  assert.equal(second.coins, 1);
});

test('floor overflow enters a claimable pending queue', () => {
  const state = fresh(215);
  clear(state);
  for (let i = 0; i < 25; i++) E.makeSword(state, { level: 0 });
  assert.equal(E.inventorySwords(state).length, 24);
  assert.equal(E.overflowSwords(state).length, 1);
  const floor = E.inventorySwords(state)[0];
  floor.location = 'rack';
  const claim = E.claimOverflow(state);
  assert.equal(claim.ok, true);
  assert.equal(E.overflowSwords(state).length, 0);
});

test('sickle and hammer plus iron hoop alter the sign mix', () => {
  const state = fresh(216, ['sickle-and-hammer', 'iron-hoop']);
  const s = anvil(state, 10);
  const dist = E.computeDistribution(state, s);
  assert.equal(dist.counts.break, 3);
  assert.equal(dist.counts.success, 5);
  assert.equal(dist.counts.great, 5);
});

test('royal change carry is capped at 30% of the next day', () => {
  const state = fresh(217, ['royal-change']);
  clear(state);
  const s = E.makeSword(state, { level: 20 });
  s.level = 20;
  E.placeOnTribute(state, s.id);
  E.ringBell(state);
  // huge excess but carry capped at 30% of next base (2100).
  assert.equal(state.royalChangeCarry, Math.round(2100 * 0.3));
});

test('a contract can be played across all 21 days to a victory', () => {
  const state = fresh(218);
  for (let day = 1; day <= 21; day++) {
    assert.equal(state.day, day, `start day ${day}`);
    clear(state);
    const s = E.makeSword(state, { level: 20 });
    s.level = 20;
    E.placeOnTribute(state, s.id);
    const res = E.ringBell(state);
    assert.equal(res.ok, true);
    assert.equal(res.summary.full, true, `day ${day} tribute`);
    if (day < 21) {
      assert.equal(state.phase, 'playing');
      assert.equal(state.anger, 0);
      assert.equal(state.day, day + 1);
    }
  }
  assert.equal(state.phase, 'victory');
  assert.equal(state.day, 21);
  assert.equal(state.run.fullTributes, 21);
  assert.equal(state.contractCompleted, true);
  assert.ok(state.unlockedAchievements.includes('clocking_out'));
});
