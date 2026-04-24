import { useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { mergeRFNodesWithLocalState } from './local-node-state';

interface UseReactFlowLocalStateOptions {
  rfNodes: Node[];
  rfEdges: Edge[];
}

export function useReactFlowLocalState({
  rfNodes,
  rfEdges,
}: UseReactFlowLocalStateOptions) {
  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);
  const latestRFNodeIdsRef = useRef<string[]>([]);

  useEffect(() => {
    latestRFNodeIdsRef.current = rfNodes.map((node) => node.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalNodes((prev) => mergeRFNodesWithLocalState(prev, rfNodes));
  }, [rfNodes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalEdges((prev) => {
      const selectionMap = new Map(prev.map((edge) => [edge.id, edge.selected]));
      return rfEdges.map((edge) => ({
        ...edge,
        selected: selectionMap.get(edge.id) ?? false,
      }));
    });
  }, [rfEdges]);

  return {
    localNodes,
    setLocalNodes,
    localEdges,
    setLocalEdges,
    latestRFNodeIdsRef,
  };
}
