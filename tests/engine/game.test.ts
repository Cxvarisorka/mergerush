import { describe, expect, it } from 'vitest';
import { createGame, applyMove, validMoves } from '../../src/engine/game';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { nextRaw } from '../../src/engine/rng';
import { createInitialBoard, drawValues } from '../../src/engine/spawn';
import { deepFreeze, stateFrom } from './helpers';

describe('createGame', () => {
  it('builds the board then the queue from the seed', () => {
    const game = createGame(123);
    const initial = createInitialBoard(DEFAULT_CONFIG, 123);
    const queue = drawValues(DEFAULT_CONFIG.spawnTable, 2, initial.rngState);
    expect(game.board).toEqual(initial.board);
    expect(game.queue).toEqual(queue.value);
    expect(game.rngState).toBe(queue.rngState);
    expect(game).toMatchObject({ version: 1, seed: 123, score: 0, moves: 0, status: 'playing', nextTileId: 5 });
    expect(game.highestTile).toBe(Math.max(...game.board.map((t) => t?.value ?? 0)));
  });

  it('is reproducible and seed-sensitive', () => {
    expect(createGame(9)).toEqual(createGame(9));
    expect(createGame(9)).not.toEqual(createGame(10));
  });

  it('normalizes the seed', () => {
    expect(createGame(-1).seed).toBe(0xffffffff);
  });
});

describe('applyMove validation', () => {
  const state = deepFreeze(createGame(5));
  const occupied = state.board.findIndex((t) => t !== null);

  it('rejects occupied, out-of-range and non-integer cells without changing state', () => {
    expect(applyMove(state, occupied)).toEqual({ ok: false, reason: 'occupied' });
    expect(applyMove(state, -1)).toEqual({ ok: false, reason: 'out-of-range' });
    expect(applyMove(state, 25)).toEqual({ ok: false, reason: 'out-of-range' });
    expect(applyMove(state, 2.5)).toEqual({ ok: false, reason: 'out-of-range' });
    expect(applyMove(state, Number.NaN)).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('rejects moves after game over', () => {
    expect(applyMove({ ...state, status: 'over' }, 0)).toEqual({ ok: false, reason: 'game-over' });
    expect(validMoves({ ...state, status: 'over' })).toEqual([]);
  });

  it('valid moves are exactly the empty cells', () => {
    expect(validMoves(state)).toEqual(state.board.flatMap((t, i) => (t ? [] : [i])));
  });

  it('does not mutate the input (input is deep-frozen)', () => {
    const cell = validMoves(state)[0]!;
    const result = applyMove(state, cell);
    expect(result.ok).toBe(true);
  });

  it('consumes exactly one random number and advances the queue', () => {
    const cell = validMoves(state)[0]!;
    const result = applyMove(state, cell);
    if (!result.ok) throw new Error();
    expect(result.state.rngState).toBe(nextRaw(state.rngState).state);
    expect(result.state.queue.slice(0, 1)).toEqual(state.queue.slice(1));
    expect(result.state.queue).toHaveLength(2);
    expect(result.state.moves).toBe(1);
    expect(result.state.nextTileId).toBe(state.nextTileId + 1);
    const advanced = result.events.find((e) => e.type === 'queueAdvanced');
    expect(advanced).toEqual({ type: 'queueAdvanced', queue: result.state.queue });
  });
});

describe('game over', () => {
  it('ends when the last cell is filled without a merge', () => {
    const rows = ['2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 .'];
    const r = applyMove(stateFrom(rows, [8, 2]), 24);
    if (!r.ok) throw new Error();
    expect(r.state.status).toBe('over');
    expect(r.events.at(-1)).toEqual({ type: 'gameOver', score: 0 });
    expect(r.events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(applyMove(r.state, 0)).toEqual({ ok: false, reason: 'game-over' });
  });

  it('continues when filling the last cell causes a merge', () => {
    const rows = ['2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 2', '4 2 4 2 8', '2 4 2 4 .'];
    const r = applyMove(stateFrom(rows, [8, 2]), 24);
    if (!r.ok) throw new Error();
    expect(r.state.status).toBe('playing');
    expect(r.events.some((e) => e.type === 'gameOver')).toBe(false);
    expect(validMoves(r.state)).toEqual([24]);
  });
});
