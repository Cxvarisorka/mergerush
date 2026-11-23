import type Phaser from 'phaser';
import type { GameEvent } from '../../engine';
import type { Haptics } from '../../platform/haptics';
import { Effects } from '../feel/Effects';
import type { Settings, SettingsStore } from '../feel/settings';
import { Sfx } from '../feel/sfx';
import type { PanelSpec } from '../view/Panel';
import { COLORS } from '../view/theme';
import { GameScene, HELP_PANEL, type SceneServices } from './GameScene';

export interface FeelServices extends SceneServices {
  readonly settings: SettingsStore;
  readonly haptics: Haptics;
  /** Screen-reader announcements (aria-live). */
  announce?(text: string): void;
}

const MILESTONE_MIN = 128;

/** The game scene with feedback: sound, haptics, particles, call-outs, settings and help. */
export class MergeRushScene extends GameScene {
  private fx!: Effects;
  private sfx!: Sfx;
  private gameHighest = 0;
  private announcedBest = false;

  constructor(private readonly feel: FeelServices) {
    super(feel);
  }

  private get settings(): Settings {
    return this.feel.settings.value;
  }

  protected override hasSettings(): boolean {
    return true;
  }

  protected override playbackSpeed(): number {
    return this.settings.reducedMotion ? 0.6 : 1;
  }

  protected override setup(): void {
    this.fx = new Effects(this, () => this.layoutInfo, () => this.settings.reducedMotion);
    const sound = this.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    this.sfx = new Sfx(() => sound.context ?? null, () => this.settings.sound);
    this.gameHighest = this.session.state.highestTile;
    this.effects = {
      onPlace: () => {
        this.sfx.place();
        this.feel.haptics.impact('light');
      },
      onMerge: (e, x, y) => {
        this.sfx.merge(e.chain);
        this.feel.haptics.impact(e.chain >= 3 ? 'heavy' : 'medium');
        this.fx.burst(x, y, e.newValue, e.chain);
        this.fx.floatText(x, y, `+${e.points}`, COLORS.text);
        if (e.chain >= 2) this.fx.chainCallout(x, y, e.chain);
        this.fx.shake(e.chain);
        const shown = this.hud.scoreValue + e.points;
        this.hud.setScore(shown, Math.max(this.session.bestAtStart, shown), true);
        if (e.newValue >= MILESTONE_MIN && e.newValue > this.gameHighest) {
          this.fx.banner(String(e.newValue), COLORS.accent);
          this.sfx.milestone();
          this.feel.haptics.notify('success');
        }
        this.gameHighest = Math.max(this.gameHighest, e.newValue);
      },
      onSlideEnd: () => this.sfx.slideStop(),
    };
  }

  protected override afterCreate(): void {
    if (!this.settings.seenHelp && this.session.state.moves === 0 && !this.panel) {
      this.openPanel(HELP_PANEL);
      this.feel.settings.update({ seenHelp: true });
    }
  }

  protected override updateScore(): void {
    this.hud.setScore(this.session.state.score, this.session.best.score, true);
  }

  protected override onInvalidTap(cell: number): void {
    const tile = this.session.state.board[cell];
    const view = tile ? this.tiles.get(tile.id) : undefined;
    if (view) this.fx.nudge(view);
    this.sfx.invalid();
    this.feel.haptics.impact('light');
  }

  protected override onMoveFinished(events: ReadonlyArray<GameEvent>): void {
    const s = this.session.state;
    const merges = events.filter((e) => e.type === 'merged');
    if (this.session.isNewBest && !this.announcedBest && this.session.bestAtStart > 0 && s.status === 'playing') {
      this.announcedBest = true;
      this.fx.banner('NEW BEST!', COLORS.accent);
    }
    const chain = merges.length;
    this.feel.announce?.(`Score ${s.score}.${chain > 1 ? ` Chain of ${chain}.` : ''}`);
  }

  protected override showGameOver(): void {
    super.showGameOver();
    this.sfx.gameOver();
    this.feel.haptics.notify('warning');
    const s = this.session.state;
    this.feel.announce?.(`Board full. Final score ${s.score}.`);
  }

  protected override onNewGame(): void {
    this.gameHighest = this.session.state.highestTile;
    this.announcedBest = false;
    this.feel.announce?.('New game.');
  }

  protected override onSettings(): void {
    this.sfx.ui();
    this.openPanel(this.settingsSpec());
  }

  settingsSpec(): PanelSpec {
    const on = (v: boolean) => (v ? 'On' : 'Off');
    const s = this.settings;
    return {
      kind: 'settings',
      title: 'Settings',
      lines: [],
      buttons: [
        { label: `Sound: ${on(s.sound)}`, action: 'toggle-sound' },
        { label: `Vibration: ${on(s.haptics)}`, action: 'toggle-haptics' },
        { label: `Reduced motion: ${on(s.reducedMotion)}`, action: 'toggle-motion' },
        { label: 'Done', action: 'close', primary: true },
      ],
      backdropAction: 'close',
    };
  }

  protected override onPanelAction(action: string): boolean {
    const toggles: Record<string, keyof Settings> = {
      'toggle-sound': 'sound',
      'toggle-haptics': 'haptics',
      'toggle-motion': 'reducedMotion',
    };
    const key = toggles[action];
    if (key) {
      this.feel.settings.update({ [key]: !this.settings[key] });
      this.sfx.ui();
      if (key === 'haptics' && this.settings.haptics) this.feel.haptics.impact('medium');
      this.openPanel(this.settingsSpec());
      return true;
    }
    this.sfx.ui();
    return false;
  }
}
