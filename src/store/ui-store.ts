import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export type InteractionMode = 'select' | 'pan';

interface UIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string } | null;
  toasts: Toast[];
  sidePanelOpen: boolean;
  interactionMode: InteractionMode;
  fitViewTrigger: number;

  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  openContextMenu: (x: number, y: number, nodeId?: string, edgeId?: string) => void;
  closeContextMenu: () => void;
  addToast: (message: string, type?: 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  toggleSidePanel: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  requestFitView: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeIds: [],
  selectedEdgeIds: [],
  contextMenu: null,
  toasts: [],
  sidePanelOpen: true,
  interactionMode: 'select',
  fitViewTrigger: 0,

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  setSelectedEdges: (ids) => set({ selectedEdgeIds: ids }),

  openContextMenu: (x, y, nodeId, edgeId) =>
    set({ contextMenu: { x, y, nodeId, edgeId } }),

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

  requestFitView: () => set((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 })),
}));
