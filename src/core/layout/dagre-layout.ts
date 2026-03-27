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

  // Compute dagre's top-left positions for all nodes
  const dagrePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const layoutNode = g.node(node.id);
    if (layoutNode) {
      dagrePositions.set(node.id, {
        x: layoutNode.x - NODE_WIDTH / 2,
        y: layoutNode.y - layoutNode.height / 2,
      });
    }
  }

  if (!options.respectPinned) {
    return nodes
      .filter((n) => dagrePositions.has(n.id))
      .map((n) => ({ id: n.id, position: dagrePositions.get(n.id)! }));
  }

  const pinnedNodes = nodes.filter((n) => n.pinned && dagrePositions.has(n.id));
  if (pinnedNodes.length === 0) {
    return nodes
      .filter((n) => dagrePositions.has(n.id))
      .map((n) => ({ id: n.id, position: dagrePositions.get(n.id)! }));
  }

  // Compute each pinned node's offset (actual position - dagre position)
  const pinnedOffsets = new Map<string, { dx: number; dy: number }>();
  for (const node of pinnedNodes) {
    const dagrePos = dagrePositions.get(node.id)!;
    pinnedOffsets.set(node.id, {
      dx: node.position.x - dagrePos.x,
      dy: node.position.y - dagrePos.y,
    });
  }

  // BFS from each unpinned node to find the nearest pinned node(s)
  // Build adjacency list (undirected — we want graph distance, not direction)
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)!.push(edge.target);
    adj.get(edge.target)!.push(edge.source);
  }

  function nearestPinnedOffset(startId: string): { dx: number; dy: number } {
    const found: { dx: number; dy: number }[] = [];
    let foundDist = -1;

    const distMap = new Map<string, number>();
    distMap.set(startId, 0);
    const queue = [startId];

    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      const currentDist = distMap.get(current)!;

      // If we already found pinned nodes at a closer distance, stop
      if (foundDist >= 0 && currentDist > foundDist) break;

      if (pinnedOffsets.has(current)) {
        found.push(pinnedOffsets.get(current)!);
        foundDist = currentDist;
      }

      for (const neighbor of adj.get(current) ?? []) {
        if (!distMap.has(neighbor)) {
          distMap.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      }
    }

    if (found.length === 0) {
      return { dx: 0, dy: 0 };
    }

    // Average the offsets of equidistant nearest pinned nodes
    const avg = { dx: 0, dy: 0 };
    for (const f of found) {
      avg.dx += f.dx;
      avg.dy += f.dy;
    }
    avg.dx /= found.length;
    avg.dy /= found.length;
    return avg;
  }

  const updates: NodePositionUpdate[] = [];
  for (const node of nodes) {
    if (node.pinned) continue;

    const dagrePos = dagrePositions.get(node.id);
    if (dagrePos) {
      const offset = nearestPinnedOffset(node.id);
      updates.push({
        id: node.id,
        position: {
          x: dagrePos.x + offset.dx,
          y: dagrePos.y + offset.dy,
        },
      });
    }
  }

  return updates;
}
