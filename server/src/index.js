import '../env.js';
import http from 'node:http';
import { URL } from 'node:url';
import {
  findUserByName, findUserById, createUser, getProfile, saveProfile,
  listSaves, getSave, commitSave, deleteSave,
} from './db.js';
import {
  hashPassword, verifyPassword, issueToken, verifyToken,
  validateUsername, validatePassword,
} from './auth.js';
import { mergeProfile, emptyProfile } from '../../shared/engine/engine.js';
import { dayInfo } from '../../shared/data/gameData.js';
import { applySavePatch } from '../../shared/savePatch.js';
import { clientIp, createAuthRateLimiter } from './rate-limit.js';

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 6 * 1024 * 1024;
const limitAuth = createAuthRateLimiter();

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload-too-large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid-json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = verifyToken(m[1]);
  if (!payload) return null;
  return findUserById(payload.uid);
}

function requireAuth(req, res) {
  const user = authUser(req);
  if (!user) {
    json(res, 401, { error: 'unauthorized', message: '请先登录。' });
    return null;
  }
  return user;
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.created_at || user.createdAt };
}

function metaFromState(state) {
  if (!state || typeof state !== 'object') return {};
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    day: num(state.day),
    phase: typeof state.phase === 'string' ? state.phase.slice(0, 20) : 'unknown',
    date: (Number.isFinite(state.day) && state.day >= 1) ? dayInfo(state.day).date : '',
    gold: num(state.gold),
    coins: num(state.coins),
    anger: num(state.anger),
    quota: num(state.quotaBase),
    relics: Array.isArray(state.relics) ? state.relics.length : 0,
    swords: Array.isArray(state.swords) ? state.swords.length : 0,
  };
}

function validSlot(slot) {
  return Number.isInteger(slot) && slot >= 1 && slot <= 3;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); } catch { json(res, 400, { error: 'bad-request' }); return; }
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'POST' && (pathname === '/api/register' || pathname === '/api/login')) {
      const retryAfter = limitAuth(clientIp(req));
      if (retryAfter) {
        res.setHeader('Retry-After', String(retryAfter));
        json(res, 429, { error: 'rate-limited', message: '注册或登录过于频繁，请稍后再试。', retryAfter });
        return;
      }
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      json(res, 200, { ok: true, name: 'forgetax-cloud', time: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/register' && req.method === 'POST') {
      const body = await readJson(req);
      const usernameError = validateUsername(body.username);
      if (usernameError) { json(res, 400, { error: 'invalid-username', message: usernameError }); return; }
      const passwordError = validatePassword(body.password);
      if (passwordError) { json(res, 400, { error: 'invalid-password', message: passwordError }); return; }
      const username = body.username.trim();
      if (findUserByName(username)) { json(res, 409, { error: 'username-taken', message: '这个用户名已被使用。' }); return; }
      const { salt, hash } = hashPassword(body.password);
      const user = createUser(username, hash, salt);
      const token = issueToken(user.id);
      json(res, 201, { token, user: publicUser(user), profile: getProfile(user.id) });
      return;
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await readJson(req);
      if (typeof body.username !== 'string' || typeof body.password !== 'string') {
        json(res, 400, { error: 'invalid', message: '请输入用户名和密码。' });
        return;
      }
      const row = findUserByName(body.username.trim());
      if (!row || !verifyPassword(body.password, row.password_salt, row.password_hash)) {
        json(res, 401, { error: 'bad-credentials', message: '用户名或密码不对。' });
        return;
      }
      const token = issueToken(row.id);
      json(res, 200, { token, user: publicUser(row), profile: getProfile(row.id) });
      return;
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      json(res, 200, { user: publicUser(user), profile: getProfile(user.id) });
      return;
    }

    if (pathname === '/api/saves' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      json(res, 200, { slots: listSaves(user.id) });
      return;
    }

    const saveMatch = pathname.match(/^\/api\/saves\/(\d+)$/);
    if (saveMatch) {
      const user = requireAuth(req, res);
      if (!user) return;
      const slot = Number(saveMatch[1]);
      if (!validSlot(slot)) { json(res, 400, { error: 'bad-slot', message: '存档槽只有 1–3。' }); return; }

      if (req.method === 'GET') {
        const save = getSave(user.id, slot);
        if (!save) { json(res, 404, { error: 'empty-slot', message: '这个存档槽是空的。' }); return; }
        json(res, 200, { save });
        return;
      }
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const body = await readJson(req);
        let changes = null;
        if (req.method === 'PATCH') {
          const previous = getSave(user.id, slot);
          if (!previous || typeof body.baseRevision !== 'string' || previous.revision !== body.baseRevision) {
            json(res, 409, { error: 'save-conflict', message: '云端存档已改变，请重新载入存档后继续。' });
            return;
          }
          try {
            changes = body.changes;
            body.state = applySavePatch(previous.state, changes);
            body.profile = applySavePatch(getProfile(user.id), body.profileChanges ?? []);
          } catch {
            json(res, 400, { error: 'invalid-patch', message: '增量存档数据无效。' });
            return;
          }
        }
        if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
          json(res, 400, { error: 'invalid-state', message: '存档数据无效。' });
          return;
        }
        if (body.state.phase === 'select' && !Array.isArray(body.state.startingChoices)) {
          json(res, 400, { error: 'invalid-state' });
          return;
        }
        let profile = getProfile(user.id);
        if (body.profile && typeof body.profile === 'object') {
          profile = mergeProfile(profile, body.profile);
        }
        const meta = metaFromState(body.state);
        const { updatedAt, revision } = commitSave(user.id, slot, body.state, meta, profile, changes, body.baseRevision);
        json(res, 200, { ok: true, slot, meta, updatedAt, revision, profile });
        return;
      }
      if (req.method === 'DELETE') {
        const removed = deleteSave(user.id, slot);
        json(res, 200, { ok: true, removed });
        return;
      }
      json(res, 405, { error: 'method-not-allowed' });
      return;
    }

    if (pathname === '/api/profile' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJson(req);
      if (!body.profile || typeof body.profile !== 'object') {
        json(res, 400, { error: 'invalid-profile' });
        return;
      }
      const merged = mergeProfile(getProfile(user.id), body.profile);
      saveProfile(user.id, merged);
      json(res, 200, { ok: true, profile: merged });
      return;
    }

    json(res, 404, { error: 'not-found', message: '没有这个接口。' });
  } catch (err) {
    if (err?.status) { json(res, err.status, { error: err.message }); return; }
    console.error('[api] unhandled', err);
    json(res, 500, { error: 'server-error', message: '服务器出错了。' });
  }
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`[forgetax-api] listening on http://${HOST}:${addr.port}`);
  console.log(`[forgetax-api] SQLite ready`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

export { server };
