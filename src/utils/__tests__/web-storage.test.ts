import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebStorage } from '../web-storage';

type StorageName = 'localStorage' | 'sessionStorage';

function captureDescriptor(name: StorageName) {
  return Object.getOwnPropertyDescriptor(globalThis, name);
}

function restoreDescriptor(name: StorageName, descriptor: PropertyDescriptor | undefined) {
  delete (globalThis as Record<string, unknown>)[name];
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  }
}

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    key: (index) => Array.from(data.keys())[index] ?? null,
  };
}

describe('getWebStorage — direct value descriptor', () => {
  let original: PropertyDescriptor | undefined;

  afterEach(() => {
    restoreDescriptor('localStorage', original);
    original = undefined;
  });

  it('returns the storage when globalThis exposes it as a writable value property', () => {
    original = captureDescriptor('localStorage');
    const storage = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: storage,
    });

    expect(getWebStorage('localStorage')).toBe(storage);
  });

  it('returns null when the value descriptor holds something that is not Storage-like', () => {
    original = captureDescriptor('localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: { getItem: 'not-a-function' },
    });

    expect(getWebStorage('localStorage')).toBeNull();
  });

  it('returns null when the value descriptor is missing setItem/removeItem', () => {
    original = captureDescriptor('localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: { getItem: () => null },
    });

    expect(getWebStorage('localStorage')).toBeNull();
  });
});

describe('getWebStorage — Node runtime fallback', () => {
  // jsdom defines localStorage and sessionStorage as accessor descriptors (get/set),
  // so the value-descriptor branch is skipped and the Node-runtime branch is exercised.

  it('returns null for localStorage in the Node runtime branch', () => {
    expect(getWebStorage('localStorage')).toBeNull();
  });

  it('returns the jsdom-backed sessionStorage instance', () => {
    const session = getWebStorage('sessionStorage');
    expect(session).not.toBeNull();
    session!.setItem('probe', 'value');
    expect(session!.getItem('probe')).toBe('value');
    session!.removeItem('probe');
  });

  it('returns null when sessionStorage access throws (private-mode emulation)', () => {
    const original = captureDescriptor('sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('access denied', 'SecurityError');
      },
    });

    try {
      expect(getWebStorage('sessionStorage')).toBeNull();
    } finally {
      restoreDescriptor('sessionStorage', original);
    }
  });

  it('returns null when sessionStorage is replaced with a non-Storage-like value', () => {
    const original = captureDescriptor('sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        return { getItem: () => null };
      },
    });

    try {
      expect(getWebStorage('sessionStorage')).toBeNull();
    } finally {
      restoreDescriptor('sessionStorage', original);
    }
  });
});

describe('getWebStorage — fresh module under SSR (no Node process, no window storage)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns null for both names when no storage exists and runtime is browser-like with neither global', async () => {
    vi.resetModules();
    vi.stubGlobal('process', undefined);
    // Force the fresh module to take the browser branch by clearing process.versions.node
    // but still leaving localStorage/sessionStorage absent.
    const localOriginal = captureDescriptor('localStorage');
    const sessionOriginal = captureDescriptor('sessionStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => undefined });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => undefined });

    try {
      const mod = await import('../web-storage');
      expect(mod.getWebStorage('localStorage')).toBeNull();
      expect(mod.getWebStorage('sessionStorage')).toBeNull();
    } finally {
      restoreDescriptor('localStorage', localOriginal);
      restoreDescriptor('sessionStorage', sessionOriginal);
    }
  });

  it('survives a getter that throws under the browser branch (Safari private-mode shape)', async () => {
    vi.resetModules();
    vi.stubGlobal('process', undefined);
    const localOriginal = captureDescriptor('localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('access denied', 'SecurityError');
      },
    });

    try {
      const mod = await import('../web-storage');
      expect(mod.getWebStorage('localStorage')).toBeNull();
    } finally {
      restoreDescriptor('localStorage', localOriginal);
    }
  });

  it('returns the storage from the browser branch when it exists as a getter-backed value', async () => {
    vi.resetModules();
    vi.stubGlobal('process', undefined);
    const localOriginal = captureDescriptor('localStorage');
    const storage = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => storage,
    });

    try {
      const mod = await import('../web-storage');
      expect(mod.getWebStorage('localStorage')).toBe(storage);
    } finally {
      restoreDescriptor('localStorage', localOriginal);
    }
  });
});
