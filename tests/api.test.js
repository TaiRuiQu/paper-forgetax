import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function request(base, path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data, headers: res.headers };
}

let server;

test.before(async () => {
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
