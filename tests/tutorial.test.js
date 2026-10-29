import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine/engine.js';
import { tutorialObjective } from '../shared/engine/tutorial.js';

function fresh(seed = 1) {
  const state = E.createRun({ seed });
  E.chooseStartingRelic(state, state.startingChoices[0]);
  return state;
}

test('guidance requires real placement and heating, and stops when tribute can be secured', () => {
  const s = fresh();
  assert.equal(tutorialObjective(s).key, 'place');
  E.placeOnAnvil(s, s.swords[0].id);
  assert.equal(tutorialObjective(s).key, 'heat');
  E.heatAnvilSword(s);
  assert.equal(tutorialObjective(s).key, 'hammer');
  E.getAnvilSword(s).flat = 2000;
  const o = tutorialObjective(s);
  assert.equal(o.key, 'tribute');
  E.moveSwordTo(s, o.swordId, 'tribute');
  assert.equal(tutorialObjective(s).key, 'bell');
  E.ringBell(s);
  assert.equal(tutorialObjective(s).key, 'complete');
  assert.equal(s.day, 2);
  assert.equal(s.anger, 0);
});

test('100 seeded guided first days survive using ordinary probabilities and real resources', () => {
  let completed = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = fresh(seed);
    let now = 100000;
    for (let i = 0; i < 500; i++) {
      const o = tutorialObjective(s);
      if (o.action === 'finish') { completed++; break; }
      let r;
      if (o.action === 'place') r = E.placeOnAnvil(s, o.swordId);
      if (o.action === 'heat') r = E.heatAnvilSword(s);
      if (o.action === 'hammer') r = E.hammer(s, { now: now += 700 });
      if (o.action === 'tribute') r = E.moveSwordTo(s, o.swordId, 'tribute');
      if (o.action === 'ring') r = E.ringBell(s);
      assert.equal(r?.ok, true, `seed ${seed}, ${o.key}`);
    }
    assert.equal(s.phase, 'playing');
    assert.equal(s.day, 2);
    assert.ok(s.anger <= 1);
  }
  assert.equal(completed, 100);
});

test('broken swords, exhaustion, resume, skipping and replay have contextual recovery', () => {
  const s = fresh();
  s.swords = [];
  assert.equal(tutorialObjective(s).action, 'ring');
  s.anger = 2;
  assert.equal(tutorialObjective(s).action, 'kit');
  s.tutorial.active = false;
  assert.equal(tutorialObjective(s), null);
  s.tutorial = { active: true, startDay: 4 };
  s.day = 4;
  assert.notEqual(tutorialObjective(E.hydrateState(E.prepareSave(s))).key, 'complete');
  s.day = 5;
  assert.equal(tutorialObjective(s).key, 'complete');
  s.phase = 'dead';
  assert.equal(tutorialObjective(s), null);
});

test('a failed anvil move preserves sword identity, Frenzy, buffs and rewind', () => {
  for (const [destination, count] of [['rack', E.RACK_CAP], ['tribute', E.TRIBUTE_CAP], ['floor', E.FLOOR_CAP]]) {
    const s = fresh();
    const sword = s.swords[0];
    E.placeOnAnvil(s, sword.id);
    s.swords = [sword];
    for (let i = 0; i < count; i++) E.makeSword(s, { route: 0 }).location = destination;
    s.frenzy = { active: true, endsAt: Date.now() + 4000, swordId: sword.id };
    s.anvilBuffs.protectBreak = true;
    s.hammerSnapshot = { preserved: true };
    const before = JSON.stringify(s);
    assert.equal(E.moveSwordTo(s, sword.id, destination).ok, false);
    assert.equal(JSON.stringify(s), before, destination);
  }
});
