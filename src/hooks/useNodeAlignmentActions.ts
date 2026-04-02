import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../constants/layout';
import { useDiagramStore } from '../store/diagram-store';
import type { SizedPositionedItem } from '../utils/align-distribute';

function isSizedPositionedItem(item: SizedPositionedItem | null): item is SizedPositionedItem {
  return item != null;
}

export function useNodeAlignmentActions() {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const alignNodesHorizontally = useDiagramStore((s) => s.alignNodesHorizontally);
  const alignNodesVertically = useDiagramStore((s) => s.alignNodesVertically);
  const { getInternalNode } = useReactFlow();

  const buildBoundsSnapshots = useCallback((ids: string[]): SizedPositionedItem[] => (
    ids
      .map((id) => {
        const node = nodes.find((candidate) => candidate.id === id);
        if (!node) return null;

        const internalNode = getInternalNode(id);
        return {
          id,
          position: node.position,
          width: internalNode?.measured?.width ?? internalNode?.width ?? DEFAULT_NODE_WIDTH,
          height: internalNode?.measured?.height ?? internalNode?.height ?? DEFAULT_NODE_HEIGHT,
        };
      })
      .filter(isSizedPositionedItem)
  ), [getInternalNode, nodes]);

  const alignSelectedNodesHorizontally = useCallback((ids: string[]) => {
    alignNodesHorizontally(buildBoundsSnapshots(ids));
  }, [alignNodesHorizontally, buildBoundsSnapshots]);

  const alignSelectedNodesVertically = useCallback((ids: string[]) => {
    alignNodesVertically(buildBoundsSnapshots(ids));
  }, [alignNodesVertically, buildBoundsSnapshots]);

  return {
    alignSelectedNodesHorizontally,
    alignSelectedNodesVertically,
  };
}
