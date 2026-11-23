import Phaser from 'phaser';
import type { Insets } from './app/layout';
import { MergeRushScene } from './app/scenes/MergeRushScene';
import { SettingsStore, defaultSettings } from './app/feel/settings';
import { switchable } from './platform/haptics';
import { createPlatform } from './platform';
import { Session } from './app/session';
import { installTestHook } from './app/testHook';

const MAX_PIXEL_RATIO = 3;

function readInsets(): Insets {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
}

async function start(): Promise<void> {
  // Web: localStorage + Vibration API. Native (Capacitor): Preferences + native haptics.
  const platform = createPlatform();
  const store = platform.store;
  const session = new Session(store);
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const settings = new SettingsStore(store, defaultSettings(prefersReducedMotion));
  await Promise.all([session.load(), settings.load()]);
  const haptics = switchable(platform.haptics, () => settings.value.haptics);
  const announcer = document.getElementById('announcer');
  const announce = (text: string) => {
    if (announcer) announcer.textContent = text;
  };

  const parent = document.getElementById('game')!;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const size = () => ({ w: Math.max(1, parent.clientWidth), h: Math.max(1, parent.clientHeight) });

  const scene = new MergeRushScene({ session, settings, haptics, announce, unit: () => pixelRatio, insets: readInsets });
  const initial = size();
  // Phaser 3 has no high-DPI setting: render at device resolution and zoom the canvas back down.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#15172b',
    banner: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(initial.w * pixelRatio),
      height: Math.round(initial.h * pixelRatio),
      zoom: 1 / pixelRatio,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [scene],
  });

  let pending = 0;
  const onResize = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const { w, h } = size();
      game.scale.resize(Math.round(w * pixelRatio), Math.round(h * pixelRatio));
      game.scale.setZoom(1 / pixelRatio);
      scene.relayout();
    });
  };
  platform.onBackButton(() => scene.handleBack());
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  if (import.meta.env.DEV || import.meta.env.VITE_TEST_HOOK === '1') installTestHook(scene, () => game.canvas);

  document.getElementById('boot')?.remove();
}

void start();
