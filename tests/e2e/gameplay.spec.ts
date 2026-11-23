import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { applyMove, createGame, serialize } from '../../src/engine';
import { emptyCells, hook, openGame, play, pressHud, pressPanel, tapCell, touchDrag, usesTouch } from './helpers';

const goldenDir = join(process.cwd(), 'tests', 'engine', 'golden');
const goldens = readdirSync(goldenDir).map((f) => JSON.parse(readFileSync(join(goldenDir, f), 'utf8')) as { seed: number; moves: number[]; finalState: string });

function expectedAfter(seed: number, moves: number[]): string {
  let s = createGame(seed);
  for (const m of moves) {
    const r = applyMove(s, m);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return serialize(s);
}

test('real taps reproduce the engine exactly (seeded game)', async ({ page }, info) => {
  const errors = await openGame(page);
  const golden = goldens[0]!;
  await page.evaluate((seed) => window.__mergeRush!.newGame(seed), golden.seed);
  const moves = golden.moves.slice(0, 25);
  for (const cell of moves) await play(page, info, cell);
  expect(JSON.stringify(await hook(page, 'state()'))).toBe(expectedAfter(golden.seed, moves));
  expect(await hook(page, 'viewsMatchState()')).toBe(true);
  expect(errors.list).toEqual([]);
});

test('golden replays are byte-identical inside the browser engine', async ({ page }) => {
  await openGame(page);
  for (const g of goldens) {
    expect(await page.evaluate(([seed, moves]) => window.__mergeRush!.replay(seed as number, moves as number[]), [g.seed, g.moves])).toBe(g.finalState);
  }
});

test('press, drag off the board and release cancels the move', async ({ page }) => {
  await openGame(page);
  const cell = (await emptyCells(page))[0]!;
  const p = await page.evaluate((c) => window.__mergeRush!.cellCenter(c), cell);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  expect(await hook(page, 'mode()')).toBe('previewing');
  const board = await hook<{ x: number; y: number; w: number; h: number }>(page, 'boardRect()');
  await page.mouse.move(board.x + board.w + 5, board.y - 5, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  expect(await hook(page, 'state().moves')).toBe(0);
  expect(await hook(page, 'mode()')).toBe('idle');
});

test('touch drag previews and commits on the cell where the finger is released', async ({ page }, info) => {
  test.skip(!usesTouch(info), 'touch devices only');
  await openGame(page);
  await page.evaluate(() => window.__mergeRush!.newGame(99));
  const empty = await emptyCells(page);
  const [a, b] = [empty[0]!, empty.at(-1)!];
  const pa = await page.evaluate((c) => window.__mergeRush!.cellCenter(c), a);
  const pb = await page.evaluate((c) => window.__mergeRush!.cellCenter(c), b);
  const expected = applyMove(createGame(99), b);
  await touchDrag(page, [pa, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, pb]);
  await page.evaluate(() => window.__mergeRush!.idle());
  expect(expected.ok && JSON.stringify(await hook(page, 'state()'))).toBe(expected.ok && serialize(expected.state));
});

test('tapping an occupied cell changes nothing', async ({ page }, info) => {
  await openGame(page);
  const before = JSON.stringify(await hook(page, 'state()'));
  const occupied = await page.evaluate(() => window.__mergeRush!.state().board.findIndex((t) => t !== null));
  await tapCell(page, info, occupied);
  await page.waitForTimeout(200);
  expect(JSON.stringify(await hook(page, 'state()'))).toBe(before);
});

test('tapping during an animation skips it and the view stays consistent', async ({ page }, info) => {
  await openGame(page);
  for (let i = 0; i < 20; i++) {
    const empty = await emptyCells(page);
    if ((await hook(page, 'state().status')) !== 'playing') break;
    await tapCell(page, info, empty[i % empty.length]!);
    await tapCell(page, info, empty[(i * 3) % empty.length]!); // lands mid-animation or as a second move
  }
  await page.evaluate(() => window.__mergeRush!.idle());
  await page.waitForTimeout(100);
  expect(await hook(page, 'viewsMatchState()')).toBe(true);
});

test('a full game ends in game over; play again starts fresh and keeps the best score', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = await openGame(page);
  let guard = 0;
  while ((await hook(page, 'state().status')) === 'playing' && guard++ < 400) {
    const empty = await emptyCells(page);
    await play(page, info, empty[(guard * 7) % empty.length]!);
  }
  const final = await hook<{ score: number; status: string }>(page, 'state()');
  expect(final.status).toBe('over');
  await page.waitForTimeout(100);
  expect(await hook(page, 'panel()')).toBe('game-over');
  expect((await hook<{ score: number }>(page, 'best()')).score).toBe(final.score);
  await pressPanel(page, 'new-game', info);
  expect(await hook(page, 'panel()')).toBeNull();
  expect(await hook(page, 'state().moves')).toBe(0);
  expect(await hook(page, 'state().status')).toBe('playing');
  await page.reload();
  await page.waitForFunction(() => window.__mergeRush?.ready());
  expect((await hook<{ score: number }>(page, 'best()')).score).toBe(final.score);
  expect(errors.list).toEqual([]);
});

test('reloading mid-game restores the exact game', async ({ page }, info) => {
  await openGame(page);
  for (let i = 0; i < 6; i++) await play(page, info, (await emptyCells(page))[i]!);
  const before = JSON.stringify(await hook(page, 'state()'));
  await page.reload();
  await page.waitForFunction(() => window.__mergeRush?.ready());
  expect(JSON.stringify(await hook(page, 'state()'))).toBe(before);
  expect(await hook(page, 'viewsMatchState()')).toBe(true);
});

test('restart asks for confirmation once a game is under way', async ({ page }, info) => {
  await openGame(page);
  await play(page, info, (await emptyCells(page))[0]!);
  await pressHud(page, info, 'restart');
  expect(await hook(page, 'panel()')).toBe('confirm-restart');
  await pressPanel(page, 'close', info);
  expect(await hook(page, 'state().moves')).toBe(1);
  await pressHud(page, info, 'restart');
  await pressPanel(page, 'new-game', info);
  expect(await hook(page, 'state().moves')).toBe(0);
});

test('settings toggle and persist', async ({ page }, info) => {
  await openGame(page);
  await pressHud(page, info, 'settings');
  expect(await hook(page, 'panel()')).toBe('settings');
  await pressPanel(page, 'toggle-sound', info);
  await pressPanel(page, 'close', info);
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('mergerush.settings')))!);
  expect(saved.sound).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.__mergeRush?.ready());
  await pressHud(page, info, 'settings');
  expect(await page.evaluate(() => window.__mergeRush!.panelButton('toggle-sound'))).not.toBeNull();
});
