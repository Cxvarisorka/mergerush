import { describe, expect, it } from 'vitest';
import { createGame, applyMove, validMoves } from '../../src/engine/game';
import { deserialize, serialize } from '../../src/engine/serialize';
import { randomPlayout } from './helpers';

describe('serialization', () => {
  it('round-trips a fresh and a played game', () => {
    const fresh = createGame(1);
    expect(deserialize(serialize(fresh))).toEqual(fresh);
    const played = randomPlayout(createGame(2), 3).states;
    for (const s of [played[10]!, played.at(-1)!]) expect(deserialize(serialize(s))).toEqual(s);
  });

  it('save mid-game, load, continue gives the same game as playing straight through', () => {
    const { states, moves } = randomPlayout(createGame(77), 78);
    let state = deserialize(serialize(states[20]!))!;
    for (const cell of moves.slice(20)) {
      const r = applyMove(state, cell);
      if (!r.ok) throw new Error(r.reason);
      state = r.state;
    }
    expect(serialize(state)).toBe(serialize(states.at(-1)!));
  });

  const base = JSON.parse(serialize(createGame(4))) as Record<string, unknown>;
  const mutate = (fn: (d: any) => void) => {
    const copy = structuredClone(base);
    fn(copy);
    return JSON.stringify(copy);
  };

  it.each([
    ['not json', '{'],
    ['not an object', '[]'],
    ['null', 'null'],
    ['wrong version', mutate((d) => (d.version = 2))],
    ['bad config', mutate((d) => (d.config = null))],
    ['bad size', mutate((d) => (d.config.size = 1))],
    ['bad queueLength', mutate((d) => (d.config.queueLength = 0))],
    ['empty spawn table', mutate((d) => (d.config.spawnTable = []))],
    ['bad spawn entry', mutate((d) => (d.config.spawnTable = [{ value: 3, weight: 1 }]))],
    ['zero weight', mutate((d) => (d.config.spawnTable = [{ value: 2, weight: 0 }]))],
    ['negative score', mutate((d) => (d.score = -1))],
    ['fractional moves', mutate((d) => (d.moves = 1.5))],
    ['bad status', mutate((d) => (d.status = 'paused'))],
    ['short board', mutate((d) => d.board.pop())],
    ['bad queue', mutate((d) => (d.queue = [3, 2]))],
    ['queue length mismatch', mutate((d) => (d.queue = [2]))],
    ['non power of two tile', mutate((d) => (d.board[d.board.findIndex((t: unknown) => t)] = { id: 1, value: 6 }))],
    ['tile not an object', mutate((d) => (d.board[d.board.findIndex((t: unknown) => t === null)] = 5))],
    ['duplicate ids', mutate((d) => {
      const cells = d.board.flatMap((t: unknown, i: number) => (t ? [i] : []));
      d.board[cells[1]].id = d.board[cells[0]].id;
    })],
    ['id beyond nextTileId', mutate((d) => (d.nextTileId = 1))],
    ['over with empty cells', mutate((d) => (d.status = 'over'))],
  ])('rejects %s', (_name, json) => {
    expect(deserialize(json)).toBeNull();
  });

  it('accepts a finished game', () => {
    const last = randomPlayout(createGame(8), 9).states.at(-1)!;
    expect(last.status).toBe('over');
    expect(validMoves(last)).toEqual([]);
    expect(deserialize(serialize(last))).toEqual(last);
  });
});
