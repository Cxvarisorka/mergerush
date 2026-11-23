# Merge Rush — Master Plan

Date: 2026-11-23. Status: **planning complete, awaiting approval. No application code has
been written.**

Companion documents: `GAME_DESIGN.md` (rules), `ARCHITECTURE.md` (technical design and
verified facts), `TESTING_STRATEGY.md`, `PHASE_1_PLAN.md`, `OPEN_QUESTIONS.md`.

## 1. Where the project stands

- The repository is empty: no commits, no files, no remote branches. Everything is new.
- Local toolchain: Node 22.23.5, npm 10.9.9, which satisfies current Vite 8, Vitest 5 and
  Capacitor 8.
- The brief asks for Phaser 3. The current Phaser release is 4.2.1 and Phaser 3 stopped at
  3.90.0 in May 2025. The plan follows the brief (pin 3.90.0) and flags the choice as Q11;
  it does not affect Phase 1.
- Official documentation sites were unreachable; version and API facts come from official
  GitHub repositories and the npm registry. Unverified items are listed in
  `ARCHITECTURE.md` §1.

## 2. Product summary

A single-player, offline, portrait-first puzzle game. Place power-of-two tiles on a 5×5
board; a placed tile that touches an equal tile moves into it, doubles, and slides onward
with momentum, possibly chaining further merges for multiplied score. The game ends when
the board fills. Full rules: `GAME_DESIGN.md`.

## 3. Architecture summary

A pure, deterministic TypeScript engine (`src/engine`) returns a new state and an event
list for every move. A thin Phaser layer (`src/app`) draws state, plays events back as
animation and converts touches to cell indices. Storage and haptics sit behind two small
interfaces (`src/platform`) so web and Capacitor builds share everything else. Details:
`ARCHITECTURE.md`.

## 4. Phases

Each phase ends in a reviewable pull request (or a few), with its commands run and output
recorded. No phase starts without approval of the previous one.

---

### Phase 1 — Foundation and Game Engine

Full detail in `PHASE_1_PLAN.md`.

1. **Objective**: the complete rules as a tested, deterministic library, plus minimal
   project configuration.
2. **Tasks**: project skeleton; types and config; seeded RNG; board helpers; spawn and
   initial board; resolution (merge priority, momentum, slide, chain scoring); game API;
   serialization; invariant tests; golden replays; bot simulations; write-up.
3. **Files**: `package.json`, `tsconfig.json`, `tsconfig.engine.json`, `vite.config.ts`,
   `.gitignore`, `index.html`, `src/main.ts` (placeholder), `src/engine/*`,
   `tests/engine/*`, `tests/sim/*`.
