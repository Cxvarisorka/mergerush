import Phaser from 'phaser';
import type { Layout } from '../layout';
import { COLORS, FONT_FAMILY, tileColor, toCss } from '../view/theme';

export const SPARK_TEXTURE = 'spark';

/** Particles, floating text, call-outs and screen shake. All of it is skipped under reduced motion where it moves. */
export class Effects {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: () => Layout,
    private readonly reducedMotion: () => boolean,
  ) {
    if (!scene.textures.exists(SPARK_TEXTURE)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture(SPARK_TEXTURE, 16, 16);
      g.destroy();
    }
  }

  /** Burst of particles in the tile's colour. Count grows with the chain, capped. */
  burst(x: number, y: number, value: number, chain: number): void {
    if (this.reducedMotion()) return;
    const L = this.layout();
    const count = Math.min(8 + chain * 4, 28);
    const emitter = this.scene.add.particles(x, y, SPARK_TEXTURE, {
      speed: { min: L.cellSize * 0.8, max: L.cellSize * (2 + chain * 0.3) },
      lifespan: { min: 260, max: 520 },
      scale: { start: (L.cellSize / 16) * 0.16, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [tileColor(value), 0xffffff],
      angle: { min: 0, max: 360 },
      emitting: false,
    });
    emitter.setDepth(40);
    emitter.explode(count);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  floatText(x: number, y: number, text: string, color: number, sizeFactor = 0.3): void {
    const L = this.layout();
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(color) })
      .setOrigin(0.5, 0.5)
      .setFontSize(Math.round(L.cellSize * sizeFactor))
      .setStroke(toCss(COLORS.background), Math.max(2, L.cellSize * 0.05))
      .setDepth(45);
    const rise = this.reducedMotion() ? 0 : L.cellSize * 0.6;
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: 0, duration: 700, ease: 'Quad.Out', delay: 120, onComplete: () => t.destroy() });
  }

  /** "×3 CHAIN" call-out that pops above the tile. */
  chainCallout(x: number, y: number, chain: number): void {
    const L = this.layout();
    const t = this.scene.add
      .text(x, y - L.cellSize * 0.55, `×${chain} CHAIN`, { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(COLORS.accent) })
      .setOrigin(0.5, 0.5)
      .setFontSize(Math.round(L.cellSize * (0.26 + Math.min(chain, 6) * 0.02)))
      .setStroke(toCss(COLORS.background), Math.max(2, L.cellSize * 0.06))
      .setDepth(46)
      .setScale(this.reducedMotion() ? 1 : 0.4);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }

  /** Big centred banner, e.g. a milestone tile or a new best. */
  banner(text: string, color: number): void {
    const L = this.layout();
    const t = this.scene.add
      .text(L.board.x + L.board.w / 2, L.board.y + L.board.h / 2, text, { fontFamily: FONT_FAMILY, fontStyle: 'bold', color: toCss(color), align: 'center' })
      .setOrigin(0.5, 0.5)
      .setFontSize(Math.round(L.cellSize * 0.7))
      .setStroke(toCss(COLORS.background), Math.max(3, L.cellSize * 0.08))
      .setDepth(60)
      .setAlpha(0)
      .setScale(this.reducedMotion() ? 1 : 0.6);
    this.scene.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 350, onComplete: () => t.destroy() });
  }

  shake(chain: number): void {
    if (this.reducedMotion() || chain < 3) return;
    this.scene.cameras.main.shake(140, Math.min(0.002 * chain, 0.012));
  }

  /** Horizontal wiggle for a rejected tap. */
  nudge(target: Phaser.GameObjects.Container): void {
    const L = this.layout();
    const x = target.x;
    if (this.reducedMotion()) {
      this.scene.tweens.add({ targets: target, alpha: 0.5, yoyo: true, duration: 90, onComplete: () => target.setAlpha(1) });
      return;
    }
    this.scene.tweens.add({
      targets: target,
      x: x + L.cellSize * 0.07,
      duration: 45,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => target.setX(x),
    });
  }
}
