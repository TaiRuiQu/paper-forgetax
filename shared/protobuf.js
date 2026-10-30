// Minimal Protocol Buffers (proto3 wire format) runtime plus a schema-free
// document codec. Cloud save sync sends JSON documents, so instead of a .proto
// per field the document is encoded as a protobuf message whose field numbers
// come from a key dictionary carried in the payload: each key is written once
// instead of once per occurrence, which is where the bytes are saved.
//
//   Document { repeated string keys = 1; Node root = 2; uint32 format = 3; }
//   Node     { bool null = 1; bool boolean = 2; double number = 3;
//              sint64 integer = 4; string text = 5; Object object = 6;
//              Array array = 7; }
//   Object   { repeated uint32 keys = 1 [packed]; repeated Node values = 2; }
//   Array    { repeated Node items = 1; }
//
// Objects keep their keys and values in parallel lists, so a field costs its
// dictionary index instead of a wrapper message around the pair.
//
// Integers inside the safe range keep their exact value through sint64;
// everything else uses a double. Any JSON document round-trips unchanged, so
// a save keeps fields that this build does not know about.

export const PROTO_FORMAT = 1;
const WIRE_VARINT = 0;
const WIRE_64 = 1;
const WIRE_LEN = 2;
const WIRE_32 = 5;
const MAX_DEPTH = 48;
const MAX_ITEMS = 200000;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
// Lone surrogates do not survive a UTF-8 round trip, so such a document is
// refused up front and its caller falls back to JSON.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

class Writer {
  constructor() {
    this.buf = new Uint8Array(1024);
    this.pos = 0;
  }

  grow(size) {
    if (this.pos + size <= this.buf.length) return;
    let capacity = this.buf.length * 2;
    while (capacity < this.pos + size) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.buf.subarray(0, this.pos));
    this.buf = next;
  }

  byte(value) {
    this.grow(1);
    this.buf[this.pos++] = value;
  }

  varint(value) {
    let v = BigInt(value);
    if (v < 0n) throw new RangeError('protobuf: negative varint');
    while (v > 0x7fn) {
      this.byte(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    this.byte(Number(v));
  }

  tag(field, wire) {
    this.varint((BigInt(field) << 3n) | BigInt(wire));
  }

  bytes(field, value) {
    this.tag(field, WIRE_LEN);
    this.varint(value.length);
    this.grow(value.length);
    this.buf.set(value, this.pos);
    this.pos += value.length;
  }

  string(field, value) {
    this.bytes(field, TEXT_ENCODER.encode(value));
  }

  double(field, value) {
    this.tag(field, WIRE_64);
    this.grow(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).setFloat64(0, value, true);
    this.pos += 8;
  }

  finish() {
    return this.buf.slice(0, this.pos);
  }
}

class Reader {
  constructor(buffer) {
    this.buf = buffer;
    this.pos = 0;
  }

  get done() {
    return this.pos >= this.buf.length;
  }

  varint() {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (this.pos >= this.buf.length) throw new Error('protobuf: truncated varint');
      const byte = this.buf[this.pos++];
      result |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if (!(byte & 0x80)) break;
      if (shift > 70n) throw new Error('protobuf: varint too long');
    }
    return result;
  }

  tag() {
    const raw = this.varint();
    return { field: Number(raw >> 3n), wire: Number(raw & 7n) };
  }

  bytes() {
    const length = Number(this.varint());
    if (length < 0 || this.pos + length > this.buf.length) throw new Error('protobuf: truncated field');
    const value = this.buf.subarray(this.pos, this.pos + length);
    this.pos += length;
    return value;
  }

  double() {
    if (this.pos + 8 > this.buf.length) throw new Error('protobuf: truncated double');
    const value = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true);
    this.pos += 8;
    return value;
  }

  skip(wire) {
    if (wire === WIRE_VARINT) this.varint();
    else if (wire === WIRE_64) this.pos += 8;
    else if (wire === WIRE_LEN) this.bytes();
    else if (wire === WIRE_32) this.pos += 4;
    else throw new Error(`protobuf: unsupported wire type ${wire}`);
    if (this.pos > this.buf.length) throw new Error('protobuf: truncated field');
  }
}

const zigzag = value => {
  const v = BigInt(value);
  return v >= 0n ? v << 1n : ((-v) << 1n) - 1n;
};
const unzigzag = value => (value >> 1n) ^ -(value & 1n);

function assertEncodable(value, depth) {
  if (depth > MAX_DEPTH) throw new Error('protobuf: document nested too deeply');
  if (typeof value === 'string') {
    if (LONE_SURROGATE.test(value)) throw new Error('protobuf: string is not valid UTF-16');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('protobuf: non-finite number');
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (LONE_SURROGATE.test(key)) throw new Error('protobuf: string is not valid UTF-16');
    assertEncodable(child, depth + 1);
  }
}

function collectKeys(value, keys, index, depth) {
  if (depth > MAX_DEPTH) throw new Error('protobuf: document nested too deeply');
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys, index, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (!index.has(key)) {
      index.set(key, keys.length);
      keys.push(key);
    }
    collectKeys(child, keys, index, depth + 1);
  }
}

