#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -x "/c/Program Files/nodejs/node.exe" ]; then
  NODE_BIN="/c/Program Files/nodejs/node.exe"
fi
if [ -z "$NODE_BIN" ]; then
  echo "Node.js 22+ is required."
  exit 1
fi
exec "$NODE_BIN" scripts/dev.mjs
