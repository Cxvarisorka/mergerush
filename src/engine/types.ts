/** Data model for the Merge Rush rules engine. Plain, JSON-compatible data only. */

export type Direction = 'up' | 'right' | 'down' | 'left';

/** Cell index: row * size + col. Row 0 is the top row, column 0 the left column. */
export type CellIndex = number;

export interface Tile {
  readonly id: number;
  readonly value: number;
}

export type Board = ReadonlyArray<Tile | null>;

export interface SpawnWeight {
  readonly value: number;
  readonly weight: number;
}

export interface GameConfig {
  readonly size: number;
  readonly initialTiles: number;
  /** Number of queued values: the tile to place now plus the previews. */
  readonly queueLength: number;
  readonly spawnTable: ReadonlyArray<SpawnWeight>;
}

export type GameStatus = 'playing' | 'over';

export interface GameState {
  readonly version: 1;
  readonly config: GameConfig;
  /** The seed the game was created with (for replay and debugging). */
  readonly seed: number;
  /** Current PRNG state. */
  readonly rngState: number;
  readonly board: Board;
  readonly queue: ReadonlyArray<number>;
  readonly nextTileId: number;
  readonly score: number;
  readonly moves: number;
  readonly longestChain: number;
  readonly highestTile: number;
  readonly status: GameStatus;
}

export type GameEvent =
  | { readonly type: 'placed'; readonly tileId: number; readonly value: number; readonly at: CellIndex }
  | {
      readonly type: 'merged';
      readonly tileId: number;
      readonly removedTileId: number;
      readonly from: CellIndex;
      readonly to: CellIndex;
      readonly direction: Direction;
      readonly newValue: number;
      readonly chain: number;
      readonly points: number;
    }
  | {
      readonly type: 'slid';
      readonly tileId: number;
      readonly from: CellIndex;
      readonly to: CellIndex;
      readonly direction: Direction;
      readonly distance: number;
    }
  | { readonly type: 'queueAdvanced'; readonly queue: ReadonlyArray<number> }
  | { readonly type: 'gameOver'; readonly score: number };

export type MoveRejection = 'game-over' | 'out-of-range' | 'occupied';

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly events: ReadonlyArray<GameEvent> }
  | { readonly ok: false; readonly reason: MoveRejection };
