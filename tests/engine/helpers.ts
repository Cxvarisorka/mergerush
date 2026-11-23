import { DEFAULT_CONFIG } from '../../src/engine/config';
import { applyMove, validMoves } from '../../src/engine/game';
import { nextInt } from '../../src/engine/rng';
import type { GameConfig, GameEvent, GameState, Tile } from '../../src/engine/types';

/**
 * Builds a board from text rows, e.g. ['2 . . 4 .', ...]. '.' is empty.
 * Tile ids are assigned 1..n in reading order.
 */
export function boardFrom(rows: string[]): Array<Tile | null> {
  const board: Array<Tile | null> = [];
  let id = 1;
  for (const row of rows) {
    for (const token of row.trim().split(/\s+/)) {
      board.push(token === '.' ? null : { id: id++, value: Number(token) });
    }
  }
  return board;
}

export function boardToText(board: ReadonlyArray<Tile | null>, size = 5): string[] {
  const rows: string[] = [];
  for (let r = 0; r < size; r++) {
    rows.push(
      board
        .slice(r * size, r * size + size)
        .map((t) => (t ? String(t.value) : '.'))
        .join(' '),
    );
  }
  return rows;
}

/** A playable state with a hand-made board and queue. */
export function stateFrom(rows: string[], queue: number[] = [2, 2], overrides: Partial<GameState> = {}): GameState {
  const board = boardFrom(rows);
  const config: GameConfig = { ...DEFAULT_CONFIG, size: rows.length, queueLength: queue.length };
  const maxId = board.reduce((m, t) => (t && t.id > m ? t.id : m), 0);
  return {
    version: 1,
    config,
    seed: 1,
    rngState: 12345,
    board,
    queue,
    nextTileId: maxId + 1,
    score: 0,
    moves: 0,
    longestChain: 0,
    highestTile: board.reduce((m, t) => (t && t.value > m ? t.value : m), 0),
    status: 'playing',
    ...overrides,
  };
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export interface Playout {
  readonly states: GameState[];
  readonly moves: number[];
  readonly events: GameEvent[][];
}

/** Plays uniformly random valid moves (driven by a separate seeded stream) until game over. */
export function randomPlayout(start: GameState, moveSeed: number, maxMoves = 10_000): Playout {
  const states = [start];
  const moves: number[] = [];
  const events: GameEvent[][] = [];
  let state = start;
  let rng = moveSeed >>> 0;
  while (state.status === 'playing' && moves.length < maxMoves) {
    const options = validMoves(state);
    const pick = nextInt(rng, options.length);
    rng = pick.state;
    const cell = options[pick.value]!;
    const result = applyMove(state, cell);
    if (!result.ok) throw new Error(`unexpected rejection ${result.reason}`);
    moves.push(cell);
    events.push([...result.events]);
    state = result.state;
    states.push(state);
  }
  return { states, moves, events };
}

export { DEFAULT_CONFIG };
