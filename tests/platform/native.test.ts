import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate running inside the Capacitor native shell.
const prefs = new Map<string, string>();
const calls: string[] = [];
let backListener: (() => void) | null = null;

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
  },
}));
vi.mock('@capacitor/haptics', () => ({
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
  Haptics: {
    impact: async ({ style }: { style: string }) => void calls.push(`impact:${style}`),
    notification: async ({ type }: { type: string }) => void calls.push(`notify:${type}`),
  },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, fn: () => void) => {
      if (event === 'backButton') backListener = fn;
      return Promise.resolve({ remove: async () => undefined });
    },
    minimizeApp: async () => void calls.push('minimize'),
  },
}));

const { createPlatform } = await import('../../src/platform');
const { PreferencesStore } = await import('../../src/platform/storage.capacitor');
const { CapacitorHaptics } = await import('../../src/platform/haptics.capacitor');
const { Session } = await import('../../src/app/session');
const { validMoves } = await import('../../src/engine');

beforeEach(() => {
  prefs.clear();
  calls.length = 0;
  backListener = null;
});

describe('native platform', () => {
  it('selects Preferences storage and native haptics', () => {
    const platform = createPlatform();
    expect(platform.native).toBe(true);
    expect(platform.store).toBeInstanceOf(PreferencesStore);
    expect(platform.haptics).toBeInstanceOf(CapacitorHaptics);
  });

  it('a game saved through Preferences survives an app restart', async () => {
    const a = new Session(createPlatform().store, () => 11);
    await a.load();
    a.play(validMoves(a.state)[0]!);
    await a.flush();
    expect(prefs.has('mergerush.save.v1')).toBe(true);
    const b = new Session(createPlatform().store, () => 99);
    await b.load();
    expect(b.state).toEqual(a.state);
  });

  it('maps haptic strengths to native styles', async () => {
    const h = new CapacitorHaptics();
    h.impact('light');
    h.impact('heavy');
    h.notify('warning');
    await Promise.resolve();
    expect(calls).toEqual(['impact:LIGHT', 'impact:HEAVY', 'notify:WARNING']);
  });

  it('back button closes a panel first, otherwise minimises the app', async () => {
    let panelOpen = true;
    createPlatform().onBackButton(() => {
      const had = panelOpen;
      panelOpen = false;
      return had;
    });
    await vi.waitFor(() => expect(backListener).not.toBeNull());
    backListener!();
    expect(panelOpen).toBe(false);
    expect(calls).not.toContain('minimize');
    backListener!();
    await Promise.resolve();
    expect(calls).toContain('minimize');
  });

  it('storage failures never throw', async () => {
    const { Preferences } = await import('@capacitor/preferences');
    const spy = vi.spyOn(Preferences, 'get').mockRejectedValueOnce(new Error('io'));
    expect(await new PreferencesStore().get('x')).toBeNull();
    spy.mockRestore();
  });
});
