import { describe, expect, it } from 'vitest';
import { applyMove } from '../../src/engine/game';
import type { GameEvent, GameState } from '../../src/engine/types';
import { boardToText, deepFreeze, stateFrom } from './helpers';

const EMPTY = '. . . . .';

function move(state: GameState, cell: number) {
  const result = applyMove(deepFreeze(state), cell);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

const resolutionEvents = (events: ReadonlyArray<GameEvent>) =>
  events.filter((e) => e.type === 'merged' || e.type === 'slid');

describe('worked example (GAME_DESIGN.md section 4)', () => {
  it('reproduces board, events and score exactly', () => {
    const state = stateFrom([EMPTY, EMPTY, '. 2 . . 4', EMPTY, EMPTY], [2, 4]);
    const result = move(state, 10);
    expect(boardToText(result.state.board)[2]).toBe('. . . . 8');
    expect(result.state.score).toBe(20);
    expect(result.state.longestChain).toBe(2);
    const placedId = state.nextTileId;
    expect(result.events[0]).toEqual({ type: 'placed', tileId: placedId, value: 2, at: 10 });
    expect(resolutionEvents(result.events)).toEqual([
      { type: 'merged', tileId: placedId, removedTileId: 1, from: 10, to: 11, direction: 'right', newValue: 4, chain: 1, points: 4 },
      { type: 'slid', tileId: placedId, from: 11, to: 13, direction: 'right', distance: 2 },
      { type: 'merged', tileId: placedId, removedTileId: 2, from: 13, to: 14, direction: 'right', newValue: 8, chain: 2, points: 16 },
    ]);
  });
});

describe('single candidate in each direction', () => {
  const cases: Array<[string, string[], number]> = [
    // place at centre 12; the only equal neighbour is in the named direction
    ['up', [EMPTY, '. . 2 . .', '. . . . .', EMPTY, EMPTY], 7],
    ['right', [EMPTY, EMPTY, '. . . 2 .', EMPTY, EMPTY], 13],
    ['down', [EMPTY, EMPTY, EMPTY, '. . 2 . .', EMPTY], 17],
    ['left', [EMPTY, EMPTY, '. 2 . . .', EMPTY, EMPTY], 11],
  ];
  for (const [direction, rows, target] of cases) {
    it(`merges ${direction}`, () => {
      const result = move(stateFrom(rows, [2, 2]), 12);
      const merged = result.events.find((e) => e.type === 'merged');
      expect(merged).toMatchObject({ direction, from: 12, to: target, newValue: 4 });
    });
  }
});

describe('merge priority without momentum: Up, Right, Down, Left', () => {
  const ring = (up: string, right: string, down: string, left: string) => [
    EMPTY,
    `. . ${up} . .`,
    `. ${left} . ${right} .`,
    `. . ${down} . .`,
    EMPTY,
  ];
  it('up beats everything', () => {
    const r = move(stateFrom(ring('2', '2', '2', '2'), [2, 2]), 12);
    expect(r.events.find((e) => e.type === 'merged')).toMatchObject({ direction: 'up', chain: 1 });
  });
  it('right beats down and left', () => {
    const r = move(stateFrom(ring('.', '2', '2', '2'), [2, 2]), 12);
    expect(r.events.find((e) => e.type === 'merged')).toMatchObject({ direction: 'right' });
  });
  it('down beats left', () => {
    const r = move(stateFrom(ring('.', '.', '2', '2'), [2, 2]), 12);
    expect(r.events.find((e) => e.type === 'merged')).toMatchObject({ direction: 'down' });
  });
  it('unequal and diagonal neighbours never match', () => {
    const rows = [EMPTY, '. 2 4 2 .', '. 4 . 4 .', '. 2 4 2 .', EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 12);
    expect(resolutionEvents(r.events)).toEqual([]);
    expect(r.state.score).toBe(0);
  });
});

describe('momentum and collisions', () => {
  it('momentum direction beats the fixed order', () => {
    // After merging right and sliding to col 3, both up (cell 8) and right (cell 14) hold 4.
    const rows = [EMPTY, '. . . 4 .', '. 2 . . 4', EMPTY, EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    const merges = r.events.filter((e) => e.type === 'merged');
    expect(merges[1]).toMatchObject({ from: 13, to: 14, direction: 'right', newValue: 8 });
    expect(boardToText(r.state.board)[1]).toBe('. . . 4 .');
  });

  it('turns 90 degrees when the equal tile is sideways', () => {
    // Merge right into col1 -> 4, slide stops at col2 (col3 holds 8); 4 below at cell 17.
    const rows = [EMPTY, EMPTY, '. 2 . 8 .', '. . 4 . .', EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    const merges = r.events.filter((e) => e.type === 'merged');
    expect(merges).toHaveLength(2);
    expect(merges[1]).toMatchObject({ from: 12, to: 17, direction: 'down', newValue: 8 });
    // then slides down to the wall
    expect(r.events.filter((e) => e.type === 'slid').at(-1)).toMatchObject({ from: 17, to: 22, direction: 'down' });
    expect(boardToText(r.state.board)).toEqual([EMPTY, EMPTY, '. . . 8 .', EMPTY, '. . 8 . .']);
  });

  it('slides to the wall and stops', () => {
    const rows = [EMPTY, EMPTY, '. 2 . . .', EMPTY, EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    expect(boardToText(r.state.board)[2]).toBe('. . . . 4');
  });

  it('is stopped by an unequal tile', () => {
    const rows = [EMPTY, EMPTY, '. 2 . 8 .', EMPTY, EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    expect(boardToText(r.state.board)[2]).toBe('. . 4 8 .');
    expect(r.events.find((e) => e.type === 'slid')).toMatchObject({ from: 11, to: 12, distance: 1 });
  });

  it('zero-length slide emits no slid event', () => {
    const rows = [EMPTY, EMPTY, '. . . . 2', EMPTY, EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 13);
    expect(r.events.some((e) => e.type === 'slid')).toBe(false);
    expect(boardToText(r.state.board)[2]).toBe('. . . . 4');
  });

  it('does not merge with tiles passed during a slide', () => {
    // The 4 tiles above and below row 2 are passed but never touched at rest.
    const rows = [EMPTY, '. . 4 . .', '. 2 . . .', '. . . 4 .', EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    expect(boardToText(r.state.board)).toEqual([EMPTY, '. . 4 . .', '. . . . 4', '. . . 4 .', EMPTY]);
    expect(r.state.score).toBe(4);
  });

  it('never moves any tile other than the active tile', () => {
    const rows = ['8 . 16 . 4', '. 2 . . .', '. . . 32 .', '64 . . . 2', '. 4 . 8 .'];
    const before = stateFrom(rows, [2, 2]);
    const r = move(before, 5);
    const placedId = before.nextTileId;
    for (let i = 0; i < 25; i++) {
      const t = r.state.board[i];
      if (t && t.id !== placedId) {
        expect(before.board[i]).toEqual(t);
      }
    }
  });

  it('the active tile keeps its id', () => {
    const rows = [EMPTY, EMPTY, '. 2 . . 4', EMPTY, EMPTY];
    const before = stateFrom(rows, [2, 2]);
    const r = move(before, 10);
    expect(r.state.board[14]).toEqual({ id: before.nextTileId, value: 8 });
  });
});

describe('chains and scoring', () => {
  it('scores newValue x chain position across a long chain', () => {
    const rows = [EMPTY, EMPTY, '. 2 4 8 16', EMPTY, EMPTY];
    const r = move(stateFrom(rows, [2, 2]), 10);
    const merges = r.events.filter((e) => e.type === 'merged');
    expect(merges.map((m) => m.type === 'merged' && [m.newValue, m.chain, m.points])).toEqual([
      [4, 1, 4],
      [8, 2, 16],
      [16, 3, 48],
      [32, 4, 128],
    ]);
    expect(r.state.score).toBe(196);
    expect(r.state.longestChain).toBe(4);
    expect(r.state.highestTile).toBe(32);
    expect(boardToText(r.state.board)[2]).toBe('. . . . 32');
  });

  it('chains across rows and terminates on a dense board', () => {
    // Snake: right along row 0, then down column 4 ... ends when nothing matches.
    const rows = ['. 2 4 8 16', '2 4 8 2 32', '4 8 2 4 64', '8 2 4 8 2', '2 4 8 2 4'];
    const r = move(stateFrom(rows, [2, 2]), 0);
    const merges = r.events.filter((e) => e.type === 'merged');
    expect(merges.length).toBeGreaterThanOrEqual(5);
    expect(r.state.board.filter((t) => t !== null)).toHaveLength(25 - merges.length);
  });

  it('multiplier resets between moves', () => {
    const rows = [EMPTY, EMPTY, '. 2 . . 4', EMPTY, '. . . . 2'];
    const first = move(stateFrom(rows, [2, 2]), 10);
    expect(first.state.score).toBe(20);
    const second = move(first.state, 23);
    const merged = second.events.find((e) => e.type === 'merged');
    expect(merged).toMatchObject({ chain: 1, points: 4 });
    expect(second.state.score).toBe(24);
  });

  it('placing without a merge scores nothing', () => {
    const r = move(stateFrom([EMPTY, EMPTY, '. . 4 . .', EMPTY, EMPTY], [2, 2]), 0);
    expect(r.state.score).toBe(0);
    expect(r.state.longestChain).toBe(0);
  });
});
