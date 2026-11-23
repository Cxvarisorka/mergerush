import { Haptics as NativeHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { Haptics, ImpactStrength, NotificationKind } from './haptics';

const IMPACT: Record<ImpactStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};
const NOTIFY: Record<NotificationKind, NotificationType> = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
};

/** Native haptics (Taptic Engine on iOS, vibrator on Android). */
export class CapacitorHaptics implements Haptics {
  impact(strength: ImpactStrength): void {
    NativeHaptics.impact({ style: IMPACT[strength] }).catch(() => undefined);
  }
  notify(kind: NotificationKind): void {
    NativeHaptics.notification({ type: NOTIFY[kind] }).catch(() => undefined);
  }
}
