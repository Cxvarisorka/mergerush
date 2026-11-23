import Phaser from 'phaser';
import type { GameEvent, MoveResult } from '../../engine';
import { applyMove } from '../../engine';
import { cellAt, cellCenter, computeLayout, type Insets, type Layout } from '../layout';
import { EventPlayer, type PlaybackEffects } from '../playback/EventPlayer';
import type { Session } from '../session';
import { BoardView } from '../view/BoardView';
import { HudView, type HudButton } from '../view/HudView';
import { Panel, type PanelSpec } from '../view/Panel';
import { COLORS } from '../view/theme';
import { TileView } from '../view/TileView';

export interface SceneServices {
  readonly session: Session;
  /** Device pixels per CSS pixel. */
  unit(): number;
  insets(): Insets;
}

type Pressed = { kind: 'hud'; id: HudButton } | { kind: 'panel'; id: string } | { kind: 'skip' } | { kind: 'board' } | null;

export type SceneMode = 'idle' | 'previewing' | 'animating';

export const HELP_PANEL: PanelSpec = {
  kind: 'help',
  title: 'How to play',
  lines: [
    'Tap an empty cell to place the tile shown under PLACE.',
    'If it touches an equal tile, it moves into it, doubles, and keeps sliding the same way.',
    'Where it stops it can merge again. Chains multiply your points.',
    'Hold and drag to preview a move. Release off the board to cancel.',
    'The game ends when the board is full.',
  ],
  buttons: [{ label: 'Got it', action: 'close', primary: true }],
  backdropAction: 'close',
};

export class GameScene extends Phaser.Scene {
  layoutInfo!: Layout;
  mode: SceneMode = 'idle';
  readonly tiles = new Map<number, TileView>();
  panel: Panel | null = null;
  protected board!: BoardView;
  protected hud!: HudView;
  protected player!: EventPlayer;
  protected effects: PlaybackEffects = {};
  private activePointer: number | null = null;
  private pressed: Pressed = null;
  private previewCell: number | null = null;
  ready = false;

  constructor(protected readonly services: SceneServices) {
    super('game');
  }

  get session(): Session {
    return this.services.session;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.board = new BoardView(this);
    this.hud = new HudView(this);
    this.hud.showSettings = this.hasSettings();
    this.player = new EventPlayer({
      scene: this,
      tiles: this.tiles,
      layout: () => this.layoutInfo,
      effects: {
        onPlace: (e, x, y) => this.effects.onPlace?.(e, x, y),
        onMerge: (e, x, y) => this.effects.onMerge?.(e, x, y),
        onSlideEnd: (e, x, y) => this.effects.onSlideEnd?.(e, x, y),
        onQueue: (q) => {
          this.hud.setQueue(q);
          this.effects.onQueue?.(q);
        },
      },
      speed: () => this.playbackSpeed(),
    });
    // Phaser passes (pointer, currentlyOver[]): wrap so extra arguments are never misread.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p, false));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onPointerUp(p, true));
    this.setup();
    this.ready = true;
    this.relayout();
    this.syncAll();
    if (this.session.state.status === 'over') this.showGameOver();
    this.afterCreate();
  }

  /** Extension points for later layers. */
  protected setup(): void {}
  protected afterCreate(): void {}
  protected hasSettings(): boolean {
    return false;
  }
  protected playbackSpeed(): number {
    return 1;
  }
  protected onSettings(): void {}
  protected onPanelAction(_action: string): boolean {
    return false;
  }
  protected onInvalidTap(_cell: number): void {}
  protected onMoveFinished(_events: ReadonlyArray<GameEvent>, _before: { score: number }): void {}
  protected onNewGame(): void {}

  relayout(): void {
    if (!this.ready) return;
    this.layoutInfo = computeLayout(this.scale.width, this.scale.height, this.services.unit(), this.services.insets());
    if (this.player.playing) this.player.skip();
    this.cancelPreview();
    this.board.setLayout(this.layoutInfo);
    this.hud.setLayout(this.layoutInfo);
    this.panel?.setLayout(this.layoutInfo);
    this.reconcile();
  }

  /** Makes the tile views match the engine state exactly. */
  reconcile(): void {
    const L = this.layoutInfo;
    const live = new Set<number>();
    this.session.state.board.forEach((tile, index) => {
      if (!tile) return;
      live.add(tile.id);
      const p = cellCenter(L, index);
      let view = this.tiles.get(tile.id);
      if (!view) {
        view = new TileView(this, tile.value, L.cellSize);
        this.tiles.set(tile.id, view);
      }
      view.setTile(tile.value, L.cellSize).setPosition(p.x, p.y).setScale(1).setAlpha(1).setDepth(10);
    });
    for (const [id, view] of this.tiles) {
      if (!live.has(id)) {
        view.destroy();
        this.tiles.delete(id);
      }
    }
  }

  syncAll(): void {
    this.reconcile();
    this.hud.setQueue(this.session.state.queue);
    this.updateScore();
  }

  protected updateScore(): void {
    this.hud.setScore(this.session.state.score, this.session.best.score);
  }

  // ---- input ---------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointer !== null) return;
    this.activePointer = pointer.id;
    const { x, y } = pointer;

