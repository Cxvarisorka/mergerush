# Merge Rush — Technical Architecture

Status: **proposal, awaiting approval.** No code exists yet. Version facts were checked on
2026-11-23; see "Verified facts" for sources and for what could not be checked.

## 1. Verified facts

### Repository and local toolchain (checked directly)

- The repository is **empty**: no commits on any branch, no files other than `.git`, and the
  remote has no branches. There is no existing architecture, code, config or test to reuse.
- Local Node.js is `v22.23.5`, npm is `10.9.9`.

### Package versions (npm registry, `latest` tag)

| Package | Latest | Notes |
|---|---|---|
| `phaser` | **4.2.1** | Phaser 4.0.0 went stable on 10 Apr 2026. The last Phaser 3 release is **3.90.0** (23 May 2025). |
| `vite` | 8.3.8 | Requires Node `^20.19.0 \|\| >=22.12.0`. |
| `vitest` | 5.1.1 | Requires Vite `>=6.4.0` and Node `>=22.12.0`. |
| `typescript` | 7.0.2 | Compatibility with the rest of the stack **not verified** (see below). |
| `@capacitor/core`, `@capacitor/cli` | 8.6.2 | CLI requires Node `>=22`. |
| `@capacitor/haptics` | 8.0.2 | |
| `@capacitor/preferences` | 8.0.1 | |
| `@playwright/test` | 1.65.1 | |

Local Node 22.23.5 satisfies Vite 8, Vitest 5 and Capacitor 8.

### Documentation findings

The official documentation sites (`docs.phaser.io`, `vite.dev`, `vitest.dev`,
`capacitorjs.com`, `playwright.dev`, MDN) are **blocked by this session's network policy**.
The findings below were read from the projects' official GitHub repositories (which hold the
same documentation sources) and the npm registry.

- **Phaser 3 is frozen, not formally ended.** No v3 release since 3.90.0; no explicit
  end-of-maintenance statement was found. The official `phaserjs/template-vite-ts` template
  now pins Phaser 4.0.0, Vite 6 and TypeScript 5.7 and has no Phaser 3 branch.
- **Phaser 3 scale modes** (v3.90.0 source): `FIT` keeps the aspect ratio inside the parent;
  `RESIZE` fills the parent and changes the game size; `EXPAND` (since 3.80) keeps FIT-style
  scaling but extends the visible area. The parent element should be sized by CSS, with no
  padding.
- **Phaser 3 has no high-DPI setting.** The `resolution` config was removed in 3.50; the
  changelog states v3 never properly supported high-DPI. The usual workaround is a game
  size multiplied by the device pixel ratio.
- **Phaser 3 particles** (3.60+): `this.add.particles(x, y, texture, config)` returns a
  `ParticleEmitter` directly.
- **Phaser 3 audio**: `sound.locked` is true while the WebAudio context is suspended; Phaser
  resumes it on the first touch or key and emits `unlocked`.
- **Vite `base`**: `./` or empty string is documented for embedded deployment.
- **Capacitor 8** requires Node 22+, Xcode 26+, iOS 15+, Android Studio 2025.2.1+, Android
  API 24+ and WebView 60+. `webDir` is the built web assets directory. The app is served
  from `capacitor://localhost` (iOS) and `https://localhost` (Android) out of the bundled
  assets.
- **Capacitor storage guidance**: `localStorage` "must be considered transient" in a WebView
  because the OS can reclaim it; the Preferences plugin (string key/value, backed by
  UserDefaults / SharedPreferences, falls back to localStorage on web) is the documented
  alternative.
- **Playwright**: `devices[...]` presets enable touch emulation; `touchscreen.tap` only
  emulates taps; swipes are done by dispatching touch events manually.
- **`navigator.vibrate`** is not supported in Safari, iOS Safari or WKWebView.

### Not verified

- Whether TypeScript 7.0.2 type-checks Phaser's bundled type definitions and works with
  Vitest 5 without issues. Vite does not type-check, so this only affects `tsc --noEmit`.
