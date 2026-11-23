/**
 * Pure screen layout. All results are in device pixels (canvas pixels). `unit` is the
 * number of device pixels per CSS pixel, so fixed CSS sizes are written as `n * unit`.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly unit: number;
  readonly orientation: 'portrait' | 'landscape';
  readonly size: number;
  readonly board: Rect;
  readonly gap: number;
  readonly cellSize: number;
  readonly score: Rect;
  readonly best: Rect;
  readonly help: Rect;
  readonly settings: Rect;
  readonly restart: Rect;
  readonly queue: Rect;
  readonly current: Rect;
  readonly next: Rect;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const MARGIN = 12;
const HUD_H = 56;
const BUTTON = 44;
const SPACING = 8;
const QUEUE_H = 96;
const MAX_BOARD = 560;
const PANEL_W = 240;

export function computeLayout(width: number, height: number, unit: number, insetsCss: Insets = NO_INSETS, size = 5): Layout {
  const u = unit;
  const ins = { top: insetsCss.top * u, right: insetsCss.right * u, bottom: insetsCss.bottom * u, left: insetsCss.left * u };
  const m = MARGIN * u;
  const availX = ins.left + m;
  const availY = ins.top + m;
  const availW = Math.max(1, width - ins.left - ins.right - 2 * m);
  const availH = Math.max(1, height - ins.top - ins.bottom - 2 * m);
  const landscape = availW > availH * 1.25;

  const b = BUTTON * u;
  const s = SPACING * u;
  const hudH = HUD_H * u;
  let board: Rect;
  let queue: Rect;
  let score: Rect;
  let best: Rect;
  let buttonsRight: number;
  let buttonY: number;

  if (!landscape) {
    const gaps = 2 * 16 * u;
    const side = Math.max(1, Math.min(availW, availH - hudH - QUEUE_H * u - gaps, MAX_BOARD * u));
    const columnH = hudH + side + QUEUE_H * u + gaps;
    const top = availY + (availH - columnH) / 2;
    const left = availX + (availW - side) / 2;
    board = { x: left, y: top + hudH + 16 * u, w: side, h: side };
    queue = { x: left, y: board.y + side + 16 * u, w: side, h: QUEUE_H * u };
    // One HUD row: score, best, then three square buttons.
    const boxW = Math.max(1, (side - (3 * b + 2 * s) - 2 * s) / 2);
    score = { x: left, y: top, w: boxW, h: hudH };
    best = { x: left + boxW + s, y: top, w: boxW, h: hudH };
    buttonsRight = left + side;
    buttonY = top + (hudH - b) / 2;
  } else {
    // Side panel: score/best row, buttons row, then the queue.
    const panelW = PANEL_W * u;
    const side = Math.max(1, Math.min(availH, availW - panelW - 16 * u, MAX_BOARD * u));
    const totalW = side + 16 * u + panelW;
    const left = availX + (availW - totalW) / 2;
    const top = availY + (availH - side) / 2;
    board = { x: left, y: top, w: side, h: side };
    const panelX = left + side + 16 * u;
    const panelH = hudH + 12 * u + b + 12 * u + QUEUE_H * u;
    const panelY = availY + (availH - panelH) / 2;
    const boxW = (panelW - s) / 2;
    score = { x: panelX, y: panelY, w: boxW, h: hudH };
    best = { x: panelX + boxW + s, y: panelY, w: boxW, h: hudH };
    buttonY = panelY + hudH + 12 * u;
    buttonsRight = panelX + panelW / 2 + (3 * b + 2 * s) / 2;
    queue = { x: panelX, y: buttonY + b + 12 * u, w: panelW, h: QUEUE_H * u };
  }

  const bx = buttonsRight - (3 * b + 2 * s);
  const help = { x: bx, y: buttonY, w: b, h: b };
  const settings = { x: bx + b + s, y: buttonY, w: b, h: b };
  const restart = { x: bx + 2 * (b + s), y: buttonY, w: b, h: b };

  const gap = board.w * 0.025;
  const cellSize = (board.w - gap * (size + 1)) / size;

  const currentSide = Math.min(queue.h * 0.72, cellSize * 1.1);
  const nextSide = currentSide * 0.6;
  const queueCenterY = queue.y + queue.h * 0.58;
  const current = { x: queue.x + queue.w / 2 - currentSide / 2, y: queueCenterY - currentSide / 2, w: currentSide, h: currentSide };
  const next = { x: current.x + currentSide + 20 * u, y: queueCenterY - nextSide / 2, w: nextSide, h: nextSide };

  return {
    width,
    height,
    unit,
    orientation: landscape ? 'landscape' : 'portrait',
    size,
    board,
    gap,
    cellSize,
    score,
    best,
    help,
    settings,
    restart,
    queue,
    current,
    next,
  };
}

export function cellRect(layout: Layout, index: number): Rect {
  const row = Math.floor(index / layout.size);
  const col = index % layout.size;
  return {
    x: layout.board.x + layout.gap + col * (layout.cellSize + layout.gap),
    y: layout.board.y + layout.gap + row * (layout.cellSize + layout.gap),
    w: layout.cellSize,
    h: layout.cellSize,
  };
}

export function cellCenter(layout: Layout, index: number): { x: number; y: number } {
  const r = cellRect(layout, index);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Board cell under a point. The board is split into equal slices, so gaps count too. */
export function cellAt(layout: Layout, x: number, y: number): number | null {
  const { board, size } = layout;
  if (x < board.x || y < board.y || x >= board.x + board.w || y >= board.y + board.h) return null;
  const col = Math.min(size - 1, Math.floor(((x - board.x) / board.w) * size));
  const row = Math.min(size - 1, Math.floor(((y - board.y) / board.h) * size));
  return row * size + col;
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
