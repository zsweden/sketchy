import type { DiagramNode, DiagramEdge } from '../types';
import type { LayoutDirection } from '../framework-types';
import type { LayoutEngine } from './layout-engine';
import { NODE_WIDTH, MIN_NODE_HEIGHT, estimateHeight } from './layout-engine';

export interface AutoLayoutOptions {
  direction: LayoutDirection;
  respectPinned: boolean;
}

export interface NodePositionUpdate {
  id: string;
  position: { x: number; y: number };
}

export async function autoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: AutoLayoutOptions,
  engine: LayoutEngine,
): Promise<NodePositionUpdate[]> {
  const inputs = nodes.map((n) => ({
    id: n.id,
    width: NODE_WIDTH,
    height: estimateHeight(n.data.label),
    position: n.position,
  }));
  const edgeInputs = edges.map((e) => ({ source: e.source, target: e.target }));

  const results = await engine(inputs, edgeInputs, { direction: options.direction });

  const enginePositions = new Map<string, { x: number; y: number }>();
  for (const r of results) {
    enginePositions.set(r.id, { x: r.x, y: r.y });
  }

  if (!options.respectPinned) {
    return nodes
      .filter((n) => enginePositions.has(n.id))
      .map((n) => ({ id: n.id, position: enginePositions.get(n.id)! }));
  }

  return applyPinnedOffsets(nodes, enginePositions);
}

/** Compute a single global translation from pinned nodes, apply to unpinned, then resolve overlaps. */
function applyPinnedOffsets(
  nodes: DiagramNode[],
  enginePositions: Map<string, { x: number; y: number }>,
): NodePositionUpdate[] {
  const pinnedNodes = nodes.filter((n) => n.pinned && enginePositions.has(n.id));

  if (pinnedNodes.length === 0) {
    return nodes
      .filter((n) => enginePositions.has(n.id))
      .map((n) => ({ id: n.id, position: enginePositions.get(n.id)! }));
  }

  // Global average offset: preserves the engine's relative layout
  const offset = { dx: 0, dy: 0 };
  for (const node of pinnedNodes) {
    const enginePos = enginePositions.get(node.id)!;
    offset.dx += node.position.x - enginePos.x;
    offset.dy += node.position.y - enginePos.y;
  }
  offset.dx /= pinnedNodes.length;
  offset.dy /= pinnedNodes.length;

  const updates: NodePositionUpdate[] = [];
  for (const node of nodes) {
    if (node.pinned) continue;
    const enginePos = enginePositions.get(node.id);
    if (enginePos) {
      updates.push({
        id: node.id,
        position: {
          x: enginePos.x + offset.dx,
          y: enginePos.y + offset.dy,
        },
      });
    }
  }

  resolveOverlapsWithPinned(updates, pinnedNodes);
  return updates;
}

/** Push unpinned nodes away from pinned nodes they overlap with. */
function resolveOverlapsWithPinned(
  updates: NodePositionUpdate[],
  pinnedNodes: DiagramNode[],
): void {
  const heights = new Map<string, number>();
  for (const u of updates) heights.set(u.id, MIN_NODE_HEIGHT);
  for (const p of pinnedNodes) heights.set(p.id, MIN_NODE_HEIGHT);

  const PADDING = 10;
  const MAX_PASSES = 5;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let resolved = true;
    for (const update of updates) {
      const uh = heights.get(update.id)!;
      for (const pinned of pinnedNodes) {
        const ph = heights.get(pinned.id)!;
        const overlapX = getOverlap(
          update.position.x, NODE_WIDTH,
          pinned.position.x, NODE_WIDTH,
        );
        const overlapY = getOverlap(
          update.position.y, uh,
          pinned.position.y, ph,
        );
        if (overlapX > 0 && overlapY > 0) {
          resolved = false;
          // Push along the axis with less overlap (cheaper to resolve)
          if (overlapX < overlapY) {
            const dir = update.position.x >= pinned.position.x ? 1 : -1;
            update.position.x += dir * (overlapX + PADDING);
          } else {
            const dir = update.position.y >= pinned.position.y ? 1 : -1;
            update.position.y += dir * (overlapY + PADDING);
          }
        }
      }
    }
    if (resolved) break;
  }
}

function getOverlap(aStart: number, aSize: number, bStart: number, bSize: number): number {
  const aEnd = aStart + aSize;
  const bEnd = bStart + bSize;
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}
