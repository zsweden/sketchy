import { useMemo } from 'react';
import { useUIStore } from '../store/ui-store';
import { useDiagramStore, useFramework } from '../store/diagram-store';
import {
  computeNodeDegrees,
  findCausalLoops,
  getConnectedSubgraph,
  getLoopSubgraph,
  labelCausalLoops,
  type ConnectedSubgraph,
  type NamedCausalLoop,
  type NodeDegrees,
} from '../core/graph/derived';

interface CanvasHighlighting {
  selectedLoop: NamedCausalLoop | null;
  highlightSets: ConnectedSubgraph | null;
  degreesMap: Map<string, NodeDegrees>;
}

export function useCanvasHighlighting(): CanvasHighlighting {
  const edges = useDiagramStore((s) => s.diagram.edges);
  const framework = useFramework();
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);

  const degreesMap = useMemo(() => computeNodeDegrees(edges), [edges]);

  const selectedLoop = useMemo(() => {
    if (!framework.allowsCycles || !selectedLoopId) return null;
    return labelCausalLoops(findCausalLoops(edges))
      .find((loop) => loop.id === selectedLoopId) ?? null;
  }, [edges, framework.allowsCycles, selectedLoopId]);

  const highlightSets = useMemo(() => {
    if (selectedLoop) return getLoopSubgraph(selectedLoop);
    if (selectedNodeIds.length === 1) {
      return getConnectedSubgraph(edges, selectedNodeIds[0]);
    }
    if (selectedEdgeIds.length === 1 && selectedNodeIds.length === 0) {
      const edge = edges.find((e) => e.id === selectedEdgeIds[0]);
      if (edge) {
        return {
          nodeIds: new Set([edge.source, edge.target]),
          edgeIds: new Set([edge.id]),
        };
      }
    }
    return null;
  }, [selectedLoop, selectedNodeIds, selectedEdgeIds, edges]);

  return { selectedLoop, highlightSets, degreesMap };
}
