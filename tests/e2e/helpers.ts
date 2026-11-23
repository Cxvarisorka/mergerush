import { expect, type Page, type TestInfo } from '@playwright/test';

export const hook = <T>(page: Page, fn: string): Promise<T> => page.evaluate(`window.__mergeRush.${fn}`) as Promise<T>;

export function usesTouch(info: TestInfo): boolean {
  return !!info.project.use.hasTouch;
}

export interface Errors {
  list: string[];
}

/** Opens the game with clean storage, collecting page errors and console errors. */
export async function openGame(page: Page, { dismissHelp = true } = {}): Promise<Errors> {
  const errors: Errors = { list: [] };
  page.on('pageerror', (e) => errors.list.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.list.push(`console: ${m.text()}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__mergeRush?.ready() === true);
  if (dismissHelp && (await hook(page, 'panel()')) === 'help') await pressPanel(page, 'close');
  return errors;
}

export async function tapAt(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (usesTouch(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function tapCell(page: Page, info: TestInfo, cell: number): Promise<void> {
  const p = await page.evaluate((c) => window.__mergeRush!.cellCenter(c), cell);
  await tapAt(page, info, p.x, p.y);
}

/** Taps an empty cell and waits until the move has been applied and played back. */
export async function play(page: Page, info: TestInfo, cell: number): Promise<void> {
  const before = await page.evaluate(() => window.__mergeRush!.state().moves);
  await tapCell(page, info, cell);
  await page.waitForFunction((m) => window.__mergeRush!.state().moves > m, before, { timeout: 5000 });
  await page.evaluate(() => window.__mergeRush!.idle());
}

export async function pressPanel(page: Page, action: string, info?: TestInfo): Promise<void> {
  const b = await page.evaluate((a) => window.__mergeRush!.panelButton(a), action);
  expect(b, `panel button ${action}`).not.toBeNull();
  if (info) await tapAt(page, info, b!.x, b!.y);
  else await page.mouse.click(b!.x, b!.y);
  await page.waitForTimeout(50);
}

export async function pressHud(page: Page, info: TestInfo, name: 'help' | 'settings' | 'restart'): Promise<void> {
  const b = await page.evaluate((n) => window.__mergeRush!.hudButton(n), name);
  await tapAt(page, info, b.x, b.y);
  await page.waitForTimeout(50);
}

export const emptyCells = (page: Page) =>
  page.evaluate(() => window.__mergeRush!.state().board.flatMap((t, i) => (t ? [] : [i])));

/** Dispatches a real touch drag (touchstart, touchmove..., touchend) on the canvas. */
export async function touchDrag(page: Page, points: Array<{ x: number; y: number }>): Promise<void> {
  await page.evaluate(async (pts) => {
    const canvas = document.querySelector('canvas')!;
    const touch = (p: { x: number; y: number }) =>
      new Touch({ identifier: 7, target: canvas, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y });
    const fire = (type: string, p: { x: number; y: number }, active: boolean) => {
      const t = touch(p);
      canvas.dispatchEvent(
        new TouchEvent(type, { touches: active ? [t] : [], targetTouches: active ? [t] : [], changedTouches: [t], bubbles: true, cancelable: true }),
      );
    };
    const wait = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    fire('touchstart', pts[0]!, true);
    await wait();
    for (const p of pts.slice(1)) {
      fire('touchmove', p, true);
      await wait();
    }
    fire('touchend', pts[pts.length - 1]!, false);
    await wait();
  }, points);
}