    if (this.panel) {
      const action = this.panel.hitTest(x, y);
      this.pressed = { kind: 'panel', id: action ?? '' };
      this.panel.setPressed(action || null);
      return;
    }
    if (this.mode === 'animating') {
      this.pressed = { kind: 'skip' };
      this.player.skip();
      return;
    }
    const button = this.hud.hitTest(x, y);
    if (button) {
      this.pressed = { kind: 'hud', id: button };
      this.hud.setPressed(button);
      return;
    }
    const cell = cellAt(this.layoutInfo, x, y);
    if (cell === null || this.session.state.status !== 'playing') return;
    if (this.session.state.board[cell] !== null) {
      this.onInvalidTap(cell);
      return;
    }
    this.pressed = { kind: 'board' };
    this.mode = 'previewing';
    this.setPreview(cell);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointer || !this.pressed) return;
    const { x, y } = pointer;
    if (this.pressed.kind === 'panel' && this.panel) {
      const action = this.panel.hitTest(x, y);
      this.panel.setPressed(action && action === this.pressed.id ? action : null);
    } else if (this.pressed.kind === 'hud') {
      this.hud.setPressed(this.hud.hitTest(x, y) === this.pressed.id ? this.pressed.id : null);
    } else if (this.pressed.kind === 'board' && this.mode === 'previewing') {
      const cell = cellAt(this.layoutInfo, x, y);
      if (cell === this.previewCell) return;
      if (cell !== null && this.session.state.board[cell] === null) this.setPreview(cell);
      else this.setPreview(null);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer, outside = false): void {
    if (pointer.id !== this.activePointer) return;
    this.activePointer = null;
    const pressed = this.pressed;
    this.pressed = null;
    if (!pressed) return;
    const { x, y } = pointer;

    if (pressed.kind === 'panel' && this.panel) {
      this.panel.setPressed(null);
      const action = outside ? null : this.panel.hitTest(x, y);
      if (action && action === pressed.id) this.handlePanelAction(action);
    } else if (pressed.kind === 'hud') {
      this.hud.setPressed(null);
      if (!outside && this.hud.hitTest(x, y) === pressed.id) this.handleHud(pressed.id);
    } else if (pressed.kind === 'board' && this.mode === 'previewing') {
      const cell = outside ? null : this.previewCell;
      this.cancelPreview();
      if (cell !== null) void this.commit(cell);
    }
  }

  private setPreview(cell: number | null): void {
    this.previewCell = cell;
    for (const v of this.tiles.values()) v.setAlpha(1);
    this.hud.currentTile?.setAlpha(cell === null ? 1 : 0.35);
    if (cell === null) {
      this.board.clearPreview();
      return;
    }
    const state = this.session.state;
    const result = applyMove(state, cell);
    const events = result.ok ? result.events : null;
    this.board.showPreview(cell, state.queue[0]!, events);
    if (events) {
      for (const e of events) if (e.type === 'merged') this.tiles.get(e.removedTileId)?.setAlpha(0.4);
    }
  }

  private cancelPreview(): void {
    if (this.mode === 'previewing') this.mode = 'idle';
    this.previewCell = null;
    this.board?.clearPreview();
    for (const v of this.tiles.values()) v.setAlpha(1);
    this.hud?.currentTile?.setAlpha(1);
  }

  // ---- actions -------------------------------------------------------------------------

  /** Places the current tile at `cell` and plays the result. Public for tests. */
  async commit(cell: number): Promise<MoveResult> {
    if (this.mode === 'animating' || this.panel) return { ok: false, reason: 'occupied' };
    const before = { score: this.session.state.score };
    const result = this.session.play(cell);
    if (!result.ok) return result;
    this.mode = 'animating';
    this.hud.setScore(before.score, Math.max(this.session.bestAtStart, before.score));
    await this.player.play(result.events);
    this.reconcile();
    this.hud.setQueue(this.session.state.queue);
    this.updateScore();
    this.mode = 'idle';
    this.onMoveFinished(result.events, before);
    if (this.session.state.status === 'over') this.showGameOver();
    return result;
  }

  private handleHud(button: HudButton): void {
    if (button === 'help') this.openPanel(HELP_PANEL);
    else if (button === 'settings') this.onSettings();
    else if (button === 'restart') {
      const s = this.session.state;
      if (s.status === 'playing' && s.moves > 0) {
        this.openPanel({
          kind: 'confirm-restart',
          title: 'Start a new game?',
          lines: ['Your current game will be lost.'],
          buttons: [
            { label: 'New game', action: 'new-game', primary: true },
            { label: 'Keep playing', action: 'close' },
          ],
          backdropAction: 'close',
        });
      } else this.newGame();
    }
  }

  protected handlePanelAction(action: string): void {
    if (this.onPanelAction(action)) return;
    if (action === 'close') this.closePanel();
    else if (action === 'new-game') this.newGame();
  }

  openPanel(spec: PanelSpec): void {
    this.closePanel();
    this.cancelPreview();
    this.panel = new Panel(this, spec);
    this.panel.setLayout(this.layoutInfo);
  }

  closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  newGame(seed?: number): void {
    this.closePanel();
    if (this.player.playing) this.player.skip();
    this.session.newGame(seed);
    for (const v of this.tiles.values()) v.destroy();
    this.tiles.clear();
    this.syncAll();
    this.mode = 'idle';
    for (const v of this.tiles.values()) {
      v.setScale(0.3);
      this.tweens.add({ targets: v, scale: 1, duration: 220, ease: 'Back.Out' });
    }
    this.onNewGame();
  }

  protected gameOverSpec(): PanelSpec {
    const s = this.session.state;
    const lines = [
      `Score ${s.score}`,
      this.session.isNewBest ? 'New best score!' : `Best ${this.session.best.score}`,
      `Highest tile ${s.highestTile}  ·  Longest chain ${s.longestChain}`,
    ];
    return {
      kind: 'game-over',
      title: 'Board full',
      lines,
      buttons: [{ label: 'Play again', action: 'new-game', primary: true }],
      backdropAction: null,
    };
  }

  protected showGameOver(): void {
    this.openPanel(this.gameOverSpec());
  }
}
