import { create } from 'zustand';
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgeConfidence,
  EdgePolarity,
} from '../core/types';
import { createEmptyDiagram } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge, findExistingEdge } from '../core/graph/validation';
import { UndoRedoManager } from '../core/history/undo-redo';
import { getEdgeHandlePlacement, getSideFromHandleId } from '../core/graph/ports';

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

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

function getDefaultEdgeFields(framework: Framework): Pick<DiagramEdge, 'polarity' | 'delay'> {
  return {
    ...(framework.supportsEdgePolarity ? { polarity: 'positive' as const } : {}),
    ...(framework.supportsEdgeDelay ? { delay: false } : {}),
  };
}

function getNodePositionMap(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  return new Map(nodes.map((node) => [node.id, node.position]));
}

function resolveEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
  handles?: {
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  },
): Pick<DiagramEdge, 'sourceSide' | 'targetSide'> {
  const explicitSourceSide = getSideFromHandleId(handles?.sourceHandleId, 'source');
  const explicitTargetSide = getSideFromHandleId(handles?.targetHandleId, 'target');

  if (explicitSourceSide && explicitTargetSide) {
    return {
      sourceSide: explicitSourceSide,
      targetSide: explicitTargetSide,
    };
  }

  const positions = getNodePositionMap(nodes);
  const placement = getEdgeHandlePlacement(
    positions.get(source),
    positions.get(target),
    settings.layoutDirection,
  );

  return {
    sourceSide: explicitSourceSide ?? placement.sourceSide,
    targetSide: explicitTargetSide ?? placement.targetSide,
  };
}

function freezeEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  return edges.map((edge) => ({
    ...edge,
    ...resolveEdgeSides(edge.source, edge.target, nodes, settings, {
      sourceHandleId: edge.sourceSide ? `source-${edge.sourceSide}` : undefined,
      targetHandleId: edge.targetSide ? `target-${edge.targetSide}` : undefined,
    }),
  }));
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
  framework: Framework,
  settings: DiagramSettings,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of mutations.addEdges ?? []) {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    const result = validateEdge(edges, source, target, {
      allowCycles: framework.allowsCycles,
    });
    if (result.valid) {
      const routingSides = settings.edgeRoutingMode === 'fixed'
        ? resolveEdgeSides(source, target, nodes, settings)
        : {};
      edges.push({
        id: crypto.randomUUID(),
        source,
        target,
        ...routingSides,
        ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
        ...(framework.supportsEdgePolarity ? { polarity: e.polarity ?? 'positive' as const } : {}),
        ...(framework.supportsEdgeDelay && e.delay ? { delay: true } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      });
      const incomingCount = edges.filter((ex) => ex.target === target).length;
      if (framework.supportsJunctions && incomingCount === 2) {
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
  framework: Framework,
): DiagramEdge[] {
  for (const upd of mutations.updateEdges ?? []) {
    const updates: Partial<DiagramEdge> = {};
    if (upd.confidence) updates.confidence = upd.confidence;
    if (framework.supportsEdgePolarity && upd.polarity) updates.polarity = upd.polarity;
    if (framework.supportsEdgeDelay && upd.delay !== undefined) updates.delay = upd.delay;
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

  addEdge: (source, target, handles) => {
    const state = get();

    // Check for existing edge between the same source→target
    const existing = findExistingEdge(state.diagram.edges, source, target);
    if (existing) {
      const newSides = state.diagram.settings.edgeRoutingMode === 'fixed'
        ? resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, handles)
        : {};
      const sameAnchors =
        existing.sourceSide === (newSides.sourceSide ?? existing.sourceSide) &&
        existing.targetSide === (newSides.targetSide ?? existing.targetSide);

      if (sameAnchors) {
        return { success: false, reason: 'Edge already exists' };
      }

      // Different anchors — replace the existing edge
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
            ? freezeEdgeSides(s.diagram.edges, s.diagram.nodes, nextSettings)
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
      edgeRoutingMode: diagram.settings.edgeRoutingMode ?? 'dynamic',
    };
    set({
      diagram: {
        ...diagram,
        settings,
        edges: settings.edgeRoutingMode === 'fixed'
          ? freezeEdgeSides(diagram.edges, diagram.nodes, settings)
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
}
