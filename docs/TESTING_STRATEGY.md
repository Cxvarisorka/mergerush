# Merge Rush — Testing and Validation Strategy

Status: **proposal.** No tests exist and nothing has been run. Every number below is a
proposed target, not a measurement.

## 1. Test layers

| Layer | Tool | Scope | Phase |
|---|---|---|---|
| Unit | Vitest (Node environment) | Engine modules, layout maths, playback planning | 1, 2, 3 |
| Property / invariant | Vitest + the engine's own seeded RNG | Thousands of random playouts checked against invariants | 1 |
| Golden replay | Vitest | Fixed `seed + moves` → frozen final state and score | 1 |
| Simulation (balancing) | Vitest, separate script | Bot playouts producing game-length and score statistics | 1, re-run on rule changes |
| Integration | Vitest | Events ↔ state consistency; save → load → continue | 1, 2 |
| End-to-end | Playwright (mobile emulation) | Real build in Chromium and WebKit | 4 |
| Device | Manual checklist | Real Android and iOS hardware | 4, 5 |
| Playtest | People | Understanding, difficulty, fun | from Phase 2 |

No property-testing library is added: random inputs come from the engine's own PRNG, so
every failure is reproducible from a printed seed.

## 2. Engine tests (Phase 1)

### Unit cases

- **RNG**: fixed output vectors for known seeds (frozen once, then never changed);
  `nextInt(n)` always in range; state round-trips through serialization; `seedFromString`
  is stable.
- **Board helpers**: index ↔ coordinate conversion, neighbours at corners, edges, centre.
- **Spawn**: weighted draw matches the table boundaries exactly; initial board has the
  configured tile count; no two starting tiles are orthogonally adjacent; queue has the
  configured length; draw order is as specified.
- **Placement**: valid on any empty cell; rejects occupied, out-of-range, non-integer and
  post-game-over moves without changing state or consuming randomness.
- **Merge and priority**: single candidate in each of the four directions; two, three and
  four candidates with no momentum follow Up, Right, Down, Left; momentum direction beats
  the fixed order; diagonals never match; unequal neighbours never match.
- **Momentum and collisions**: slide to wall; slide stopped by an unequal tile; zero-length
  slide; stop next to an equal tile ahead → merge through and continue; stop next to an
  equal tile sideways → 90° turn; tiles passed during a slide are not merged; no other tile
  moves.
- **Chains**: the worked example in `GAME_DESIGN.md` reproduced exactly (board, events,
  score 20); a hand-built long chain; termination on a nearly full board.
- **Scoring**: `newValue × chain`; multiplier resets between moves; `longestChain` updates.
- **Game over**: filling the last cell without a merge ends the game; filling it with a
  merge does not; the `gameOver` event is emitted once.
- **Serialization**: round-trip equality; rejects malformed JSON, wrong version, wrong
  board length, non-power-of-two values.

### Invariants checked over random playouts

For many seeds, play random valid moves to game over and assert after every move:

1. Every tile value is a power of two `>= 2`; tile ids are unique.
2. Tile count after a move = count before + 1 − number of merges.
3. Score never decreases and increases by exactly the sum of `points` in the events.
4. `applyMove` does not mutate its input (deep-frozen input in tests).
5. Exactly one random draw is consumed per valid move.
6. Replaying the events onto the previous board reproduces the new board
   (events are sufficient for the renderer).
7. Every game terminates; chain length never exceeds 24.

### Determinism

- Same seed and moves → byte-identical serialized state, run twice in the same process and
  compared against committed golden files.
- Save mid-game, load, continue → identical to the uninterrupted game.
- In Phase 4 the same golden replays are executed inside Chromium and WebKit through
  Playwright to confirm the engine behaves identically outside Node.

### Coverage

Target: 95 % line and branch coverage on `src/engine/`, enforced by a threshold. Coverage
is a floor, not the goal; the invariants above are the real safety net.

## 3. Balancing simulations

Two simple bots, implemented as test utilities:

- **Random bot**: uniformly random valid cell.
- **Greedy bot**: tries every empty cell with `applyMove` and picks the highest immediate
  score, tie-broken by most empty cells left.

Each runs a fixed set of seeds (for example 2,000) and reports median and percentile game
length, score, highest tile and chain-length distribution.

Proposed targets, to be revised once real numbers exist:

| Measure | Target | Purpose |
|---|---|---|
| Random bot median game length | 40–100 moves | A careless player gets a short but not instant game |
| Greedy / random median score ratio | ≥ 5× | Decisions matter |
| Greedy bot games ending within 2,000 moves | ≥ 95 % | The game is not trivially endless |
| Share of greedy-bot moves with chain ≥ 2 | 10–30 % | Chains are regular but still an event |

If the fixed spawn table misses these, the table and the progression rule (Q5) are adjusted
and the simulation re-run. Bots are a cheap proxy; they do not replace playtests.

## 4. App-layer tests (Phases 2–3)

- **Layout** (`layout.ts`, pure): for a list of viewport sizes (320×568, 360×640, 390×844,
  412×915, 768×1024, landscape variants) the board is square, on screen, inside safe areas,
  and cells are at least 48 CSS px.
- **Hit-testing**: screen point → cell index, including gaps and outside the board.
- **Playback planning**: an event list maps to the expected ordered animation steps and the
  total duration stays within the time box. Tween execution itself is not unit-tested.
