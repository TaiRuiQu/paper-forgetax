import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../shared/engine/engine.js';
import { serializeSaveFile, parseSaveFile, MAX_SAVE_FILE_BYTES } from '../shared/saveFile.js';

function run() {
  const state = E.createRun({ seed: 123 });
  E.chooseStartingRelic(state, state.startingChoices[0]);
  return state;
}

test('backup round trips every game phase, inventory and shared progress without credentials', () => {
  for (const phase of ['select', 'playing', 'dead', 'victory']) {
    const state = run();
    state.phase = phase;
    state.swords[0].location = 'overflow';
    state.frenzy = { active: true, endsAt: Date.now() + 3000, remainingMs: 0, swordId: state.swords[0].id };
    const saved = E.prepareSave(state);
    const profile = E.emptyProfile();
    profile.stats.bestDay = 12;
    profile.tutorialDone = true;
    profile.codex.swords.citadel = true;
    const text = serializeSaveFile(saved, profile);
    const result = parseSaveFile('\uFEFF' + text);
    assert.deepEqual(result.state, saved);
    assert.deepEqual(result.profile, profile);
    const restored = E.hydrateState(result.state);
    assert.ok(restored.frenzy.endsAt > Date.now());
    assert.equal(restored.cooldownUntil, 0);
    assert.doesNotMatch(text, /token|password/);
  }
});

test('bad JSON, unrelated files, incompatible versions and oversized files are rejected', () => {
  for (const value of ['', '{', 'null', '[]', '{}', '{"format":"other","version":1}']) {
    assert.throws(() => parseSaveFile(value));
  }
  const data = JSON.parse(serializeSaveFile(E.prepareSave(run()), E.emptyProfile()));
  data.version = 2;
  assert.throws(() => parseSaveFile(JSON.stringify(data)), /版本/);
  data.version = 1;
  data.state.version = 999;
  assert.throws(() => parseSaveFile(JSON.stringify(data)), /损坏/);
  assert.throws(() => parseSaveFile(' '.repeat(MAX_SAVE_FILE_BYTES + 1)), /5 MB/);
});

test('malformed game structures and prototype or HTML injection cannot be restored', () => {
  const original = serializeSaveFile(E.prepareSave(run()), E.emptyProfile());
  for (const mutate of [
    d => { delete d.state.shop; },
    d => { d.state.relics = ['missing']; },
    d => { d.state.day = -1; },
    d => { d.state.swords[0].family = 'missing'; },
    d => { d.state.swords[0].id = '\"><img src=x>'; },
    d => { d.state.swords.push(d.state.swords[0]); },
    d => { d.state.anvilSwordId = 'missing'; },
    d => { d.state.log[0].type = '\"><img src=x>'; },
    d => { d.profile = null; },
    d => { d.state.shop = JSON.parse('{"__proto__":{"polluted":true}}'); },
  ]) {
    const data = JSON.parse(original);
    mutate(data);
    assert.throws(() => parseSaveFile(JSON.stringify(data)));
  }
  assert.equal({}.polluted, undefined);
});

// Exercise the actual browser controller with a small DOM/API adapter.
function controller(api = {}) {
  const source = fs.readFileSync(new URL('../client/js/main.js', import.meta.url), 'utf8');
  const notices = [], downloads = [];
  const state = run();
  const app = { state, activeSlot: 1, screen: 'menu', profile: E.emptyProfile(), saves: [{ slot: 1, state }], modal: null };
  let input;
  const button = { disabled: false, textContent: '' };
  const context = vm.createContext({
    app, E, serializeSaveFile, parseSaveFile, MAX_SAVE_FILE_BYTES, Blob,
    setTimeout: callback => callback(), clearTimeout() {},
    URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: {
      body: { append() {} }, querySelector: () => button,
      createElement: tag => tag === 'input' ? (input = {
        addEventListener(event, fn) { this.change = fn; }, click() {},
      }) : { click() {}, remove() {} },
    },
    Api: { putSave: async () => ({ profile: app.profile }), ...api },
    UI: { toast: (...args) => notices.push(args.slice(1)) },
    Modals: { openConfirm: (app, payload) => { app.modal = { payload }; }, closeModal: app => { app.modal = null; } },
    showMenu() {}, syncProfile() {},
  });
  vm.runInContext(source.slice(source.indexOf('let importingSave ='), source.indexOf('async function loadSlot(')), context);
  return { app, context, notices, downloads, button, input: () => input };
}

test('live export works without a server and preserves paused frenzy time', async () => {
  const c = controller();
  c.app.screen = 'game';
  c.app._clockPaused = true;
  c.app._frenzyRemain = 2500;
  c.app.state.frenzy.active = true;
  await vm.runInContext('exportSlot(1, { disabled: false })', c.context);
  const backup = parseSaveFile(await c.downloads[0].text());
  assert.equal(backup.state.frenzy.remainingMs, 2500);
  assert.equal(backup.state.gold, c.app.state.gold);
});

test('file selection validates before asking for confirmation and never writes immediately', async () => {
  let writes = 0;
  const c = controller({ putSave: async () => { writes++; } });
  vm.runInContext('chooseSaveFile(2)', c.context);
  c.input().files = [{ size: 2, text: async () => '{}' }];
  await c.input().change();
  assert.equal(c.app.modal, null);
  vm.runInContext('chooseSaveFile(2)', c.context);
  c.input().files = [{ size: 2000, text: async () => serializeSaveFile(E.prepareSave(run()), E.emptyProfile()) }];
  await c.input().change();
  assert.equal(c.app.modal.payload.kind, 'import-slot');
  assert.equal(c.app.modal.payload.slot, 2);
  assert.equal(writes, 0);
});

test('failed restore preserves local state and can retry; duplicate submissions are ignored', async () => {
  let fail, calls = 0;
  const c = controller({ putSave: () => { calls++; return new Promise((resolve, reject) => { fail = reject; }); } });
  const previous = c.app.state;
  c.context.payload = { slot: 1, backup: { state: E.prepareSave(run()), profile: E.emptyProfile() } };
  const pending = vm.runInContext('importSlot(payload)', c.context);
  await vm.runInContext('importSlot(payload)', c.context);
  assert.equal(calls, 1);
  fail(new Error('offline'));
  await pending;
  assert.equal(c.app.state, previous);
  assert.equal(c.app.saves[0].state, previous);
  assert.equal(c.button.disabled, false);
  assert.equal(c.notices.at(-1)[0], '恢复失败');
});

test('successful restore replaces only its target slot and merges shared unlocks', async () => {
  let written;
  const c = controller({ putSave: async (slot, state, profile) => {
    written = { slot, state, profile };
    return { profile, meta: { day: state.day }, updatedAt: 'now' };
  } });
  c.app.profile.codex.swords.citadel = true;
  const other = { slot: 2, state: run() };
  c.app.saves.push(other);
  const profile = E.emptyProfile();
  profile.codex.relics['supply-permit'] = true;
  c.context.payload = { slot: 1, backup: { state: E.prepareSave(run()), profile } };
  await vm.runInContext('importSlot(payload)', c.context);
  assert.equal(written.slot, 1);
  assert.ok(written.profile.codex.swords.citadel);
  assert.ok(written.profile.codex.relics['supply-permit']);
  assert.equal(c.app.saves.find(s => s.slot === 2), other);
  assert.equal(c.app.state, null);
  assert.equal(c.notices.at(-1)[0], '存档已恢复');
});
