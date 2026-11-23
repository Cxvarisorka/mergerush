import { applyMove, createGame, deserialize, serialize, type GameState, type MoveResult } from '../engine';
import type { KeyValueStore } from '../platform/storage';

export const SAVE_KEY = 'mergerush.save.v1';
export const BEST_KEY = 'mergerush.best';

export interface BestRecord {
  readonly score: number;
  readonly tile: number;
}

export type SeedSource = () => number;

export function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  }
}

function parseBest(json: string | null): BestRecord {
  try {
    const data = json ? (JSON.parse(json) as Partial<BestRecord>) : {};
    const score = Number.isInteger(data.score) && data.score! >= 0 ? data.score! : 0;
    const tile = Number.isInteger(data.tile) && data.tile! >= 0 ? data.tile! : 0;
    return { score, tile };
  } catch {
    return { score: 0, tile: 0 };
  }
}

/**
 * Owns the current game, best record and persistence. The state is saved immediately after
 * every move, before any animation, so killing the app mid-animation loses nothing.
 */
export class Session {
  state: GameState;
  best: BestRecord = { score: 0, tile: 0 };
  /** Best score when the current game started; used to detect a new best. */
  bestAtStart = 0;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly seeds: SeedSource = randomSeed,
  ) {
    this.state = createGame(this.seeds());
  }

  async load(): Promise<void> {
    const [saved, best] = await Promise.all([this.store.get(SAVE_KEY).catch(() => null), this.store.get(BEST_KEY).catch(() => null)]);
    this.best = parseBest(best);
    const restored = saved ? deserialize(saved) : null;
    if (restored && restored.status === 'playing') {
      this.state = restored;
    } else {
      this.state = createGame(this.seeds());
      this.persist();
    }
    this.bestAtStart = this.best.score;
    this.updateBest();
  }

  get isNewBest(): boolean {
    return this.state.score > this.bestAtStart && this.state.score > 0;
  }

  play(cell: number): MoveResult {
    const result = applyMove(this.state, cell);
    if (result.ok) {
      this.state = result.state;
      this.updateBest();
      this.persist();
    }
    return result;
  }

  newGame(seed: number = this.seeds()): void {
    this.state = createGame(seed);
    this.bestAtStart = this.best.score;
    this.persist();
  }

  /** Resolves once every pending write has finished. */
  flush(): Promise<void> {
    return this.writes;
  }

  private updateBest(): void {
    const score = Math.max(this.best.score, this.state.score);
    const tile = Math.max(this.best.tile, this.state.highestTile);
    if (score !== this.best.score || tile !== this.best.tile) this.best = { score, tile };
  }

  private persist(): void {
    const save = serialize(this.state);
    const best = JSON.stringify(this.best);
    this.writes = this.writes
      .then(() => Promise.all([this.store.set(SAVE_KEY, save), this.store.set(BEST_KEY, best)]))
      .then(
        () => undefined,
        () => undefined,
      );
  }
}
