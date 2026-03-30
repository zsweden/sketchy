import type { DiagramNode, DiagramEdge } from '../types';
import { findStronglyConnectedComponents } from '../graph/derived';
import type { LayoutEngine } from './layout-engine';
import { NODE_WIDTH, estimateHeight } from './layout-engine';
import { cyclicLayoutEngine } from './cyclic-layout-engine';

export interface AutoLayoutOptions {
  direction: LayoutDirection;
  cyclic?: boolean;
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
  const lockedIds = new Set(nodes.filter((n) => n.data.locked).map((n) => n.id));
  const degrees = computeDegrees(nodes, edges);
  const inputs = nodes.map((n) => {
    const deg = degrees.get(n.id) ?? { indegree: 0, outdegree: 0 };
    const hasBadges = n.data.tags.length > 0
      || (deg.indegree === 0 && deg.outdegree > 0)
      || (deg.indegree > 0 && deg.outdegree > 0);
    const height = estimateHeight(n.data.label, hasBadges);
    return { id: n.id, width: NODE_WIDTH, height, position: n.position, locked: n.data.locked };
  });
  const edgeInputs = edges.map((e) => ({ source: e.source, target: e.target }));
  const useCyclicEngine = shouldUseCyclicEngine(nodes, edges, options.cyclic);
  const selectedEngine = useCyclicEngine ? cyclicLayoutEngine : engine;

  const results = await selectedEngine(inputs, edgeInputs, {
    direction: options.direction,
    cyclic: useCyclicEngine,
  });

  return results.map((r) => {
    // Locked nodes keep their current position
    if (lockedIds.has(r.id)) {
      const node = nodes.find((n) => n.id === r.id)!;
      return { id: r.id, position: node.position };
    }
    return { id: r.id, position: { x: r.x, y: r.y } };
  });
}

function shouldUseCyclicEngine(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  cyclic: boolean | undefined,
): boolean {
  if (!cyclic) return false;
  return findStronglyConnectedComponents(
    nodes.map((node) => node.id),
    edges,
  ).some((component) => component.length >= 2);
}

function computeDegrees(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Map<string, { indegree: number; outdegree: number }> {
  const deg = new Map<string, { indegree: number; outdegree: number }>();
  for (const n of nodes) {
    deg.set(n.id, { indegree: 0, outdegree: 0 });
  }
  for (const e of edges) {
    const s = deg.get(e.source);
    if (s) s.outdegree++;
    const t = deg.get(e.target);
    if (t) t.indegree++;
  }
  return deg;
}
