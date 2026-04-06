import { create } from 'zustand';

type InteractionMode = 'select' | 'pan';
export type GraphObjectKind = 'node' | 'edge' | 'loop';
type ChatPanelMode = 'min' | 'shared' | 'max';
export interface GraphObjectTarget {
  kind: GraphObjectKind;
  id: string;
}

interface UIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedLoopId: string | null;
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string } | null;
  sidePanelOpen: boolean;
  chatPanelMode: ChatPanelMode;
  interactionMode: InteractionMode;
  fitViewTrigger: number;
  clearSelectionTrigger: number;
  selectionSyncTrigger: number;
  viewportFocusTarget: GraphObjectTarget | null;
  viewportFocusTrigger: number;
  searchQuery: string;

  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  setSelectedLoop: (id: string | null) => void;
  openContextMenu: (x: number, y: number, nodeId?: string, edgeId?: string) => void;
  closeContextMenu: () => void;
  toggleSidePanel: () => void;
  setChatPanelMode: (mode: ChatPanelMode) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  requestFitView: () => void;
  requestClearSelection: () => void;
  selectGraphObject: (target: GraphObjectTarget) => void;
  focusGraphObject: (target: GraphObjectTarget) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedLoopId: null,
  contextMenu: null,
  sidePanelOpen: true,
  chatPanelMode: 'shared',
  interactionMode: 'select',
  fitViewTrigger: 0,
  clearSelectionTrigger: 0,
  selectionSyncTrigger: 0,
  viewportFocusTarget: null,
  viewportFocusTrigger: 0,
  searchQuery: '',

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  setSelectedEdges: (ids) => set({ selectedEdgeIds: ids }),

  setSelectedLoop: (id) => set({ selectedLoopId: id }),

  openContextMenu: (x, y, nodeId, edgeId) =>
    set({ contextMenu: { x, y, nodeId, edgeId } }),

  closeContextMenu: () => set({ contextMenu: null }),

  toggleSidePanel: () =>
    set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),

  setChatPanelMode: (mode) => set({ chatPanelMode: mode }),

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

  setSearchQuery: (query) => set({ searchQuery: query }),
}));

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__uiStore = useUIStore;
}
