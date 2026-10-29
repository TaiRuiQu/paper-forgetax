import test from 'node:test';
import assert from 'node:assert/strict';
import { swingForgeHammer, finishForgeStrike } from '../client/js/forge.js';

function stage(t, hidden = false) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rig = { dataset: { strikePhase: 'idle' } };
  const hammer = {
    animate(frames, timing) {
      let reject;
      const finished = new Promise((resolve, fail) => {
        reject = fail;
        this.timer = setTimeout(resolve, timing.duration);
      });
      return { finished, cancel: () => { clearTimeout(this.timer); reject(new Error('cancelled')); } };
    },
  };
  globalThis.document = { hidden, getElementById: id => id === 'forge-rig' ? rig : hammer };
  t.after(() => { finishForgeStrike(); delete globalThis.document; });
  return rig;
}

test('result presentation happens once at contact, after the windup', t => {
  const rig = stage(t);
  const impacts = [];
  swingForgeHammer({ interval: 640, reduced: false, onImpact: quiet => impacts.push(quiet) });
  assert.equal(rig.dataset.strikePhase, 'windup');
  t.mock.timers.tick(200);
  assert.deepEqual(impacts, []);
  t.mock.timers.tick(40);
  assert.deepEqual(impacts, [false]);
  assert.equal(rig.dataset.strikePhase, 'impact');
  finishForgeStrike();
  t.mock.timers.tick(1000);
  assert.deepEqual(impacts, [false]);
});

test('interruption commits a pending result quietly exactly once', t => {
  stage(t);
  const impacts = [];
  swingForgeHammer({ interval: 640, reduced: false, onImpact: quiet => impacts.push(quiet) });
  finishForgeStrike(true);
  finishForgeStrike(true);
  t.mock.timers.tick(1000);
  assert.deepEqual(impacts, [true]);
});

test('reduced motion presents immediately without a spatial animation', t => {
  const rig = stage(t);
  const impacts = [];
  swingForgeHammer({ interval: 640, reduced: true, onImpact: quiet => impacts.push(quiet) });
  assert.deepEqual(impacts, [false]);
  assert.equal(rig.dataset.strikePhase, 'idle');
});

test('hidden-window presentation does not play impact feedback', t => {
  stage(t, true);
  const impacts = [];
  swingForgeHammer({ interval: 440, reduced: false, onImpact: quiet => impacts.push(quiet) });
  t.mock.timers.tick(180);
  assert.deepEqual(impacts, [true]);
});
