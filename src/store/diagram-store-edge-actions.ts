import { DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { findExistingEdge, validateEdge } from '../core/graph/validation';
import {
  getDefaultEdgeFields,
  resolveEdgeSides,
  captureOptimizedEdgeSides,
  resolveFramework,
} from './diagram-helpers';
import { getDefaultJunctionType } from '../core/framework-types';
import type { DiagramEdge, JunctionType } from '../core/types';
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
  | 'setEdgeTag'
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

      const framework = resolveFramework(state.diagram.frameworkId);
      const result = validateEdge(state.diagram.edges, source, target, {
        allowCycles: framework.allowsCycles,
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
        ...getDefaultEdgeFields(framework),
      };

      const targetIncomingCount =
        state.diagram.edges.filter((existingEdge) => existingEdge.target === target).length + 1;

      set((storeState) => {
        let nodes = storeState.diagram.nodes;
        if (framework.supportsJunctions && targetIncomingCount === 2) {
          const defaultJunction = getDefaultJunctionType(framework) as JunctionType;
          nodes = nodes.map((node) =>
            node.id === target ? { ...node, data: { ...node.data, junctionType: defaultJunction } } : node,
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

    setEdgeTag: (id, edgeTag) => {
      updateEdges(
        (edge) => (edge.id === id ? { ...edge, edgeTag: edgeTag || undefined } : edge),
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

    optimizeEdges: () => {
      const state = get();
      if (state.diagram.settings.edgeRoutingMode !== 'fixed') return false;

      const fw = resolveFramework(state.diagram.frameworkId);
      const config = fw.allowsCycles
        ? { ...DEFAULT_EDGE_ROUTING_CONFIG, flowAlignedBonus: 0 }
        : DEFAULT_EDGE_ROUTING_CONFIG;

      const optimizedEdges = captureOptimizedEdgeSides(
        state.diagram.edges,
        state.diagram.nodes,
        state.diagram.settings,
        DEFAULT_EDGE_ROUTING_POLICY,
        config,
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

      const fw = resolveFramework(state.diagram.frameworkId);
      const config = fw.allowsCycles
        ? { ...DEFAULT_EDGE_ROUTING_CONFIG, flowAlignedBonus: 0 }
        : DEFAULT_EDGE_ROUTING_CONFIG;

      const optimizedEdges = captureOptimizedEdgeSides(
        state.diagram.edges,
        state.diagram.nodes,
        state.diagram.settings,
        DEFAULT_EDGE_ROUTING_POLICY,
        config,
      );
      setDiagram((diagram) => ({ ...diagram, edges: optimizedEdges }));
    },
  };
}