function nodeBytes(value, index, depth) {
  if (depth > MAX_DEPTH) throw new Error('protobuf: document nested too deeply');
  const node = new Writer();
  if (value === null) {
    node.tag(1, WIRE_VARINT);
    node.varint(1);
    return node.finish();
  }
  switch (typeof value) {
    case 'boolean':
      node.tag(2, WIRE_VARINT);
      node.varint(value ? 1 : 0);
      return node.finish();
    case 'number':
      if (Number.isSafeInteger(value)) {
        node.tag(4, WIRE_VARINT);
        node.varint(zigzag(value));
      } else {
        node.double(3, value);
      }
      return node.finish();
    case 'string':
      node.string(5, value);
      return node.finish();
    case 'object': {
      if (Array.isArray(value)) {
        if (value.length > MAX_ITEMS) throw new Error('protobuf: array too long');
        const array = new Writer();
        for (const item of value) array.bytes(1, nodeBytes(item, index, depth + 1));
        node.bytes(7, array.finish());
        return node.finish();
      }
      const entries = Object.entries(value);
      if (entries.length > MAX_ITEMS) throw new Error('protobuf: object too large');
      const object = new Writer();
      const keyList = new Writer();
      for (const [key, child] of entries) {
        const fieldIndex = index.get(key);
        if (fieldIndex === undefined) throw new Error(`protobuf: unindexed key ${key}`);
        keyList.varint(fieldIndex);
        object.bytes(2, nodeBytes(child, index, depth + 1));
      }
      object.bytes(1, keyList.finish());
      node.bytes(6, object.finish());
      return node.finish();
    }
    default:
      throw new Error(`protobuf: cannot encode ${typeof value}`);
  }
}

function readNode(buffer, keys, depth) {
  if (depth > MAX_DEPTH) throw new Error('protobuf: document nested too deeply');
  const reader = new Reader(buffer);
  let value;
  let seen = false;
  while (!reader.done) {
    const { field, wire } = reader.tag();
    if (field === 1) { reader.varint(); value = null; seen = true; }
    else if (field === 2) { value = reader.varint() !== 0n; seen = true; }
    else if (field === 3) { value = reader.double(); seen = true; }
    else if (field === 4) { value = Number(unzigzag(reader.varint())); seen = true; }
    else if (field === 5) { value = TEXT_DECODER.decode(reader.bytes()); seen = true; }
    else if (field === 6) { value = readObject(reader.bytes(), keys, depth + 1); seen = true; }
    else if (field === 7) { value = readArray(reader.bytes(), keys, depth + 1); seen = true; }
    else reader.skip(wire);
  }
  if (!seen) throw new Error('protobuf: empty node');
  return value;
}

function readArray(buffer, keys, depth) {
  const reader = new Reader(buffer);
  const items = [];
  while (!reader.done) {
    const { field, wire } = reader.tag();
    if (field === 1) {
      if (items.length >= MAX_ITEMS) throw new Error('protobuf: array too long');
      items.push(readNode(reader.bytes(), keys, depth + 1));
    } else reader.skip(wire);
  }
  return items;
}

function readObject(buffer, keys, depth) {
  const reader = new Reader(buffer);
  const keyList = [];
  const values = [];
  while (!reader.done) {
    const { field, wire } = reader.tag();
    if (field === 1) {
      const packed = new Reader(reader.bytes());
      while (!packed.done) keyList.push(keys[Number(packed.varint())]);
    } else if (field === 2) {
      values.push(readNode(reader.bytes(), keys, depth + 1));
    } else reader.skip(wire);
  }
  if (keyList.length !== values.length) throw new Error('protobuf: mismatched object');
  const result = {};
  for (let i = 0; i < keyList.length; i++) {
    const key = keyList[i];
    if (typeof key !== 'string') throw new Error('protobuf: unknown key');
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('protobuf: unsafe key');
    // defineProperty keeps a crafted key from reaching the prototype chain.
    Object.defineProperty(result, key, { value: values[i], enumerable: true, configurable: true, writable: true });
  }
  return result;
}

export function encodeDocument(value) {
  assertEncodable(value, 0);
  const keys = [];
  const index = new Map();
  collectKeys(value, keys, index, 0);
  const writer = new Writer();
  for (const key of keys) writer.string(1, key);
  writer.bytes(2, nodeBytes(value, index, 0));
  writer.tag(3, WIRE_VARINT);
  writer.varint(PROTO_FORMAT);
  return writer.finish();
}

export function decodeDocument(input) {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
  const reader = new Reader(buffer);
  const keys = [];
  let root;
  let hasRoot = false;
  let format = 0;
  while (!reader.done) {
    const { field, wire } = reader.tag();
    if (field === 1) {
      keys.push(TEXT_DECODER.decode(reader.bytes()));
      if (keys.length > MAX_ITEMS) throw new Error('protobuf: too many keys');
    } else if (field === 2) { root = readNode(reader.bytes(), keys, 0); hasRoot = true; }
    else if (field === 3) format = Number(reader.varint());
    else reader.skip(wire);
  }
  if (!hasRoot) throw new Error('protobuf: missing document body');
  if (format !== PROTO_FORMAT) throw new Error(`protobuf: unsupported format ${format}`);
  return root;
}
