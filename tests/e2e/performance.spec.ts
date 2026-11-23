import { expect, test } from '@playwright/test';
import { emptyCells, hook, openGame, play } from './helpers';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'android-phone' && info.project.name !== 'desktop', 'measured on two projects');
});

/**
 * Headless Chromium here renders WebGL in software (SwiftShader), so frame times mostly
 * measure CPU pixel fill, not the game. The assertions therefore target what the game
 * controls: start-up time and main-thread script time per move. Frame times are logged.
 */
test('starts quickly and keeps main-thread work per move small', async ({ page, context }, info) => {
  const t0 = Date.now();
  await openGame(page);
  const startup = Date.now() - t0;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metric = async (name: string) => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === name)!.value;

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const loop = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.evaluate(() => window.__mergeRush!.newGame(20261123));
  const scriptBefore = await metric('ScriptDuration');
  let moves = 0;
  for (let i = 0; i < 30; i++) {
    if ((await hook(page, 'state().status')) !== 'playing') break;
    const empty = await emptyCells(page);
    await play(page, info, empty[(i * 5) % empty.length]!);
    moves++;
  }
  const scriptMsPerMove = ((await metric('ScriptDuration')) - scriptBefore) * 1000 / moves;
  const frames = (await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames)).slice(5).sort((a, b) => a - b);
  const median = frames[Math.floor(frames.length / 2)]!;
  const p95 = frames[Math.floor(frames.length * 0.95)]!;
  console.log(
    `[perf:${info.project.name}] startup ${startup} ms; script ${scriptMsPerMove.toFixed(1)} ms per move (includes test polling); ` +
      `frames median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms (software GL)`,
  );
  expect(startup).toBeLessThan(5000);
  expect(scriptMsPerMove).toBeLessThan(60);
});
