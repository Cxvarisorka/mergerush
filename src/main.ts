import Phaser from 'phaser';
import type { Insets } from './app/layout';
import { GameScene } from './app/scenes/GameScene';
import { Session } from './app/session';
import { LocalStorageStore } from './platform/storage';
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
  const session = new Session(new LocalStorageStore());
  await session.load();

  const parent = document.getElementById('game')!;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const size = () => ({ w: Math.max(1, parent.clientWidth), h: Math.max(1, parent.clientHeight) });

  const scene = new GameScene({ session, unit: () => pixelRatio, insets: readInsets });
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
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  if (import.meta.env.DEV || import.meta.env.VITE_TEST_HOOK === '1') installTestHook(scene, () => game.canvas);

  document.getElementById('boot')?.remove();
}

void start();
