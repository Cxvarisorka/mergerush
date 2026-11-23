import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, tileColor, tileFontScale, tileTextColor, toCss } from './theme';

/** One tile: rounded square and value label, drawn centred on (0, 0) so it can scale in place. */
export class TileView extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  value = 0;
  side = 0;

  constructor(scene: Phaser.Scene, value: number, side: number) {
    super(scene);
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONT_FAMILY, fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5, 0.5);
    this.add([this.bg, this.label]);
    this.setTile(value, side);
    scene.add.existing(this);
  }

  setTile(value: number, side: number): this {
    if (value === this.value && side === this.side) return this;
    this.value = value;
    this.side = side;
    const r = side * 0.16;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.22);
    this.bg.fillRoundedRect(-side / 2, -side / 2 + side * 0.045, side, side, r);
    this.bg.fillStyle(tileColor(value), 1);
    this.bg.fillRoundedRect(-side / 2, -side / 2, side, side, r);
    this.label.setText(String(value));
    this.label.setFontSize(Math.max(1, Math.round(side * tileFontScale(value))));
    this.label.setColor(toCss(tileTextColor(value)));
    return this;
  }

  /** A translucent copy used for previews. */
  static ghost(scene: Phaser.Scene, value: number, side: number, alpha: number): TileView {
    return new TileView(scene, value, side).setAlpha(alpha);
  }
}

export function drawSlot(g: Phaser.GameObjects.Graphics, x: number, y: number, side: number): void {
  g.fillStyle(COLORS.slot, 1);
  g.fillRoundedRect(x, y, side, side, side * 0.16);
}
