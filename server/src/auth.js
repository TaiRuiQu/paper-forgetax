import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.FORGETAX_DATA_DIR || path.resolve(__dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const SECRET_PATH = process.env.FORGETAX_SECRET_FILE || path.join(DATA_DIR, 'secret.key');

function loadSecret() {
  if (process.env.FORGETAX_SECRET) return process.env.FORGETAX_SECRET;
  try {
    return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

export function issueToken(userId) {
  const payload = { uid: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.uid !== 'number') return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function validateUsername(username) {
  if (typeof username !== 'string') return '用户名必须是文字。';
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return '用户名需要 3–20 个字符。';
  if (!/^[\p{L}\p{N}_-]+$/u.test(trimmed)) return '用户名只能包含文字、数字、下划线和连字符。';
  return null;
}

export function validatePassword(password) {
  if (typeof password !== 'string') return '密码必须是文字。';
  if (password.length < 6) return '密码至少需要 6 个字符。';
  if (password.length > 72) return '密码不能超过 72 个字符。';
  return null;
}

export const TOKEN_EXPIRES_SECONDS = TOKEN_TTL_SECONDS;
