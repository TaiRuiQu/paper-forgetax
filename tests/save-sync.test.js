import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSave, applySavePatch } from '../shared/savePatch.js';
import { SaveSync } from '../shared/saveSync.js';
import { createRun, prepareSave, emptyProfile } from '../shared/engine/engine.js';

test('deltas preserve null, deletion, nested fields and array structure changes', () => {
  const before = { nullable: 'old', removed: true, nested: { keep: 1, change: 2 }, items: [{ id: 'a', level: 1 }] };
  const after = { nullable: null, nested: { keep: 1, change: 3, added: {} }, items: [{ id: 'a', level: 2 }] };
  const changes = diffSave(before, after);
  assert.ok(changes.some(change => change.path.join('.') === 'items.0.level'));
  assert.ok(changes.some(change => change.path[0] === 'removed' && change.remove));
  assert.deepEqual(applySavePatch(before, changes), after);
  after.items.unshift({ id: 'b', level: 3 });
  assert.deepEqual(applySavePatch(before, diffSave(before, after)), after);
  after.items = [];
  assert.deepEqual(applySavePatch(before, diffSave(before, after)), after);
  assert.equal(before.items[0].level, 1);
});

test('invalid paths cannot mutate prototypes, sparse arrays or the document root', () => {
  for (const change of [
    { path: [], value: {} },
    { path: ['__proto__', 'polluted'], value: true },
    { path: ['missing', 'child'], value: true },
    { path: ['items', 5], value: true },
    { path: ['items', 0], remove: true },
    { path: ['items', 'length'], value: 99 },
  ]) assert.throws(() => applySavePatch({ items: [1] }, [change]), /invalid-patch/);
  assert.equal({}.polluted, undefined);
});

test('unchanged saves skip requests and failed deltas are retained for retry', async () => {
  const requests = [];
  let fail = false;
  let cloud;
  let revision = 0;
  const sync = new SaveSync(async (url, options) => {
    if (!options) return { save: { slot: 1, state: structuredClone(cloud), revision: String(revision) } };
    requests.push(options);
    if (fail) throw new Error('offline');
    cloud = options.method === 'PUT' ? structuredClone(options.body.state) : applySavePatch(cloud, options.body.changes);
    return { revision: String(++revision), profile: { stats: { plays: 1 } }, meta: {}, updatedAt: 'now' };
  });
  const profile = { stats: { plays: 1 } };
  sync.rememberProfile(profile);
  profile.stats.plays = 2;
  assert.equal(sync.profile.stats.plays, 1, 'profile baseline must not share mutable app objects');
  profile.stats.plays = 1;
  const state = { gold: 1, updatedAt: 'first' };
  await sync.save(1, state, profile);
  await sync.save(1, { ...state, updatedAt: 'later' }, profile);
  assert.equal(requests.length, 1);
  state.gold = 2;
  fail = true;
  await assert.rejects(sync.save(1, state, profile), /offline/);
  assert.equal(sync.slots.get(1).state.gold, 1);
  fail = false;
  state.gold = 3;
  await sync.save(1, state, profile);
  assert.equal(requests.at(-1).method, 'PATCH');
  assert.equal(cloud.gold, 3);
  assert.equal(sync.slots.get(1).state.gold, 3);
});

test('concurrent requests use acknowledged revisions in sequence', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const requests = [];
  const sync = new SaveSync(async (url, options) => {
    requests.push(options);
    if (requests.length === 1) await gate;
    return { revision: String(requests.length), profile: {}, meta: {} };
  });
  const first = sync.save(1, { gold: 1 }, {});
  const state = { gold: 2 };
  const second = sync.save(1, state, {});
  state.gold = 99;
  await Promise.resolve();
  assert.equal(requests.length, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(requests[1].body.baseRevision, '1');
  assert.deepEqual(requests[1].body.changes, [{ path: ['gold'], value: 2 }]);
});

test('a lost acknowledgement recovers only when cloud state already matches', async () => {
  const sync = new SaveSync(async (url, options) => {
    if (!options) return { save: { slot: 1, state: { gold: 2 }, revision: 'committed' } };
    if (options.body.baseRevision === 'old') throw Object.assign(new Error('conflict'), { code: 'save-conflict' });
    assert.equal(options.body.baseRevision, 'committed');
    assert.deepEqual(options.body.changes, []);
    return { revision: 'recovered', profile: {} };
  });
  sync.remember({ slot: 1, state: { gold: 1 }, revision: 'old' });
  await sync.save(1, { gold: 2 }, {});
  assert.equal(sync.slots.get(1).revision, 'recovered');
  sync.remember({ slot: 1, state: { gold: 1 }, revision: 'old' });
  await assert.rejects(sync.save(1, { gold: 3 }, {}), /conflict/);
  assert.equal(sync.slots.get(1).revision, 'old');
});

