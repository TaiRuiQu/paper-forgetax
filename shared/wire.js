// Wire encoding for API bodies: JSON, or the experimental protobuf document
// codec, whichever is smaller for this payload. Big snapshots (a slot's full
// state) shrink by about a fifth; a handful of changed fields is already tiny
// in JSON, where protobuf's key table would cost more, so those stay JSON.
// The receiver picks the format from Content-Type, and a client that does not
// ask for protobuf always gets JSON back.
import { encodeDocument, decodeDocument } from './protobuf.js';

export const JSON_TYPE = 'application/json';
export const PROTOBUF_TYPE = 'application/x-protobuf';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export function encodeMessage(value, { protobuf: allowProtobuf = true } = {}) {
  const json = TEXT_ENCODER.encode(JSON.stringify(value));
  if (!allowProtobuf) return { bytes: json, type: JSON_TYPE };
  let binary;
  try {
    binary = encodeDocument(value);
  } catch {
    // Non-finite numbers, lone surrogates and other JSON-only shapes stay JSON.
    return { bytes: json, type: JSON_TYPE };
  }
  return binary.length < json.length
    ? { bytes: binary, type: PROTOBUF_TYPE }
    : { bytes: json, type: JSON_TYPE };
}

export function decodeMessage(bytes, type = JSON_TYPE) {
  if (bytes.length === 0) return {};
  if (/application\/x-protobuf/.test(type)) {
    return decodeDocument(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }
  return JSON.parse(TEXT_DECODER.decode(bytes));
}
