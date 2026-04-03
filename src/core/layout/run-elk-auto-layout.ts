import type { DiagramEdge, DiagramNode } from '../types';
import { autoLayout, type AutoLayoutOptions, type NodePositionUpdate } from './auto-layout';
import { elkEngine } from './elk-engine';

export async function runElkAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: AutoLayoutOptions,
): Promise<NodePositionUpdate[]> {
  return autoLayout(nodes, edges, options, elkEngine);
}