4. **Dependencies**: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`. Answers to
   Q1–Q7.
5. **Acceptance criteria**: typecheck, tests and build pass; engine coverage ≥ 95 %; worked
   example reproduced; byte-identical replays; engine free of DOM, clock and ambient
   randomness; simulation statistics reported.
6. **Required tests**: unit, invariant, golden, save/load equivalence, simulations.
7. **Risks**: late rule changes; TypeScript 7 tooling compatibility; golden files frozen
   with a bug; balance surprises; over-engineering.
8. **Definition of done**: criteria met with evidence, only planned files added, results
   written up, owner approval.

---

### Phase 2 — Playable Game

1. **Objective**: a complete, plain-looking game playable on a phone browser: place tiles,
   see results, score, game over, restart, resume after reload.
2. **Tasks**:
   1. Resolve Q11 (optional Phaser 4 spike), then add Phaser with an exact version pin.
   2. `main.ts`: game config, RESIZE scaling, full-viewport container, pixel-ratio handling.
   3. `layout.ts`: pure layout from viewport and safe-area insets.
   4. `BootScene`: generate tile, grid and UI textures.
   5. `BoardView` and `TileView` with pooling; draw any `GameState`.
   6. `BoardInput`: press/drag preview, release to commit, release off-board to cancel.
   7. Move preview rendering (ghost tile, path, landing cell) using `applyMove`.
   8. Minimal `EventPlayer`: linear move and value-change steps, no flourish, followed by
      reconciliation with engine state.
   9. `HudView`: score, best, current and next tile, restart button with confirmation.
   10. `GameOverOverlay`: final score, best, restart.
   11. `session.ts` and `platform/storage.ts`: save after each move, load on start, best
       score, corrupt-save fallback.
   12. Viewport meta, touch-action and overscroll CSS so the page does not scroll or zoom.
3. **Files**: `src/app/**`, `src/platform/storage.ts`, `index.html`, `src/main.ts`
   (replaced), `tests/app/layout.test.ts`, `tests/app/session.test.ts`, `package.json`.
4. **Dependencies**: `phaser`. Phase 1 approved. Q11, Q13, Q18.
5. **Acceptance criteria**:
   - A full game is playable start to game over on a 360×640 emulated phone and on at
     least one real phone browser.
   - Board fully visible with cells ≥ 48 CSS px on all listed viewport sizes; survives
     rotation and resize.
   - Preview always matches the committed result (same function).
   - Score and board after every move equal the engine's state.
   - Reload restores the game; best score persists; restart works from play and from game
     over.
   - The page does not scroll, zoom or select text during play.
   - `src/engine` unchanged except for bug fixes with tests.
6. **Required tests**: layout and hit-testing unit tests; session tests with in-memory
   storage; manual checklist run on emulated and real devices and recorded; Phase 1 suite
   still green.
7. **Risks**: high-DPI blur or cost under Phaser 3; iOS Safari viewport and safe-area
   quirks; press-drag-release feeling slow; TypeScript and Phaser type compatibility;
   Phaser bundle size.
8. **Definition of done**: criteria met with a recorded checklist and bundle-size figure;
   first 5-person playtest held and notes written; owner approval.

---

### Phase 3 — Game Feel and Visual Polish

1. **Objective**: make moves readable and satisfying without changing any rule.
2. **Tasks**:
   1. Full `EventPlayer`: eased slides, merge pop, value roll-up, chain step timing with a
      total time box and acceleration for long chains.
   2. Chain feedback: multiplier call-out, escalating pitch, floating score.
   3. Particles on merge, scaled by chain position, capped.
   4. Visual design pass: palette with per-value colours, typography, spacing, game-over
      and restart transitions, new-best highlight.
   5. Sound: place, merge (pitched), slide stop, game over, UI tap; mute toggle; unlock on
      first touch.
   6. Haptics interface with web implementation (`navigator.vibrate` where available,
      no-op elsewhere); toggle.
   7. Settings: sound, haptics, reduced motion; persisted.
   8. Milestone celebration (Q8) and three-move interactive tutorial (Q17).
3. **Files**: `src/app/playback/*`, `src/app/view/*`, `src/app/view/theme.ts`,
   `src/platform/haptics.ts`, `public/audio/*`, `tests/app/playback.test.ts`.
4. **Dependencies**: no new packages. Phase 2 approved. Q8, Q17, Q21, Q22.
5. **Acceptance criteria**:
   - Every event type has a distinct, legible animation; an observer can follow a
     three-merge chain.
   - Typical move playback ≤ 400 ms; longest chain ≤ 1,200 ms; input never queues up
     behind animation.
   - After any playback the view equals engine state (automated reconciliation check in
     development builds).
   - Sound and haptics can each be turned off; reduced motion removes shake and particles.
   - Engine untouched; all earlier tests green.
6. **Required tests**: playback-planning unit tests (order and duration budget); settings
   persistence tests; manual feel review on a real device; second playtest round.
7. **Risks**: polish expanding without limit; animation length hurting pace; audio latency
   on Android WebView; asset licensing; frame drops from particles on low-end devices.
8. **Definition of done**: criteria met; playtest notes show testers can follow chains;
   performance spot-check on the low-end reference device; owner approval of look and feel.

---

### Phase 4 — Quality Assurance

1. **Objective**: prove the game is correct, fast, accessible and robust across target
   browsers and devices before packaging.
2. **Tasks**:
   1. Add Playwright with Pixel/Chromium and iPhone/WebKit projects; add the
      non-production test hook.
   2. Implement the end-to-end scenarios in `TESTING_STRATEGY.md` §5, including in-browser
      golden replays.
   3. Fill gaps in unit and integration coverage found during Phases 2–3.
   4. Performance pass: measure bundle size, cold start, frame times and memory over a long
      session; fix what misses targets.
   5. Accessibility pass: contrast, colour-blind check, reduced motion, touch targets,
      score and game-over announcements.
   6. Robustness: storage unavailable, corrupt save, background/foreground mid-animation,
      rapid input, resize storms.
   7. Compatibility matrix run on real devices; issues logged and fixed or accepted.
   8. Optional CI workflow (Q19).
3. **Files**: `playwright.config.ts`, `tests/e2e/*`, small changes in `src/app/**`,
   optionally `.github/workflows/ci.yml`, `docs/` test report.
4. **Dependencies**: `@playwright/test`. Phase 3 approved. Q12, Q14, Q16, Q19.
5. **Acceptance criteria**: all end-to-end scenarios pass in both browser projects three
   times consecutively; golden replays identical in Node, Chromium and WebKit; performance
   targets in `TESTING_STRATEGY.md` §8 met on the reference devices or deviations accepted
   in writing; accessibility checklist complete; no known crash or state-corruption bug
   open.
6. **Required tests**: everything above plus the manual device checklist.
7. **Risks**: canvas end-to-end tests being flaky; emulation hiding real-device problems;
   performance fixes needing a renderer change late; the test hook leaking into production.
8. **Definition of done**: written test report with results and the device matrix; open
   issues triaged; owner approval.

---

### Phase 5 — Mobile Packaging and Release Preparation

1. **Objective**: installable Android and iOS builds that work fully offline and are ready
   for store submission.
2. **Tasks**:
   1. Add Capacitor; `capacitor.config.ts` with app id, name and `webDir: 'dist'`.
   2. Add Android and iOS platforms; build and run on emulators and devices.
   3. Swap in `@capacitor/preferences` storage and `@capacitor/haptics`, selected at
      start-up by platform; migrate nothing (no prior native data).
   4. Native details: portrait lock, status-bar and safe-area handling, splash screen, app
      icons, Android back button (confirm exit / close overlay), pause audio in background.
   5. Offline verification: fresh install, airplane mode, first launch and full game.
   6. Device testing across the matrix; performance re-check inside the WebView.
   7. Store readiness: versioning, signing, screenshots, descriptions, privacy
      declarations, age rating, testing-track release.
3. **Files**: `capacitor.config.ts`, `android/**`, `ios/**`,
   `src/platform/storage.capacitor.ts`, `src/platform/haptics.capacitor.ts`,
   `src/platform/index.ts`, `package.json`, release checklist in `docs/`.
4. **Dependencies**: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
   `@capacitor/ios`, `@capacitor/preferences`, `@capacitor/haptics`. Android Studio
   2025.2.1+, Xcode 26+ on a Mac, developer accounts. Q23–Q27.
5. **Acceptance criteria**: debug and release builds install and run on at least one real
   Android and one real iOS device; a full game is playable in airplane mode from first
   launch; game and best score survive force-quit and device restart; haptics and audio
   behave per settings and the hardware mute switch; no network requests observed; store
   listings complete and a build accepted on each testing track.
6. **Required tests**: full automated suite against the web build; manual device checklist
   on native builds; upgrade-install test (install build N, play, install N+1, state kept).
7. **Risks**: iOS builds need a Mac and Xcode 26+; WebView performance differing from the
   browser; store review requirements; signing-key handling; older Android WebView
   versions.
8. **Definition of done**: signed builds on both testing tracks, release checklist
   complete, owner sign-off to submit.

## 5. Cross-phase rules

- The engine changes only through tests; golden files change only with intentional rule
  changes.
- Dependencies are pinned and added only in the phase that needs them.
- Every phase's pull request states what was run and what was not.
- Rule or balance changes after Phase 1 go through simulation and a playtest before
  release.

## 6. Top risks

1. **The mechanic is unproven.** Whether momentum merging is understandable and fun is not
   known until the Phase 2 playtest. The plan front-loads a cheap engine and an early
   plain playable to find out quickly.
2. **Merge priority legibility** (Q2) is the most likely source of player confusion.
3. **Balance** (Q4, Q5): the game may be endless or too short; simulations in Phase 1 give
   the first evidence.
4. **Phaser version** (Q11): building on a frozen major version versus an unverified new
   one.
5. **High-DPI rendering** under Phaser 3.
6. **iOS build access** (Q27) and store requirements.

## 7. Before implementation can start

- [ ] Core loop interpretation confirmed (Q1)
- [ ] Merge priority rule chosen (Q2)
- [ ] Starting tile count and placement confirmed (Q3)
- [ ] Spawn table confirmed as the starting point (Q4)
- [ ] Progression approach confirmed: fixed table first, tune from data (Q5)
- [ ] Queue preview length confirmed (Q6)
- [ ] Scoring formula confirmed (Q7)
- [ ] Tooling choice confirmed: no linter/formatter initially (Q15)
- [ ] Latest stable TypeScript/Vite/Vitest acceptable, with documented fallback (Q20)
- [ ] Phase 1 scope in `PHASE_1_PLAN.md` approved
- [ ] Explicit go-ahead to begin Phase 1

Needed before Phase 2, not before Phase 1: Phaser version (Q11), orientation (Q13), input
style (Q18).
