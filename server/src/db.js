import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyProfile } from '../../shared/engine/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.FORGETAX_DATA_DIR || path.resolve(__dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.FORGETAX_DB || path.join(DATA_DIR, 'forgetax.db');

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
    state TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, slot)
  );
`);

const findUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const findUserByIdStmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
const insertUserStmt = db.prepare('INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)');
const insertProfileStmt = db.prepare('INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)');
const getProfileStmt = db.prepare('SELECT data, updated_at FROM profiles WHERE user_id = ?');
const setProfileStmt = db.prepare('INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at');
const listSavesStmt = db.prepare('SELECT slot, state, meta, updated_at FROM saves WHERE user_id = ? ORDER BY slot');
const getSaveStmt = db.prepare('SELECT slot, state, meta, updated_at FROM saves WHERE user_id = ? AND slot = ?');
const putSaveStmt = db.prepare(`
  INSERT INTO saves (user_id, slot, state, meta, updated_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, slot) DO UPDATE SET state=excluded.state, meta=excluded.meta, updated_at=excluded.updated_at
`);
const deleteSaveStmt = db.prepare('DELETE FROM saves WHERE user_id = ? AND slot = ?');

export function findUserByName(username) {
  return findUserStmt.get(username);
}

export function findUserById(id) {
  return findUserByIdStmt.get(id);
}

export function createUser(username, passwordHash, passwordSalt) {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const info = insertUserStmt.run(username, passwordHash, passwordSalt, now);
    const userId = Number(info.lastInsertRowid);
    insertProfileStmt.run(userId, JSON.stringify(emptyProfile()), now);
    db.exec('COMMIT');
    return { id: userId, username, created_at: now };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getProfile(userId) {
  const row = getProfileStmt.get(userId);
  if (!row) {
    const p = emptyProfile();
    setProfileStmt.run(userId, JSON.stringify(p), new Date().toISOString());
    return p;
  }
  try {
    return JSON.parse(row.data);
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(userId, profile) {
  const now = new Date().toISOString();
  setProfileStmt.run(userId, JSON.stringify(profile), now);
  return now;
}

export function listSaves(userId) {
  return listSavesStmt.all(userId).map(row => ({
    slot: row.slot,
    state: safeParse(row.state, null),
    meta: safeParse(row.meta, {}),
    updatedAt: row.updated_at,
  }));
}

export function getSave(userId, slot) {
  const row = getSaveStmt.get(userId, slot);
  if (!row) return null;
  return {
    slot: row.slot,
    state: safeParse(row.state, null),
    meta: safeParse(row.meta, {}),
    updatedAt: row.updated_at,
  };
}

export function putSave(userId, slot, state, meta) {
  const now = new Date().toISOString();
  putSaveStmt.run(userId, slot, JSON.stringify(state), JSON.stringify(meta || {}), now);
  return now;
}

export function deleteSave(userId, slot) {
  return deleteSaveStmt.run(userId, slot).changes > 0;
}

function safeParse(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

export function closeDb() {
  try { db.close(); } catch { /* ignore */ }
}

export { db, DB_PATH };
