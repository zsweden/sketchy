import { getFramework } from '../frameworks/registry';
import { DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { reportError } from '../core/monitoring/error-logging';
import { runElkAutoLayout } from '../core/layout/run-elk-auto-layout';
import { deriveDiagramFromTransition, getNextDiagramTransition } from '../transitions/registry';
import { useUIStore } from './ui-store';
import {
  getDefaultFramework,
  createDiagramForFramework,
  ensureFixedEdgeSides,
  batchAddNodes,
  batchUpdateNodes,
  batchRemoveNodes,
  batchAddEdges,
  batchUpdateEdges,
  batchRemoveEdges,
  snapshot,
  captureOptimizedEdgeSides,
} from './diagram-helpers';
import type { DiagramSettings } from '../core/types';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export function createDiagramActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'batchApply'
  | 'runAutoLayout'
  | 'deriveNextDiagram'
  | 'setFramework'
  | 'updateSettings'
  | 'loadDiagram'
  | 'newDiagram'
  | 'setDiagramName'
  | 'undo'
  | 'redo'
  | 'commitToHistory'
> {
  const { get, history, moveNodes, pushHistorySnapshot, set, undoState, clearPendingNodeMove } = context;
  const focusInitialNode = (nodeId?: string) => {
    if (!nodeId) return;
    useUIStore.getState().focusGraphObject({ kind: 'node', id: nodeId });
  };

  return {
    batchApply: (mutations) => {
      const state = get();
      pushHistorySnapshot();

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
        ...undoState,
      });

      return idMap;
    },

    runAutoLayout: async ({ commitHistory = false, fitView = true } = {}) => {
      const state = get();

      let updates;
      try {
        updates = await runElkAutoLayout(state.diagram.nodes, state.diagram.edges, {
          direction: state.diagram.settings.layoutDirection,
          cyclic: state.framework.allowsCycles,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useUIStore.getState().addToast(`Auto-layout failed: ${msg}`, 'error');
        void reportError(err, { source: 'layout.elk_error', fatal: false });
        return false;
      }

      if (updates.length === 0) {
        return false;
      }

      if (commitHistory) {
        pushHistorySnapshot();
      }

      moveNodes(updates);
      get().optimizeEdgesAfterLayout();

      if (commitHistory) {
        set(undoState);
      }
      if (fitView) {
        useUIStore.getState().requestFitView();
      }

      return true;
    },

    deriveNextDiagram: async () => {
      const state = get();
      const transition = getNextDiagramTransition(state.framework.id);
      if (!transition) {
        return false;
      }

      const result = deriveDiagramFromTransition(state.diagram, transition.id);
      const framework = getFramework(transition.targetFrameworkId);
      if (!result || !framework) {
        return false;
      }

      clearPendingNodeMove();
      history.clear();
      set({
        diagram: result.diagram,
        framework,
        canUndo: false,
        canRedo: false,
      });

      const laidOut = await get().runAutoLayout({ fitView: true });
      if (!laidOut) {
        useUIStore.getState().requestFitView();
      }

      return true;
    },

    setFramework: (frameworkId) => {
      const framework = getFramework(frameworkId);
      if (!framework) return;

      pushHistorySnapshot();
      const diagram = createDiagramForFramework(framework);

      set({
        diagram,
        framework,
        ...undoState,
      });
      focusInitialNode(diagram.nodes[0]?.id);
    },

    updateSettings: (settings) => {
      set((state) => {
        const nextSettings = { ...state.diagram.settings, ...settings };
        const edgeRoutingModeChanged =
          settings.edgeRoutingMode !== undefined
          && settings.edgeRoutingMode !== state.diagram.settings.edgeRoutingMode;

        return {
          diagram: {
            ...state.diagram,
            settings: nextSettings,
            edges: edgeRoutingModeChanged && nextSettings.edgeRoutingMode === 'fixed'
              ? captureOptimizedEdgeSides(
                state.diagram.edges,
                state.diagram.nodes,
                nextSettings,
                DEFAULT_EDGE_ROUTING_POLICY,
              )
              : state.diagram.edges,
          },
        };
      });
    },

    loadDiagram: (diagram) => {
      const state = get();
      pushHistorySnapshot();

      const framework = getFramework(diagram.frameworkId) ?? state.framework;
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
        framework,
        ...undoState,
      });
    },

    newDiagram: () => {
      pushHistorySnapshot();
      const diagram = createDiagramForFramework(get().framework);

      set({
        diagram,
        ...undoState,
      });
      focusInitialNode(diagram.nodes[0]?.id);
    },

    setDiagramName: (name) => {
      set((state) => ({
        diagram: { ...state.diagram, name },
      }));
    },

    undo: () => {
      clearPendingNodeMove();
      const state = get();
      const prev = history.undo(snapshot(state));
      if (prev) {
        set((storeState) => ({
          diagram: { ...storeState.diagram, nodes: prev.nodes, edges: prev.edges },
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        }));
      }
    },

    redo: () => {
      clearPendingNodeMove();
      const state = get();
      const next = history.redo(snapshot(state));
      if (next) {
        set((storeState) => ({
          diagram: { ...storeState.diagram, nodes: next.nodes, edges: next.edges },
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        }));
      }
    },

    commitToHistory: () => {
      pushHistorySnapshot();
      set(undoState);
    },
  };
}

export const initialFramework = getDefaultFramework();
