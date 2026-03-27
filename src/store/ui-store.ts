import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export type InteractionMode = 'select' | 'pan';

interface UIState {
  selectedNodeIds: string[];
  contextMenu: { x: number; y: number; nodeId?: string } | null;
  toasts: Toast[];
  sidePanelOpen: boolean;
  interactionMode: InteractionMode;

  setSelectedNodes: (ids: string[]) => void;
  openContextMenu: (x: number, y: number, nodeId?: string) => void;
  closeContextMenu: () => void;
  addToast: (message: string, type?: 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  toggleSidePanel: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeIds: [],
  contextMenu: null,
  toasts: [],
  sidePanelOpen: true,
  interactionMode: 'select',

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  openContextMenu: (x, y, nodeId) =>
    set({ contextMenu: { x, y, nodeId } }),

  closeContextMenu: () => set({ contextMenu: null }),

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({
      toasts: [...s.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  dismissToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  toggleSidePanel: () =>
    set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),

  setInteractionMode: (mode) => set({ interactionMode: mode }),
}));
