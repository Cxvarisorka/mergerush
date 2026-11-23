import type { Board, CellIndex, Direction } from './types';

/** Direction order used for merge priority: Up, Right, Down, Left. */
export const DIRECTIONS: ReadonlyArray<Direction> = Object.freeze(['up', 'right', 'down', 'left']);

const DELTAS: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

export function toIndex(row: number, col: number, size: number): CellIndex {
  return row * size + col;
}

export function toRowCol(index: CellIndex, size: number): { row: number; col: number } {
  return { row: Math.floor(index / size), col: index % size };
}

export function isInRange(index: number, size: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < size * size;
}

/** The neighbouring cell in `direction`, or null when that would leave the board. */
export function neighbour(index: CellIndex, direction: Direction, size: number): CellIndex | null {
  const { row, col } = toRowCol(index, size);
  const [dr, dc] = DELTAS[direction];
  const r = row + dr;
  const c = col + dc;
  if (r < 0 || r >= size || c < 0 || c >= size) return null;
  return toIndex(r, c, size);
}

/** Empty cells in ascending index order. */
export function emptyCells(board: Board): CellIndex[] {
  const cells: CellIndex[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) cells.push(i);
  return cells;
}

export function hasOccupiedNeighbour(board: Board, index: CellIndex, size: number): boolean {
  for (const d of DIRECTIONS) {
    const n = neighbour(index, d, size);
    if (n !== null && board[n] !== null) return true;
  }
  return false;
}
