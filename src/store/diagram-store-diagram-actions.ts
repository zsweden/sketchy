import { getFramework, getDefaultFramework } from '../frameworks/registry';
import { DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { reportError } from '../core/monitoring/error-logging';
import { runElkAutoLayout } from '../core/layout/run-elk-auto-layout';
import { uiEvents } from './ui-events';
import {
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
  resolveFramework,
} from './diagram-helpers';
import type { DiagramSettings } from '../core/types';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export function createDiagramActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'batchApply'
  | 'runAutoLayout'
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
    uiEvents.emit('viewportFocus', { kind: 'node', id: nodeId });
  };

  return {
    batchApply: (mutations) => {
      const state = get();
      const framework = resolveFramework(state.diagram.frameworkId);
      pushHistorySnapshot();

      const idMap = new Map<string, string>();
      let nodes = [...state.diagram.nodes];
      let edges = [...state.diagram.edges];

      nodes = batchAddNodes(mutations, idMap, nodes, framework);
      nodes = batchUpdateNodes(mutations, idMap, nodes);
      ({ nodes, edges } = batchRemoveNodes(mutations, idMap, nodes, edges));
      ({ nodes, edges } = batchAddEdges(
        mutations,
        idMap,
        nodes,
        edges,
        framework,
        state.diagram.settings,
      ));
      edges = batchUpdateEdges(mutations, edges, framework);
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
          cyclic: resolveFramework(state.diagram.frameworkId).allowsCycles,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        uiEvents.emit('toastError', `Auto-layout failed: ${msg}`);
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
        uiEvents.emit('fitView');
      }
      uiEvents.emit('edgeRefresh');

      return true;
    },

    setFramework: (frameworkId) => {
      const framework = getFramework(frameworkId);
      if (!framework) return;

      pushHistorySnapshot();
      const diagram = createDiagramForFramework(framework);

      set({
        diagram,
        ...undoState,
      });
      focusInitialNode(diagram.nodes[0]?.id);
      uiEvents.emit('edgeRefresh');
    },

    updateSettings: (settings) => {
      set((state) => {
        const nextSettings = { ...state.diagram.settings, ...settings };
        const edgeRoutingModeChanged =
          settings.edgeRoutingMode !== undefined
          && settings.edgeRoutingMode !== state.diagram.settings.edgeRoutingMode;

        const fw = resolveFramework(state.diagram.frameworkId);
        const edgeRoutingConfig = fw.allowsCycles
          ? { ...DEFAULT_EDGE_ROUTING_CONFIG, flowAlignedBonus: 0 }
          : DEFAULT_EDGE_ROUTING_CONFIG;

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
                edgeRoutingConfig,
              )
              : state.diagram.edges,
          },
        };
      });
    },

    loadDiagram: (diagram) => {
      pushHistorySnapshot();

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
        ...undoState,
      });
      uiEvents.emit('edgeRefresh');
    },

    newDiagram: () => {
      pushHistorySnapshot();
      const diagram = createDiagramForFramework(resolveFramework(get().diagram.frameworkId));

      set({
        diagram,
        ...undoState,
      });
      focusInitialNode(diagram.nodes[0]?.id);
      uiEvents.emit('edgeRefresh');
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
