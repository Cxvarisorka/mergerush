import { expect, test } from '@playwright/test';
import { emptyCells, hook, openGame, play, usesTouch } from './helpers';

test('rotation and resizing keep the board visible and playable', async ({ page }, info) => {
  test.skip(!usesTouch(info), 'mobile devices only');
  await openGame(page);
  const vp = page.viewportSize()!;
  for (const size of [{ width: vp.height, height: vp.width }, vp]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const board = await hook<{ x: number; y: number; w: number; h: number }>(page, 'boardRect()');
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.x + board.w).toBeLessThanOrEqual(size.width + 0.5);
    expect(board.y + board.h).toBeLessThanOrEqual(size.height + 0.5);
    expect((await hook<{ cellSizeCss: number }>(page, 'layout()')).cellSizeCss).toBeGreaterThanOrEqual(44);
    await play(page, info, (await emptyCells(page))[0]!);
    expect(await hook(page, 'viewsMatchState()')).toBe(true);
  }
  expect(await hook(page, 'state().moves')).toBe(2);
});

test('plays fully offline and makes no network requests during play', async ({ page, context }, info) => {
  const errors = await openGame(page);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await context.setOffline(true);
  for (let i = 0; i < 12; i++) {
    if ((await hook(page, 'state().status')) !== 'playing') break;
    await play(page, info, (await emptyCells(page))[0]!);
  }
  expect(requests).toEqual([]);
  expect(errors.list).toEqual([]);
  await context.setOffline(false);
});

test('works when storage is unavailable', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage disabled');
      },
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__mergeRush?.ready());
  if ((await hook(page, 'panel()')) === 'help') {
    const b = await page.evaluate(() => window.__mergeRush!.panelButton('close'));
    await page.mouse.click(b!.x, b!.y);
  }
  await play(page, info, (await emptyCells(page))[0]!);
  expect(await hook(page, 'state().moves')).toBe(1);
});

test('a corrupt save is discarded and a new game starts', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('mergerush.save.v1', '{"version":1,"board":"garbage"}');
      localStorage.setItem('mergerush.best', '{{{');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await openGame(page);
  expect(await hook(page, 'state().moves')).toBe(0);
  expect(await hook(page, 'best().score')).toBe(0);
  await play(page, info, (await emptyCells(page))[0]!);
});

test('prefers-reduced-motion turns on reduced motion by default', async ({ browser }, info) => {
  const context = await browser.newContext({ ...info.project.use, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await openGame(page);
  const settings = JSON.parse((await page.evaluate(() => localStorage.getItem('mergerush.settings')))!);
  expect(settings.reducedMotion).toBe(true);
  await context.close();
});

test('the render loop sleeps when idle and wakes on input', async ({ page }, info) => {
  await openGame(page);
  await page.waitForFunction(() => window.__mergeRush!.sleeping(), null, { timeout: 10_000 });
  await play(page, info, (await emptyCells(page))[0]!);
  expect(await hook(page, 'state().moves')).toBe(1);
  expect(await hook(page, 'viewsMatchState()')).toBe(true);
  await page.waitForFunction(() => window.__mergeRush!.sleeping(), null, { timeout: 10_000 });
});

test('no display-object leak across several full games', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-phone' && info.project.name !== 'desktop', 'long test on two projects');
  test.setTimeout(420_000);
  await openGame(page);
  const counts: number[] = [];
  for (let game = 0; game < 3; game++) {
    await page.evaluate((s) => window.__mergeRush!.newGame(s), 1000 + game);
    await page.waitForTimeout(300);
    counts.push(await hook<number>(page, 'displayObjectCount()'));
    let guard = 0;
    while ((await hook(page, 'state().status')) === 'playing' && guard++ < 300) {
      const empty = await emptyCells(page);
      await play(page, info, empty[0]!);
    }
    await page.waitForTimeout(1500); // let effects expire
  }
  await page.evaluate(() => window.__mergeRush!.newGame(7));
  await page.waitForTimeout(1500);
  counts.push(await hook<number>(page, 'displayObjectCount()'));
  const spread = Math.max(...counts) - Math.min(...counts);
  expect(spread, `display object counts ${counts.join(', ')}`).toBeLessThanOrEqual(8);
});
