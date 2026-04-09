import type { DiagramEdge, DiagramNode } from '../types';
import { computeNodeDegrees } from '../graph/derived';
import { NODE_WIDTH, estimateHeight } from './layout-engine';
import type { LayoutEdgeInput, LayoutInput } from './layout-engine';

export function prepareLayoutNodes(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): LayoutInput[] {
  const degrees = computeNodeDegrees(edges);

  return nodes.map((node) => {
    const degree = degrees.get(node.id) ?? { indegree: 0, outdegree: 0 };
    const hasBadges = node.data.tags.length > 0
      || (degree.indegree === 0 && degree.outdegree > 0)
      || (degree.indegree > 0 && degree.outdegree > 0);

    return {
      id: node.id,
      width: NODE_WIDTH,
      height: estimateHeight(node.data.label, hasBadges),
      position: node.position,
      locked: node.data.locked,
    };
  });
}

export function prepareLayoutEdges(edges: DiagramEdge[]): LayoutEdgeInput[] {
  return edges.map((edge) => ({ source: edge.source, target: edge.target }));
}

