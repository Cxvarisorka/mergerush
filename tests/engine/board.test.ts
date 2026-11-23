import { describe, expect, it } from 'vitest';
import { emptyCells, hasOccupiedNeighbour, isInRange, neighbour, toIndex, toRowCol } from '../../src/engine/board';
import { boardFrom } from './helpers';

describe('board helpers', () => {
  it('converts between index and row/col', () => {
    for (let i = 0; i < 25; i++) {
      const { row, col } = toRowCol(i, 5);
      expect(toIndex(row, col, 5)).toBe(i);
    }
    expect(toRowCol(7, 5)).toEqual({ row: 1, col: 2 });
  });

  it('finds neighbours and walls', () => {
    expect(neighbour(0, 'up', 5)).toBeNull();
    expect(neighbour(0, 'left', 5)).toBeNull();
    expect(neighbour(0, 'right', 5)).toBe(1);
    expect(neighbour(0, 'down', 5)).toBe(5);
    expect(neighbour(24, 'down', 5)).toBeNull();
    expect(neighbour(24, 'right', 5)).toBeNull();
    expect(neighbour(4, 'right', 5)).toBeNull(); // no wrap-around
    expect(neighbour(5, 'left', 5)).toBeNull();
    expect(neighbour(12, 'up', 5)).toBe(7);
    expect(neighbour(12, 'left', 5)).toBe(11);
  });

  it('checks range', () => {
    expect(isInRange(0, 5)).toBe(true);
    expect(isInRange(24, 5)).toBe(true);
    expect(isInRange(25, 5)).toBe(false);
    expect(isInRange(-1, 5)).toBe(false);
    expect(isInRange(1.5, 5)).toBe(false);
  });

  it('lists empty cells in ascending order and detects neighbours', () => {
    const board = boardFrom(['2 . .', '. . .', '. . 4']);
    expect(emptyCells(board)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(hasOccupiedNeighbour(board, 1, 3)).toBe(true);
    expect(hasOccupiedNeighbour(board, 4, 3)).toBe(false);
    expect(hasOccupiedNeighbour(board, 5, 3)).toBe(true);
  });
});
