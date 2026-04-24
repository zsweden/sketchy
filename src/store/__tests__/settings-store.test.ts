import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'sketchy-settings';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = '';

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

  describe('setProvider', () => {
    it('switches provider, resets model, updates baseUrl', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setProvider('anthropic');

      const state = useSettingsStore.getState();
      expect(state.provider).toBe('anthropic');
      expect(state.baseUrl).toBe('https://api.anthropic.com/v1');
      expect(state.model).toBe('');

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.provider).toBe('anthropic');
      expect(stored.baseUrl).toBe('https://api.anthropic.com/v1');
      expect(stored.model).toBe('');
    });

    it('keeps current baseUrl for custom provider', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setBaseUrl('https://my-custom.api/v1');
      useSettingsStore.getState().setProvider('custom');

      expect(useSettingsStore.getState().baseUrl).toBe('https://my-custom.api/v1');
    });

    it('ignores unknown provider id', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setProvider('nonexistent');

      // Should remain default
      expect(useSettingsStore.getState().provider).toBe('openai');
    });
  });

  describe('setTheme', () => {
    it('updates theme in state and persists', async () => {
      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().setTheme('dark');

      expect(useSettingsStore.getState().theme).toBe('dark');
      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.theme).toBe('dark');
    });
  });

  describe('refreshModels', () => {
    it('fetches models and updates availableModels on success', async () => {
      const mockModels = [
        { id: 'gpt-4o', owned_by: 'openai', created: null },
        { id: 'gpt-4o-mini', owned_by: 'openai', created: null },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: mockModels }), { status: 200 }),
      ));

      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().refreshModels();

      // Wait for async fetch to complete
      await vi.waitFor(() => {
        expect(useSettingsStore.getState().modelsLoading).toBe(false);
      });

      expect(useSettingsStore.getState().availableModels).toHaveLength(2);
      expect(useSettingsStore.getState().modelsError).toBeNull();
      // Should auto-select first model when current model is empty
      expect(useSettingsStore.getState().model).toBe('gpt-4o');
      vi.unstubAllGlobals();
    });

    it('falls back to known models on fetch failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiKey: 'sk-test', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' }),
      );

      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().refreshModels();

      await vi.waitFor(() => {
        expect(useSettingsStore.getState().modelsLoading).toBe(false);
      });

      expect(useSettingsStore.getState().modelsError).toContain('Network error');
      // Should fall back to known Anthropic models
      expect(useSettingsStore.getState().availableModels.length).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    });

    it('preserves current model when it exists in fetched list', async () => {
      const mockModels = [
        { id: 'gpt-4o', owned_by: 'openai', created: null },
        { id: 'gpt-4o-mini', owned_by: 'openai', created: null },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: mockModels }), { status: 200 }),
      ));

      mockStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: 'sk-x', model: 'gpt-4o-mini' }));

      // importFreshStore triggers module-level refreshModels() automatically
      // because apiKey is truthy — no need to call it again (double-call races)
      const useSettingsStore = await importFreshStore();

      await vi.waitFor(() => {
        expect(useSettingsStore.getState().modelsLoading).toBe(false);
      });

      // Should keep existing model since it's in the list
      expect(useSettingsStore.getState().model).toBe('gpt-4o-mini');
      vi.unstubAllGlobals();
    });

    it('aborts previous request when called again', async () => {
      let fetchCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
        fetchCount++;
        return new Promise((resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }
          // Only resolve the second call
          if (fetchCount === 2) {
            setTimeout(() => resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })), 10);
          }
        });
      }));

      const useSettingsStore = await importFreshStore();
      useSettingsStore.getState().refreshModels(); // first call — will be aborted
      useSettingsStore.getState().refreshModels(); // second call — should succeed

      await vi.waitFor(() => {
        expect(useSettingsStore.getState().modelsLoading).toBe(false);
      });

      expect(fetchCount).toBe(2);
      vi.unstubAllGlobals();
    });
  });

  describe('cross-tab sync', () => {
    it('updates state when storage event fires with new settings', async () => {
      const useSettingsStore = await importFreshStore();

      const newSettings = JSON.stringify({
        apiKey: 'sk-from-other-tab',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        theme: 'dark',
      });

      // Mock fetch for the refreshModels call triggered by cross-tab sync
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      ));

      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: newSettings,
      }));

      const state = useSettingsStore.getState();
      expect(state.openaiApiKey).toBe('sk-from-other-tab');
      expect(state.provider).toBe('anthropic');
      expect(state.theme).toBe('dark');
      vi.unstubAllGlobals();
    });

    it('ignores storage events for unrelated keys', async () => {
      const useSettingsStore = await importFreshStore();
      const originalKey = useSettingsStore.getState().openaiApiKey;

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'unrelated-key',
        newValue: JSON.stringify({ apiKey: 'should-not-apply' }),
      }));

      expect(useSettingsStore.getState().openaiApiKey).toBe(originalKey);
    });

    it('ignores storage events with null newValue', async () => {
      const useSettingsStore = await importFreshStore();
      const originalKey = useSettingsStore.getState().openaiApiKey;

      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: null,
      }));

      expect(useSettingsStore.getState().openaiApiKey).toBe(originalKey);
    });

    it('ignores malformed JSON in storage event', async () => {
      const useSettingsStore = await importFreshStore();
      const originalKey = useSettingsStore.getState().openaiApiKey;

      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: 'not json{{{',
      }));

      expect(useSettingsStore.getState().openaiApiKey).toBe(originalKey);
    });
  });

  describe('detectProvider via init', () => {
    it('detects Anthropic provider from baseUrl', async () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiKey: 'sk-ant', baseUrl: 'https://api.anthropic.com/v1' }),
      );

      const useSettingsStore = await importFreshStore();
      expect(useSettingsStore.getState().provider).toBe('anthropic');
    });

    it('falls back to custom for unknown baseUrl', async () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiKey: 'sk-x', baseUrl: 'https://my-llm-proxy.com/v1' }),
      );

      const useSettingsStore = await importFreshStore();
      expect(useSettingsStore.getState().provider).toBe('custom');
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
