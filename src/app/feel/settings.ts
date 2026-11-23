import type { KeyValueStore } from '../../platform/storage';

export const SETTINGS_KEY = 'mergerush.settings';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  seenHelp: boolean;
}

export function defaultSettings(prefersReducedMotion = false): Settings {
  return { sound: true, haptics: true, reducedMotion: prefersReducedMotion, seenHelp: false };
}

export function parseSettings(json: string | null, defaults: Settings): Settings {
  if (!json) return { ...defaults };
  try {
    const data = JSON.parse(json) as Partial<Record<keyof Settings, unknown>>;
    const pick = (key: keyof Settings) => (typeof data[key] === 'boolean' ? (data[key] as boolean) : defaults[key]);
    return { sound: pick('sound'), haptics: pick('haptics'), reducedMotion: pick('reducedMotion'), seenHelp: pick('seenHelp') };
  } catch {
    return { ...defaults };
  }
}

export class SettingsStore {
  value: Settings;

  constructor(
    private readonly store: KeyValueStore,
    private readonly defaults: Settings,
  ) {
    this.value = { ...defaults };
  }

  async load(): Promise<Settings> {
    this.value = parseSettings(await this.store.get(SETTINGS_KEY).catch(() => null), this.defaults);
    return this.value;
  }

  update(patch: Partial<Settings>): Settings {
    this.value = { ...this.value, ...patch };
    void this.store.set(SETTINGS_KEY, JSON.stringify(this.value)).catch(() => undefined);
    return this.value;
  }
}
