/**
 * Small synthesized sound set (no audio files, nothing to license or download).
 * Plays only when the AudioContext is running, i.e. after the browser's first-gesture unlock.
 */

/** Pentatonic steps so rising chain pitches always sound consonant. */
const CHAIN_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function chainFrequency(chain: number): number {
  const step = CHAIN_STEPS[Math.min(Math.max(chain, 1), CHAIN_STEPS.length) - 1]!;
  return 392 * 2 ** (step / 12);
}

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

export class Sfx {
  constructor(
    private readonly context: () => AudioContext | null,
    private readonly enabled: () => boolean,
  ) {}

  private tone(freq: number, duration: number, { type = 'sine', gain = 0.12, slideTo, delay = 0 }: ToneOptions = {}): void {
    const ctx = this.context();
    if (!ctx || !this.enabled() || ctx.state !== 'running') return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch {
      /* audio is optional */
    }
  }

  place(): void {
    this.tone(520, 0.07, { type: 'triangle', gain: 0.07 });
  }

  merge(chain: number): void {
    const f = chainFrequency(chain);
    this.tone(f, 0.18, { type: 'sine', gain: 0.13 });
    this.tone(f * 2, 0.12, { type: 'triangle', gain: 0.04 });
  }

  slideStop(): void {
    this.tone(170, 0.06, { type: 'sine', gain: 0.06 });
  }

  invalid(): void {
    this.tone(150, 0.12, { type: 'square', gain: 0.035, slideTo: 110 });
  }

  ui(): void {
    this.tone(760, 0.035, { type: 'triangle', gain: 0.05 });
  }

  milestone(): void {
    [0, 4, 7, 12].forEach((s, i) => this.tone(523 * 2 ** (s / 12), 0.16, { type: 'triangle', gain: 0.08, delay: i * 0.07 }));
  }

  gameOver(): void {
    [7, 4, 0].forEach((s, i) => this.tone(330 * 2 ** (s / 12), 0.22, { type: 'sine', gain: 0.09, delay: i * 0.12 }));
  }
}
