import { create } from 'zustand';
import { fetchAvailableModels, type ModelInfo } from '../core/ai/model-fetcher';

const STORAGE_KEY = 'sketchy-settings';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

interface StoredSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface SettingsState {
  openaiApiKey: string;
  baseUrl: string;
  model: string;
  settingsOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  modelsError: string | null;

  setOpenaiApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  toggleSettings: () => void;
  closeSettings: () => void;
  refreshModels: () => void;
}

function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey ?? '',
        baseUrl: parsed.baseUrl ?? DEFAULT_BASE_URL,
        model: parsed.model ?? DEFAULT_MODEL,
      };
    }
  } catch { /* ignore */ }
  return { apiKey: '', baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL };
}

function saveSettings(patch: Partial<StoredSettings>) {
  try {
    const current = loadSettings();
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadSettings();
  let abortController: AbortController | null = null;

  function refreshModels() {
    const { baseUrl, openaiApiKey } = get();
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    set({ modelsLoading: true, modelsError: null });

    fetchAvailableModels(baseUrl, openaiApiKey, controller.signal)
      .then((models) => {
        if (!controller.signal.aborted) {
          set({ availableModels: models, modelsLoading: false });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          set({ availableModels: [], modelsLoading: false, modelsError: String(err) });
        }
      });
  }

  return {
    openaiApiKey: initial.apiKey,
    baseUrl: initial.baseUrl,
    model: initial.model,
    settingsOpen: false,
    availableModels: [],
    modelsLoading: false,
    modelsError: null,

    setOpenaiApiKey: (key) => {
      saveSettings({ apiKey: key });
      set({ openaiApiKey: key });
      refreshModels();
    },

    setBaseUrl: (url) => {
      saveSettings({ baseUrl: url });
      set({ baseUrl: url });
      refreshModels();
    },

    setModel: (model) => {
      saveSettings({ model });
      set({ model });
    },

    toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
    closeSettings: () => set({ settingsOpen: false }),
    refreshModels,
  };
});

// Fetch models on startup if we have a key or a non-default base URL
const { openaiApiKey, baseUrl, refreshModels } = useSettingsStore.getState();
if (openaiApiKey || baseUrl !== DEFAULT_BASE_URL) {
  refreshModels();
}
