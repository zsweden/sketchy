import { findExistingEdge, validateEdge } from '../core/graph/validation';
import {
  getDefaultEdgeFields,
  resolveEdgeSides,
  captureOptimizedEdgeSides,
} from './diagram-helpers';
import { DEFAULT_EDGE_ROUTING_ALGORITHM, type EdgeRoutingAlgorithmId } from '../core/edge-routing';
import type { DiagramEdge } from '../core/types';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export function createDiagramEdgeActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'addEdge'
  | 'deleteEdges'
  | 'setEdgeConfidence'
  | 'setEdgePolarity'
  | 'setEdgeDelay'
  | 'updateEdgeNotes'
  | 'commitEdgeNotes'
  | 'optimizeEdges'
  | 'optimizeEdgesAfterLayout'
> {
  const { applyDiagramChange, get, set, setDiagram, pushHistorySnapshot, undoState, updateEdges } = context;

  return {
    addEdge: (source, target, handles) => {
      const state = get();

      const existing = findExistingEdge(state.diagram.edges, source, target);
      if (existing) {
        const newSides = resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, handles);
        const existingSides = resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, {
          sourceHandleId: existing.sourceSide ? `source-${existing.sourceSide}` : undefined,
          targetHandleId: existing.targetSide ? `target-${existing.targetSide}` : undefined,
        });

        if (newSides.sourceSide === existingSides.sourceSide &&
            newSides.targetSide === existingSides.targetSide) {
          return { success: false, reason: 'Edge already exists' };
        }

        if (state.diagram.settings.edgeRoutingMode === 'dynamic') {
          return { success: false, reason: 'dynamic-edge-move' };
        }

        pushHistorySnapshot();
        set((storeState) => ({
          diagram: {
            ...storeState.diagram,
            edges: storeState.diagram.edges.map((edge) =>
              edge.id === existing.id ? { ...edge, ...newSides } : edge,
            ),
          },
          ...undoState,
        }));
        return { success: true, reason: 'Edge moved' };
      }

      const result = validateEdge(state.diagram.edges, source, target, {
        allowCycles: state.framework.allowsCycles,
      });

      if (!result.valid) {
        return { success: false, reason: result.reason };
      }

      pushHistorySnapshot();

      const edge: DiagramEdge = {
        id: crypto.randomUUID(),
        source,
        target,
        ...(state.diagram.settings.edgeRoutingMode === 'fixed'
          ? resolveEdgeSides(source, target, state.diagram.nodes, state.diagram.settings, handles)
          : {}),
        ...getDefaultEdgeFields(state.framework),
      };

      const targetIncomingCount =
        state.diagram.edges.filter((existingEdge) => existingEdge.target === target).length + 1;

      set((storeState) => {
        let nodes = storeState.diagram.nodes;
        if (state.framework.supportsJunctions && targetIncomingCount === 2) {
          nodes = nodes.map((node) =>
            node.id === target ? { ...node, data: { ...node.data, junctionType: 'or' as const } } : node,
          );
        }
        return {
          diagram: {
            ...storeState.diagram,
            nodes,
            edges: [...storeState.diagram.edges, edge],
          },
          ...undoState,
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

    commitEdgeNotes: (id, notes) => {
      updateEdges(
        (edge) => (edge.id === id ? { ...edge, notes: notes || undefined } : edge),
        { trackHistory: true },
      );
    },

    optimizeEdges: (algorithm: EdgeRoutingAlgorithmId = DEFAULT_EDGE_ROUTING_ALGORITHM) => {
      const state = get();
      if (state.diagram.settings.edgeRoutingMode !== 'fixed') return false;

      const optimizedEdges = captureOptimizedEdgeSides(
        state.diagram.edges,
        state.diagram.nodes,
        state.diagram.settings,
        algorithm,
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
  };
}
