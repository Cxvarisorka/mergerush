import { describe, expect, it } from 'vitest';
import { BEST_KEY, SAVE_KEY, Session, randomSeed } from '../../src/app/session';
import { createGame, serialize, validMoves } from '../../src/engine';
import { MemoryStore, type KeyValueStore } from '../../src/platform/storage';

const seeds = (...list: number[]) => {
  let i = 0;
  return () => list[i++ % list.length]!;
};

describe('Session', () => {
  it('starts a new seeded game when nothing is saved, and saves it', async () => {
    const store = new MemoryStore();
    const session = new Session(store, seeds(42));
    await session.load();
    await session.flush();
    expect(session.state).toEqual(createGame(42));
    expect(await store.get(SAVE_KEY)).toBe(serialize(createGame(42)));
  });

  it('saves after every move, before any animation, and restores it', async () => {
    const store = new MemoryStore();
    const a = new Session(store, seeds(7));
    await a.load();
    const cell = validMoves(a.state)[0]!;
    expect(a.play(cell).ok).toBe(true);
    await a.flush();
    const b = new Session(store, seeds(999));
    await b.load();
    expect(b.state).toEqual(a.state);
  });

  it('rejects invalid moves without saving', async () => {
    const store = new MemoryStore();
    const s = new Session(store, seeds(3));
    await s.load();
    await s.flush();
    const before = await store.get(SAVE_KEY);
    const occupied = s.state.board.findIndex((t) => t !== null);
    expect(s.play(occupied)).toEqual({ ok: false, reason: 'occupied' });
    await s.flush();
    expect(await store.get(SAVE_KEY)).toBe(before);
  });

  it('discards a corrupt save and starts fresh', async () => {
    const store = new MemoryStore();
    await store.set(SAVE_KEY, '{"version":1,"broken":true}');
    await store.set(BEST_KEY, 'not json');
    const s = new Session(store, seeds(5));
    await s.load();
    expect(s.state).toEqual(createGame(5));
    expect(s.best).toEqual({ score: 0, tile: 8 >= s.state.highestTile ? s.state.highestTile : 0 });
  });

  it('does not resume a finished game', async () => {
    const store = new MemoryStore();
    const finished = { ...createGame(1), status: 'over' as const };
    await store.set(SAVE_KEY, serialize(finished));
    const s = new Session(store, seeds(2));
    await s.load();
    expect(s.state).toEqual(createGame(2));
  });

  it('tracks best score and tile, persists it, and detects a new best', async () => {
    const store = new MemoryStore();
    await store.set(BEST_KEY, JSON.stringify({ score: 10, tile: 4 }));
    const s = new Session(store, seeds(11));
    await s.load();
    expect(s.best.score).toBe(10);
    let guard = 0;
    while (s.state.score <= 10 && s.state.status === 'playing' && guard++ < 500) s.play(validMoves(s.state)[0]!);
    expect(s.state.score).toBeGreaterThan(10);
    expect(s.best.score).toBe(s.state.score);
    expect(s.isNewBest).toBe(true);
    await s.flush();
    expect(JSON.parse((await store.get(BEST_KEY))!).score).toBe(s.state.score);
    s.newGame(3);
    expect(s.isNewBest).toBe(false);
    expect(s.state.moves).toBe(0);
  });

  it('keeps working when storage fails', async () => {
    const failing: KeyValueStore = {
      get: () => Promise.reject(new Error('nope')),
      set: () => Promise.reject(new Error('nope')),
      remove: () => Promise.reject(new Error('nope')),
    };
    const s = new Session(failing, seeds(8));
    await s.load();
    expect(s.play(validMoves(s.state)[0]!).ok).toBe(true);
    await expect(s.flush()).resolves.toBeUndefined();
  });

  it('randomSeed returns an unsigned 32-bit integer', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true);
  });
});
