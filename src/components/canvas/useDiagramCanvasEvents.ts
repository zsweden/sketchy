import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useUIEvent } from '../../store/ui-events';
import { useUIStore } from '../../store/ui-store';

interface UseDiagramCanvasEventsOptions {
  latestRFNodeIdsRef: MutableRefObject<string[]>;
  setLocalNodes: Dispatch<SetStateAction<Node[]>>;
  setLocalEdges: Dispatch<SetStateAction<Edge[]>>;
  updateNodeInternals: (id: string | string[]) => void;
}

export function useDiagramCanvasEvents({
  latestRFNodeIdsRef,
  setLocalNodes,
  setLocalEdges,
  updateNodeInternals,
}: UseDiagramCanvasEventsOptions) {
  useUIEvent('edgeRefresh', () => {
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        const nodeIds = latestRFNodeIdsRef.current;
        if (nodeIds.length > 0) updateNodeInternals(nodeIds);
      });
    });

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  });

  useUIEvent('selectionSync', () => {
    const {
      selectedNodeIds: nodeIds,
      selectedEdgeIds: edgeIds,
    } = useUIStore.getState();
    const nodeSet = new Set(nodeIds);
    const edgeSet = new Set(edgeIds);
    setLocalNodes((nodes) => nodes.map((node) => ({
      ...node,
      selected: nodeSet.has(node.id),
    })));
    setLocalEdges((edges) => edges.map((edge) => ({
      ...edge,
      selected: edgeSet.has(edge.id),
    })));
  });
}
