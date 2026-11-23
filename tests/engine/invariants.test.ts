import { describe, expect, it } from 'vitest';
import { createGame, applyMove } from '../../src/engine/game';
import { nextRaw } from '../../src/engine/rng';
import type { GameEvent, GameState, Tile } from '../../src/engine/types';
import { deepFreeze, randomPlayout } from './helpers';

const isPowerOfTwo = (v: number) => Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0;

/** Rebuilds the next board from the previous board and the events alone. */
export function replayEvents(board: ReadonlyArray<Tile | null>, events: ReadonlyArray<GameEvent>): Array<Tile | null> {
  const next = board.slice();
  for (const e of events) {
    if (e.type === 'placed') next[e.at] = { id: e.tileId, value: e.value };
    if (e.type === 'merged') {
      next[e.from] = null;
      next[e.to] = { id: e.tileId, value: e.newValue };
    }
    if (e.type === 'slid') {
      next[e.to] = next[e.from]!;
      next[e.from] = null;
    }
  }
  return next;
}

function checkMove(before: GameState, after: GameState, events: ReadonlyArray<GameEvent>) {
  const tiles = after.board.filter((t): t is Tile => t !== null);
  // 1. values are powers of two, ids unique
  for (const t of tiles) expect(isPowerOfTwo(t.value)).toBe(true);
  expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
  // 2. tile count = before + 1 - merges
  const merges = events.filter((e) => e.type === 'merged');
  const beforeCount = before.board.filter((t) => t !== null).length;
  expect(tiles.length).toBe(beforeCount + 1 - merges.length);
  // 3. score increases by exactly the sum of points
  const points = merges.reduce((s, e) => s + (e.type === 'merged' ? e.points : 0), 0);
  expect(after.score).toBe(before.score + points);
  // 5. one random draw per move
  expect(after.rngState).toBe(nextRaw(before.rngState).state);
  // 6. events are sufficient to rebuild the board
  expect(replayEvents(before.board, events)).toEqual(after.board);
  // 7. chain length bounded
  expect(merges.length).toBeLessThanOrEqual(24);
  // value sum is conserved plus the placed tile
  const sum = (b: ReadonlyArray<Tile | null>) => b.reduce((s, t) => s + (t?.value ?? 0), 0);
  expect(sum(after.board)).toBe(sum(before.board) + before.queue[0]!);
}

describe('invariants over random playouts', () => {
  it('hold for every move of 1,000 games, and every game terminates', () => {
    let totalMoves = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const { states, events } = randomPlayout(createGame(seed), seed * 7919);
      expect(states.at(-1)!.status).toBe('over');
      for (let i = 1; i < states.length; i++) checkMove(states[i - 1]!, states[i]!, events[i - 1]!);
      totalMoves += states.length - 1;
    }
    expect(totalMoves).toBeGreaterThan(1000);
  }, 60_000);

  it('applyMove never mutates its input (deep-frozen) across a full game', () => {
    const { states, moves } = randomPlayout(createGame(31337), 1);
    for (let i = 0; i < moves.length; i++) {
      const frozen = deepFreeze(structuredClone(states[i]!));
      const result = applyMove(frozen, moves[i]!);
      expect(result.ok && result.state).toEqual(states[i + 1]);
    }
  });
});
