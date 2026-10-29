import '../env.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { emptyProfile } from '../../shared/engine/engine.js';
import { diffSave, sqliteSavePath } from '../../shared/savePatch.js';

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
// Existing databases are upgraded in place; old saves remain readable.
if (!db.prepare('PRAGMA table_info(saves)').all().some(column => column.name === 'revision')) {
  db.exec("ALTER TABLE saves ADD COLUMN revision TEXT NOT NULL DEFAULT ''");
}
db.prepare("UPDATE saves SET revision = lower(hex(randomblob(16))) WHERE revision = ''").run();

const findUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const findUserByIdStmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
const insertUserStmt = db.prepare('INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)');
const insertProfileStmt = db.prepare('INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)');
const getProfileStmt = db.prepare('SELECT data, updated_at FROM profiles WHERE user_id = ?');
const setProfileStmt = db.prepare('INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at');
const listSavesStmt = db.prepare('SELECT slot, state, meta, updated_at, revision FROM saves WHERE user_id = ? ORDER BY slot');
const getSaveStmt = db.prepare('SELECT slot, state, meta, updated_at, revision FROM saves WHERE user_id = ? AND slot = ?');
const putSaveStmt = db.prepare(`
  INSERT INTO saves (user_id, slot, state, meta, updated_at, revision) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, slot) DO UPDATE SET state=excluded.state, meta=excluded.meta, updated_at=excluded.updated_at, revision=excluded.revision
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
    revision: row.revision,
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
    revision: row.revision,
  };
}

export function putSave(userId, slot, state, meta) {
  const now = new Date().toISOString();
  putSaveStmt.run(userId, slot, JSON.stringify(state), JSON.stringify(meta || {}), now, randomUUID());
  return now;
}

const patchStatements = new Map();
function updateJson(table, column, changes, userId, slot) {
  // Bound expression size and SQLite function arguments, preserving operation order.
  for (let offset = 0; offset < changes.length;) {
    const remove = changes[offset].remove === true;
    const batch = [];
    while (offset < changes.length && batch.length < 32 && (changes[offset].remove === true) === remove) {
      batch.push(changes[offset++]);
    }
    const key = `${table}:${column}:${remove}:${batch.length}`;
    if (!patchStatements.has(key)) {
      const args = batch.map(() => remove ? '?' : '?, json(?)').join(', ');
      patchStatements.set(key, db.prepare(`UPDATE ${table} SET ${column} = ${remove ? 'json_remove' : 'json_set'}(${column}, ${args}) WHERE user_id = ?${table === 'saves' ? ' AND slot = ?' : ''}`));
    }
    const values = batch.flatMap(change => remove
      ? [sqliteSavePath(change.path)] : [sqliteSavePath(change.path), JSON.stringify(change.value)]);
    patchStatements.get(key).run(...values, userId, ...(table === 'saves' ? [slot] : []));
  }
}

// Commit the slot and shared profile together, with field-level JSON updates.
export function commitSave(userId, slot, state, meta, profile, changes = null, baseRevision = null) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = getSave(userId, slot);
    if (changes !== null && (!previous || previous.revision !== baseRevision)) {
      throw Object.assign(new Error('save-conflict'), { status: 409 });
    }
    const now = new Date().toISOString();
    const revision = randomUUID();
    if (changes === null) {
      putSaveStmt.run(userId, slot, JSON.stringify(state), JSON.stringify(meta), now, revision);
    } else {
      updateJson('saves', 'state', changes, userId, slot);
      updateJson('saves', 'meta', diffSave(previous.meta, meta), userId, slot);
      db.prepare('UPDATE saves SET updated_at = ?, revision = ? WHERE user_id = ? AND slot = ?').run(now, revision, userId, slot);
    }
    const profileChanges = diffSave(getProfile(userId), profile);
    if (profileChanges.length) {
      updateJson('profiles', 'data', profileChanges, userId);
      db.prepare('UPDATE profiles SET updated_at = ? WHERE user_id = ?').run(now, userId);
    }
    db.exec('COMMIT');
    return { updatedAt: now, revision };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
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
