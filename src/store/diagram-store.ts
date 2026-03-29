import { create } from 'zustand';
import type { Diagram, DiagramEdge, DiagramNode, DiagramSettings, EdgeConfidence } from '../core/types';
import { createEmptyDiagram } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge } from '../core/graph/validation';
import { UndoRedoManager } from '../core/history/undo-redo';

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface BatchMutations {
  addNodes?: { id: string; label: string; tags?: string[]; notes?: string }[];
  updateNodes?: { id: string; label?: string; tags?: string[]; notes?: string }[];
  removeNodeIds?: string[];
  addEdges?: { source: string; target: string; confidence?: EdgeConfidence; notes?: string }[];
  updateEdges?: { id: string; confidence?: EdgeConfidence; notes?: string }[];
  removeEdgeIds?: string[];
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
  updateNodeNotes: (id: string, notes: string) => void;
  moveNodes: (changes: { id: string; position: { x: number; y: number } }[]) => void;
  deleteNodes: (ids: string[]) => void;

  // Edge operations
  addEdge: (source: string, target: string) => { success: boolean; reason?: string };
  deleteEdges: (ids: string[]) => void;
  setEdgeConfidence: (id: string, confidence: EdgeConfidence) => void;
  updateEdgeNotes: (id: string, notes: string) => void;

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

function getDefaultFramework(): Framework {
  const fw = getFramework('crt');
  if (!fw) throw new Error('CRT framework not registered');
  return fw;
}

function createDiagramForFramework(framework: Framework): Diagram {
  const diagram = createEmptyDiagram(framework.id);
  return {
    ...diagram,
    settings: {
      ...diagram.settings,
      layoutDirection: framework.defaultLayoutDirection,
    },
  };
}

function snapshot(state: { diagram: Diagram }): DiagramSnapshot {
  return {
    nodes: state.diagram.nodes,
    edges: state.diagram.edges,
  };
}

// --- Batch mutation helpers ---

function batchAddNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const n of mutations.addNodes ?? []) {
    const realId = crypto.randomUUID();
    idMap.set(n.id, realId);
    nodes.push({
      id: realId,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        tags: n.tags ?? [],
        junctionType: 'or',
        ...(n.notes ? { notes: n.notes } : {}),
      },
    });
  }
  return nodes;
}

function batchUpdateNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const upd of mutations.updateNodes ?? []) {
    const realId = idMap.get(upd.id) ?? upd.id;
    nodes = nodes.map((node) => {
      if (node.id !== realId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(upd.label !== undefined ? { label: upd.label } : {}),
          ...(upd.tags !== undefined ? { tags: upd.tags } : {}),
          ...(upd.notes !== undefined ? { notes: upd.notes || undefined } : {}),
        },
      };
    });
  }
  return nodes;
}

function batchRemoveNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  if (!mutations.removeNodeIds?.length) return { nodes, edges };
  const removeSet = new Set(mutations.removeNodeIds.map((id) => idMap.get(id) ?? id));
  return {
    nodes: nodes.filter((n) => !removeSet.has(n.id)),
    edges: edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)),
  };
}

function batchAddEdges(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of mutations.addEdges ?? []) {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    const result = validateEdge(edges, source, target);
    if (result.valid) {
      edges.push({
        id: crypto.randomUUID(),
        source,
        target,
        ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      });
      const incomingCount = edges.filter((ex) => ex.target === target).length;
      if (incomingCount === 2) {
        nodes = nodes.map((n) =>
          n.id === target ? { ...n, data: { ...n.data, junctionType: 'or' as const } } : n,
        );
      }
    }
  }
  return { nodes, edges };
}

function batchUpdateEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
): DiagramEdge[] {
  for (const upd of mutations.updateEdges ?? []) {
    const updates: Partial<DiagramEdge> = {};
    if (upd.confidence) updates.confidence = upd.confidence;
    if (upd.notes !== undefined) updates.notes = upd.notes || undefined;
    if (Object.keys(updates).length > 0) {
      edges = edges.map((e) =>
        e.id === upd.id ? { ...e, ...updates } : e,
      );
    }
  }
  return edges;
}

function batchRemoveEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
): DiagramEdge[] {
  if (!mutations.removeEdgeIds?.length) return edges;
  const removeSet = new Set(mutations.removeEdgeIds);
  return edges.filter((e) => !removeSet.has(e.id));
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

  addEdge: (source, target) => {
    const state = get();
    const result = validateEdge(state.diagram.edges, source, target);

    if (!result.valid) {
      return { success: false, reason: result.reason };
    }

    history.push(snapshot(state));

    const edge: DiagramEdge = {
      id: crypto.randomUUID(),
      source,
      target,
    };

    // Check if target node now has indegree >= 2 — default junction to 'and'
    const targetIncomingCount =
      state.diagram.edges.filter((e) => e.target === target).length + 1;

    set((s) => {
      let nodes = s.diagram.nodes;
      if (targetIncomingCount === 2) {
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
    ({ nodes, edges } = batchAddEdges(mutations, idMap, nodes, edges));
    edges = batchUpdateEdges(mutations, edges);
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
    set((s) => ({
      diagram: {
        ...s.diagram,
        settings: { ...s.diagram.settings, ...settings },
      },
    }));
  },

  loadDiagram: (diagram) => {
    const state = get();
    history.push(snapshot(state));

    const fw = getFramework(diagram.frameworkId) ?? state.framework;
    set({
      diagram,
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
}
