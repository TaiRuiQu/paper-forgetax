import { createRun, emptyProfile, mergeProfile, ENGINE_VERSION } from './engine/engine.js';
import { RELIC_BY_ID } from './data/relics.js';
import { SWORD_FAMILIES } from './data/gameData.js';

export const MAX_SAVE_FILE_BYTES = 5 * 1024 * 1024;
const FORMAT = 'forgetax-save';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw new Error('存档内容不完整或已损坏，请选择游戏导出的 JSON 文件。'); };

function checkTree(value, depth = 0) {
  if (depth > 40 || (typeof value === 'number' && !Number.isFinite(value))) invalid();
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid();
      checkTree(child, depth + 1);
    }
  }
}

function checkShape(value, template) {
  if (template === null) return;
  if (Array.isArray(template)) { if (!Array.isArray(value)) invalid(); return; }
  if (record(template)) {
    if (!record(value)) invalid();
    for (const key of Object.keys(template)) checkShape(value[key], template[key]);
  } else if (typeof value !== typeof template) invalid();
}

function validate(data) {
  checkTree(data);
  if (!record(data) || data.format !== FORMAT || data.version !== 1) {
    throw new Error('无法识别此存档格式或版本，请选择本游戏导出的存档。');
  }
  const s = data.state;
  if (!record(s) || s.version !== ENGINE_VERSION) invalid();
  const template = createRun({ seed: 1 });
  template.codex = emptyProfile().codex;
  checkShape(s, template);
  checkShape(data.profile, emptyProfile());
  if (!['select', 'playing', 'victory', 'dead'].includes(s.phase)
      || !Number.isSafeInteger(s.day) || s.day < 1
      || !s.relics.every(id => typeof id === 'string' && Object.hasOwn(RELIC_BY_ID, id))
      || !s.startingChoices.every(id => typeof id === 'string' && Object.hasOwn(RELIC_BY_ID, id))
      || !s.unlockedAchievements.every(id => typeof id === 'string')
      || !s.shop.items.every(item => record(item) && Object.hasOwn(RELIC_BY_ID, item.relicId))
      || !s.log.every(item => record(item) && typeof item.text === 'string'
        && typeof item.type === 'string' && /^[a-z-]+$/.test(item.type) && typeof item.day === 'number')) invalid();
  const ids = new Set();
  for (const sword of s.swords) {
    if (!record(sword) || typeof sword.id !== 'string' || !/^[a-z0-9_-]+$/i.test(sword.id) || ids.has(sword.id)
        || !Object.hasOwn(SWORD_FAMILIES, sword.family)
        || !['floor', 'rack', 'anvil', 'tribute', 'overflow'].includes(sword.location)
        || !Number.isInteger(sword.level) || sword.level < 0 || sword.level > 99
        || !record(sword.layers) || !record(sword.store) || !record(sword.counters) || !record(sword.protections)
        || !Array.isArray(sword.counters.idolMilestones)) invalid();
    for (const key of ['historyMaxLevel', 'baseValue', 'flat', 'mult', 'greatMult', 'valueHistoryMax', 'charge']) {
      if (typeof sword[key] !== 'number') invalid();
    }
    ids.add(sword.id);
  }
  if (s.anvilSwordId !== null && !ids.has(s.anvilSwordId)) invalid();
  return { state: s, profile: mergeProfile(emptyProfile(), data.profile) };
}

export function serializeSaveFile(state, profile) {
  const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), state, profile };
  validate(data);
  // Machine format: no indentation and no pretty-printing. It is read back by
  // the game, not by people, so the whitespace would only cost bytes.
  const text = JSON.stringify(data);
  if (new TextEncoder().encode(text).length > MAX_SAVE_FILE_BYTES) throw new Error('存档超过 5 MB，无法导出。');
  return text;
}

export function parseSaveFile(text) {
  if (new TextEncoder().encode(text).length > MAX_SAVE_FILE_BYTES) throw new Error('文件超过 5 MB，请选择有效的存档文件。');
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('文件不是有效的 JSON，请选择游戏导出的存档文件。'); }
  return validate(data);
}
