/** Minimal async key/value store so web and native builds can use different backends. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

/** localStorage-backed store. Never throws: failures (private mode, quota) are ignored. */
export class LocalStorageStore implements KeyValueStore {
  async get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: keep playing without persistence */
    }
  }
  async remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
