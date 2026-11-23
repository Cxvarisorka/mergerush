import { Capacitor } from '@capacitor/core';
import { WebVibrationHaptics, type Haptics } from './haptics';
import { CapacitorHaptics } from './haptics.capacitor';
import { LocalStorageStore, type KeyValueStore } from './storage';
import { PreferencesStore } from './storage.capacitor';

export interface Platform {
  readonly native: boolean;
  readonly store: KeyValueStore;
  readonly haptics: Haptics;
  /** Registers the Android back button handler; returns false when nothing was handled. */
  onBackButton(handler: () => boolean): void;
}

/** Picks native or web implementations once, at start-up. */
export function createPlatform(): Platform {
  const native = Capacitor.isNativePlatform();
  return {
    native,
    store: native ? new PreferencesStore() : new LocalStorageStore(),
    haptics: native ? new CapacitorHaptics() : new WebVibrationHaptics(),
    onBackButton(handler) {
      if (!native) return;
      void import('@capacitor/app').then(({ App }) =>
        App.addListener('backButton', () => {
          if (!handler()) void App.minimizeApp();
        }),
      );
    },
  };
}
