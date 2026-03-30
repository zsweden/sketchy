import type { DiagramNode, DiagramEdge } from '../types';
import type { LayoutDirection } from '../framework-types';
import { findStronglyConnectedComponents } from '../graph/derived';
import type { LayoutEngine } from './layout-engine';
import { NODE_WIDTH, estimateHeight } from './layout-engine';

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

  const results = await engine(inputs, edgeInputs, { direction: options.direction });

  const adjustedResults = options.cyclic
    ? circularizeCyclicComponents(inputs, edges, results)
    : results;

  return adjustedResults.map((r) => {
    // Locked nodes keep their current position
    if (lockedIds.has(r.id)) {
      const node = nodes.find((n) => n.id === r.id)!;
      return { id: r.id, position: node.position };
    }
    return { id: r.id, position: { x: r.x, y: r.y } };
  });
}

function circularizeCyclicComponents(
  nodes: { id: string; width: number; height: number }[],
  edges: DiagramEdge[],
  results: { id: string; x: number; y: number }[],
): { id: string; x: number; y: number }[] {
  const positions = new Map(results.map((result) => [result.id, result]));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const components = findStronglyConnectedComponents(
    nodes.map((node) => node.id),
    edges,
  ).filter((component) => component.length >= 2);

  for (const component of components) {
    const positioned = component
      .map((nodeId) => {
        const node = nodeMap.get(nodeId);
        const position = positions.get(nodeId);
        if (!node || !position) return null;
        return { nodeId, node, position };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (positioned.length < 2) continue;

    const centerX = positioned.reduce((sum, entry) => sum + entry.position.x, 0) / positioned.length;
    const centerY = positioned.reduce((sum, entry) => sum + entry.position.y, 0) / positioned.length;
    const radius = Math.max(
      140,
      ...positioned.map((entry) => Math.max(entry.node.width, entry.node.height)),
    );
    const sorted = [...positioned].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const angleStep = (Math.PI * 2) / sorted.length;

    sorted.forEach((entry, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      positions.set(entry.nodeId, {
        id: entry.nodeId,
        x: centerX + radius * Math.cos(angle) - entry.node.width / 2,
        y: centerY + radius * Math.sin(angle) - entry.node.height / 2,
      });
    });
  }

  return results.map((result) => positions.get(result.id) ?? result);
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
