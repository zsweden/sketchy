import dagre from 'dagre';
import type { DiagramEdge, DiagramNode } from '../types';
import type { LayoutDirection } from '../framework-types';

interface LayoutOptions {
  direction: LayoutDirection;
  respectPinned: boolean;
}

interface NodePositionUpdate {
  id: string;
  position: { x: number; y: number };
}

const NODE_WIDTH = 240;
const MIN_NODE_HEIGHT = 48;
const RANK_SEP = 80;
const NODE_SEP = 40;

function estimateHeight(label: string): number {
  const charsPerLine = 30;
  const lineHeight = 24;
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  return Math.max(MIN_NODE_HEIGHT, lines * lineHeight + 24);
}

export function autoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: LayoutOptions,
): NodePositionUpdate[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
  });

  for (const node of nodes) {
    const height = estimateHeight(node.data.label);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const updates: NodePositionUpdate[] = [];
  for (const node of nodes) {
    if (options.respectPinned && node.pinned) continue;

    const layoutNode = g.node(node.id);
    if (layoutNode) {
      updates.push({
        id: node.id,
        position: {
          x: layoutNode.x - NODE_WIDTH / 2,
          y: layoutNode.y - layoutNode.height / 2,
        },
      });
    }
  }

  return updates;
}
