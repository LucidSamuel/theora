import type { KeyStoragePreference } from '../types';

const SESSION_KEY = 'theora:ai:key';
const LOCAL_KEY = 'theora:ai:key';
const PREF_KEY = 'theora:ai:storage-pref';

let memoryKey: string | null = null;

// Simple same-tab change notification
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach((fn) => fn()); }

function tryGet(storage: Storage | undefined, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function trySet(storage: Storage | undefined, key: string, value: string): void {
  try { storage?.setItem(key, value); } catch { /* noop */ }
}
function tryRemove(storage: Storage | undefined, key: string): void {
  try { storage?.removeItem(key); } catch { /* noop */ }
}

function getSessionStorage(): Storage | undefined {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : undefined; } catch { return undefined; }
}
function getLocalStorage(): Storage | undefined {
  try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; }
}

function getKeyForPreference(pref: KeyStoragePreference): string | null {
  switch (pref) {
    case 'local':
      return tryGet(getLocalStorage(), LOCAL_KEY) ?? memoryKey;
    case 'session':
      return tryGet(getSessionStorage(), SESSION_KEY) ?? memoryKey;
    case 'memory':
    default:
      return memoryKey;
  }
}

/**
 * Stores and retrieves the user's Anthropic API key with configurable persistence.
 * - memory: key only lives in JS memory — gone on page refresh
 * - session: key stored in sessionStorage — survives refresh, gone when tab closes
 * - local: key stored in localStorage — persists across sessions
 */
export const ApiKeyStore = {
  get(): string | null {
    return getKeyForPreference(ApiKeyStore.getPreference());
  },

  set(key: string): void {
    const pref = ApiKeyStore.getPreference();
    memoryKey = key;
    switch (pref) {
      case 'local':
        trySet(getLocalStorage(), LOCAL_KEY, key);
        break;
      case 'session':
        trySet(getSessionStorage(), SESSION_KEY, key);
        break;
    }
    notify();
  },

  clear(): void {
    memoryKey = null;
    tryRemove(getSessionStorage(), SESSION_KEY);
    tryRemove(getLocalStorage(), LOCAL_KEY);
    notify();
  },

  has(): boolean {
    return ApiKeyStore.get() !== null;
  },

  getPreference(): KeyStoragePreference {
    const pref = tryGet(getLocalStorage(), PREF_KEY);
    if (pref === 'session' || pref === 'local' || pref === 'memory') return pref;
    return 'memory';
  },

  setPreference(pref: KeyStoragePreference): void {
    const previousPref = ApiKeyStore.getPreference();
    const current = getKeyForPreference(previousPref);
    trySet(getLocalStorage(), PREF_KEY, pref);

    // Migrate key to new storage
    memoryKey = null;
    tryRemove(getSessionStorage(), SESSION_KEY);
    tryRemove(getLocalStorage(), LOCAL_KEY);
    if (current) {
      memoryKey = current;
      switch (pref) {
        case 'local':
          trySet(getLocalStorage(), LOCAL_KEY, current);
          break;
        case 'session':
          trySet(getSessionStorage(), SESSION_KEY, current);
          break;
      }
    }
  },

  /** Validates that a string looks like a valid Anthropic API key format. */
  validate(key: string): boolean {
    return /^sk-ant-[a-zA-Z0-9_-]{40,}$/.test(key.trim());
  },

  /** Subscribe to key set/clear events. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
