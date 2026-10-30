import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeDocument, decodeDocument, PROTO_FORMAT } from '../shared/protobuf.js';
import { encodeMessage, decodeMessage, PROTOBUF_TYPE, JSON_TYPE } from '../shared/wire.js';
import { createRun, prepareSave, emptyProfile, chooseStartingRelic } from '../shared/engine/engine.js';

function sampleDoc() {
  const state = createRun({ seed: 7, profile: emptyProfile() });
  return {
    format: 'forgetax-save',
    version: 1,
    exportedAt: '2026-10-30T00:00:00.000Z',
    state: prepareSave(state),
    profile: emptyProfile(),
  };
}

// A run that has seen a few days: enough repeated records (swords, log) for the
// key dictionary to pay for itself, the way a real cloud save looks.
function advancedDoc() {
  const state = createRun({ seed: 11, profile: emptyProfile() });
  chooseStartingRelic(state, state.startingChoices[0]);
  for (let i = 0; i < 12; i++) {
    state.swords.push({ ...structuredClone(state.swords[0]), id: `more${i}`, level: i });
  }
  state.log = Array.from({ length: 40 }, (_, i) => ({ day: 1, text: `锻造记录 ${i}`, type: 'forge', at: Date.now() }));
  return { state: prepareSave(state), profile: emptyProfile() };
}

test('the protobuf document codec round trips every JSON shape it accepts', () => {
  const value = {
    nil: null, yes: true, no: false, zero: 0, neg: -17, big: 9007199254740991,
    tiny: -9007199254740991, float: 1.5, negativeFloat: -2.25, text: '', chinese: '锻造·入神',
    list: [1, 'two', null, true, [], {}, [1, [2, [3]]]],
    nested: { a: { b: { c: { d: 'deep' } } }, 'key with space': 1, '0': 'numeric key' },
    'quotes"and\\slashes': 'v',
  };
  const bytes = encodeDocument(value);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(decodeDocument(bytes), value);
  // Exact integers survive rather than going through a double.
  const numbers = decodeDocument(encodeDocument({ big: 9007199254740991, neg: -17 }));
  assert.equal(numbers.big, 9007199254740991);
  assert.equal(numbers.neg, -17);
  assert.equal(bytes[0], 0x0a, 'key table comes first, field 1 wire type 2');
});

test('the document codec refuses what JSON cannot represent and what would corrupt UTF-8', () => {
  assert.throws(() => encodeDocument({ v: NaN }), /non-finite/);
  assert.throws(() => encodeDocument({ v: Infinity }), /non-finite/);
  assert.throws(() => encodeDocument({ v: '\uD800' }), /UTF-16/);
  assert.throws(() => encodeDocument({ ['\uDFFF']: 1 }), /UTF-16/);
  // Truncated and foreign payloads fail instead of yielding junk documents.
  assert.throws(() => decodeDocument(new Uint8Array([])), /missing document body/);
  assert.throws(() => decodeDocument(encodeDocument({ a: 1 }).subarray(0, 6)));
  const foreign = encodeDocument({ a: 1 });
  foreign[foreign.length - 1] = 9;
  assert.throws(() => decodeDocument(foreign), /unsupported format/);
  assert.equal(PROTO_FORMAT, 1);
});

test('prototype keys from a crafted payload never reach the prototype chain', () => {
  // Document { keys = ["__proto__"], root = Object{ keys=[0], values=[1] } }
  const keys = '__proto__';
  const object = Uint8Array.from([0x0a, 0x01, 0x00, 0x12, 0x02, 0x10, 0x02]); // keys=[0] values=[int 1]
  const root = Uint8Array.from([0x32, object.length, ...object]); // Node.object
  const forged = Uint8Array.from([
    0x0a, keys.length, ...new TextEncoder().encode(keys),
    0x12, root.length, ...root,
    0x18, 0x01, // format = 1
  ]);
  assert.throws(() => decodeDocument(forged), /unsafe key/);
  assert.equal({}.polluted, undefined);
});

test('documents that repeat keys use the dictionary instead of repeating names', () => {
  const swords = Array.from({ length: 40 }, (_, i) => ({
    id: `sw${i}`, family: 'citadel', level: i, historyMaxLevel: i, baseValue: 320, location: 'floor',
  }));
  const proto = encodeDocument({ swords }).length;
  const json = new TextEncoder().encode(JSON.stringify({ swords })).length;
  assert.ok(proto < json * 0.6, `expected protobuf (${proto}) well under JSON (${json})`);
});

test('the wire layer picks protobuf for big bodies, JSON for small ones and when disabled', () => {
  const big = advancedDoc();
  const chosen = encodeMessage(big);
  assert.equal(chosen.type, PROTOBUF_TYPE);
  assert.ok(chosen.bytes.length < new TextEncoder().encode(JSON.stringify(big)).length);
  assert.deepEqual(decodeMessage(chosen.bytes, chosen.type), JSON.parse(JSON.stringify(big)));

  const small = { gold: 3 };
  const tiny = encodeMessage(small);
  assert.equal(tiny.type, JSON_TYPE);
  assert.deepEqual(decodeMessage(tiny.bytes, tiny.type), small);

  const off = encodeMessage(big, { protobuf: false });
  assert.equal(off.type, JSON_TYPE);
  assert.deepEqual(decodeMessage(off.bytes, off.type), JSON.parse(JSON.stringify(big)));

  assert.deepEqual(decodeMessage(new Uint8Array(0), PROTOBUF_TYPE), {});
});