- Phaser 4's API differences from Phaser 3 beyond the existence of a migration section in
  its README.
- That a Capacitor build works fully offline without a service worker. It follows from
  bundled assets on a local scheme, but no document states it outright; Phase 5 tests it.
- Bundle size and frame rate on real devices. Nothing has been built or measured.

## 2. Key conflict: "Phaser 3" versus the current release

The brief specifies Phaser 3. A plain `npm install phaser` now installs Phaser 4.2.1, and
Phaser 3 has had no release in 18 months.

- **Option A — pin `phaser@3.90.0` exactly.** Matches the brief. Mature, widely documented,
  the API facts above were verified against its source. Frozen: no fixes for future
  browser or WebView changes, and no high-DPI support (workaround needed).
- **Option B — use Phaser 4.2.x.** Maintained, and per the v3 changelog designed for
  high-DPI. Its API was not verified here and the official docs were unreachable.

**This plan is written for Option A, as briefed, and does not decide for you.** The engine
has no Phaser dependency, so Phase 1 is identical under both options and the choice is only
needed before Phase 2. Recommendation: confirm before Phase 2, preferably after a
half-day spike that renders the board in Phaser 4; if the spike is clean, Phaser 4 is the
better long-term choice for a new project. Tracked as Q11.

## 3. Principles

1. **The engine is a pure TypeScript library.** No Phaser, DOM, timers, storage or
   randomness other than its own seeded generator. Given a state and a move, it returns a
   new state and a list of events. This is what makes it testable and reproducible.
2. **The view never decides rules.** It draws state, plays back events and turns pointer
   input into a cell index.
3. **Platform services sit behind two tiny interfaces** (storage, haptics) so the web build
   and the Capacitor build differ only in which implementation is constructed.
4. **No dependency without a present need.** Phase 1 needs TypeScript, Vite and Vitest only.
   No state library, no ECS, no UI framework, no event-bus library, no RNG package.

## 4. Folder structure

```
mergerush/
├─ docs/                      planning documents
├─ index.html                 single page, full-screen game container
├─ package.json
├─ tsconfig.json              app + tests (DOM lib)
├─ tsconfig.engine.json       engine only, NO DOM lib (purity check)
├─ vite.config.ts             base './', Vitest config
├─ src/
│  ├─ engine/                 deterministic rules — Phase 1
│  │  ├─ types.ts             data model (section 5)
│  │  ├─ config.ts            default GameConfig (size, spawn table, counts)
│  │  ├─ rng.ts               seeded PRNG, nextInt, seed hashing
│  │  ├─ board.ts             coordinates, neighbours, empty cells
│  │  ├─ spawn.ts             weighted draw, initial board, queue refill
│  │  ├─ resolve.ts           merge priority, momentum, slide, scoring
│  │  ├─ game.ts              createGame, applyMove, validMoves
│  │  ├─ serialize.ts         versioned save/load with validation
│  │  └─ index.ts             public API — the only file the app imports
│  ├─ app/                    Phaser layer — Phase 2+
│  │  ├─ main.ts              Phaser.Game config, scale setup
│  │  ├─ scenes/
│  │  │  ├─ BootScene.ts      generate textures, load audio
│  │  │  └─ GameScene.ts      owns the session; wires views, input, playback
│  │  ├─ view/
│  │  │  ├─ layout.ts         pure: screen size -> board rect, cell size (unit-tested)
│  │  │  ├─ BoardView.ts      grid background, cell hit-testing
│  │  │  ├─ TileView.ts       one tile sprite + label, pooled
│  │  │  ├─ HudView.ts        score, best, queue preview, restart button
│  │  │  ├─ GameOverOverlay.ts
│  │  │  └─ theme.ts          colours, fonts, timings
│  │  ├─ input/BoardInput.ts  pointer -> preview / commit / cancel
│  │  ├─ playback/EventPlayer.ts   GameEvent[] -> tweens, sounds, haptics
│  │  └─ session.ts           current GameState, save after each move, restart
│  └─ platform/
│     ├─ storage.ts           KeyValueStore interface + localStorage impl
│     ├─ storage.capacitor.ts Preferences impl — Phase 5
│     ├─ haptics.ts           Haptics interface + no-op / vibrate impl
│     └─ haptics.capacitor.ts Capacitor impl — Phase 5
├─ tests/
│  ├─ engine/                 unit, property and golden-replay tests — Phase 1
│  ├─ sim/                    bot simulations for balancing — Phase 1
│  ├─ app/                    layout and playback-planning tests — Phase 2/3
│  └─ e2e/                    Playwright — Phase 4
└─ android/, ios/             generated by Capacitor — Phase 5
```

