import { create } from 'zustand';
import { uiEvents } from './ui-events';

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
  requestEdgeRefresh: () => void;
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

  requestFitView: () => { uiEvents.emit('fitView'); },

  requestEdgeRefresh: () => { uiEvents.emit('edgeRefresh'); },

  requestClearSelection: () => {
    set({
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedLoopId: null,
    });
    uiEvents.emit('selectionSync');
  },

  selectGraphObject: ({ kind, id }) => {
    if (kind === 'node') {
      set({ selectedNodeIds: [id], selectedEdgeIds: [], selectedLoopId: null });
    } else if (kind === 'edge') {
      set({ selectedNodeIds: [], selectedEdgeIds: [id], selectedLoopId: null });
    } else {
      set({ selectedNodeIds: [], selectedEdgeIds: [], selectedLoopId: id });
    }
    uiEvents.emit('selectionSync');
  },

  focusGraphObject: (target) => { uiEvents.emit('viewportFocus', target); },

  setSearchQuery: (query) => set({ searchQuery: query }),
}));

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__uiStore = useUIStore;
}
