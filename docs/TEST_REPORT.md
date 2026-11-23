# Merge Rush — Test Report

Date: 2026-11-23. Everything below was run in the cloud development container (Linux,
4 CPUs, Node 22.23.5, headless Chromium 1243 via Playwright 1.63.0). Nothing here was run
on a physical phone.

## Commands and results

| Command | Result |
|---|---|
| `npm run typecheck` | passes (app + tests, and the engine alone without DOM types) |
| `npm test` | 177 tests in 15 files pass (incl. native glue tests with mocked Capacitor) |
| `npm run test:coverage` | engine coverage 100 % statements, branches, functions, lines |
| `npm run build` | passes; one JS chunk of 1,235 kB (329 kB gzipped), almost all Phaser |
| `npm run test:e2e` | 95 passed, 0 failed, 20 skipped by design, about 12 min with 2 workers (re-run after Capacitor integration: same result) |

## End-to-end device matrix

All projects run Chromium. The iPhone and iPad-style projects emulate the device
(viewport, pixel ratio, touch, user agent) but **not the WebKit engine**: this environment
only has Chromium, and installing WebKit was out of bounds. Real Safari / WKWebView is
untested.

| Project | Emulates | Input used |
|---|---|---|
| `android-phone` | Pixel 7 (412×915, DPR 2.625) | touch taps, dispatched touch drags |
| `iphone` | iPhone 13 (390×844, DPR 3) | touch taps, dispatched touch drags |
| `small-phone` | iPhone SE (375×667, DPR 2) | touch taps, dispatched touch drags |
| `tablet` | Galaxy Tab S4 (712×1138, DPR 2.25) | touch taps, dispatched touch drags |
| `desktop` | Desktop Chrome 1280×800 | mouse, keyboard |

Scenarios covered (each project unless noted):

- Loads with no console or page errors; first-launch help appears once; no requests leave
  the origin.
- Canvas fills the viewport, the page never scrolls, board fully on screen, cells ≥ 44 CSS px.
- Real taps reproduce the engine exactly (25 moves of a golden game, byte-identical state).
- The three golden replays are byte-identical when run inside the browser.
- Press-drag-off-release cancels; a touch drag commits where the finger lifts (touch
  projects); tapping an occupied cell changes nothing.
- Tapping during an animation skips it and the tiles still match the state.
- A full game reaches game over; play again resets; best score survives reload.
- Reload mid-game restores the exact game; restart asks for confirmation.
- Settings toggle and persist; `prefers-reduced-motion` turns reduced motion on.
- Rotation and resize keep the board visible and playable (touch projects).
- Offline play with zero network requests; storage that throws; corrupt saves.
- The render loop sleeps when idle and wakes on input.
- No display-object leak over three full games (android-phone, desktop).
- Keyboard: arrow keys and Enter play the game; panels are keyboard operable (desktop).
- The production build does not contain the test hook (desktop, file check).

## Performance

| Measure | android-phone | desktop | Target |
|---|---|---|---|
| Start-up to playable | 1.7 s | 1.3 s | < 3 s on device (test guard: < 5 s) |
| Main-thread script per move, incl. test polling | 26 ms | 26 ms | guard < 60 ms |
| Frame time median / p95 (software GL) | 83 / 100 ms | 67 / 83 ms | not representative, see below |
| Idle CPU | 0 (render loop sleeps after 2 s) | 0 | — |

Headless Chromium here renders WebGL with SwiftShader on the CPU. A CPU profile of the idle
board showed about 40 ms of JavaScript in 1.5 s; the rest was native pixel fill. An empty
Phaser scene of the same size runs at 60 fps, so frame times above reflect the software
rasterizer filling a 2.4-megapixel canvas, not game logic. Two changes came out of this
investigation:

1. Tile faces and the board are drawn once into cached textures instead of being
   re-tessellated as vector shapes every frame (median frame time on the phone profile
   fell from 66 ms to 50 ms in isolation).
2. The render loop sleeps after 2 s without input, tweens or effects, and wakes on any
   touch, key, wheel, resize or visibility change. A static puzzle no longer redraws at
   60 fps, which matters for phone battery.

**Real-device frame rate is unmeasured.** It needs the Phase 5 device check.

## Accessibility

- Every tile value from 2 to 131072 has text contrast ≥ 4.5:1 (unit-tested). Tests found
  64, 128 and 256 below the bar; their colours were darkened.
- Numbers are always shown, so tiles never rely on colour alone.
- Touch targets: board cells ≥ 48 CSS px on all tested portrait phones (unit-tested over 14
  viewports at 3 pixel ratios), ≥ 44 px in landscape; HUD buttons 44 px.
- Reduced motion (setting, defaulting to `prefers-reduced-motion`): no particles, no
  shake, no floating motion, 40 % shorter playback.
- Sound and vibration can each be turned off; the game is fully playable silently.
- Keyboard play: arrow keys move a visible cursor with the move preview, Enter or Space
  places, Escape closes panels, Tab/arrows move panel focus, H/S/R open help, settings
  and restart.
- Screen readers: an `aria-live` region announces the score after each move, chains, new
  games and game over. Full non-visual play of the board is not supported (Q16).
- Not done: an automated colour-blindness simulation. The palette changes both hue and
  lightness and always shows the number, but this was not formally checked.

## Known gaps

- No WebKit / Safari run; no real Android or iOS device run.
- Audio was not verified by ear; the synthesized sounds are only exercised for errors.
- Vibration on Android Chrome was not felt; the API calls are unit-tested only.
- Native builds: see `docs/MASTER_PLAN.md`, Phase 5 status.
