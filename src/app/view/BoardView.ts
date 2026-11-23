import Phaser from 'phaser';
import type { GameEvent } from '../../engine';
import { cellCenter, cellRect, type Layout } from '../layout';
import { COLORS, FONT_FAMILY, toCss } from './theme';
import { TileView, drawSlot } from './TileView';

/** Board background, empty slots and the move preview. Tiles are owned by the scene. */
export class BoardView {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly path: Phaser.GameObjects.Graphics;
  private ghosts: TileView[] = [];
  private pointsText: Phaser.GameObjects.Text;
  private layout!: Layout;

  constructor(private readonly scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setDepth(0);
    this.path = scene.add.graphics().setDepth(5);
    this.pointsText = scene.add
      .text(0, 0, '', { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(COLORS.accent) })
      .setOrigin(0.5, 1)
      .setDepth(30)
      .setVisible(false);
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    const { board } = layout;
    this.bg.clear();
    this.bg.fillStyle(COLORS.board, 1);
    this.bg.fillRoundedRect(board.x, board.y, board.w, board.h, layout.cellSize * 0.2);
    for (let i = 0; i < layout.size * layout.size; i++) {
      const r = cellRect(layout, i);
      drawSlot(this.bg, r.x, r.y, r.w);
    }
  }

  /**
   * Shows where a placement would go: ghost of the placed tile, the path of the active tile,
   * and a ghost of the final tile with the points it would score.
   */
  showPreview(cell: number, value: number, events: ReadonlyArray<GameEvent> | null): void {
    this.clearPreview();
    const L = this.layout;
    const side = L.cellSize;
    const start = cellCenter(L, cell);
    this.ghosts.push(TileView.ghost(this.scene, value, side, 0.55).setPosition(start.x, start.y).setDepth(6));
    if (!events) return;

    const points: Array<{ x: number; y: number }> = [start];
    let finalCell = cell;
    let finalValue = value;
    let score = 0;
    let chain = 0;
    for (const e of events) {
      if (e.type === 'merged') {
        points.push(cellCenter(L, e.to));
        finalCell = e.to;
        finalValue = e.newValue;
        score += e.points;
        chain = e.chain;
      } else if (e.type === 'slid') {
        points.push(cellCenter(L, e.to));
        finalCell = e.to;
      }
    }
    if (points.length < 2) return;

    const w = Math.max(2, side * 0.08);
    this.path.lineStyle(w, COLORS.path, 0.55);
    this.path.beginPath();
    this.path.moveTo(points[0]!.x, points[0]!.y);
    for (const p of points.slice(1)) this.path.lineTo(p.x, p.y);
    // The path ends under the final ghost tile, which is drawn on top.
    this.path.strokePath();
    this.path.fillStyle(COLORS.path, 0.75);
    for (const p of points.slice(1)) this.path.fillCircle(p.x, p.y, w * 1.1);

    const end = cellCenter(L, finalCell);
    const ghost = TileView.ghost(this.scene, finalValue, side * 0.92, 1).setPosition(end.x, end.y).setDepth(7);
    this.ghosts.push(ghost);
    this.path.lineStyle(Math.max(2, side * 0.05), COLORS.accent, 1);
    const r = cellRect(L, finalCell);
    this.path.strokeRoundedRect(r.x - w / 2, r.y - w / 2, r.w + w, r.h + w, side * 0.18);

    this.pointsText
      .setText(chain > 1 ? `+${score}  ×${chain} chain` : `+${score}`)
      .setFontSize(Math.round(side * 0.3))
      .setPosition(end.x, r.y - w * 1.5)
      .setVisible(true);
  }

  clearPreview(): void {
    this.path.clear();
    for (const g of this.ghosts) g.destroy();
    this.ghosts = [];
    this.pointsText.setVisible(false);
  }
}
