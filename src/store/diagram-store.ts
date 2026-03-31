import { create } from 'zustand';
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgeConfidence,
  EdgePolarity,
} from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge, findExistingEdge } from '../core/graph/validation';
import { UndoRedoManager } from '../core/history/undo-redo';
import {
  getDefaultFramework,
  createDiagramForFramework,
  getDefaultEdgeFields,
  resolveEdgeSides,
  captureOptimizedEdgeSides,
  ensureFixedEdgeSides,
  snapshot,
  batchAddNodes,
  batchUpdateNodes,
  batchRemoveNodes,
  batchAddEdges,
  batchUpdateEdges,
  batchRemoveEdges,
} from './diagram-helpers';

export interface BatchMutations {
  addNodes?: { id: string; label: string; tags?: string[]; notes?: string }[];
  updateNodes?: { id: string; label?: string; tags?: string[]; notes?: string }[];
  removeNodeIds?: string[];
  addEdges?: {
    source: string;
    target: string;
    confidence?: EdgeConfidence;
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  updateEdges?: {
    id: string;
    confidence?: EdgeConfidence;
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  removeEdgeIds?: string[];
}

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const history = new UndoRedoManager<DiagramSnapshot>();

interface DiagramState {
  diagram: Diagram;
  framework: Framework;

  // Node operations
  addNode: (position: { x: number; y: number }) => string;
  updateNodeText: (id: string, label: string) => void;
  updateNodeTags: (id: string, tags: string[]) => void;
  updateNodeJunction: (id: string, type: 'and' | 'or') => void;
  updateNodeColor: (id: string, color: string | undefined) => void;
  updateNodeTextColor: (id: string, textColor: string | undefined) => void;
  updateNodeNotes: (id: string, notes: string) => void;
  toggleNodeLocked: (ids: string[], locked: boolean) => void;
  moveNodes: (changes: { id: string; position: { x: number; y: number } }[]) => void;
  deleteNodes: (ids: string[]) => void;

  // Edge operations
  addEdge: (
    source: string,
    target: string,
    handles?: {
      sourceHandleId?: string | null;
      targetHandleId?: string | null;
    },
  ) => { success: boolean; reason?: string };
  deleteEdges: (ids: string[]) => void;
  setEdgeConfidence: (id: string, confidence: EdgeConfidence) => void;
  setEdgePolarity: (id: string, polarity: EdgePolarity) => void;
  setEdgeDelay: (id: string, delay: boolean) => void;
  updateEdgeNotes: (id: string, notes: string) => void;
  optimizeEdges: () => boolean;

  // Diagram operations
  setFramework: (frameworkId: string) => void;
  updateSettings: (settings: Partial<DiagramSettings>) => void;
  loadDiagram: (diagram: Diagram) => void;
  newDiagram: () => void;
  setDiagramName: (name: string) => void;

  // Batch update (for AI modifications — single render)
  batchApply: (mutations: BatchMutations) => Map<string, string>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  commitToHistory: () => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  diagram: createDiagramForFramework(getDefaultFramework()),
  framework: getDefaultFramework(),

  addNode: (position) => {
    const id = crypto.randomUUID();
    const node: DiagramNode = {
      id,
      type: 'entity',
      position,
      data: {
        label: '',
        tags: [],
        junctionType: 'or',
      },
    };

    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: { ...s.diagram, nodes: [...s.diagram.nodes, node] },
      canUndo: true,
      canRedo: false,
    }));

