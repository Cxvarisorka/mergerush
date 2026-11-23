import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { hook, openGame, pressPanel } from './helpers';

test('loads cleanly, shows help on first launch only, and requests nothing off-origin', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const errors = await openGame(page, { dismissHelp: false });
  expect(await hook(page, 'panel()')).toBe('help');
  await pressPanel(page, 'close');
  expect(await hook(page, 'panel()')).toBeNull();
  await page.reload();
  await page.waitForFunction(() => window.__mergeRush?.ready());
  expect(await hook(page, 'panel()')).toBeNull();
  expect(requests.filter((u) => !u.startsWith(baseURL!))).toEqual([]);
  expect(errors.list).toEqual([]);
});

test('the game canvas fills the viewport and the page does not scroll', async ({ page }) => {
  await openGame(page);
  const vp = page.viewportSize()!;
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width).toBeCloseTo(vp.width, 0);
  expect(box!.height).toBeCloseTo(vp.height, 0);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(scroll[0]).toBeLessThanOrEqual(vp.width);
  expect(scroll[1]).toBeLessThanOrEqual(vp.height);
  const board = await hook<{ x: number; y: number; w: number; h: number }>(page, 'boardRect()');
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.x + board.w).toBeLessThanOrEqual(vp.width + 0.5);
  expect(board.y + board.h).toBeLessThanOrEqual(vp.height + 0.5);
  expect((await hook<{ cellSizeCss: number }>(page, 'layout()')).cellSizeCss).toBeGreaterThanOrEqual(44);
});

test('production build does not contain the test hook', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'file check runs once');
  const read = (dir: string) =>
    readdirSync(join(dir, 'assets'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(join(dir, 'assets', f), 'utf8'))
      .join('\n');
  expect(read('dist')).not.toContain('__mergeRush');
  expect(read('dist-e2e')).toContain('__mergeRush');
});
