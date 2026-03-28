import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'sketchy-settings';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

// Mock localStorage since jsdom doesn't provide it in this environment
function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

let mockStorage: ReturnType<typeof createMockLocalStorage>;

// Install mock localStorage before the store module loads
beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
});

// We must use dynamic import + module cache reset so that the store
// re-runs its initializer (which calls loadSettings) with the current
// localStorage mock state.
async function importFreshStore() {
  // Bust the module cache so the store re-initializes
  const modulePath = '../settings-store';
  // vitest uses Vite's module system — vi.resetModules clears the cache
  vi.resetModules();
  const mod = await import(modulePath);
  return mod.useSettingsStore;
}

describe('settings store', () => {
  describe('default values (no localStorage data)', () => {
    it('has empty API key, default base URL, default model, settings closed', async () => {
      const useSettingsStore = await importFreshStore();
      const state = useSettingsStore.getState();

      expect(state.openaiApiKey).toBe('');
      expect(state.baseUrl).toBe(DEFAULT_BASE_URL);
      expect(state.model).toBe(DEFAULT_MODEL);
      expect(state.settingsOpen).toBe(false);
    });
  });

  describe('initialization from localStorage', () => {
    it('loads existing settings from localStorage on init', async () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiKey: 'sk-existing',
          baseUrl: 'https://other.api/v1',
          model: 'o3-mini',
        })
      );

      const useSettingsStore = await importFreshStore();
      const state = useSettingsStore.getState();

      expect(state.openaiApiKey).toBe('sk-existing');
      expect(state.baseUrl).toBe('https://other.api/v1');
      expect(state.model).toBe('o3-mini');
    });

    it('handles corrupted localStorage gracefully (falls back to defaults)', async () => {
      mockStorage.setItem(STORAGE_KEY, 'not valid json{{{');

      const useSettingsStore = await importFreshStore();
      const state = useSettingsStore.getState();

      expect(state.openaiApiKey).toBe('');
      expect(state.baseUrl).toBe(DEFAULT_BASE_URL);
      expect(state.model).toBe(DEFAULT_MODEL);
    });

    it('handles partial settings (missing fields get defaults)', async () => {
      mockStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: 'sk-partial' }));

      const useSettingsStore = await importFreshStore();
      const state = useSettingsStore.getState();

      expect(state.openaiApiKey).toBe('sk-partial');
      expect(state.baseUrl).toBe(DEFAULT_BASE_URL);
      expect(state.model).toBe(DEFAULT_MODEL);
    });

    it('handles null field values (falls back to defaults via ??)', async () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiKey: null, baseUrl: null, model: null })
      );

      const useSettingsStore = await importFreshStore();
      const state = useSettingsStore.getState();

      expect(state.openaiApiKey).toBe('');
      expect(state.baseUrl).toBe(DEFAULT_BASE_URL);
      expect(state.model).toBe(DEFAULT_MODEL);
    });
  });

  describe('setOpenaiApiKey', () => {
    it('updates state with the new key', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setOpenaiApiKey('sk-test-123');
      expect(useSettingsStore.getState().openaiApiKey).toBe('sk-test-123');
    });

    it('persists the key to localStorage', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setOpenaiApiKey('sk-test-456');

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.apiKey).toBe('sk-test-456');
    });

    it('preserves other settings when updating key', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setBaseUrl('https://custom.api/v1');
      useSettingsStore.getState().setOpenaiApiKey('sk-new');

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.apiKey).toBe('sk-new');
      expect(stored.baseUrl).toBe('https://custom.api/v1');
    });
  });

  describe('setBaseUrl', () => {
    it('updates state with the new URL', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setBaseUrl('https://custom.api/v1');
      expect(useSettingsStore.getState().baseUrl).toBe('https://custom.api/v1');
    });

    it('persists the URL to localStorage', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setBaseUrl('https://custom.api/v1');

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.baseUrl).toBe('https://custom.api/v1');
    });
  });

  describe('setModel', () => {
    it('updates state with the new model', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setModel('o3');
      expect(useSettingsStore.getState().model).toBe('o3');
    });

    it('persists the model to localStorage', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setModel('gpt-4.1-mini');

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.model).toBe('gpt-4.1-mini');
    });
  });

  describe('toggleSettings', () => {
    it('opens settings when closed', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().toggleSettings();
      expect(useSettingsStore.getState().settingsOpen).toBe(true);
    });

    it('closes settings when open', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().toggleSettings(); // open
      useSettingsStore.getState().toggleSettings(); // close
      expect(useSettingsStore.getState().settingsOpen).toBe(false);
    });
  });

  describe('closeSettings', () => {
    it('sets settingsOpen to false when open', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().toggleSettings(); // open
      useSettingsStore.getState().closeSettings();
      expect(useSettingsStore.getState().settingsOpen).toBe(false);
    });

    it('is a no-op when already closed', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().closeSettings();
      expect(useSettingsStore.getState().settingsOpen).toBe(false);
    });
  });

  describe('localStorage error handling', () => {
    it('survives localStorage.setItem throwing', async () => {
      const useSettingsStore = await importFreshStore();

      mockStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw -- saveSettings catches errors
      expect(() => {
        useSettingsStore.getState().setOpenaiApiKey('sk-quota');
      }).not.toThrow();

      // State should still update even if persistence fails
      expect(useSettingsStore.getState().openaiApiKey).toBe('sk-quota');
    });

    it('survives localStorage.getItem throwing during save', async () => {
      const useSettingsStore = await importFreshStore();

      mockStorage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      // saveSettings calls loadSettings which calls getItem -- should not throw
      expect(() => {
        useSettingsStore.getState().setOpenaiApiKey('sk-security');
      }).not.toThrow();

      expect(useSettingsStore.getState().openaiApiKey).toBe('sk-security');
    });
  });
});
