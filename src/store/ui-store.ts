import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  action?: { label: string; onClick: () => void };
}

export type InteractionMode = 'select' | 'pan';
export type GraphObjectKind = 'node' | 'edge' | 'loop';
export interface GraphObjectTarget {
  kind: GraphObjectKind;
  id: string;
}

interface UIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedLoopId: string | null;
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string } | null;
  toasts: Toast[];
  sidePanelOpen: boolean;
  interactionMode: InteractionMode;
  fitViewTrigger: number;
  clearSelectionTrigger: number;
  selectionSyncTrigger: number;
  viewportFocusTarget: GraphObjectTarget | null;
  viewportFocusTrigger: number;

  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  setSelectedLoop: (id: string | null) => void;
  openContextMenu: (x: number, y: number, nodeId?: string, edgeId?: string) => void;
  closeContextMenu: () => void;
  addToast: (message: string, type?: 'info' | 'warning' | 'error', action?: { label: string; onClick: () => void }) => void;
  dismissToast: (id: string) => void;
  toggleSidePanel: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  requestFitView: () => void;
  requestClearSelection: () => void;
  selectGraphObject: (target: GraphObjectTarget) => void;
  focusGraphObject: (target: GraphObjectTarget) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedLoopId: null,
  contextMenu: null,
  toasts: [],
  sidePanelOpen: true,
  interactionMode: 'select',
  fitViewTrigger: 0,
  clearSelectionTrigger: 0,
  selectionSyncTrigger: 0,
  viewportFocusTarget: null,
  viewportFocusTrigger: 0,

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  setSelectedEdges: (ids) => set({ selectedEdgeIds: ids }),

  setSelectedLoop: (id) => set({ selectedLoopId: id }),

  openContextMenu: (x, y, nodeId, edgeId) =>
    set({ contextMenu: { x, y, nodeId, edgeId } }),

  closeContextMenu: () => set({ contextMenu: null }),

  addToast: (message, type = 'info', action) => {
    const id = crypto.randomUUID();
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, action }],
    }));
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.filter((t) => t.id !== id),
      }));
    }, action ? 6000 : 4000);
  },

  dismissToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  toggleSidePanel: () =>
    set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),

  setInteractionMode: (mode) => set({ interactionMode: mode }),

  requestFitView: () => set((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 })),

  requestClearSelection: () => set((s) => ({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    clearSelectionTrigger: s.clearSelectionTrigger + 1,
    selectionSyncTrigger: s.selectionSyncTrigger + 1,
  })),

  selectGraphObject: ({ kind, id }) => {
    if (kind === 'node') {
      set((s) => ({ selectedNodeIds: [id], selectedEdgeIds: [], selectedLoopId: null, selectionSyncTrigger: s.selectionSyncTrigger + 1 }));
      return;
    }

    if (kind === 'edge') {
      set((s) => ({ selectedNodeIds: [], selectedEdgeIds: [id], selectedLoopId: null, selectionSyncTrigger: s.selectionSyncTrigger + 1 }));
      return;
    }

    set((s) => ({ selectedNodeIds: [], selectedEdgeIds: [], selectedLoopId: id, selectionSyncTrigger: s.selectionSyncTrigger + 1 }));
  },

  focusGraphObject: (target) => set((s) => ({
    viewportFocusTarget: target,
    viewportFocusTrigger: s.viewportFocusTrigger + 1,
  })),
}));
