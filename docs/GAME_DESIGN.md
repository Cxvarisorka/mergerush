# Merge Rush — Game Design

Status: **proposal, awaiting approval.** Nothing here is implemented or playtested.
Rules marked **[DECISION]** are product decisions with a recommended default; they are
collected in `OPEN_QUESTIONS.md` and must be confirmed before Phase 1 starts.

## 1. Concept in one paragraph

The player places numbered tiles (powers of two) one at a time onto a 5×5 board. When a
placed tile touches an equal tile, it **moves into it**, the two merge into one tile of
double the value, and the merged tile keeps **sliding in the direction it moved** until it
hits a wall or another tile. If it comes to rest next to another equal tile, it merges again
and keeps going. Every extra merge in one move multiplies the score. The board has no
gravity and nothing else moves. The game ends when the board is full.

The "rush" is the momentum chain: one well-placed tile can ricochet across the board.

## 2. Terms and coordinates

- **Cell**: `(row, col)`, both `0..4`. Row 0 is the top row, column 0 is the left column.
  Cell index = `row * 5 + col` (`0..24`).
- **Tile**: `{ id, value }`. `value` is a power of two, `>= 2`. `id` is a unique integer,
  used only so the renderer can track a tile across events.
- **Directions**, in fixed priority order: **Up** `(-1,0)`, **Right** `(0,+1)`,
  **Down** `(+1,0)`, **Left** `(0,-1)`.
- **Active tile**: the tile the player just placed. It is the only tile that ever moves.
- **Momentum**: the direction of the active tile's last movement, or *none*.
- **Queue**: upcoming tile values. `queue[0]` is the tile to place now; `queue[1]` is the
  preview.

## 3. Turn structure

1. The player chooses an empty cell. **Any empty cell is a valid move**; an occupied or
   out-of-range cell is an invalid move and changes nothing.
2. A tile with value `queue[0]` is placed there and becomes the active tile, with no
   momentum.
3. **Resolution** runs (section 4) until it terminates.
4. The queue advances: `queue[0]` is removed and one new value is drawn and appended.
5. **Game over** is checked (section 8).

The whole turn is computed atomically by the engine. Animation is a replay of what already
happened, so interrupting the app mid-animation cannot corrupt the game.

## 4. Resolution: matching, merge priority, momentum

Repeat until step 2 stops the loop. `P` is the active tile's cell, `m` its momentum,
`chain` starts at 0.

1. **Candidates** — the directions `D` for which the cell `P + D` is on the board, holds a
   tile, and that tile's value equals the active tile's value. Diagonals never match.
2. If there are no candidates, resolution ends.
3. **Merge priority** — pick exactly one direction:
   1. if `m` is a candidate, pick `m` (straight ahead wins);
   2. otherwise pick the first candidate in the order Up, Right, Down, Left. **[DECISION Q2]**
4. **Merge** — the active tile moves from `P` into the target cell `T = P + D`. The target
   tile is removed. The active tile keeps its `id`, now sits at `T`, and its value doubles.
5. **Score** — `chain += 1`; add `newValue × chain` points (section 7).
6. **Momentum and movement** — set `m = D`. While the cell `P + m` is on the board and
   empty, move the active tile one cell in direction `m`. The slide may be zero cells long;
   the tile still has momentum `m`.
7. Go to step 1.

### Collision and blocked movement

- A slide stops when the next cell is off the board (wall) or occupied (any tile, any value).
- Nothing is pushed, swapped or displaced. Tiles other than the active tile never move.
- Matching is checked only where the active tile **comes to rest**, never for tiles it
  passes on the way.
- If the tile that blocked the slide has an equal value, it is a candidate in direction `m`
  and wins priority, so the active tile merges straight through it and keeps sliding.
- The cell directly behind the active tile is always empty after a merge (it just left it),
  so a chain can never reverse direction; it can only continue straight or turn 90°.

### Termination

Every loop iteration that does not stop removes exactly one tile. A board holds at most 25
tiles, so a chain has at most 24 merges. No iteration cap or special case is needed.

### Worked example

Row 2 before the move (other rows empty), `.` = empty:

```
col:  0  1  2  3  4
      .  2  .  .  4
```

The player places a `2` at `(2,0)`.

| Step | What happens | Board row 2 | Points |
|---|---|---|---|
| place | `2` at `(2,0)`, no momentum | `2 2 . . 4` | |
| merge 1 | candidate Right; moves into `(2,1)`, becomes `4`, momentum Right | `. 4 . . 4` | 4 × 1 = 4 |
| slide | `(2,2)` and `(2,3)` are empty; `(2,4)` is occupied, stop at `(2,3)` | `. . . 4 4` | |
| merge 2 | Right is a candidate and is the momentum; moves into `(2,4)`, becomes `8` | `. . . . 8` | 8 × 2 = 16 |
| slide | wall; zero cells | `. . . . 8` | |
| end | no candidates | | total 20 |

One placed tile, two merges, three tiles became one.

## 5. Tile generation (powers of two)

Each new queue value is drawn from a fixed weighted table **[DECISION Q4]**:

| Value | Weight | Draw `n = nextInt(10)` |
|---|---|---|
| 2 | 6 | `n` in 0–5 |
| 4 | 3 | `n` in 6–8 |
| 8 | 1 | `n` = 9 |

The table is configuration data, not code, so it can be tuned from simulation and playtest
results without touching the rules. Whether the table should shift toward higher values as
the player's highest tile grows is an open balancing question **[DECISION Q5]**; the
recommended v1 is a fixed table, measured first.

