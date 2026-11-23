# Merge Rush — Phase 1 Plan: Foundation and Game Engine

Status: **not started. Implementation requires explicit approval** and answers to the
blocking questions in `OPEN_QUESTIONS.md` (Q1–Q7).

## 1. Objective

Deliver the complete, deterministic rules of Merge Rush as a pure TypeScript library with
tests, plus the minimal project configuration needed to build and test it. At the end of
Phase 1 a full game can be played to game over from code, reproducibly from a seed, with no
rendering at all.

## 2. In scope / out of scope

**In scope**: package and TypeScript configuration, Vite and Vitest setup, a placeholder
page so the build can be verified, all engine modules, unit/property/golden tests, bot
simulations, engine README section.

**Out of scope**: Phaser, any rendering or input, audio, storage implementations,
Playwright, Capacitor, CI, linting/formatting tools (Q15), visual design.

## 3. Dependencies

Dev dependencies only, pinned to exact versions in `package.json`:

- `typescript` (7.0.2 is current; if it causes tooling problems, fall back to the newest
  version that works and record why)
- `vite` 8.x
- `vitest` 5.x
- `@vitest/coverage-v8` (same version as Vitest)

Requires Node `>=22.12` (local is 22.23.5). No runtime dependencies.

## 4. Files to be created

| File | Purpose |
|---|---|
| `package.json` | scripts: `dev`, `build`, `typecheck`, `test`, `test:coverage`, `sim`; `engines.node` |
| `.gitignore` | `node_modules`, `dist`, coverage output |
| `tsconfig.json` | strict, `noUncheckedIndexedAccess`, `noEmit`, bundler resolution, DOM lib |
| `tsconfig.engine.json` | includes only `src/engine`, **no DOM lib, no ambient types** |
| `vite.config.ts` | `base: './'`, Vitest settings, coverage thresholds for `src/engine` |
| `index.html`, `src/main.ts` | placeholder page that imports the engine and prints a seeded board as text (build verification only) |
| `src/engine/types.ts` | data model from `ARCHITECTURE.md` §5 |
| `src/engine/config.ts` | `DEFAULT_CONFIG` |
| `src/engine/rng.ts` | PRNG step, `nextInt`, `seedFromString` |
| `src/engine/board.ts` | coordinates, neighbours, empty cells |
| `src/engine/spawn.ts` | weighted draw, initial board, queue |
| `src/engine/resolve.ts` | resolution loop |
| `src/engine/game.ts` | `createGame`, `applyMove`, `validMoves` |
| `src/engine/serialize.ts` | `serialize`, `deserialize` |
| `src/engine/index.ts` | public exports |
| `tests/engine/*.test.ts` | one test file per engine module, plus `invariants.test.ts`, `golden.test.ts` |
| `tests/engine/helpers.ts` | text-board builder (`"2 . . 4 ."` → state), deep-freeze, random-playout driver |
| `tests/engine/golden/*.json` | frozen replays and expected results |
| `tests/sim/bots.ts`, `tests/sim/simulate.test.ts` | random and greedy bots, statistics report |

No existing files are modified, because none exist.

## 5. Implementation tasks, in order

Each task is test-first: write the failing tests, implement, run, commit.

1. **Project skeleton.** `package.json`, both tsconfigs, `vite.config.ts`, `.gitignore`,
   placeholder page. Verify `npm install`, `npm run typecheck`, `npm run build` and an empty
   `npm test` all run. Record the actual installed versions.
2. **Types and config.** `types.ts`, `config.ts`. No logic; verified by typecheck.
3. **RNG.** Pure function style: `next(state) → { value, state }`, `nextInt(state, n)`,
   `seedFromString`. Tests: range, determinism, state round-trip. Then freeze output vectors
   for three seeds into the test file.
4. **Board helpers.** Index/coordinate conversion, `neighbour(cell, direction)` returning
   `null` at walls, `emptyCells(board)` in ascending order.
