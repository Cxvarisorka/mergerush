import type { GameConfig } from './types';

/** Default rules: see docs/GAME_DESIGN.md. */
export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  size: 5,
  initialTiles: 4,
  queueLength: 2,
  spawnTable: Object.freeze([
    Object.freeze({ value: 2, weight: 6 }),
    Object.freeze({ value: 4, weight: 3 }),
    Object.freeze({ value: 8, weight: 1 }),
  ]),
});
