import { create } from 'zustand';
import type { Diagram, DiagramEdge, DiagramNode, DiagramSettings } from '../core/types';
import { createEmptyDiagram } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge } from '../core/graph/validation';
import { UndoRedoManager } from '../core/history/undo-redo';

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
  updateNodeNotes: (id: string, notes: string) => void;
  moveNodes: (changes: { id: string; position: { x: number; y: number } }[]) => void;
  deleteNodes: (ids: string[]) => void;

  // Edge operations
  addEdge: (source: string, target: string) => { success: boolean; reason?: string };
  deleteEdges: (ids: string[]) => void;

  // Diagram operations
  setFramework: (frameworkId: string) => void;
  updateSettings: (settings: Partial<DiagramSettings>) => void;
  loadDiagram: (diagram: Diagram) => void;
  newDiagram: () => void;
  setDiagramName: (name: string) => void;

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

function snapshot(state: { diagram: Diagram }): DiagramSnapshot {
  return {
    nodes: state.diagram.nodes,
    edges: state.diagram.edges,
  };
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  diagram: createEmptyDiagram('crt'),
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

  setFramework: (frameworkId) => {
    const fw = getFramework(frameworkId);
    if (!fw) return;

    const state = get();
    history.push(snapshot(state));

    set({
      diagram: createEmptyDiagram(frameworkId),
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
      diagram: createEmptyDiagram(s.framework.id),
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
