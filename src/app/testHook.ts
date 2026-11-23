import { applyMove, createGame, serialize, type GameState } from '../engine';
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
  /** Runs the engine in the page: seed + moves -> serialized final state. */
  replay(seed: number, moves: number[]): string;
  /** True when every tile view matches the engine state (position, value, count). */
  viewsMatchState(): boolean;
  displayObjectCount(): number;
  cursor(): number | null;
  sleeping(): boolean;
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
    replay: (seed, moves) => {
      let state = createGame(seed);
      for (const cell of moves) {
        const r = applyMove(state, cell);
        if (!r.ok) throw new Error(r.reason);
        state = r.state;
      }
      return serialize(state);
    },
    viewsMatchState: () => {
      const L = scene.layoutInfo;
      const board = scene.session.state.board;
      const tiles = board.filter((t) => t !== null);
      if (tiles.length !== scene.tiles.size) return false;
      return board.every((t, i) => {
        if (!t) return true;
        const v = scene.tiles.get(t.id);
        const p = cellCenter(L, i);
        return !!v && v.value === t.value && Math.abs(v.x - p.x) < 0.5 && Math.abs(v.y - p.y) < 0.5;
      });
    },
    displayObjectCount: () => scene.children.length,
    cursor: () => scene.cursorCell,
    sleeping: () => scene.sleeping,
    idle: async () => {
      while (scene.mode === 'animating') await new Promise((r) => setTimeout(r, 16));
    },
  };
}
