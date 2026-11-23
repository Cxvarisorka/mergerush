/**
 * Deterministic PRNG (mulberry32). Integer-only arithmetic, so results are identical in
 * every JavaScript engine. The whole generator state is one unsigned 32-bit integer.
 */

export interface RngStep {
  readonly value: number;
  readonly state: number;
}

/** Normalises any number to a valid unsigned 32-bit seed. */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return Math.trunc(seed) >>> 0;
}

/** Advances the generator. `value` is an unsigned 32-bit integer. */
export function nextRaw(state: number): RngStep {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: next };
}

/** Integer in 0..n-1 (n >= 1). Mapping: raw value modulo n. Frozen by test vectors. */
export function nextInt(state: number, n: number): RngStep {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`nextInt: n must be a positive integer, got ${n}`);
  const step = nextRaw(state);
  return { value: step.value % n, state: step.state };
}

/** FNV-1a 32-bit hash of a string's UTF-16 code units, for text seeds. */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
