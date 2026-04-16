import { useMemo } from 'react';
import {
  computeNodeDegrees,
  findCausalLoops,
  labelCausalLoops,
  type NamedCausalLoop,
  type NodeDegrees,
} from '../core/graph/derived';
import type { DiagramEdge } from '../core/types';

interface GraphDerivations {
  degreesMap: Map<string, NodeDegrees>;
  labeledLoops: NamedCausalLoop[];
}

export function useGraphDerivations(
  edges: DiagramEdge[],
  allowsCycles: boolean | undefined,
): GraphDerivations {
  const degreesMap = useMemo(() => computeNodeDegrees(edges), [edges]);
  const labeledLoops = useMemo(
    () => (allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : []),
    [edges, allowsCycles],
  );
  return { degreesMap, labeledLoops };
}
