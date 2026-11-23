import { emptyCells, isInRange } from './board';
import { DEFAULT_CONFIG } from './config';
import { resolve } from './resolve';
import { normalizeSeed } from './rng';
import { createInitialBoard, drawValue, drawValues } from './spawn';
import type { CellIndex, GameConfig, GameEvent, GameState, MoveResult, Tile } from './types';

/** Creates a new game. Same seed and config always give the same game. */
export function createGame(seed: number, config: GameConfig = DEFAULT_CONFIG): GameState {
  const normalized = normalizeSeed(seed);
  const initial = createInitialBoard(config, normalized);
  const queue = drawValues(config.spawnTable, config.queueLength, initial.rngState);
  const highestTile = initial.board.reduce((max, t) => (t && t.value > max ? t.value : max), 0);
  return {
    version: 1,
    config,
    seed: normalized,
    rngState: queue.rngState,
    board: initial.board,
    queue: queue.value,
    nextTileId: initial.nextTileId,
    score: 0,
    moves: 0,
    longestChain: 0,
    highestTile,
    status: 'playing',
  };
}

/** Empty cells where the current tile may be placed (empty once the game is over). */
export function validMoves(state: GameState): CellIndex[] {
  return state.status === 'playing' ? emptyCells(state.board) : [];
}

/**
 * Applies one move. Pure: never mutates `state`. Invalid moves return a rejection and
 * consume no randomness. Exactly one random number is consumed per valid move.
 */
export function applyMove(state: GameState, cell: CellIndex): MoveResult {
  const { size, spawnTable } = state.config;
  if (state.status !== 'playing') return { ok: false, reason: 'game-over' };
  if (!isInRange(cell, size)) return { ok: false, reason: 'out-of-range' };
  if (state.board[cell] !== null) return { ok: false, reason: 'occupied' };

  const board: Array<Tile | null> = state.board.slice();
  const value = state.queue[0]!;
  const tileId = state.nextTileId;
  board[cell] = { id: tileId, value };

  const events: GameEvent[] = [{ type: 'placed', tileId, value, at: cell }];
  const resolution = resolve(board, cell, size);
  events.push(...resolution.events);

  const drawn = drawValue(spawnTable, state.rngState);
  const queue = [...state.queue.slice(1), drawn.value];
  events.push({ type: 'queueAdvanced', queue });

  const score = state.score + resolution.points;
  const finalValue = board[resolution.finalCell]!.value;
  const over = board.every((t) => t !== null);
  if (over) events.push({ type: 'gameOver', score });

  return {
    ok: true,
    events,
    state: {
      ...state,
      rngState: drawn.rngState,
      board,
      queue,
      nextTileId: tileId + 1,
      score,
      moves: state.moves + 1,
      longestChain: Math.max(state.longestChain, resolution.chain),
      highestTile: Math.max(state.highestTile, finalValue),
      status: over ? 'over' : 'playing',
    },
  };
}
