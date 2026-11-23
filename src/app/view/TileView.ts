import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, tileColor, tileFontScale, tileTextColor, toCss } from './theme';

/**
 * Tile faces are drawn once into a cached texture per (value, size): redrawing rounded
 * rectangles as vector graphics every frame is expensive on low-end GPUs.
 */
export function tileTexture(scene: Phaser.Scene, value: number, side: number): { key: string; originY: number } {
  const s = Math.max(2, Math.round(side));
  const shadow = Math.max(1, Math.ceil(s * 0.045));
  const key = `tile-${value}-${s}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const r = s * 0.16;
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(0, shadow, s, s, r);
    g.fillStyle(tileColor(value), 1);
    g.fillRoundedRect(0, 0, s, s, r);
    g.generateTexture(key, s, s + shadow);
    g.destroy();
  }
  return { key, originY: s / 2 / (s + shadow) };
}

/** Removes cached tile textures whose size is not in `keepSides` (after a resize). */
export function pruneTileTextures(scene: Phaser.Scene, keepSides: number[]): void {
  const keep = new Set(keepSides.map((s) => `-${Math.max(2, Math.round(s))}`));
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith('tile-') && !keep.has(key.slice(key.lastIndexOf('-')))) scene.textures.remove(key);
  }
}

/** One tile: cached face image and value label, centred on (0, 0) so it can scale in place. */
export class TileView extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  value = 0;
  side = 0;

  constructor(scene: Phaser.Scene, value: number, side: number) {
    super(scene);
    this.bg = scene.make.image({ x: 0, y: 0, key: tileTexture(scene, value, side).key }, false);
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
    const tex = tileTexture(this.scene, value, side);
    this.bg.setTexture(tex.key).setOrigin(0.5, tex.originY).setDisplaySize(side, side * (this.bg.height / this.bg.width));
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
