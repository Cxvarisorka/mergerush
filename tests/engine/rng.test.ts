import { describe, expect, it } from 'vitest';
import { nextInt, nextRaw, normalizeSeed, seedFromString } from '../../src/engine/rng';

function sequence(seed: number, count: number): number[] {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < count; i++) {
    const step = nextRaw(state);
    out.push(step.value);
    state = step.state;
  }
  return out;
}

describe('rng', () => {
  it('matches frozen output vectors', () => {
    // Frozen on first implementation. Changing these breaks every saved game and replay.
    expect(sequence(0, 5)).toMatchInlineSnapshot(`
      [
        1144304738,
        1416247,
        958946056,
        627933444,
        2007157716,
      ]
    `);
    expect(sequence(1, 5)).toMatchInlineSnapshot(`
      [
        2693262067,
        11749833,
        2265367787,
        4213581821,
        4159151403,
      ]
    `);
    expect(sequence(0xdeadbeef, 5)).toMatchInlineSnapshot(`
      [
        4043151706,
        1147597007,
        3315858022,
        1538288752,
        2042435954,
      ]
    `);
  });

  it('is deterministic and state-only', () => {
    expect(sequence(42, 20)).toEqual(sequence(42, 20));
    expect(sequence(42, 20)).not.toEqual(sequence(43, 20));
  });

  it('nextInt stays in range and covers it', () => {
    let state = 7;
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const step = nextInt(state, 10);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(10);
      expect(Number.isInteger(step.value)).toBe(true);
      seen.add(step.value);
      state = step.state;
    }
    expect(seen.size).toBe(10);
  });

  it('nextInt(1) is always 0 but still advances the state', () => {
    const step = nextInt(5, 1);
    expect(step.value).toBe(0);
    expect(step.state).not.toBe(5);
  });

  it('nextInt rejects invalid ranges', () => {
    expect(() => nextInt(1, 0)).toThrow(RangeError);
    expect(() => nextInt(1, 2.5)).toThrow(RangeError);
  });

  it('roughly uniform', () => {
    const counts = new Array(5).fill(0);
    let state = 99;
    for (let i = 0; i < 50_000; i++) {
      const step = nextInt(state, 5);
      counts[step.value]++;
      state = step.state;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('normalizes seeds', () => {
    expect(normalizeSeed(-1)).toBe(0xffffffff);
    expect(normalizeSeed(3.9)).toBe(3);
    expect(normalizeSeed(Number.NaN)).toBe(0);
    expect(normalizeSeed(2 ** 32 + 5)).toBe(5);
  });

  it('hashes strings stably (FNV-1a)', () => {
    expect(seedFromString('')).toBe(0x811c9dc5);
    expect(seedFromString('a')).toBe(0xe40c292c);
    expect(seedFromString('2026-11-23')).toBe(seedFromString('2026-11-23'));
    expect(seedFromString('2026-11-23')).not.toBe(seedFromString('2026-11-24'));
  });
});
