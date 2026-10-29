// Paths use property names and numeric array indices; null is a value, not deletion.
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object';
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

export function diffSave(before, after, path = []) {
  if (before === after) return [];
  if (!object(before) || !object(after) || Array.isArray(before) !== Array.isArray(after)
      || (Array.isArray(after) && before.length !== after.length)) {
    return [{ path, value: after }];
  }
  const changes = [];
  for (const key of Object.keys(before)) {
    if (!own(after, key)) changes.push({ path: [...path, key], remove: true });
  }
  for (const key of Object.keys(after)) {
    const child = [...path, Array.isArray(after) ? Number(key) : key];
    if (!own(before, key)) changes.push({ path: child, value: after[key] });
    else changes.push(...diffSave(before[key], after[key], child));
  }
  return changes;
}

export function validateSavePatch(changes) {
  if (!Array.isArray(changes) || changes.length > 10000) throw new Error('invalid-patch');
  for (const change of changes) {
    if (!change || !Array.isArray(change.path) || !change.path.length || change.path.length > 32
        || change.path.some(key => typeof key === 'number'
          ? !Number.isSafeInteger(key) || key < 0 || key > 100000
          : typeof key !== 'string' || !key.length || key.length > 200
            || forbidden.has(key) || /["\\\u0000-\u001f]/.test(key))
        || typeof change.path[0] !== 'string'
        || (change.remove === true ? own(change, 'value') : !own(change, 'value'))) {
      throw new Error('invalid-patch');
    }
  }
  return changes;
}

export function applySavePatch(value, changes) {
  validateSavePatch(changes);
  const result = JSON.parse(JSON.stringify(value));
  for (const change of changes) {
    let parent = result;
    for (const key of change.path.slice(0, -1)) {
      if (!object(parent) || !own(parent, key)) throw new Error('invalid-patch-path');
      parent = parent[key];
    }
    const key = change.path.at(-1);
    if (!object(parent) || (Array.isArray(parent)
      ? typeof key !== 'number' || key >= parent.length || change.remove === true
      : typeof key !== 'string')) throw new Error('invalid-patch-path');
    if (change.remove === true) delete parent[key];
    else parent[key] = JSON.parse(JSON.stringify(change.value));
  }
  return result;
}

export function sqliteSavePath(path) {
  return '$' + path.map(key => typeof key === 'number' ? `[${key}]` : `.${JSON.stringify(key)}`).join('');
}
