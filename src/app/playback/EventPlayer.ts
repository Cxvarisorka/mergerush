import Phaser from 'phaser';
import type { GameEvent } from '../../engine';
import { cellCenter, type Layout } from '../layout';
import { TileView } from '../view/TileView';
import { planPlayback, type Timing } from './plan';
import { TIMING } from '../view/theme';

type Merged = Extract<GameEvent, { type: 'merged' }>;
type Placed = Extract<GameEvent, { type: 'placed' }>;
type Slid = Extract<GameEvent, { type: 'slid' }>;

/** Optional feedback hooks (sound, particles, haptics, call-outs). */
export interface PlaybackEffects {
  onPlace?(event: Placed, x: number, y: number): void;
  onMerge?(event: Merged, x: number, y: number): void;
  onSlideEnd?(event: Slid, x: number, y: number): void;
  onQueue?(queue: ReadonlyArray<number>): void;
}

export interface PlayerContext {
  readonly scene: Phaser.Scene;
  readonly tiles: Map<number, TileView>;
  layout(): Layout;
  effects?: PlaybackEffects;
  timing?: Timing;
  speed?(): number;
}

interface Running {
  tween: Phaser.Tweens.Tween;
  done: () => void;
}

/**
 * Replays engine events as tweens. The engine state is already final, so playback is
 * purely cosmetic and can be skipped at any time; the scene reconciles afterwards.
 */
export class EventPlayer {
  private running = new Set<Running>();
  private skipping = false;
  playing = false;

  constructor(private readonly ctx: PlayerContext) {}

  async play(events: ReadonlyArray<GameEvent>): Promise<void> {
    this.skipping = false;
    this.playing = true;
    const plan = planPlayback(events, this.ctx.timing ?? TIMING, this.ctx.speed?.() ?? 1);
    try {
      for (const step of plan.steps) {
        if (this.skipping) break;
        await this.playStep(step.event, step.duration);
      }
    } finally {
      this.playing = false;
    }
  }

  /** Finishes immediately. */
  skip(): void {
    this.skipping = true;
    for (const r of [...this.running]) {
      r.tween.stop();
      r.done();
    }
  }

  private async playStep(event: GameEvent, duration: number): Promise<void> {
    const { scene, tiles } = this.ctx;
    const L = this.ctx.layout();
    switch (event.type) {
      case 'placed': {
        const p = cellCenter(L, event.at);
        const view = new TileView(scene, event.value, L.cellSize).setPosition(p.x, p.y).setDepth(10).setScale(0.5);
        tiles.get(event.tileId)?.destroy();
        tiles.set(event.tileId, view);
        this.ctx.effects?.onPlace?.(event, p.x, p.y);
        await this.tween({ targets: view, scale: 1, duration, ease: 'Back.Out' });
        return;
      }
      case 'merged': {
        const view = tiles.get(event.tileId);
        const removed = tiles.get(event.removedTileId);
        const p = cellCenter(L, event.to);
        if (!view) return;
        view.setDepth(12);
        await this.tween({ targets: view, x: p.x, y: p.y, duration: duration * 0.45, ease: 'Quad.In' });
        removed?.destroy();
        tiles.delete(event.removedTileId);
        view.setTile(event.newValue, L.cellSize);
        this.ctx.effects?.onMerge?.(event, p.x, p.y);
        view.setScale(1.22);
        await this.tween({ targets: view, scale: 1, duration: duration * 0.55, ease: 'Quad.Out' });
        return;
      }
      case 'slid': {
        const view = tiles.get(event.tileId);
        if (!view) return;
        const p = cellCenter(L, event.to);
        await this.tween({ targets: view, x: p.x, y: p.y, duration, ease: 'Cubic.Out' });
        this.ctx.effects?.onSlideEnd?.(event, p.x, p.y);
        return;
      }
      case 'queueAdvanced':
        this.ctx.effects?.onQueue?.(event.queue);
        return;
      case 'gameOver':
        return;
    }
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (this.skipping || !config.duration || (config.duration as number) <= 0) {
      // Apply the end values instantly.
      const t = config.targets as Phaser.GameObjects.Components.Transform;
      if (typeof config.x === 'number') t.x = config.x;
      if (typeof config.y === 'number') t.y = config.y;
      if (typeof config.scale === 'number') t.scale = config.scale;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let finished = false;
      const entry: Running = {
        tween: undefined as unknown as Phaser.Tweens.Tween,
        done: () => {
          if (finished) return;
          finished = true;
          this.running.delete(entry);
          resolve();
        },
      };
      entry.tween = this.ctx.scene.tweens.add({ ...config, onComplete: () => entry.done(), onStop: () => entry.done() });
      this.running.add(entry);
    });
  }
}
