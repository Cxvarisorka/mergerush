import { describe, expect, it } from 'vitest';
import { chainAcceleration, planPlayback } from '../../src/app/playback/plan';
import { TIMING } from '../../src/app/view/theme';
import { applyMove } from '../../src/engine';
import type { GameEvent } from '../../src/engine';
import { stateFrom } from '../engine/helpers';

const EMPTY = '. . . . .';

function eventsFor(rows: string[], cell: number): ReadonlyArray<GameEvent> {
  const r = applyMove(stateFrom(rows, [2, 2]), cell);
  if (!r.ok) throw new Error(r.reason);
  return r.events;
}

describe('planPlayback', () => {
  it('keeps the event order and gives instant steps zero duration', () => {
    const events = eventsFor([EMPTY, EMPTY, '. 2 . . 4', EMPTY, EMPTY], 10);
    const plan = planPlayback(events);
    expect(plan.steps.map((s) => s.event)).toEqual(events);
    expect(plan.steps.map((s) => s.event.type)).toEqual(['placed', 'merged', 'slid', 'merged', 'queueAdvanced']);
    expect(plan.steps.at(-1)!.duration).toBe(0);
    expect(plan.total).toBe(plan.steps.reduce((a, s) => a + s.duration, 0));
  });

  it('a placement without merges takes the place duration only', () => {
    const plan = planPlayback(eventsFor([EMPTY, EMPTY, EMPTY, EMPTY, '. . . . 4'], 0));
    expect(plan.total).toBe(TIMING.place);
  });

  it('a typical one-merge move is at most 400 ms', () => {
    const plan = planPlayback(eventsFor([EMPTY, EMPTY, '. 2 . . .', EMPTY, EMPTY], 10));
    expect(plan.total).toBeLessThanOrEqual(400);
  });

  it('never exceeds the time box, even for the longest possible chain', () => {
    const merges: GameEvent[] = [{ type: 'placed', tileId: 1, value: 2, at: 0 }];
    for (let c = 1; c <= 24; c++) {
      merges.push({ type: 'merged', tileId: 1, removedTileId: c + 1, from: 0, to: 1, direction: 'right', newValue: 2 ** (c + 1), chain: c, points: 1 });
      merges.push({ type: 'slid', tileId: 1, from: 1, to: 4, direction: 'right', distance: 3 });
    }
    const plan = planPlayback(merges);
    expect(plan.total).toBeLessThanOrEqual(TIMING.maxMove + merges.length); // rounding slack
    expect(plan.steps.every((s) => s.duration >= 0)).toBe(true);
  });

  it('later chain steps are faster', () => {
    expect(chainAcceleration(1)).toBe(1);
    expect(chainAcceleration(3)).toBeLessThan(chainAcceleration(2));
    const plan = planPlayback(eventsFor([EMPTY, EMPTY, '. 2 4 8 .', EMPTY, EMPTY], 10));
    const merges = plan.steps.filter((s) => s.event.type === 'merged').map((s) => s.duration);
    expect(merges[2]!).toBeLessThan(merges[0]!);
  });

  it('speed < 1 shortens playback (reduced motion) and 0 makes it instant', () => {
    const events = eventsFor([EMPTY, EMPTY, '. 2 . . 4', EMPTY, EMPTY], 10);
    expect(planPlayback(events, TIMING, 0.6).total).toBeLessThan(planPlayback(events).total);
    expect(planPlayback(events, TIMING, 0).total).toBe(0);
  });
});