5. **Spawn.** `drawValue`, `createInitialBoard` (non-adjacent placement, specified draw
   order), `fillQueue`.
6. **Resolution.** `resolve(board, activeCell) → { board, events, points, chain }`
   implementing `GAME_DESIGN.md` §4 exactly. This is the core of the phase; its tests are
   written from the unit-case list in `TESTING_STRATEGY.md` §2 using the text-board helper.
7. **Game API.** `createGame`, `applyMove` (validation → place → resolve → advance queue →
   game-over check → events), `validMoves`.
8. **Serialization.** Versioned JSON with structural validation.
9. **Invariant tests.** Random playouts over at least 1,000 seeds with the seven invariants.
10. **Golden replays.** Three full games (seeds chosen arbitrarily, moves from the random
    bot), final states committed as JSON. The first 10 moves of one game are checked by
    hand against the written rules before the file is frozen.
11. **Simulations.** Random and greedy bots; `npm run sim` prints the statistics table.
    Results are pasted into the pull request and compared against the proposed targets.
12. **Engine purity check.** `tsc -p tsconfig.engine.json` added to `npm run typecheck`.
13. **Write-up.** Short README section: how to run, the public API, how to regenerate
    golden files, simulation results, any deviation from the design documents.

## 6. Acceptance criteria

1. `npm run typecheck` passes, including the engine-only project without DOM types.
2. `npm test` passes; engine line and branch coverage ≥ 95 %.
3. `npm run build` produces a `dist/` that loads from a relative path.
4. The worked example in `GAME_DESIGN.md` §4 is a passing test with identical board, events
   and score.
5. Same seed and moves give byte-identical serialized state on repeated runs and match the
   golden files.
6. A saved-and-reloaded mid-game state continues identically to the uninterrupted game.
7. `src/engine` contains no import from outside `src/engine` and no use of `Math.random`,
   `Date`, timers, DOM or storage (checked by the engine tsconfig plus a text search in a
   test).
8. Every invalid move returns a typed rejection and leaves state unchanged.
9. All 1,000+ random playouts terminate and satisfy all invariants.
10. Simulation statistics are produced and reported. **Meeting the balance targets is not
    an acceptance criterion** for Phase 1; reporting the numbers is.

## 7. Required tests

All of `TESTING_STRATEGY.md` §2 (unit cases, invariants, determinism, coverage) and §3
(simulations run and reported).

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A blocking rule decision changes after implementation | Medium | Rules are confined to `resolve.ts`, `spawn.ts` and `config.ts`; confirm Q1–Q7 first |
| TypeScript 7 incompatibility with Vitest or Vite tooling | Unknown (unverified) | Task 1 surfaces it immediately; fall back to an earlier TypeScript and record it |
| Golden files frozen with a subtle rule bug | Medium | Hand-check of 10 moves; unit tests written from the rule text, not from engine output |
| Bots show the game is trivially endless or brutally short | Medium | Expected possibility; outcome is a balancing proposal, not a Phase 1 failure |
| Over-engineering (classes, generic grids, plug-in rules) | Medium | Plain functions and data; one board shape; configuration limited to `GameConfig` |
| Float-based range mapping differs across JS engines | Low | Integer-only PRNG arithmetic; cross-engine check in Phase 4 |

## 9. Definition of done

- All acceptance criteria met, with command output included in the pull request.
- Pull request contains only the files listed in §4.
- Simulation results and any deviations from the design are written up.
- `OPEN_QUESTIONS.md` updated with anything learned.
- Reviewed and approved by the project owner. Phase 2 does not start without approval and
  an answer to Q11 (Phaser version).

## 10. Suggested review slices

To keep review small, Phase 1 can be delivered as three pull requests:

1. Skeleton + types + RNG + board helpers (tasks 1–4).
2. Spawn + resolution + game API + serialization (tasks 5–8).
3. Invariants + golden replays + simulations + write-up (tasks 9–13).
