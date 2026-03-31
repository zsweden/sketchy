import type { DiagramEdge, DiagramNode } from '../types';
import type { AutoLayoutOptions, NodePositionUpdate } from './auto-layout';

export async function runElkAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: AutoLayoutOptions,
): Promise<NodePositionUpdate[]> {
  const [{ autoLayout }, { elkEngine }] = await Promise.all([
    import('./auto-layout'),
    import('./elk-engine'),
  ]);
  return autoLayout(nodes, edges, options, elkEngine);
}