test('ordinary gameplay updates do not upload unchanged inventory or codex', () => {
  const before = prepareSave(createRun({ seed: 42, profile: emptyProfile() }));
  const after = structuredClone(before);
  after.gold += 10;
  after.runSigns.success += 1;
  const delta = { baseRevision: 'revision', changes: diffSave(before, after), profileChanges: [] };
  assert.deepEqual(applySavePatch(before, delta.changes), after);
  assert.ok(!JSON.stringify(delta).includes('startingChoices'));
  assert.ok(JSON.stringify(delta).length < JSON.stringify({ state: after, profile: emptyProfile() }).length / 4);
});

function uncertainSave() {
  let cloud = { slot: 1, state: { gold: 1, items: ['a'], updatedAt: 'old' }, revision: '1' };
  let loseResponse = false;
  let failRead = false;
  const writes = [];
  const sync = new SaveSync(async (url, options) => {
    if (!options) {
      if (failRead) throw new Error('offline');
      return { save: structuredClone(cloud) };
    }
    assert.equal(options.method, 'PATCH');
    if (options.body.baseRevision !== cloud.revision) {
      throw Object.assign(new Error('conflict'), { code: 'save-conflict' });
    }
    cloud.state = applySavePatch(cloud.state, options.body.changes);
    cloud.revision = String(Number(cloud.revision) + 1);
    writes.push(structuredClone(options.body));
    if (loseResponse) throw new Error('timeout after commit');
    return { revision: cloud.revision, profile: {}, meta: {} };
  });
  sync.remember(cloud);
  return {
    sync, writes, cloud: () => cloud,
    loseResponse: value => { loseResponse = value; },
    failRead: value => { failRead = value; },
  };
}

test('rapid queued saves recover a lost acknowledgement after gameplay advances', async () => {
  const f = uncertainSave();
  f.loseResponse(true);
  await assert.rejects(f.sync.save(1, { gold: 2, items: ['a', 'b'] }, {}), /timeout/);
  f.loseResponse(false);
  const queued = Array.from({ length: 30 }, (_, i) => f.sync.save(1, { gold: i + 3, items: ['a', 'b'] }, {}));
  await Promise.all(queued);
  assert.deepEqual(f.cloud().state, { gold: 32, items: ['a', 'b'], updatedAt: 'old' });
  assert.equal(f.sync.slots.get(1).revision, f.cloud().revision);
  assert.equal(f.sync.unacknowledged.size, 0);
  assert.ok(f.writes.slice(1).every(write => write.changes.every(change => change.path[0] !== 'items')));
});

test('failed reconciliation and another lost response do not poison future saves', async () => {
  const f = uncertainSave();
  f.loseResponse(true);
  await assert.rejects(f.sync.save(1, { gold: 2 }, {}), /timeout/);
  f.failRead(true);
  await assert.rejects(f.sync.save(1, { gold: 3 }, {}), /offline/);
  assert.deepEqual(f.sync.unacknowledged.get(1), { gold: 2 });
  f.failRead(false);
  await assert.rejects(f.sync.save(1, { gold: 4 }, {}), /timeout/);
  f.loseResponse(false);
  await f.sync.save(1, { gold: 5 }, {});
  assert.deepEqual(f.cloud().state, { gold: 5, updatedAt: 'old' });
});

test('returning to the acknowledged state still undoes an uncertain committed write', async () => {
  const f = uncertainSave();
  const original = structuredClone(f.cloud().state);
  f.loseResponse(true);
  await assert.rejects(f.sync.save(1, { gold: 2, items: [] }, {}), /timeout/);
  f.loseResponse(false);
  await f.sync.save(1, original, {});
  assert.deepEqual(f.cloud().state, original);
  assert.equal(f.writes.length, 2);
});

test('an uncertain write never permits overwriting a different cloud save', async () => {
  const f = uncertainSave();
  f.loseResponse(true);
  await assert.rejects(f.sync.save(1, { gold: 2 }, {}), /timeout/);
  f.loseResponse(false);
  f.cloud().state = { gold: 100, items: ['another player session'] };
  f.cloud().revision = 'external';
  for (const gold of [3, 4]) {
    await assert.rejects(f.sync.save(1, { gold }, {}), { code: 'save-conflict' });
  }
  assert.equal(f.writes.length, 1);
  assert.equal(f.cloud().state.gold, 100);
  // Explicitly loading the cloud save resolves a real multi-client conflict.
  f.sync.remember(f.cloud());
  await f.sync.save(1, { gold: 101, items: ['another player session'] }, {});
  assert.equal(f.cloud().state.gold, 101);
});
