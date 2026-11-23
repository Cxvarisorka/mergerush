import { emptyCells, hasOccupiedNeighbour } from './board';
import { nextInt } from './rng';
import type { GameConfig, SpawnWeight, Tile } from './types';

export interface Drawn<T> {
  readonly value: T;
  readonly rngState: number;
}

export function totalWeight(table: ReadonlyArray<SpawnWeight>): number {
  return table.reduce((sum, entry) => sum + entry.weight, 0);
}

/** Draws one tile value from the weighted table. Consumes exactly one random number. */
export function drawValue(table: ReadonlyArray<SpawnWeight>, rngState: number): Drawn<number> {
  const step = nextInt(rngState, totalWeight(table));
  let remaining = step.value;
  for (const entry of table) {
    if (remaining < entry.weight) return { value: entry.value, rngState: step.state };
    remaining -= entry.weight;
  }
  /* c8 ignore next */
  throw new Error('drawValue: unreachable');
}

export interface InitialBoard {
  readonly board: Array<Tile | null>;
  readonly nextTileId: number;
  readonly rngState: number;
}

/**
 * Places `config.initialTiles` tiles, each on a random empty cell that is not orthogonally
 * adjacent to an existing tile. For each tile: draw the cell, then draw the value.
 */
export function createInitialBoard(config: GameConfig, rngState: number): InitialBoard {
  const board: Array<Tile | null> = new Array<Tile | null>(config.size * config.size).fill(null);
  let state = rngState;
  let nextTileId = 1;
  for (let i = 0; i < config.initialTiles; i++) {
    let candidates = emptyCells(board).filter((c) => !hasOccupiedNeighbour(board, c, config.size));
    // Only reachable with unusual configs (many tiles on a small board): fall back to any empty cell.
    if (candidates.length === 0) candidates = emptyCells(board);
    if (candidates.length === 0) break;
    const cellStep = nextInt(state, candidates.length);
    state = cellStep.state;
    const valueStep = drawValue(config.spawnTable, state);
    state = valueStep.rngState;
    board[candidates[cellStep.value]!] = { id: nextTileId++, value: valueStep.value };
  }
  return { board, nextTileId, rngState: state };
}

/** Draws `count` values in order. */
export function drawValues(table: ReadonlyArray<SpawnWeight>, count: number, rngState: number): Drawn<number[]> {
  const values: number[] = [];
  let state = rngState;
  for (let i = 0; i < count; i++) {
    const step = drawValue(table, state);
    values.push(step.value);
    state = step.rngState;
  }
  return { value: values, rngState: state };
}
