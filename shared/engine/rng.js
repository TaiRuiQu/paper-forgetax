// Deterministic RNG stored inside the run state so undo/save are reproducible.
export function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state, maxExclusive) {
  return Math.floor(random(state) * maxExclusive);
}

export function pick(state, arr) {
  return arr[randomInt(state, arr.length)];
}

export function shuffle(state, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(state, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chance(state, p) {
  return random(state) < p;
}

export function makeSeed() {
  return (Math.random() * 0xffffffff) >>> 0 || 1;
}