    return id;
  },

  updateNodeText: (id, label) => {
    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n,
        ),
      },
    }));
  },

  updateNodeTags: (id, tags) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, tags } } : n,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  updateNodeJunction: (id, type) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, junctionType: type } } : n,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  updateNodeColor: (id, color) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, color } } : n,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  updateNodeTextColor: (id, textColor) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, textColor } } : n,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  updateNodeNotes: (id, notes) => {
    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, notes: notes || undefined } } : n,
        ),
      },
    }));
  },

  toggleNodeLocked: (ids, locked) => {
    const state = get();
    history.push(snapshot(state));
    const idSet = new Set(ids);
    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          idSet.has(n.id) ? { ...n, data: { ...n.data, locked: locked || undefined } } : n,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  moveNodes: (changes) => {
    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) => {
          const change = changes.find((c) => c.id === n.id);
          return change ? { ...n, position: change.position } : n;
        }),
      },
    }));
  },

  deleteNodes: (ids) => {
    const state = get();
    history.push(snapshot(state));

    const idSet = new Set(ids);
    set((s) => ({
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.filter((n) => !idSet.has(n.id)),
        edges: s.diagram.edges.filter(
          (e) => !idSet.has(e.source) && !idSet.has(e.target),
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  addEdge: (source, target, handles) => {
    const state = get();

    // Check for existing edge between the same source→target
    const existing = findExistingEdge(state.diagram.edges, source, target);
    if (existing) {
      // Always resolve sides so we can compare handles regardless of routing mode
      const newSides = resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, handles);
      const existingSides = resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, {
        sourceHandleId: existing.sourceSide ? `source-${existing.sourceSide}` : undefined,
        targetHandleId: existing.targetSide ? `target-${existing.targetSide}` : undefined,
      });

      if (newSides.sourceSide === existingSides.sourceSide &&
          newSides.targetSide === existingSides.targetSide) {
        return { success: false, reason: 'Edge already exists' };
      }

      // Different anchors — replace the existing edge
      if (state.diagram.settings.edgeRoutingMode === 'dynamic') {
        return { success: false, reason: 'dynamic-edge-move' };
      }
      history.push(snapshot(state));
      set((s) => ({
        diagram: {
          ...s.diagram,
          edges: s.diagram.edges.map((e) =>
            e.id === existing.id ? { ...e, ...newSides } : e,
          ),
        },
        canUndo: true,
        canRedo: false,
      }));
      return { success: true, reason: 'Edge moved' };
    }

    const result = validateEdge(state.diagram.edges, source, target, {
      allowCycles: state.framework.allowsCycles,
    });

    if (!result.valid) {
      return { success: false, reason: result.reason };
    }

    history.push(snapshot(state));

    const edge: DiagramEdge = {
      id: crypto.randomUUID(),
      source,
      target,
      ...(state.diagram.settings.edgeRoutingMode === 'fixed'
        ? resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, handles)
        : {}),
      ...getDefaultEdgeFields(state.framework),
    };

    // Check if target node now has indegree >= 2 — default junction to 'and'
    const targetIncomingCount =
      state.diagram.edges.filter((e) => e.target === target).length + 1;

    set((s) => {
      let nodes = s.diagram.nodes;
      if (state.framework.supportsJunctions && targetIncomingCount === 2) {
        nodes = nodes.map((n) =>
          n.id === target ? { ...n, data: { ...n.data, junctionType: 'or' as const } } : n,
        );
      }
      return {
        diagram: {
          ...s.diagram,
          nodes,
          edges: [...s.diagram.edges, edge],
        },
        canUndo: true,
        canRedo: false,
      };
    });

    return { success: true };
  },

  deleteEdges: (ids) => {
    const state = get();
    history.push(snapshot(state));

    const idSet = new Set(ids);
    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.filter((e) => !idSet.has(e.id)),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  batchApply: (mutations) => {
    const state = get();
    history.push(snapshot(state));

    const idMap = new Map<string, string>();
    let nodes = [...state.diagram.nodes];
    let edges = [...state.diagram.edges];

    nodes = batchAddNodes(mutations, idMap, nodes);
    nodes = batchUpdateNodes(mutations, idMap, nodes);
    ({ nodes, edges } = batchRemoveNodes(mutations, idMap, nodes, edges));
    ({ nodes, edges } = batchAddEdges(
      mutations,
      idMap,
      nodes,
      edges,
      state.framework,
      state.diagram.settings,
    ));
    edges = batchUpdateEdges(mutations, edges, state.framework);
    edges = batchRemoveEdges(mutations, edges);

    set({
      diagram: { ...state.diagram, nodes, edges },
      canUndo: true,
      canRedo: false,
    });

    return idMap;
  },

  setEdgeConfidence: (id, confidence) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.map((e) =>
          e.id === id ? { ...e, confidence } : e,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  setEdgePolarity: (id, polarity) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.map((e) =>
          e.id === id ? { ...e, polarity } : e,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  setEdgeDelay: (id, delay) => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.map((e) =>
          e.id === id ? { ...e, delay } : e,
        ),
      },
      canUndo: true,
      canRedo: false,
    }));
  },

  updateEdgeNotes: (id, notes) => {
    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.map((e) =>
          e.id === id ? { ...e, notes: notes || undefined } : e,
        ),
      },
    }));
  },

  optimizeEdges: () => {
    const state = get();
    if (state.diagram.settings.edgeRoutingMode !== 'fixed') return false;

    const optimizedEdges = captureOptimizedEdgeSides(
      state.diagram.edges,
      state.diagram.nodes,
      state.diagram.settings,
    );
    const changed = optimizedEdges.some((edge, index) => {
      const current = state.diagram.edges[index];
      return edge.sourceSide !== current?.sourceSide || edge.targetSide !== current?.targetSide;
    });

    if (!changed) return false;

    history.push(snapshot(state));
    set((s) => ({
      diagram: {
        ...s.diagram,
        edges: optimizedEdges,
      },
      canUndo: true,
      canRedo: false,
    }));
    return true;
  },

  setFramework: (frameworkId) => {
    const fw = getFramework(frameworkId);
    if (!fw) return;

    const state = get();
    history.push(snapshot(state));

    set({
      diagram: createDiagramForFramework(fw),
      framework: fw,
      canUndo: true,
      canRedo: false,
    });
  },

  updateSettings: (settings) => {
    set((s) => {
      const nextSettings = { ...s.diagram.settings, ...settings };
      const edgeRoutingModeChanged =
        settings.edgeRoutingMode !== undefined
        && settings.edgeRoutingMode !== s.diagram.settings.edgeRoutingMode;

        return {
          diagram: {
            ...s.diagram,
            settings: nextSettings,
            edges: edgeRoutingModeChanged && nextSettings.edgeRoutingMode === 'fixed'
            ? captureOptimizedEdgeSides(s.diagram.edges, s.diagram.nodes, nextSettings)
            : s.diagram.edges,
          },
        };
      });
  },

  loadDiagram: (diagram) => {
    const state = get();
    history.push(snapshot(state));

    const fw = getFramework(diagram.frameworkId) ?? state.framework;
    const settings: DiagramSettings = {
      layoutDirection: diagram.settings.layoutDirection,
      showGrid: diagram.settings.showGrid,
      snapToGrid: diagram.settings.snapToGrid ?? false,
      edgeRoutingMode: diagram.settings.edgeRoutingMode ?? 'dynamic',
    };
    set({
      diagram: {
        ...diagram,
        settings,
        edges: settings.edgeRoutingMode === 'fixed'
          ? ensureFixedEdgeSides(diagram.edges, diagram.nodes, settings)
          : diagram.edges,
      },
      framework: fw,
      canUndo: true,
      canRedo: false,
    });
  },

  newDiagram: () => {
    const state = get();
    history.push(snapshot(state));

    set((s) => ({
      diagram: createDiagramForFramework(s.framework),
      canUndo: true,
      canRedo: false,
    }));
  },

  setDiagramName: (name) => {
    set((s) => ({
      diagram: { ...s.diagram, name },
    }));
  },

  undo: () => {
    const state = get();
    const prev = history.undo(snapshot(state));
    if (prev) {
      set((s) => ({
        diagram: { ...s.diagram, nodes: prev.nodes, edges: prev.edges },
        canUndo: history.canUndo,
        canRedo: history.canRedo,
      }));
    }
  },

  redo: () => {
    const state = get();
    const next = history.redo(snapshot(state));
    if (next) {
      set((s) => ({
        diagram: { ...s.diagram, nodes: next.nodes, edges: next.edges },
        canUndo: history.canUndo,
        canRedo: history.canRedo,
      }));
    }
  },

  canUndo: false,
  canRedo: false,

  commitToHistory: () => {
    const state = get();
    history.push(snapshot(state));
    set({ canUndo: true, canRedo: false });
  },
}));

// Expose store for dev/testing in development mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__diagramStore = useDiagramStore;
  (window as unknown as Record<string, unknown>).__sketchy_addEdge = (
    source: string,
    target: string,
  ) => useDiagramStore.getState().addEdge(source, target);
}
