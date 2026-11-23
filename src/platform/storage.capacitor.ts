import { Preferences } from '@capacitor/preferences';
import type { KeyValueStore } from './storage';

/**
 * Native storage via @capacitor/preferences (UserDefaults on iOS, SharedPreferences on
 * Android). Capacitor's docs warn that WebView localStorage can be cleared by the OS.
 * Never throws: failures are swallowed so the game keeps running.
 */
export class PreferencesStore implements KeyValueStore {
  async get(key: string): Promise<string | null> {
    try {
      return (await Preferences.get({ key })).value;
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      /* ignore */
    }
  }
  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {
      /* ignore */
    }
  }
}
