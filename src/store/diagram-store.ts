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
import { runElkAutoLayout } from '../core/layout/run-elk-auto-layout';
import { useUIStore } from './ui-store';
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
const UNDO_STATE = { canUndo: true, canRedo: false } as const;

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
  optimizeEdgesAfterLayout: () => void;
  runAutoLayout: (options?: { commitHistory?: boolean; fitView?: boolean }) => Promise<boolean>;

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

export const useDiagramStore = create<DiagramState>((set, get) => {
  const setDiagram = (updater: (diagram: Diagram) => Diagram) => {
    set((state) => ({ diagram: updater(state.diagram) }));
  };

  const applyDiagramChange = (
    updater: (diagram: Diagram) => Diagram,
    options: { trackHistory?: boolean } = {},
  ) => {
    if (options.trackHistory) {
      history.push(snapshot(get()));
    }

    set((state) => ({
      diagram: updater(state.diagram),
      ...(options.trackHistory ? UNDO_STATE : {}),
    }));
  };

  const updateNodes = (
    mapper: (node: DiagramNode) => DiagramNode,
    options: { trackHistory?: boolean } = {},
  ) => {
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map(mapper),
      }),
      options,
    );
  };

  const updateEdges = (
    mapper: (edge: DiagramEdge) => DiagramEdge,
    options: { trackHistory?: boolean } = {},
  ) => {
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        edges: diagram.edges.map(mapper),
      }),
      options,
    );
  };

  return {
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

    applyDiagramChange(
      (diagram) => ({ ...diagram, nodes: [...diagram.nodes, node] }),
      { trackHistory: true },
    );

    return id;
  },

  updateNodeText: (id, label) => {
    updateNodes((node) =>
      node.id === id ? { ...node, data: { ...node.data, label } } : node,
    );
  },

  updateNodeTags: (id, tags) => {
    updateNodes(
      (node) => (node.id === id ? { ...node, data: { ...node.data, tags } } : node),
      { trackHistory: true },
    );
  },

  updateNodeJunction: (id, type) => {
    updateNodes(
      (node) => (
        node.id === id ? { ...node, data: { ...node.data, junctionType: type } } : node
      ),
      { trackHistory: true },
    );
  },

  updateNodeColor: (id, color) => {
    updateNodes(
      (node) => (node.id === id ? { ...node, data: { ...node.data, color } } : node),
      { trackHistory: true },
    );
  },

  updateNodeTextColor: (id, textColor) => {
    updateNodes(
      (node) => (
        node.id === id ? { ...node, data: { ...node.data, textColor } } : node
      ),
      { trackHistory: true },
    );
  },

  updateNodeNotes: (id, notes) => {
    updateNodes((node) => (
      node.id === id
        ? { ...node, data: { ...node.data, notes: notes || undefined } }
        : node
    ));
  },

  toggleNodeLocked: (ids, locked) => {
    const idSet = new Set(ids);
    updateNodes(
      (node) => (
        idSet.has(node.id)
          ? { ...node, data: { ...node.data, locked: locked || undefined } }
          : node
      ),
      { trackHistory: true },
    );
  },

  moveNodes: (changes) => {
    const positions = new Map(changes.map((change) => [change.id, change.position]));
    setDiagram((diagram) => ({
      ...diagram,
      nodes: diagram.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      }),
    }));
  },

  deleteNodes: (ids) => {
    const idSet = new Set(ids);
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.filter((node) => !idSet.has(node.id)),
        edges: diagram.edges.filter((edge) => !idSet.has(edge.source) && !idSet.has(edge.target)),
      }),
      { trackHistory: true },
    );
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
        ...UNDO_STATE,
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
        ...UNDO_STATE,
      };
    });

    return { success: true };
  },

  deleteEdges: (ids) => {
    const idSet = new Set(ids);
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        edges: diagram.edges.filter((edge) => !idSet.has(edge.id)),
      }),
      { trackHistory: true },
    );
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
      ...UNDO_STATE,
    });

    return idMap;
  },

  setEdgeConfidence: (id, confidence) => {
    updateEdges(
      (edge) => (edge.id === id ? { ...edge, confidence } : edge),
      { trackHistory: true },
    );
  },

  setEdgePolarity: (id, polarity) => {
    updateEdges(
      (edge) => (edge.id === id ? { ...edge, polarity } : edge),
      { trackHistory: true },
    );
  },

  setEdgeDelay: (id, delay) => {
    updateEdges(
      (edge) => (edge.id === id ? { ...edge, delay } : edge),
      { trackHistory: true },
    );
  },

  updateEdgeNotes: (id, notes) => {
    updateEdges((edge) => (
      edge.id === id ? { ...edge, notes: notes || undefined } : edge
    ));
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

    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        edges: optimizedEdges,
      }),
      { trackHistory: true },
    );
    return true;
  },

  optimizeEdgesAfterLayout: () => {
    const state = get();
    if (state.diagram.settings.edgeRoutingMode !== 'fixed') return;
    const optimizedEdges = captureOptimizedEdgeSides(
      state.diagram.edges,
      state.diagram.nodes,
      state.diagram.settings,
    );
    setDiagram((diagram) => ({ ...diagram, edges: optimizedEdges }));
  },

  runAutoLayout: async ({ commitHistory = false, fitView = true } = {}) => {
    const state = get();
    const updates = await runElkAutoLayout(state.diagram.nodes, state.diagram.edges, {
      direction: state.diagram.settings.layoutDirection,
      cyclic: state.framework.allowsCycles,
    });

    if (updates.length === 0) {
      return false;
    }

    if (commitHistory) {
      history.push(snapshot(get()));
    }

    get().moveNodes(updates);
    get().optimizeEdgesAfterLayout();

    if (commitHistory) {
      set(UNDO_STATE);
    }
    if (fitView) {
      useUIStore.getState().requestFitView();
    }

    return true;
  },

  setFramework: (frameworkId) => {
    const fw = getFramework(frameworkId);
    if (!fw) return;

    history.push(snapshot(get()));

    set({
      diagram: createDiagramForFramework(fw),
      framework: fw,
      ...UNDO_STATE,
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
      ...UNDO_STATE,
    });
  },

  newDiagram: () => {
    history.push(snapshot(get()));

    set((state) => ({
      diagram: createDiagramForFramework(state.framework),
      ...UNDO_STATE,
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
    set(UNDO_STATE);
  },
  };
});

// Expose store for dev/testing in development mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__diagramStore = useDiagramStore;
  (window as unknown as Record<string, unknown>).__sketchy_addEdge = (
    source: string,
    target: string,
  ) => useDiagramStore.getState().addEdge(source, target);
}
