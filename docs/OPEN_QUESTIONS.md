# Merge Rush — Open Questions and Assumptions

Each question has a recommended default. **Blocking** means it must be answered before the
named phase starts. Nothing here has been decided on your behalf.

## A. Gameplay — blocking for Phase 1

| # | Question | Recommended default | Alternatives |
|---|---|---|---|
| Q1 | **Is the core loop right?** The brief lists mechanics but not how they connect. This plan interprets it as: tap to place a queued tile; an equal neighbour makes it move in, merge, and slide with momentum; chains follow. Untimed. | As described in `GAME_DESIGN.md` | Swipe-to-slide-the-whole-board (2048-style); a timed "rush" mode; gravity/drop mechanic |
| Q2 | **Merge priority with several equal neighbours and no momentum.** | Fixed order Up, Right, Down, Left, made visible by an on-board preview before commit | (a) placed tile absorbs **all** equal neighbours and is pushed by the net direction; (b) the player chooses by swiping toward the neighbour; (c) no slide when ambiguous |
| Q3 | **Starting tiles.** | 4 tiles, never adjacent to each other | 0, 2 or 3 tiles; allow adjacency |
| Q4 | **Spawn table.** | 2: 60 %, 4: 30 %, 8: 10 % | 2/4 only (90/10); wider range |
| Q5 | **Difficulty progression.** Should higher values enter the queue as the highest tile grows? | Fixed table for v1; decide from Phase 1 simulation data | Unlock a new value each time the highest tile doubles twice; rising share of 8s over time |
| Q6 | **Queue preview length.** | Current tile + 1 upcoming | Current only (harder); +2 (easier, more planning) |
| Q7 | **Scoring.** | Each merge scores `new value × chain position`; no cap | Flat `new value`; doubling multiplier (×1, ×2, ×4…); slide-distance bonus |

## B. Gameplay — non-blocking (needed by Phase 2 or 3)

| # | Question | Recommended default |
|---|---|---|
| Q8 | Win or milestone moment (for example first 2048)? | Endless play with a one-time celebration; no win screen |
| Q9 | Is it acceptable that equal tiles can sit adjacent unmerged after a chain (only the placed tile triggers merges)? | Yes, as a "primed pair" mechanic; verify in the first playtest |
| Q10 | Undo? | None in v1 |
| Q17 | Tutorial format? | Three interactive first moves on a scripted seed; no text walls |
| Q18 | Confirm-before-commit input (press-drag-release with preview) versus instant tap? | Press-drag-release; a quick tap still commits immediately |

## C. Technical

| # | Question | Blocking for | Recommended default |
|---|---|---|---|
| Q11 | **Phaser 3 or Phaser 4?** Phaser 4.2.1 is the current release; Phaser 3 ended at 3.90.0 in May 2025. See `ARCHITECTURE.md` §2. | Phase 2 | Plan assumes `phaser@3.90.0` as briefed. Suggest a half-day Phaser 4 spike before committing; switch if it is clean |
| Q12 | Target and reference devices, minimum OS versions? | Phase 4 | Capacitor 8 minimums (Android API 24, iOS 15); one low-end Android (about 3 GB RAM) and one older iPhone as references |
| Q13 | Orientation: portrait only, or both? | Phase 2 | Portrait-first; landscape usable on web, locked to portrait in the native apps |
| Q14 | Is the web build a product (hosted, installable PWA) or only a development target? | Phase 4 | Development target only; no service worker |
| Q15 | Linting/formatting tools (ESLint, Prettier)? | Phase 1 | None initially; strict TypeScript only. Add if more than one person contributes |
| Q16 | Accessibility level beyond contrast, reduced motion and touch-target size? | Phase 4 | Score/game-over announcements only; no full screen-reader play |
| Q19 | Continuous integration (GitHub Actions running typecheck and tests)? | Phase 4 | One small workflow, added in Phase 4 or earlier on request |
| Q20 | TypeScript version if 7.x shows incompatibilities? | Phase 1, task 1 | Use the newest version that works; record the reason |
| Q21 | Sound: recorded files or synthesized in code? Who supplies them and under what licence? | Phase 3 | A handful of short, licence-clear files; pitch rises with chain position |
| Q22 | Visual identity: palette, font, app icon, name availability in stores? | Phase 3 / 5 | Generated shapes and one bundled open-licence font; icon and store assets supplied by the owner |

## D. Release and business — blocking for Phase 5

| # | Question |
|---|---|
| Q23 | Which stores, and are developer accounts (Apple, Google) already set up? |
| Q24 | App identifier (for example `com.<owner>.mergerush`) and display name? |
| Q25 | Monetisation: none, ads, or purchases? Any of these adds SDKs, privacy disclosures and consent flows that this plan does not include. |
| Q26 | Analytics or crash reporting? The current plan ships none, which keeps the privacy declaration trivial. |
| Q27 | Who has a Mac with Xcode 26+ for iOS builds? iOS cannot be built in the cloud environment used for this planning. |

## E. Assumptions made in this plan

These were assumed in order to write a concrete plan. Correct any that are wrong.

1. Single-player, offline, no accounts, no backend.
2. "Merge Rush" is an original design; no existing game's rules, art or name are being
   reproduced.
3. One developer or a very small team, so tooling is kept minimal.
4. Latest stable tool versions are acceptable except where the brief names a major version
   (Phaser 3).
5. English-only UI for v1; the game is mostly numbers, so localisation is cheap later.
6. No art or audio assets exist yet.
7. The board is always 5×5; `size` is configuration only to keep tests simple, not to
   support other sizes as a feature.

## F. Things that could not be verified

1. Official documentation websites were unreachable from the planning environment; facts
   were taken from the projects' official GitHub repositories and the npm registry instead.
2. TypeScript 7 compatibility with Phaser's type definitions and with Vitest.
3. Phaser 4 API details and migration effort.
4. Any performance, bundle-size or device-behaviour figure. Nothing has been built or run.
5. Whether the proposed rules are fun or balanced. That needs the Phase 1 simulations and
   the Phase 2 playtest.
