import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { nextInt } from '../../src/engine/rng';
import { createInitialBoard, drawValue, drawValues } from '../../src/engine/spawn';
import { hasOccupiedNeighbour } from '../../src/engine/board';

describe('spawn', () => {
  it('maps the draw to the table boundaries exactly', () => {
    // Find states whose nextInt(10) gives each value, then check the mapping.
    const expected = [2, 2, 2, 2, 2, 2, 4, 4, 4, 8];
    const found = new Map<number, number>();
    for (let s = 0; found.size < 10; s++) {
      const v = nextInt(s, 10).value;
      if (!found.has(v)) found.set(v, s);
    }
    for (const [n, state] of found) expect(drawValue(DEFAULT_CONFIG.spawnTable, state).value).toBe(expected[n]);
  });

  it('draw frequencies follow the weights', () => {
    const counts: Record<number, number> = { 2: 0, 4: 0, 8: 0 };
    let state = 3;
    for (let i = 0; i < 30_000; i++) {
      const d = drawValue(DEFAULT_CONFIG.spawnTable, state);
      counts[d.value]!++;
      state = d.rngState;
    }
    expect(counts[2]! / 30_000).toBeCloseTo(0.6, 1);
    expect(counts[4]! / 30_000).toBeCloseTo(0.3, 1);
    expect(counts[8]! / 30_000).toBeCloseTo(0.1, 1);
  });

  it('creates the configured number of non-adjacent starting tiles', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { board, nextTileId } = createInitialBoard(DEFAULT_CONFIG, seed);
      const occupied = board.flatMap((t, i) => (t ? [i] : []));
      expect(occupied).toHaveLength(4);
      expect(nextTileId).toBe(5);
      for (const cell of occupied) {
        const without = board.slice();
        without[cell] = null;
        expect(hasOccupiedNeighbour(without, cell, 5)).toBe(false);
      }
    }
  });

  it('follows the specified draw order: cell, value, cell, value...', () => {
    const { board, rngState } = createInitialBoard({ ...DEFAULT_CONFIG, initialTiles: 1 }, 77);
    const cell = nextInt(77, 25);
    const value = drawValue(DEFAULT_CONFIG.spawnTable, cell.state);
    expect(board[cell.value]?.value).toBe(value.value);
    expect(rngState).toBe(value.rngState);
  });

  it('falls back to any empty cell when spacing is impossible, and stops when full', () => {
    const tiny = { ...DEFAULT_CONFIG, size: 2, initialTiles: 5 };
    const { board } = createInitialBoard(tiny, 1);
    expect(board.every((t) => t !== null)).toBe(true);
  });

  it('draws multiple values in order', () => {
    const many = drawValues(DEFAULT_CONFIG.spawnTable, 3, 10);
    const a = drawValue(DEFAULT_CONFIG.spawnTable, 10);
    const b = drawValue(DEFAULT_CONFIG.spawnTable, a.rngState);
    const c = drawValue(DEFAULT_CONFIG.spawnTable, b.rngState);
    expect(many.value).toEqual([a.value, b.value, c.value]);
    expect(many.rngState).toBe(c.rngState);
  });
});
