import { describe, expect, it } from 'vitest';
import { cellAt, cellCenter, cellRect, computeLayout, contains, type Layout, type Rect } from '../../src/app/layout';

const VIEWPORTS: Array<[number, number]> = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [568, 320],
  [640, 360],
  [844, 390],
  [915, 412],
  [1280, 720],
  [1920, 1080],
];

/** Realistic safe-area insets: notched phones (taller than 2:1) have them, others do not. */
function insetsFor(w: number, h: number) {
  const notched = Math.max(w, h) / Math.min(w, h) > 2;
  if (!notched) return { top: 0, right: 0, bottom: 0, left: 0 };
  return w < h ? { top: 47, right: 0, bottom: 34, left: 0 } : { top: 0, right: 47, bottom: 21, left: 47 };
}

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 && inner.x + inner.w <= outer.x + outer.w + 1e-6 && inner.y + inner.h <= outer.y + outer.h + 1e-6;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function elements(l: Layout): Rect[] {
  return [l.board, l.score, l.best, l.help, l.settings, l.restart, l.current, l.next];
}

describe('layout', () => {
  for (const unit of [1, 2, 3]) {
    for (const [w, h] of VIEWPORTS) {
      it(`${w}x${h} @${unit}x: everything on screen, square board, cells >= 48 CSS px, no overlaps`, () => {
        const ins = insetsFor(w, h);
        const l = computeLayout(w * unit, h * unit, unit, ins);
        const screen = { x: ins.left * unit, y: ins.top * unit, w: (w - ins.left - ins.right) * unit, h: (h - ins.top - ins.bottom) * unit };
        expect(l.board.w).toBeCloseTo(l.board.h);
        expect(l.cellSize / unit).toBeGreaterThanOrEqual(48);
        expect(l.help.w / unit).toBeGreaterThanOrEqual(44);
        for (const r of elements(l)) expect(inside(r, screen)).toBe(true);
        const list = elements(l);
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(overlaps(list[i]!, list[j]!)).toBe(false);
        expect(l.orientation).toBe(w - ins.left - ins.right > (h - ins.top - ins.bottom) * 1.25 ? 'landscape' : 'portrait');
      });
    }
  }

  it('cells are inside the board and do not overlap', () => {
    const l = computeLayout(390, 844, 1);
    for (let i = 0; i < 25; i++) {
      expect(inside(cellRect(l, i), l.board)).toBe(true);
      for (let j = i + 1; j < 25; j++) expect(overlaps(cellRect(l, i), cellRect(l, j))).toBe(false);
    }
  });

  it('hit-tests cell centres, gaps and points outside the board', () => {
    const l = computeLayout(390, 844, 2);
    for (let i = 0; i < 25; i++) {
      const c = cellCenter(l, i);
      expect(cellAt(l, c.x, c.y)).toBe(i);
    }
    expect(cellAt(l, l.board.x + 1, l.board.y + 1)).toBe(0); // gap in the corner
    expect(cellAt(l, l.board.x + l.board.w - 0.5, l.board.y + l.board.h - 0.5)).toBe(24);
    expect(cellAt(l, l.board.x - 1, l.board.y + 10)).toBeNull();
    expect(cellAt(l, l.board.x + 10, l.board.y + l.board.h)).toBeNull();
  });

  it('contains() is half-open', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(contains(r, 0, 0)).toBe(true);
    expect(contains(r, 10, 5)).toBe(false);
  });

  it('degrades gracefully on a tiny viewport', () => {
    const l = computeLayout(100, 100, 1);
    expect(l.board.w).toBeGreaterThan(0);
    expect(l.cellSize).toBeGreaterThan(0);
  });
});
