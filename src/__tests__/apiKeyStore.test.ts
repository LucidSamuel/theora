import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ApiKeyStore } from '../modes/predict/ai/apiKeyStore';

class MockStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

function installMockStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: new MockStorage(),
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: new MockStorage(),
  });
}

function restoreStorage(name: 'localStorage' | 'sessionStorage', descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}

describe('ApiKeyStore', () => {
  beforeEach(() => {
    installMockStorage();
    ApiKeyStore.clear();
  });

  afterAll(() => {
    restoreStorage('localStorage', originalLocalStorage);
    restoreStorage('sessionStorage', originalSessionStorage);
  });

  it('starts with no key', () => {
    expect(ApiKeyStore.has()).toBe(false);
    expect(ApiKeyStore.get()).toBeNull();
  });

  it('stores and retrieves key in memory mode', () => {
    ApiKeyStore.set('sk-ant-test123456789012345678901234567890abcdef');
    expect(ApiKeyStore.has()).toBe(true);
    expect(ApiKeyStore.get()).toBe('sk-ant-test123456789012345678901234567890abcdef');
  });

  it('clears key', () => {
    ApiKeyStore.set('sk-ant-test123456789012345678901234567890abcdef');
    ApiKeyStore.clear();
    expect(ApiKeyStore.has()).toBe(false);
    expect(ApiKeyStore.get()).toBeNull();
  });

  it('validates correct key format', () => {
    expect(ApiKeyStore.validate('sk-ant-abcdefghijklmnopqrstuvwxyz01234567890123')).toBe(true);
    expect(ApiKeyStore.validate('sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123_-extra')).toBe(true);
  });

  it('rejects invalid key formats', () => {
    expect(ApiKeyStore.validate('')).toBe(false);
    expect(ApiKeyStore.validate('not-a-key')).toBe(false);
    expect(ApiKeyStore.validate('sk-ant-short')).toBe(false);
    expect(ApiKeyStore.validate('sk-other-abcdefghijklmnopqrstuvwxyz0123456789')).toBe(false);
  });

  it('defaults to memory preference when storage is empty', () => {
    expect(ApiKeyStore.getPreference()).toBe('memory');
  });

  it('setPreference does not throw without browser storage', () => {
    restoreStorage('localStorage');
    restoreStorage('sessionStorage');
    expect(() => ApiKeyStore.setPreference('session')).not.toThrow();
    expect(() => ApiKeyStore.setPreference('local')).not.toThrow();
    expect(() => ApiKeyStore.setPreference('memory')).not.toThrow();
    installMockStorage();
  });

  it('key survives preference changes via memory fallback', () => {
    const testKey = 'sk-ant-test123456789012345678901234567890abcdef';
    ApiKeyStore.set(testKey);
    expect(ApiKeyStore.get()).toBe(testKey);

    // Switch preference — key migrates through memory
    ApiKeyStore.setPreference('session');
    expect(ApiKeyStore.get()).toBe(testKey);

    ApiKeyStore.setPreference('local');
    expect(ApiKeyStore.get()).toBe(testKey);
  });

  it('migrates an existing session key before switching preference backends', () => {
    const testKey = 'sk-ant-test123456789012345678901234567890abcdef';
    localStorage.setItem('theora:ai:storage-pref', 'session');
    sessionStorage.setItem('theora:ai:key', testKey);

    expect(ApiKeyStore.get()).toBe(testKey);

    ApiKeyStore.setPreference('local');

    expect(ApiKeyStore.getPreference()).toBe('local');
    expect(sessionStorage.getItem('theora:ai:key')).toBeNull();
    expect(localStorage.getItem('theora:ai:key')).toBe(testKey);
    expect(ApiKeyStore.get()).toBe(testKey);
  });
});