Phaser scenes are kept to two. The game-over panel and HUD are views inside `GameScene`,
not separate scenes, because they share its state and lifecycle.

## 5. Data model (engine)

```ts
export type Direction = 'up' | 'right' | 'down' | 'left';
export type CellIndex = number;            // 0..24, row * size + col

export interface Tile { readonly id: number; readonly value: number; }

export interface GameConfig {
  readonly size: number;                   // 5
  readonly initialTiles: number;           // 4
  readonly queueLength: number;            // 2 (current + 1 preview)
  readonly spawnTable: ReadonlyArray<{ readonly value: number; readonly weight: number }>;
}

export interface GameState {
  readonly version: 1;                     // save-format version
  readonly config: GameConfig;
  readonly seed: number;                   // original seed, for replay/debug
  readonly rngState: number;               // current PRNG state
  readonly board: ReadonlyArray<Tile | null>;   // length size*size
  readonly queue: ReadonlyArray<number>;
  readonly nextTileId: number;
  readonly score: number;
  readonly moves: number;
  readonly longestChain: number;
  readonly status: 'playing' | 'over';
}

export type GameEvent =
  | { type: 'placed'; tileId: number; value: number; at: CellIndex }
  | { type: 'merged'; tileId: number; removedTileId: number; from: CellIndex;
      to: CellIndex; direction: Direction; newValue: number; chain: number; points: number }
  | { type: 'slid'; tileId: number; from: CellIndex; to: CellIndex;
      direction: Direction; distance: number }
  | { type: 'queueAdvanced'; queue: ReadonlyArray<number> }
  | { type: 'gameOver'; score: number };

export type MoveResult =
  | { ok: true; state: GameState; events: ReadonlyArray<GameEvent> }
  | { ok: false; reason: 'game-over' | 'out-of-range' | 'occupied' };
```

Public functions:

```ts
createGame(seed: number, config?: GameConfig): GameState
applyMove(state: GameState, cell: CellIndex): MoveResult   // pure; never mutates `state`
validMoves(state: GameState): CellIndex[]
seedFromString(text: string): number
serialize(state: GameState): string
deserialize(json: string): GameState | null                // null if invalid or wrong version
```

Notes:

- `applyMove` is pure, so the on-board **preview is the same call** as the real move; the
  view simply does not commit the result.
- Invalid moves are ordinary return values, not exceptions.
- Zero-distance slides emit no `slid` event.
- State is plain JSON-compatible data. The engine internally copies the 25-element board per
  move; there is no need for an immutability library at this size.
- A **replay** is `{ seed, config, moves: CellIndex[] }` and is used by tests. Recording
  replays in the shipped game is optional and not planned for v1.

## 6. Game-state lifecycle and transitions

Engine status has two values:

```
createGame ──> playing ──applyMove (board not full)──> playing
                  │
                  └──applyMove (board full after resolution)──> over
over ──applyMove──> rejected ('game-over')
```

The app layer adds view states around it, held in `GameScene`:

```
Boot ─> Loading save ─> Idle ─(pointer down on empty cell)─> Previewing
Previewing ─(release on cell)─> Animating ─(playback done, playing)─> Idle
Previewing ─(release off board)─> Idle
Animating ─(playback done, over)─> GameOver ─(restart)─> Idle
Idle ─(restart, confirmed)─> Idle (new game)
```

