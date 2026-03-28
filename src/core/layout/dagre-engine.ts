import dagre from 'dagre';
import type { LayoutEngine } from './layout-engine';
import { RANK_SEP, NODE_SEP } from './layout-engine';

export const dagreEngine: LayoutEngine = async (nodes, edges, options) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes
    .map((node) => {
      const laid = g.node(node.id);
      if (!laid) return null;
      return {
        id: node.id,
        x: laid.x - node.width / 2,
        y: laid.y - laid.height / 2,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
};
