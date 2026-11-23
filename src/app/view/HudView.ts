import Phaser from 'phaser';
import type { Layout, Rect } from '../layout';
import { COLORS, FONT_FAMILY, toCss } from './theme';
import { TileView } from './TileView';

export type HudButton = 'help' | 'settings' | 'restart';

/** Score and best boxes, the tile queue and the HUD buttons. */
export class HudView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly texts: Record<'scoreLabel' | 'score' | 'bestLabel' | 'best' | 'nowLabel' | 'nextLabel' | 'help', Phaser.GameObjects.Text>;
  private current: TileView | null = null;
  private next: TileView | null = null;
  private layout!: Layout;
  private queue: ReadonlyArray<number> = [];
  private pressed: HudButton | null = null;
  scoreValue = 0;
  showSettings = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1);
    const t = (color: number) =>
      scene.add.text(0, 0, '', { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(color) }).setOrigin(0.5, 0.5).setDepth(2);
    this.texts = {
      scoreLabel: t(COLORS.muted).setText('SCORE'),
      score: t(COLORS.text),
      bestLabel: t(COLORS.muted).setText('BEST'),
      best: t(COLORS.text),
      nowLabel: t(COLORS.muted).setText('PLACE'),
      nextLabel: t(COLORS.muted).setText('NEXT'),
      help: t(COLORS.text).setText('?'),
    };
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    const u = layout.unit;
    const box = (r: Rect, label: Phaser.GameObjects.Text, value: Phaser.GameObjects.Text) => {
      label.setPosition(r.x + r.w / 2, r.y + r.h * 0.3).setFontSize(Math.round(11 * u));
      value.setPosition(r.x + r.w / 2, r.y + r.h * 0.66).setFontSize(Math.round(22 * u));
    };
    box(layout.score, this.texts.scoreLabel, this.texts.score);
    box(layout.best, this.texts.bestLabel, this.texts.best);
    this.texts.help.setPosition(layout.help.x + layout.help.w / 2, layout.help.y + layout.help.h / 2).setFontSize(Math.round(22 * u));
    this.texts.nowLabel.setPosition(layout.current.x + layout.current.w / 2, layout.queue.y + 8 * u).setFontSize(Math.round(11 * u));
    this.texts.nextLabel.setPosition(layout.next.x + layout.next.w / 2, layout.queue.y + 8 * u).setFontSize(Math.round(11 * u));
    this.redraw();
    this.setQueue(this.queue, true);
  }

  setScore(score: number, best: number): void {
    this.scoreValue = score;
    this.texts.score.setText(String(score));
    this.texts.best.setText(String(best));
  }

  setQueue(queue: ReadonlyArray<number>, force = false): void {
    if (!force && queue.length === this.queue.length && queue.every((v, i) => v === this.queue[i])) return;
    this.queue = queue;
    if (!this.layout) return;
    const { current, next } = this.layout;
    const make = (view: TileView | null, value: number | undefined, r: Rect, alpha: number) => {
      if (value === undefined) {
        view?.destroy();
        return null;
      }
      const v = view ?? new TileView(this.scene, value, r.w).setDepth(2);
      return v.setTile(value, r.w).setPosition(r.x + r.w / 2, r.y + r.h / 2).setAlpha(alpha);
    };
    this.current = make(this.current, queue[0], current, 1);
    this.next = make(this.next, queue[1], next, 0.75);
  }

  get currentTile(): TileView | null {
    return this.current;
  }

  setPressed(button: HudButton | null): void {
    if (this.pressed === button) return;
    this.pressed = button;
    this.redraw();
  }

  hitTest(x: number, y: number): HudButton | null {
    if (!this.layout) return null;
    const buttons: HudButton[] = this.showSettings ? ['help', 'settings', 'restart'] : ['help', 'restart'];
    for (const b of buttons) {
      const r = this.layout[b];
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return b;
    }
    return null;
  }

  private redraw(): void {
    const L = this.layout;
    const u = L.unit;
    const g = this.g;
    g.clear();
    const radius = 10 * u;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(L.score.x, L.score.y, L.score.w, L.score.h, radius);
    g.fillRoundedRect(L.best.x, L.best.y, L.best.w, L.best.h, radius);

    const button = (name: HudButton, r: Rect) => {
      g.fillStyle(this.pressed === name ? COLORS.buttonPressed : COLORS.button, 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, radius);
    };
    button('help', L.help);
    if (this.showSettings) button('settings', L.settings);
    button('restart', L.restart);

    // Settings icon: three slider lines.
    if (this.showSettings) {
      const s = L.settings;
      g.lineStyle(2.5 * u, COLORS.text, 1);
      for (let i = 0; i < 3; i++) {
        const y = s.y + s.h * (0.32 + i * 0.18);
        g.lineBetween(s.x + s.w * 0.28, y, s.x + s.w * 0.72, y);
        g.fillStyle(COLORS.text, 1);
        g.fillCircle(s.x + s.w * (i === 1 ? 0.62 : 0.38), y, 3.5 * u);
      }
    }

    // Restart icon: open circular arrow.
    const r = L.restart;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rad = r.w * 0.24;
    g.lineStyle(3 * u, COLORS.text, 1);
    g.beginPath();
    g.arc(cx, cy, rad, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(240), false);
    g.strokePath();
    const tipAngle = Phaser.Math.DegToRad(-60);
    const tx = cx + Math.cos(tipAngle) * rad;
    const ty = cy + Math.sin(tipAngle) * rad;
    g.fillStyle(COLORS.text, 1);
    g.fillTriangle(tx + 5 * u, ty - 4 * u, tx + 3 * u, ty + 6 * u, tx - 5 * u, ty - 1 * u);

    this.texts.help.setVisible(true);
  }
}
