export type ImpactStrength = 'light' | 'medium' | 'heavy';
export type NotificationKind = 'success' | 'warning' | 'error';

/** Haptic feedback. Implementations must never throw. */
export interface Haptics {
  impact(strength: ImpactStrength): void;
  notify(kind: NotificationKind): void;
}

export const NO_HAPTICS: Haptics = { impact() {}, notify() {} };

const IMPACT_MS: Record<ImpactStrength, number> = { light: 8, medium: 16, heavy: 28 };
const NOTIFY_PATTERN: Record<NotificationKind, number[]> = {
  success: [12, 40, 18],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

/**
 * Web Vibration API. Supported by Chrome on Android; not by Safari or iOS WebViews
 * (there this is a silent no-op).
 */
export class WebVibrationHaptics implements Haptics {
  private vibrate(pattern: number | number[]): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
  impact(strength: ImpactStrength): void {
    this.vibrate(IMPACT_MS[strength]);
  }
  notify(kind: NotificationKind): void {
    this.vibrate(NOTIFY_PATTERN[kind]);
  }
}

/** Wraps another implementation behind an on/off switch. */
export function switchable(inner: Haptics, enabled: () => boolean): Haptics {
  return {
    impact: (s) => enabled() && inner.impact(s),
    notify: (k) => enabled() && inner.notify(k),
  };
}
