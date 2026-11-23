import { describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY, SettingsStore, defaultSettings, parseSettings } from '../../src/app/feel/settings';
import { chainFrequency } from '../../src/app/feel/sfx';
import { contrastRatio, tileColor, tileTextColor, tileFontScale } from '../../src/app/view/theme';
import { switchable, WebVibrationHaptics, type Haptics } from '../../src/platform/haptics';
import { MemoryStore } from '../../src/platform/storage';

describe('settings', () => {
  it('defaults and parsing', () => {
    expect(defaultSettings()).toEqual({ sound: true, haptics: true, reducedMotion: false, seenHelp: false });
    expect(defaultSettings(true).reducedMotion).toBe(true);
    const d = defaultSettings();
    expect(parseSettings(null, d)).toEqual(d);
    expect(parseSettings('nope', d)).toEqual(d);
    expect(parseSettings('{"sound":false,"haptics":"yes"}', d)).toEqual({ ...d, sound: false });
  });

  it('persists updates', async () => {
    const store = new MemoryStore();
    const s = new SettingsStore(store, defaultSettings());
    await s.load();
    s.update({ sound: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse((await store.get(SETTINGS_KEY))!).sound).toBe(false);
    const again = new SettingsStore(store, defaultSettings());
    expect((await again.load()).sound).toBe(false);
  });
});

describe('haptics', () => {
  it('switchable respects the setting', () => {
    const inner: Haptics = { impact: vi.fn(), notify: vi.fn() };
    let on = false;
    const h = switchable(inner, () => on);
    h.impact('light');
    expect(inner.impact).not.toHaveBeenCalled();
    on = true;
    h.impact('heavy');
    h.notify('success');
    expect(inner.impact).toHaveBeenCalledWith('heavy');
    expect(inner.notify).toHaveBeenCalledWith('success');
  });

  it('web vibration is a safe no-op without navigator.vibrate', () => {
    expect(() => new WebVibrationHaptics().impact('medium')).not.toThrow();
  });
});

describe('theme', () => {
  const values = Array.from({ length: 17 }, (_, i) => 2 ** (i + 1)); // 2 .. 131072
  it.each(values)('tile %i text contrast is at least 4.5:1', (v) => {
    expect(contrastRatio(tileColor(v), tileTextColor(v))).toBeGreaterThanOrEqual(4.5);
  });

  it('adjacent tile values have distinct colours up to 8192', () => {
    for (let i = 1; i < 13; i++) expect(tileColor(2 ** i)).not.toBe(tileColor(2 ** (i + 1)));
  });

  it('long numbers get smaller fonts', () => {
    expect(tileFontScale(2)).toBeGreaterThan(tileFontScale(128));
    expect(tileFontScale(128)).toBeGreaterThan(tileFontScale(1024));
    expect(tileFontScale(1024)).toBeGreaterThan(tileFontScale(16384));
  });
});

describe('sfx', () => {
  it('chain pitch rises and stays bounded', () => {
    for (let c = 1; c < 12; c++) expect(chainFrequency(c + 1)).toBeGreaterThanOrEqual(chainFrequency(c));
    expect(chainFrequency(1)).toBeCloseTo(392);
    expect(chainFrequency(100)).toBeLessThan(2000);
  });
});