On commit the app: calls `applyMove`, stores the new state, **saves it immediately**, then
hands the events to `EventPlayer`. If the app is killed during the animation, the next
launch loads the already-final state.

## 7. Rendering architecture

- **Scaling**: `Phaser.Scale.RESIZE` with a full-viewport parent sized by CSS; `layout.ts`
  computes the board rectangle, cell size and HUD positions from the current width, height
  and safe-area insets, and is re-run on resize and orientation change. The board is the
  largest square that fits with margins; HUD goes above it in portrait. Portrait is the
  design target; landscape must remain usable **[Q13]**.
- **High-DPI (Phaser 3)**: set the canvas backing size to CSS size × `devicePixelRatio`
  (capped at 2 or 3 to protect low-end GPUs) and scale layout accordingly. This is the
  riskiest rendering item under Option A and is validated first in Phase 2.
- **Assets**: tile faces, the grid and particles are generated at boot with Phaser
  `Graphics` → textures. No image pipeline, no atlas tooling. Numbers are drawn with a
  bundled or system font (no network fonts; the game must work offline).
- **Tiles**: `TileView` objects are keyed by tile `id` and pooled (maximum 25 live plus a
  few in transition).
- **Playback**: `EventPlayer` turns the event list into a sequence of tweens. Durations come
  from `theme.ts`; total playback is time-boxed, and per-step durations shrink for long
  chains. After playback the view is reconciled against the engine state, so a dropped or
  interrupted tween can never leave the screen wrong.
- **Input**: one handler on the scene. Pointer down/move over an empty cell shows the
  preview (ghost tile, path, landing cell); release commits; release outside the board
  cancels. Minimum touch target equals a cell, which on a 360 px-wide screen is roughly
  60 px.
- **Audio and haptics** are triggered only from `EventPlayer`, so they are always in sync
  with what is shown and can be muted in one place.

## 8. Offline storage

```ts
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

- Web: `localStorage` implementation. Native (Phase 5): `@capacitor/preferences`, because
  Capacitor documents that WebView `localStorage` can be reclaimed by the OS.
- Keys: `mergerush.save.v1` (serialized `GameState`), `mergerush.best` (best score, highest
  tile), `mergerush.settings` (sound, haptics, reduced motion).
- Loading validates the data; an unreadable or wrong-version save is discarded and a new
  game starts. Storage failures (private mode, quota) are caught and the game continues
  without persistence.
- The game makes no network requests at all. No service worker or PWA manifest is planned;
  the native build is offline by construction. A web PWA is a separate decision (Q14).

## 9. Performance considerations

The game is small: 25 cells, one moving tile, at most a few dozen display objects. The
realistic risks are start-up cost and wasted work, not simulation speed.

- Phaser is by far the largest part of the bundle. Measure the production bundle in Phase 2;
  only consider a custom Phaser build if the measured size or start-up time misses the
  targets in `TESTING_STRATEGY.md`.
- No per-frame allocation in the scene's `update`; the game is event-driven and idle
  between moves.
- Textures generated once at boot (and regenerated only on a size-class change).
- Particle counts capped; particles and screen shake disabled under reduced-motion.
- Pixel-ratio cap as described above.
- Engine cost per move is microseconds; previews on pointer move are computed only when the
  hovered cell changes.

## 10. Dependencies by phase

| Phase | Adds |
|---|---|
| 1 | `typescript`, `vite`, `vitest`, `@vitest/coverage-v8` (dev) |
| 2 | `phaser` (exact pin, version per Q11) |
| 3 | nothing (audio files are assets, not packages) |
| 4 | `@playwright/test` (dev) |
| 5 | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/preferences`, `@capacitor/haptics` |

Deliberately absent: linters/formatters (Q15), state management, UI frameworks, RNG or
immutability libraries, analytics, crash reporting, and any backend.
