import { expect, test } from '@playwright/test';
import { applyMove, createGame, serialize } from '../../src/engine';
import { hook, openGame } from './helpers';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard tests run on desktop');
});

test('arrow keys move a cursor and Enter places the tile', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__mergeRush!.newGame(5));
  await page.locator('canvas').focus().catch(() => undefined);
  await page.keyboard.press('ArrowUp'); // first arrow shows the cursor at the centre
  expect(await hook(page, 'cursor()')).toBe(12);
  let state = createGame(5);
  // walk to an empty cell
  const target = state.board.findIndex((t) => t === null);
  const [tr, tc] = [Math.floor(target / 5), target % 5];
  for (let i = 0; i < 2 - tr; i++) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < tr - 2; i++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 2 - tc; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < tc - 2; i++) await page.keyboard.press('ArrowRight');
  expect(await hook(page, 'cursor()')).toBe(target);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__mergeRush!.state().moves === 1);
  await page.evaluate(() => window.__mergeRush!.idle());
  const r = applyMove(state, target);
  if (!r.ok) throw new Error(r.reason);
  state = r.state;
  expect(JSON.stringify(await hook(page, 'state()'))).toBe(serialize(state));
  const announced = await page.locator('#announcer').textContent();
  expect(announced).toContain(`Score ${state.score}`);
});

test('panels are keyboard operable', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('h');
  expect(await hook(page, 'panel()')).toBe('help');
  await page.keyboard.press('Escape');
  expect(await hook(page, 'panel()')).toBeNull();
  await page.keyboard.press('s');
  expect(await hook(page, 'panel()')).toBe('settings');
  await page.keyboard.press('ArrowDown'); // focus starts on the primary (Done); wraps to first
  await page.keyboard.press('Enter'); // toggles sound
  const settings = JSON.parse((await page.evaluate(() => localStorage.getItem('mergerush.settings')))!);
  expect(settings.sound).toBe(false);
  await page.keyboard.press('Escape');
  expect(await hook(page, 'panel()')).toBeNull();
});
