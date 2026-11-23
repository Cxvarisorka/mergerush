import type { GameState } from '../engine';
import { cellCenter, type Rect } from './layout';
import type { GameScene } from './scenes/GameScene';

/**
 * Read-mostly hook for automated tests. Installed only in dev and e2e builds
 * (VITE_TEST_HOOK=1); production builds never include it. Coordinates are CSS pixels.
 */
export interface MergeRushTestHook {
  ready(): boolean;
  state(): GameState;
  best(): { score: number; tile: number };
  mode(): string;
  panel(): string | null;
  cellCenter(index: number): { x: number; y: number };
  hudButton(name: 'help' | 'settings' | 'restart'): { x: number; y: number };
  panelButton(action: string): { x: number; y: number } | null;
  boardRect(): Rect;
  layout(): { orientation: string; cellSizeCss: number; unit: number };
  newGame(seed: number): void;
  idle(): Promise<void>;
}

declare global {
  interface Window {
    __mergeRush?: MergeRushTestHook;
  }
}

export function installTestHook(scene: GameScene, canvas: () => HTMLCanvasElement): void {
  const toCss = (x: number, y: number) => {
    const rect = canvas().getBoundingClientRect();
    const k = scene.layoutInfo.unit;
    return { x: rect.left + x / k, y: rect.top + y / k };
  };
  const center = (r: Rect) => toCss(r.x + r.w / 2, r.y + r.h / 2);
  window.__mergeRush = {
    ready: () => scene.ready,
    state: () => scene.session.state,
    best: () => scene.session.best,
    mode: () => scene.mode,
    panel: () => scene.panel?.spec.kind ?? null,
    cellCenter: (i) => {
      const p = cellCenter(scene.layoutInfo, i);
      return toCss(p.x, p.y);
    },
    hudButton: (name) => center(scene.layoutInfo[name]),
    panelButton: (action) => {
      const b = scene.panel?.buttonRects().find((r) => r.action === action);
      return b ? center(b) : null;
    },
    boardRect: () => {
      const b = scene.layoutInfo.board;
      const k = scene.layoutInfo.unit;
      const tl = toCss(b.x, b.y);
      return { x: tl.x, y: tl.y, w: b.w / k, h: b.h / k };
    },
    layout: () => ({
      orientation: scene.layoutInfo.orientation,
      cellSizeCss: scene.layoutInfo.cellSize / scene.layoutInfo.unit,
      unit: scene.layoutInfo.unit,
    }),
    newGame: (seed) => scene.newGame(seed),
    idle: async () => {
      while (scene.mode === 'animating') await new Promise((r) => setTimeout(r, 16));
    },
  };
}
