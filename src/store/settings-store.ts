import { create } from 'zustand';
import { fetchAvailableModels, type ModelInfo } from '../core/ai/model-fetcher';
import { DEFAULT_THEME, type ThemeId } from '../styles/themes';

const STORAGE_KEY = 'sketchy-settings';

const DEFAULT_MODEL = 'gpt-4o';

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  requiresKey: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', requiresKey: true },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', requiresKey: true },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', requiresKey: true },
  { id: 'together', name: 'Together', baseUrl: 'https://api.together.xyz/v1', requiresKey: true },
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', requiresKey: false },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', requiresKey: false },
  { id: 'custom', name: 'Custom', baseUrl: '', requiresKey: false },
];

function detectProvider(baseUrl: string): string {
  const match = PROVIDERS.find((p) => p.id !== 'custom' && p.baseUrl === baseUrl);
  return match?.id ?? 'custom';
}

interface StoredSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: string;
  theme?: string;
}

interface SettingsState {
  provider: string;
  theme: ThemeId;
  openaiApiKey: string;
  baseUrl: string;
  model: string;
  settingsOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  modelsError: string | null;

  setProvider: (providerId: string) => void;
  setTheme: (theme: ThemeId) => void;
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
      const baseUrl = parsed.baseUrl ?? PROVIDERS[0].baseUrl;
      return {
        apiKey: parsed.apiKey ?? '',
        baseUrl,
        model: parsed.model ?? DEFAULT_MODEL,
        provider: parsed.provider ?? detectProvider(baseUrl),
        theme: parsed.theme ?? DEFAULT_THEME,
      };
    }
  } catch { /* ignore */ }
  return { apiKey: '', baseUrl: PROVIDERS[0].baseUrl, model: DEFAULT_MODEL, provider: PROVIDERS[0].id, theme: DEFAULT_THEME };
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
    const { baseUrl, openaiApiKey, provider } = get();
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    set({ modelsLoading: true, modelsError: null });

    fetchAvailableModels(baseUrl, openaiApiKey, controller.signal, provider)
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
    provider: initial.provider ?? PROVIDERS[0].id,
    theme: (initial.theme as ThemeId) ?? DEFAULT_THEME,
    openaiApiKey: initial.apiKey,
    baseUrl: initial.baseUrl,
    model: initial.model,
    settingsOpen: false,
    availableModels: [],
    modelsLoading: false,
    modelsError: null,

    setProvider: (providerId) => {
      const p = PROVIDERS.find((pr) => pr.id === providerId);
      if (!p) return;
      const baseUrl = p.id === 'custom' ? get().baseUrl : p.baseUrl;
      saveSettings({ provider: providerId, baseUrl });
      set({ provider: providerId, baseUrl });
      refreshModels();
    },

    setTheme: (theme) => {
      saveSettings({ theme });
      set({ theme });
    },

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
if (openaiApiKey || baseUrl !== PROVIDERS[0].baseUrl) {
  refreshModels();
}

// Sync settings across tabs via localStorage storage event
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    const parsed = JSON.parse(e.newValue);
    const newBaseUrl = parsed.baseUrl ?? PROVIDERS[0].baseUrl;
    const newProvider = parsed.provider ?? detectProvider(newBaseUrl);
    useSettingsStore.setState({
      openaiApiKey: parsed.apiKey ?? '',
      baseUrl: newBaseUrl,
      model: parsed.model ?? DEFAULT_MODEL,
      provider: newProvider,
      theme: (parsed.theme as ThemeId) ?? DEFAULT_THEME,
    });
    useSettingsStore.getState().refreshModels();
  } catch { /* ignore malformed data */ }
});
