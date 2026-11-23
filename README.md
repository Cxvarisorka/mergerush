# Merge Rush

An original mobile-first 2D merge puzzle game. TypeScript, Phaser 3, Vite, Vitest, Capacitor.

Place power-of-two tiles on a 5×5 board. A tile placed next to an equal tile moves into
it, doubles, and keeps sliding in that direction; if it comes to rest next to another equal
tile it merges again. Each extra merge in one move multiplies its points. The game ends
when the board is full. Full rules: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Commands

Requires Node.js 22.12 or newer.

| Command | What it does |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | development server |
| `npm run build` | production build into `dist/` |
| `npm run typecheck` | TypeScript for the app and, separately, the engine without DOM types |
| `npm test` | unit, invariant, golden-replay and simulation tests |
| `npm run test:coverage` | tests with engine coverage (threshold 95 %) |
| `npm run sim` | balancing simulation report |
| `npm run test:e2e` | Playwright end-to-end tests on emulated phones, tablet and desktop |
| `npm run test:all` | typecheck, unit tests and end-to-end tests |
| `npm run cap:sync` | build the web app and copy it into the Android and iOS projects |
| `npm run android:build` | debug APK (needs the Android SDK) |
| `npx cap open android` / `npx cap open ios` | open the native project in Android Studio / Xcode |

## How to play

Tap an empty cell to place the tile shown under PLACE. Hold and drag to preview where it
will go; release off the board to cancel. On a keyboard: arrow keys and Enter.

## Engine

`src/engine` is a pure, deterministic rules library: no Phaser, DOM, clock, storage or
`Math.random`. Public API (`src/engine/index.ts`):

```ts
createGame(seed: number, config?: GameConfig): GameState
applyMove(state: GameState, cell: CellIndex): MoveResult   // pure; returns new state + events
validMoves(state: GameState): CellIndex[]
seedFromString(text: string): number
serialize(state: GameState): string
deserialize(json: string): GameState | null
```

A game is fully reproducible from its seed and the list of cells played.

Golden replays in `tests/engine/golden/` change only when the rules change on purpose:

```bash
UPDATE_GOLDEN=1 npx vitest run tests/engine/golden.test.ts
```

## Project layout

```
src/engine/     pure deterministic rules (no Phaser, no DOM)
src/app/        Phaser scene, views, input, playback, session, layout
src/platform/   storage and haptics for web (localStorage, Vibration API) and native (Capacitor)
tests/          unit, invariant, golden, simulation (Vitest) and e2e (Playwright) tests
android/, ios/  Capacitor native projects
docs/           plan, design, architecture, testing, test report, release checklist
```

## Documentation

- [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md): roadmap and phase status
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md): rules
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): technical design
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md): what was tested and the results
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md): native builds and store release
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md): decisions taken and still open
