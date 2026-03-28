import { create } from 'zustand';

const STORAGE_KEY = 'sketchy-settings';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

export const MODEL_OPTIONS = [
  // GPT
  { value: 'gpt-4.1', cost: 'medium' },
  { value: 'gpt-4.1-mini', cost: 'low' },
  { value: 'gpt-4.1-nano', cost: 'low' },
  { value: 'gpt-4o', cost: 'medium' },
  { value: 'gpt-4o-mini', cost: 'low' },
  // Reasoning
  { value: 'o3', cost: 'high' },
  { value: 'o4-mini', cost: 'medium' },
  { value: 'o3-mini', cost: 'medium' },
];

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

  setOpenaiApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  toggleSettings: () => void;
  closeSettings: () => void;
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

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadSettings();

  return {
    openaiApiKey: initial.apiKey,
    baseUrl: initial.baseUrl,
    model: initial.model,
    settingsOpen: false,

    setOpenaiApiKey: (key) => {
      saveSettings({ apiKey: key });
      set({ openaiApiKey: key });
    },

    setBaseUrl: (url) => {
      saveSettings({ baseUrl: url });
      set({ baseUrl: url });
    },

    setModel: (model) => {
      saveSettings({ model });
      set({ model });
    },

    toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
    closeSettings: () => set({ settingsOpen: false }),
  };
});
