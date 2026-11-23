import type { GameEvent } from '../../engine';
import { TIMING } from '../view/theme';

export interface Timing {
  readonly place: number;
  readonly mergeMove: number;
  readonly slidePerCell: number;
  readonly pop: number;
  readonly maxMove: number;
}

export interface PlannedStep {
  readonly event: GameEvent;
  /** Milliseconds; 0 for instant steps. */
  readonly duration: number;
}

export interface PlaybackPlan {
  readonly steps: ReadonlyArray<PlannedStep>;
  readonly total: number;
}

/** Later steps of a chain play faster so long chains stay snappy. */
export const chainAcceleration = (chain: number): number => 0.88 ** Math.max(0, chain - 1);

/**
 * Turns a move's events into sequential animation steps. The total never exceeds
 * `timing.maxMove`; `speed` < 1 shortens everything further (reduced motion).
 */
export function planPlayback(events: ReadonlyArray<GameEvent>, timing: Timing = TIMING, speed = 1): PlaybackPlan {
  let chain = 0;
  const raw = events.map((event) => {
    switch (event.type) {
      case 'placed':
        return timing.place;
      case 'merged':
        chain = event.chain;
        return (timing.mergeMove + timing.pop) * chainAcceleration(chain);
      case 'slid':
        return timing.slidePerCell * event.distance * chainAcceleration(chain);
      default:
        return 0;
    }
  });
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, rawTotal > 0 ? timing.maxMove / rawTotal : 1) * Math.max(0, Math.min(1, speed));
  const steps = events.map((event, i) => ({ event, duration: Math.round(raw[i]! * scale) }));
  return { steps, total: steps.reduce((a, s) => a + s.duration, 0) };
}
