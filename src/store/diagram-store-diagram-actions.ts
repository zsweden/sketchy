import { getFramework } from '../frameworks/registry';
import { getAutomaticEdgeRoutingPlacement } from '../core/edge-routing';
import { resolveElkAlgorithm } from '../core/layout/elk-engine';
import { prepareLayoutNodes } from '../core/layout/layout-inputs';
import { computeLayoutMetrics, scoreLayoutMetrics } from '../core/layout/layout-metrics';
import { reportError } from '../core/monitoring/error-logging';
import { runElkAutoLayout } from '../core/layout/run-elk-auto-layout';
import { deriveDiagramFromTransition, getNextDiagramTransition } from '../transitions/registry';
import { useSettingsStore } from './settings-store';
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
  getOptimizedEdgePlacements,
  getStoredOrAutomaticEdgeSides,
} from './diagram-helpers';
import type { DiagramEdge, DiagramNode, DiagramSettings } from '../core/types';
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
      const startedAt = Date.now();
      const elkExperimentSettings = useSettingsStore.getState().elkExperimentSettings;
      const edgeRoutingPolicy = useSettingsStore.getState().edgeRoutingExperimentPolicy;

      let updates;
      try {
        updates = await runElkAutoLayout(state.diagram.nodes, state.diagram.edges, {
          direction: state.diagram.settings.layoutDirection,
          cyclic: state.framework.allowsCycles,
          elk: elkExperimentSettings,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useUIStore.getState().addToast(`Auto-layout failed: ${msg}`, 'error');
        void reportError(err, { source: 'layout.elk_error', fatal: false });
        return false;
      }

      if (updates.length === 0) {
        useSettingsStore.getState().setLastLayoutRun(null);
        return false;
      }

      if (commitHistory) {
        pushHistorySnapshot();
      }

      moveNodes(updates);
      get().optimizeEdgesAfterLayout();
      useSettingsStore.getState().setLastLayoutRun(
        computeLatestLayoutRun(
          get().diagram.nodes,
          get().diagram.edges,
          get().diagram.settings,
          Date.now() - startedAt,
          elkExperimentSettings.algorithmOverride,
          edgeRoutingPolicy,
          state.framework.allowsCycles,
        ),
      );

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
        const edgeRoutingPolicy = useSettingsStore.getState().edgeRoutingExperimentPolicy;
        const edgeRoutingModeChanged =
          settings.edgeRoutingMode !== undefined
          && settings.edgeRoutingMode !== state.diagram.settings.edgeRoutingMode;

        return {
          diagram: {
            ...state.diagram,
            settings: nextSettings,
            edges: edgeRoutingModeChanged && nextSettings.edgeRoutingMode === 'fixed'
              ? captureOptimizedEdgeSides(state.diagram.edges, state.diagram.nodes, nextSettings, edgeRoutingPolicy)
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

function computeLatestLayoutRun(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  settings: DiagramSettings,
  durationMs: number,
  algorithmOverride: ReturnType<typeof useSettingsStore.getState>['elkExperimentSettings']['algorithmOverride'],
  edgeRoutingPolicy: ReturnType<typeof useSettingsStore.getState>['edgeRoutingExperimentPolicy'],
  cyclic?: boolean,
) {
  if (nodes.length === 0) {
    return null;
  }

  const layoutNodes = prepareLayoutNodes(nodes, edges);
  const layoutNodesById = new Map(layoutNodes.map((node) => [node.id, node]));
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  const nodeBoxes = new Map(layoutNodes.map((node) => [
    node.id,
    {
      left: node.position?.x ?? 0,
      top: node.position?.y ?? 0,
      right: (node.position?.x ?? 0) + node.width,
      bottom: (node.position?.y ?? 0) + node.height,
    },
  ]));

  const optimizedPlacements = getOptimizedEdgePlacements(edges, nodes, settings, edgeRoutingPolicy);
  const layoutEdges = edges.map((edge) => {
    const sourceNode = layoutNodesById.get(edge.source);
    const targetNode = layoutNodesById.get(edge.target);

    const placement = edge.sourceSide && edge.targetSide && sourceNode && targetNode
      ? getStoredOrAutomaticEdgeSides(edge, nodes, settings)
      : optimizedPlacements.get(edge.id) ?? getAutomaticEdgeRoutingPlacement(
        { source: edge.source, target: edge.target },
        nodeBoxes,
        settings.layoutDirection,
      );

    return {
      source: edge.source,
      target: edge.target,
      sourceSide: placement.sourceSide,
      targetSide: placement.targetSide,
    };
  });

  const metrics = computeLayoutMetrics(layoutNodes, layoutEdges, positions, {
    layoutDirection: settings.layoutDirection,
    edgeRoutingPolicy,
  });

  return {
    metrics,
    score: Math.round(scoreLayoutMetrics(metrics) * 100) / 100,
    durationMs,
    algorithm: resolveElkAlgorithm(algorithmOverride, cyclic),
    direction: settings.layoutDirection,
  };
}
