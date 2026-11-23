import Phaser from 'phaser';
import type { Layout } from '../layout';
import { COLORS, FONT_FAMILY, toCss } from './theme';

export interface PanelButton {
  readonly label: string;
  readonly action: string;
  readonly primary?: boolean;
}

export interface PanelSpec {
  readonly kind: string;
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
  readonly buttons: ReadonlyArray<PanelButton>;
  /** Action used when the dimmed backdrop is tapped (null = ignore). */
  readonly backdropAction?: string | null;
}

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
  primary: boolean;
  text: Phaser.GameObjects.Text;
}

/** Modal panel: dimmed backdrop, title, text lines and stacked buttons. */
export class Panel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private buttons: ButtonRect[] = [];
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private pressed: string | null = null;
  private layout!: Layout;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spec: PanelSpec,
  ) {
    const depth = 100;
    this.g = scene.add.graphics().setDepth(depth);
    this.title = scene.add
      .text(0, 0, spec.title, { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(COLORS.text), align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    this.body = scene.add
      .text(0, 0, spec.lines.join('\n'), { fontFamily: FONT_FAMILY, color: toCss(COLORS.muted), align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    for (const b of spec.buttons) {
      const text = scene.add
        .text(0, 0, b.label, {
          fontFamily: FONT_FAMILY,
          fontStyle: 'bold',
          color: toCss(b.primary ? 0x1b1b2f : COLORS.text),
        })
        .setOrigin(0.5, 0.5)
        .setDepth(depth + 2);
      this.buttons.push({ x: 0, y: 0, w: 0, h: 0, action: b.action, primary: !!b.primary, text });
    }
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    const u = layout.unit;
    const w = Math.min(layout.width - 32 * u, 360 * u);
    const pad = 24 * u;
    this.title.setFontSize(Math.round(26 * u)).setWordWrapWidth(w - 2 * pad, true);
    this.body.setFontSize(Math.round(16 * u)).setLineSpacing(6 * u).setWordWrapWidth(w - 2 * pad, true);
    const buttonH = 50 * u;
    const spacing = 10 * u;
    const bodyH = this.spec.lines.length ? this.body.height + 20 * u : 0;
    const h = pad + this.title.height + 16 * u + bodyH + this.buttons.length * (buttonH + spacing) - spacing + pad;
    const x = (layout.width - w) / 2;
    const y = Math.max(8 * u, (layout.height - h) / 2);
    this.box = { x, y, w, h };
    this.title.setPosition(layout.width / 2, y + pad);
    this.body.setPosition(layout.width / 2, y + pad + this.title.height + 16 * u);
    let by = y + pad + this.title.height + 16 * u + bodyH;
    for (const b of this.buttons) {
      Object.assign(b, { x: x + pad, y: by, w: w - 2 * pad, h: buttonH });
      b.text.setPosition(x + w / 2, by + buttonH / 2).setFontSize(Math.round(18 * u));
      by += buttonH + spacing;
    }
    this.redraw();
  }

  /** The action under the point, '' for the panel body, or the backdrop action. */
  hitTest(x: number, y: number): string | null {
    for (const b of this.buttons) if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) return b.action;
    const { box } = this;
    if (x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h) return '';
    return this.spec.backdropAction ?? '';
  }

  setPressed(action: string | null): void {
    if (this.pressed === action) return;
    this.pressed = action;
    this.redraw();
  }

  /** Button rectangles (for tests). */
  buttonRects(): ReadonlyArray<{ action: string; x: number; y: number; w: number; h: number }> {
    return this.buttons.map(({ action, x, y, w, h }) => ({ action, x, y, w, h }));
  }

  destroy(): void {
    this.g.destroy();
    this.title.destroy();
    this.body.destroy();
    for (const b of this.buttons) b.text.destroy();
  }

  private redraw(): void {
    const L = this.layout;
    const u = L.unit;
    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.dim, 0.72);
    g.fillRect(0, 0, L.width, L.height);
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(this.box.x, this.box.y, this.box.w, this.box.h, 18 * u);
    for (const b of this.buttons) {
      const base = b.primary ? COLORS.accent : COLORS.button;
      g.fillStyle(this.pressed === b.action ? (b.primary ? 0xe6b84f : COLORS.buttonPressed) : base, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 12 * u);
    }
  }
}
