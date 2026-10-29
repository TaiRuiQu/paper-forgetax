import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { diffSave } from '../shared/savePatch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '../server/src/index.js');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'forgetax-test-'));

function startApi() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, FORGETAX_DATA_DIR: DATA_DIR, PORT: '0', HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error(`API did not start. stdout=${out} stderr=${err}`)); }, 12000);
    proc.stdout.on('data', chunk => {
      out += chunk.toString();
      const m = out.match(/listening on http:\/\/[^:]+:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, base: `http://127.0.0.1:${m[1]}/api` });
      }
    });
    proc.stderr.on('data', c => { err += c.toString(); });
    proc.on('exit', code => { if (code && code !== 0) { clearTimeout(timer); reject(new Error(`API exited ${code}: ${err}`)); } });
  });
}

function stop(server) {
  return new Promise(resolve => {
    if (!server?.proc || server.proc.exitCode !== null) { resolve(); return; }
    server.proc.once('exit', resolve);
    server.proc.kill();
    setTimeout(resolve, 2000);
  });
}

async function request(base, path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data, headers: res.headers };
}

let server;

test.before(async () => {
  const legacy = new DatabaseSync(path.join(DATA_DIR, 'forgetax.db'));
  legacy.exec(`CREATE TABLE saves (
    user_id INTEGER NOT NULL, slot INTEGER NOT NULL, state TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id, slot)
  ); INSERT INTO saves VALUES (999, 1, '{"gold":123}', '{}', 'legacy');`);
  legacy.close();
  server = await startApi();
});

