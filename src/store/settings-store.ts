import { create } from 'zustand';

const STORAGE_KEY = 'sketchy-settings';

interface SettingsState {
  openaiApiKey: string;
  settingsOpen: boolean;

  setOpenaiApiKey: (key: string) => void;
  toggleSettings: () => void;
  closeSettings: () => void;
}

function loadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  openaiApiKey: loadApiKey(),
  settingsOpen: false,

  setOpenaiApiKey: (key) => {
    try {
      if (key) {
        localStorage.setItem(STORAGE_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
    set({ openaiApiKey: key });
  },

  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),
}));