Values are stored as plain integers. The largest value reachable on 25 cells is far below
`Number.MAX_SAFE_INTEGER`, so no big-number handling is needed.

## 6. Initial board and seeded randomness

### Random generator

- One small deterministic PRNG owned by the engine (recommended: **mulberry32** — 32-bit
  integer state, integer-only arithmetic via `Math.imul`, state is a single number that
  serializes trivially).
- The engine never calls `Math.random()`, `Date.now()` or any other ambient source.
- The seed is a 32-bit unsigned integer supplied by the caller. Text seeds (for example a
  date string for a daily board) are hashed to a 32-bit integer by a fixed hash function in
  the engine.
- `nextInt(n)` returns an integer in `0..n-1`. The mapping from raw output to range is part
  of the specification and is frozen by test vectors.

### Order of random draws (part of the specification)

1. For each of the 4 starting tiles **[DECISION Q3]**, in order: draw the cell, then draw
   the value.
   - Cell: uniform among empty cells that are **not orthogonally adjacent to an existing
     tile**, listed in ascending cell-index order. (On 5×5 with 4 tiles such a cell always
     exists, so no retry loop is needed.)
   - Value: from the table in section 5.
2. Draw 2 values to fill the queue **[DECISION Q6]**.
3. After each valid move: draw exactly 1 value for the queue.

Resolution consumes no randomness. Consequences:

- **Reproducibility**: the same seed and the same list of chosen cells always produce the
  same boards, scores and events. A whole game is fully described by `seed + moves[]`.
- **Fairness**: with a fixed table, the tile sequence for a seed is the same whatever the
  player does, so two players on the same seed face the same sequence.

Starting tiles are spaced apart so the opening board never shows two equal tiles touching
without having merged, which would contradict the rule the player is about to learn.

## 7. Scoring and combo multiplier

- Each merge scores `newValue × chain`, where `chain` is that merge's position in the
  current move (1 for the first merge, 2 for the second, …). **[DECISION Q7]**
- Placing a tile that does not merge scores 0.
- The multiplier resets every move. There is no cross-move combo and no time bonus.
- Slide distance scores nothing; it matters only for where the tile ends up.
- Tracked alongside score: move count, highest tile, longest chain. Best score persists
  across games.

## 8. Game over and restart

- **Game over**: after a move fully resolves, the board has no empty cell. Because a move
  needs an empty cell, this is the only terminal condition. A move into the last empty cell
  that triggers a merge frees a cell and the game continues.
- There is no win state; the game is endless. A one-time celebration at a milestone tile
  is optional polish **[DECISION Q8]**.
- **Restart** is available at any time and from the game-over screen. It creates a new game
  from a **fresh seed**, resets score, moves and queue, and keeps the best score. Restarting
  a game in progress asks for confirmation. Restarting never replays the same seed unless
  the player explicitly chose a seeded mode.

## 9. Known exploits, ambiguities and balancing risks

| # | Issue | Why it matters | Proposed handling |
|---|---|---|---|
| E1 | **Fixed merge priority is invisible.** With two equal neighbours and no momentum, Up/Right/Down/Left decides, and a player cannot guess that. | Feels arbitrary; breaks "player understanding". | Show the outcome before commit: while the finger is down, the board previews the merge path and landing cell; release commits, dragging off the board cancels. The engine's move function is pure, so the preview is the same code as the real move. Alternatives in Q2. |
| E2 | **Seed replay.** Restarting the same seed reveals the tile sequence. | Trivialises scores in any shared-seed mode. | Normal games always use a fresh seed. A daily/shared seed mode, if ever added, allows one scored attempt per seed. Not in v1. |
| E3 | **The game may be too easy or endless.** Free placement plus a short preview gives a lot of control; the fixed table may never create pressure. | No difficulty curve, sessions drag. | Unknown until measured. Phase 1 includes bot simulations (random, greedy) reporting game-length and score distributions; the table and Q5 are tuned from that, then confirmed by playtest. |
| E4 | **The game may be too punishing.** Momentum can drag a large tile away from where the player is building. | Frustration, feels random. | This is also the intended strategic depth. The preview (E1) makes it a choice rather than a surprise. Measure with playtests. |
| E5 | **Unmerged equal neighbours.** After a chain, two equal tiles can sit side by side (only the active tile triggers merges). | Players may read it as a bug. | Intended: such pairs are "primed" and are set off by placing next to them. Needs one line in the tutorial. Flag for playtest (Q9). |
| E6 | **Corner parking.** Keeping the largest tile in a corner is likely the dominant strategy, as in other power-of-two games. | Reduces variety. | Accept for v1; momentum already disturbs static layouts. Revisit with playtest data. |
| E7 | **Input during animation.** A second tap while a chain is still animating. | Double placement or perceived lag. | The state is already final; the view ignores placement until playback ends, and playback is time-boxed and shortens for long chains. |
| E8 | **Undo.** | Changes difficulty and scoring integrity. | Not in v1 (Q10). |
| E9 | **No timer despite the name.** | "Rush" might be expected to mean time pressure. | v1 is untimed; a timer would be a separate mode fed to the engine as input, never read from a clock inside it (Q1). |

## 10. Explicit non-goals for v1

No timer, no undo, no power-ups, no blockers or special tiles, no gravity, no online
features, no accounts, no ads or purchases, no daily mode. Each is a separate decision
later; none is assumed by the architecture beyond keeping the rules configurable.