test.after(async () => {
  await stop(server);
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('health endpoint is public', async () => {
  const r = await request(server.base, '/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.match(r.headers.get('access-control-allow-origin'), /\*/);
});

test('existing saves acquire a revision without changing their state', () => {
  const legacy = new DatabaseSync(path.join(DATA_DIR, 'forgetax.db'));
  try {
    const row = legacy.prepare('SELECT state, updated_at, revision FROM saves WHERE user_id = 999').get();
    assert.equal(row.state, '{"gold":123}');
    assert.equal(row.updated_at, 'legacy');
    assert.ok(row.revision);
  } finally { legacy.close(); }
});

test('auth, multi-user isolation, validation and token signing', async () => {
  const noAuth = await request(server.base, '/saves');
  assert.equal(noAuth.status, 401);

  const badReg = await request(server.base, '/register', { method: 'POST', body: { username: 'a', password: '123' } });
  assert.equal(badReg.status, 400);
  const shortPw = await request(server.base, '/register', { method: 'POST', body: { username: 'validname', password: '123' } });
  assert.equal(shortPw.status, 400);

  const alice = await request(server.base, '/register', { method: 'POST', body: { username: 'AliceSmith', password: 'forge123' } });
  assert.equal(alice.status, 201);
  assert.ok(alice.data.token);
  assert.equal(alice.data.user.username, 'AliceSmith');
  assert.ok(alice.data.profile.codex);

  const dup = await request(server.base, '/register', { method: 'POST', body: { username: 'alicesmith', password: 'forge123' } });
  assert.equal(dup.status, 409);

  const wrong = await request(server.base, '/login', { method: 'POST', body: { username: 'AliceSmith', password: 'nope-nope' } });
  assert.equal(wrong.status, 401);

  const logged = await request(server.base, '/login', { method: 'POST', body: { username: 'AliceSmith', password: 'forge123' } });
  assert.equal(logged.status, 200);

  const tampered = `${alice.data.token.slice(0, -2)}xx`;
  const badToken = await request(server.base, '/saves', { token: tampered });
  assert.equal(badToken.status, 401);

  const bob = await request(server.base, '/register', { method: 'POST', body: { username: 'BobForge', password: 'forge123' } });
  assert.equal(bob.status, 201);
  const bobSaves = await request(server.base, '/saves', { token: bob.data.token });
  assert.deepEqual(bobSaves.data.slots, []);

  const state = {
    version: 2, phase: 'playing', day: 4, quotaBase: 3350, gold: 999, coins: 3, anger: 1,
    relics: ['bent-nail'], swords: [{ id: 'sw1', level: 3 }],
  };
  const saved = await request(server.base, '/saves/1', {
    method: 'PUT',
    token: alice.data.token,
    body: {
      state,
      profile: {
        codex: { relics: { 'bent-nail': true }, swords: { citadel: 4 } },
        achievements: { one_more_hit: '2026-10-28T00:00:00Z', not_a_real_achievement: 'x' },
        stats: { plays: 2, bestDay: 4 },
      },
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.meta.day, 4);
  assert.equal(saved.data.meta.date, '4月18日');
  assert.equal(saved.data.meta.relics, 1);
  assert.equal(saved.data.meta.quota, 3350);
  assert.ok(saved.data.profile.achievements.one_more_hit);
  assert.equal(saved.data.profile.achievements.not_a_real_achievement, undefined);
  assert.equal(saved.data.profile.codex.swords.citadel, 4);

  const aliceSaves = await request(server.base, '/saves', { token: alice.data.token });
  assert.equal(aliceSaves.data.slots.length, 1);
  assert.equal(aliceSaves.data.slots[0].slot, 1);
  assert.equal(aliceSaves.data.slots[0].state.day, 4);

  const bobSaves2 = await request(server.base, '/saves', { token: bob.data.token });
  assert.deepEqual(bobSaves2.data.slots, []);
  const bobRead = await request(server.base, '/saves/1', { token: bob.data.token });
  assert.equal(bobRead.status, 404);

  const badSlot = await request(server.base, '/saves/4', { method: 'PUT', token: alice.data.token, body: { state } });
  assert.equal(badSlot.status, 400);
  const badState = await request(server.base, '/saves/2', { method: 'PUT', token: alice.data.token, body: { state: 'nope' } });
  assert.equal(badState.status, 400);
  const badJson = await fetch(`${server.base}/saves/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alice.data.token}` },
    body: '{broken',
  });
  assert.equal(badJson.status, 400);

  const me = await request(server.base, '/me', { token: alice.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, 'AliceSmith');
  assert.equal(me.data.profile.stats.bestDay, 4);

  const mergedLower = await request(server.base, '/profile', {
    method: 'POST', token: alice.data.token,
    body: { profile: { stats: { bestDay: 1 }, achievements: { one_more_hit: 'ignored' } } },
  });
  assert.equal(mergedLower.status, 200);
  assert.equal(mergedLower.data.profile.stats.bestDay, 4);

  const del = await request(server.base, '/saves/1', { method: 'DELETE', token: alice.data.token });
  assert.equal(del.status, 200);
  assert.equal(del.data.removed, true);
  const empty = await request(server.base, '/saves', { token: alice.data.token });
  assert.deepEqual(empty.data.slots, []);

  await request(server.base, '/saves/2', {
    method: 'PUT', token: alice.data.token,
    body: { state: { ...state, day: 8 }, profile: { codex: { relics: { 'lucky-coal': true } } } },
  });
});

test('SQLite data survives an API restart', async () => {
  const login = await request(server.base, '/login', { method: 'POST', body: { username: 'AliceSmith', password: 'forge123' } });
  const token = login.data.token;
  await stop(server);
  server = await startApi();
  const relogin = await request(server.base, '/login', { method: 'POST', body: { username: 'AliceSmith', password: 'forge123' } });
  assert.equal(relogin.status, 200);
  const saves = await request(server.base, '/saves', { token: relogin.data.token });
  assert.equal(saves.data.slots.length, 1);
  assert.equal(saves.data.slots[0].slot, 2);
  assert.equal(saves.data.slots[0].state.day, 8);
  assert.equal(relogin.data.profile.codex.relics['bent-nail'], true);
  assert.equal(relogin.data.profile.codex.relics['lucky-coal'], true);
  const me = await request(server.base, '/me', { token });
  assert.equal(me.status, 200);
});

test('register and login share ten attempts per CF IP, including successes and malformed requests', async () => {
  const headers = { 'CF-Connecting-IP': '203.0.113.10' };
  const success = await request(server.base, '/login', {
    method: 'POST', headers, body: { username: 'AliceSmith', password: 'forge123' },
  });
  assert.equal(success.status, 200);
  for (let i = 0; i < 9; i++) {
    const response = await request(server.base, i % 2 ? '/login' : '/register', {
      method: 'POST', headers, body: {},
    });
    assert.equal(response.status, 400);
  }
  for (const route of ['/login', '/register/']) {
    const blocked = await request(server.base, route, { method: 'POST', headers, body: {} });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.data.error, 'rate-limited');
    assert.ok(blocked.data.retryAfter > 0 && blocked.data.retryAfter <= 300);
    assert.equal(blocked.headers.get('retry-after'), String(blocked.data.retryAfter));
  }
  assert.equal((await request(server.base, '/health', { headers })).status, 200);
  assert.equal((await request(server.base, '/login', { method: 'OPTIONS', headers })).status, 204);
  const burst = await Promise.all(Array.from({ length: 12 }, () => request(server.base, '/login', {
    method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.11' },
    body: { username: 'NonexistentUser', password: 'wrong-password' },
  })));
  assert.equal(burst.filter(response => response.status === 401).length, 10);
  assert.equal(burst.filter(response => response.status === 429).length, 2);
  const malformed = await fetch(`${server.base}/login`, {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.12' }, body: '{broken',
  });
  assert.equal(malformed.status, 400);
  for (let i = 0; i < 9; i++) {
    assert.equal((await request(server.base, '/register', {
      method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.12' }, body: {},
    })).status, 400);
  }
  assert.equal((await request(server.base, '/login', {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.12' }, body: {},
  })).status, 429);
});

test('incremental saves persist only changed fields and reject stale or invalid patches', async () => {
  const registered = await request(server.base, '/register', {
    method: 'POST', body: { username: 'DeltaForge', password: 'forge123' },
  });
  const token = registered.data.token;
  const initial = {
    phase: 'playing', day: 2, gold: 10, removed: 'delete me', nullable: 'old',
    swords: [{ id: 'a', level: 1, name: 'unchanged' }], relics: ['bent-nail'],
    nested: { keep: true, 'dot.key': 1, '中文': 1 },
    counters: Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`key${i}`, 0])),
  };
  const full = await request(server.base, '/saves/1', { method: 'PUT', token, body: { state: initial } });
  assert.equal(full.status, 200);
  assert.ok(full.data.revision);
  const updated = structuredClone(initial);
  updated.gold = 20;
  updated.nullable = null;
  delete updated.removed;
  updated.nested['dot.key'] = 2;
  updated.nested['中文'] = 2;
  updated.swords[0].level = 3;
  for (const key of Object.keys(updated.counters)) updated.counters[key] = 1;
  // Another slot/page can add shared discoveries while this save is in flight.
  await request(server.base, '/profile', {
    method: 'POST', token, body: { profile: { codex: { relics: { 'bent-nail': true } } } },
  });
  const body = {
    baseRevision: full.data.revision, changes: diffSave(initial, updated),
    profileChanges: [{ path: ['stats', 'bestDay'], value: 2 }],
  };
  const patched = await request(server.base, '/saves/1', { method: 'PATCH', token, body });
  assert.equal(patched.status, 200);
  assert.notEqual(patched.data.revision, full.data.revision);
  assert.equal(patched.data.meta.gold, 20);
  assert.equal(patched.data.profile.stats.bestDay, 2);
  assert.equal(patched.data.profile.codex.relics['bent-nail'], true);
  let read = await request(server.base, '/saves/1', { token });
  assert.deepEqual(read.data.save.state, updated);
  assert.equal(read.data.save.revision, patched.data.revision);
  const stale = await request(server.base, '/saves/1', { method: 'PATCH', token, body });
  assert.equal(stale.status, 409);
  const missing = await request(server.base, '/saves/2', { method: 'PATCH', token, body });
  assert.equal(missing.status, 409);

  for (const changes of [
    [{ path: ['__proto__', 'polluted'], value: true }],
    [{ path: ['swords', 99], value: {} }],
    [{ path: ['nested', 'missing', 'child'], value: 1 }],
    [{ path: ['phase'], value: 'select' }],
    [{ path: ['swords', 0], remove: true }],
  ]) {
    const invalid = await request(server.base, '/saves/1', {
      method: 'PATCH', token,
      body: { baseRevision: patched.data.revision, changes, profileChanges: [{ path: ['stats', 'bestDay'], value: 999 }] },
    });
    assert.equal(invalid.status, 400);
  }
  read = await request(server.base, '/saves/1', { token });
  assert.deepEqual(read.data.save.state, updated);
  assert.equal(read.data.save.revision, patched.data.revision);
  assert.equal((await request(server.base, '/me', { token })).data.profile.stats.bestDay, 2);

  // If a profile write fails after the slot update, neither write may commit.
  const probe = new DatabaseSync(path.join(DATA_DIR, 'forgetax.db'));
  try {
    probe.exec(`CREATE TRIGGER fail_profile BEFORE UPDATE ON profiles
      WHEN NEW.user_id = ${Number(registered.data.user.id)}
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;`);
    const failed = await request(server.base, '/saves/1', {
      method: 'PATCH', token, body: {
        baseRevision: patched.data.revision, changes: [{ path: ['gold'], value: 21 }],
        profileChanges: [{ path: ['stats', 'bestDay'], value: 3 }],
      },
    });
    assert.equal(failed.status, 500);
    read = await request(server.base, '/saves/1', { token });
    assert.deepEqual(read.data.save.state, updated);
    assert.equal(read.data.save.revision, patched.data.revision);
    assert.equal((await request(server.base, '/me', { token })).data.profile.stats.bestDay, 2);
  } finally {
    probe.exec('DROP TRIGGER IF EXISTS fail_profile');
    probe.close();
  }

  const arrayUpdate = { ...updated, swords: [{ id: 'b', level: 1 }, ...updated.swords] };
  const arrayPatch = await request(server.base, '/saves/1', {
    method: 'PATCH', token,
    body: { baseRevision: patched.data.revision, changes: diffSave(updated, arrayUpdate) },
  });
  assert.equal(arrayPatch.status, 200);
  assert.equal(arrayPatch.data.meta.swords, 2);
  await stop(server);
  server = await startApi();
  read = await request(server.base, '/saves/1', { token });
  assert.deepEqual(read.data.save.state, arrayUpdate);
  assert.equal(read.data.save.revision, arrayPatch.data.revision);

  await request(server.base, '/saves/1', { method: 'DELETE', token });
  const recreated = await request(server.base, '/saves/1', { method: 'PUT', token, body: { state: initial } });
  assert.notEqual(recreated.data.revision, arrayPatch.data.revision);
  const oldPatch = await request(server.base, '/saves/1', {
    method: 'PATCH', token, body: { baseRevision: arrayPatch.data.revision, changes: [] },
  });
  assert.equal(oldPatch.status, 409);
  const options = await request(server.base, '/saves/1', { method: 'OPTIONS' });
  assert.match(options.headers.get('access-control-allow-methods'), /PATCH/);
});