- **Session**: commit saves before playback; load restores; corrupt save falls back to a
  new game. Uses an in-memory `KeyValueStore`.

Phaser scenes are not unit-tested in isolation; they are thin and are covered by
end-to-end tests.

## 5. End-to-end tests (Phase 4)

Playwright projects: Chromium with a Pixel preset, WebKit with an iPhone preset.

The game exposes a small test hook only in non-production builds (seed via `?seed=`,
read-only access to current state and board geometry), because canvas content cannot be
queried through the DOM.

Scenarios:

1. Loads with no console errors and no network requests beyond its own bundle.
2. Seeded game: tapping a known sequence of cells produces the expected score and board.
3. Preview: press, drag across cells, release off-board → no move made.
4. Invalid tap on an occupied cell → no change.
5. Play a seeded sequence to game over → overlay shown, restart works, best score kept.
6. Reload mid-game → state restored.
7. Rotate / resize → board stays fully visible and playable.
8. Offline: after the built app has loaded, the network is disabled and a full game is
   played; the test asserts the game issues **zero** network requests during play.
   (Reloading while offline is not expected to work on the web build, which has no service
   worker; offline launch is verified on the native builds in Phase 5.)
9. Golden replays executed in-page (determinism across engines).

Taps use `touchscreen.tap`; the press-drag-release preview uses mouse or dispatched touch
events, since Playwright's touchscreen API only emulates taps.

## 6. Manual device checks (Phases 4–5)

Reference devices to be named by the owner (Q12). Checklist per device: cold start time,
touch accuracy at board edges, notch and gesture-bar safe areas, audio starts after first
touch, mute switch respected, haptics, background/foreground mid-animation, kill and
relaunch restores the game, airplane-mode launch, rotation, low-power mode, text legibility
outdoors.

## 7. Accessibility checks (Phase 4)

- Tile values distinguishable without colour (the number is always shown; contrast ratio
  ≥ 4.5:1 for numbers against tile colours).
- A colour-blind-safe palette check using simulated deuteranopia/protanopia screenshots.
- Reduced-motion setting (and `prefers-reduced-motion`) disables shake and particles and
  shortens tweens.
- Sound and haptics independently switchable; the game is fully playable silent.
- Touch targets ≥ 48 CSS px.
- Screen-reader support for a canvas game is limited; a live-region announcing score and
  game over is proposed as the minimum. Full non-visual play is out of scope for v1 unless
  requested (Q16).

## 8. Game-design validation

| Quality | How it is evaluated | Proposed success criterion |
|---|---|---|
| Simplicity | Rules fit on one screen; count of rules a player must know | Core loop explained in ≤ 3 sentences, no text tutorial longer than 3 steps |
| Player understanding | Prediction test: show 5 board + placement pictures, ask where the tile ends and what value | ≥ 80 % of first-time testers get ≥ 4 of 5 right after 3 minutes of play |
| Understanding of priority | Same test with two-candidate cases, with the preview enabled | ≥ 80 % correct with preview; record the rate without it to judge Q2 |
| Difficulty progression | Move number at game over across first 5 games per tester; bot statistics | Median first game 2–5 minutes; game 5 median length ≥ 1.5× game 1 |
| Strategic depth | Greedy/random score ratio; spread of human scores after 10 games; testers can state a strategy | Ratio ≥ 5×; experienced testers outscore new ones by ≥ 3× |
| Replayability | Voluntary replays in a free session; return next day in a small diary test | ≥ 60 % start a second game unprompted; ≥ 30 % play again next day |
| Responsiveness | Time from release to first visual change; move playback length | Feedback within 100 ms; typical move ≤ 400 ms, longest chain ≤ 1,200 ms |
| Performance | Frame-time capture during chains on the reference low-end device | 95th-percentile frame time ≤ 16.7 ms; cold start ≤ 3 s; no growth in memory over 500 moves |
| Determinism | Golden replays in Node, Chromium, WebKit; save/load equivalence | 100 % identical |
| Mobile usability | One-handed play test; mis-tap rate from testers' reported "didn't mean that" moves | ≥ 90 % of testers play one-handed comfortably; mis-taps < 2 % of moves |

## 9. Playtesting approach

1. **Phase 1 (no UI)**: bot simulations plus the owner reading generated move-by-move text
   boards to sanity-check that the rules feel right on paper.
2. **Phase 2 (first playable)**: 5 people, in person or screen-shared, 15 minutes each, no
   explanation given. Observe silently: first confusion, first chain, first game-over
   reaction. Then run the prediction test. Five testers per round is enough to expose the
   large problems; fix and repeat with new testers.
3. **Phase 3 (with polish)**: a second round of 5 new testers; add the next-day diary
   question.
4. **Phase 5 (device builds)**: wider closed test through the stores' testing tracks.

Each round ends with a short written note: what was observed, what changes, which open
questions it answers. Rule changes go back through the simulations and the golden files are
regenerated deliberately, in a commit that says why.

## 10. Rules of evidence

- A phase is not "done" on the strength of code review; its commands must be run and their
  output recorded in the pull request.
- Golden files change only in commits that intentionally change rules.
- A failing or flaky test is fixed or its cause documented; tests are never skipped to get
  a green run.
