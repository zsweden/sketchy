import type { DiagramNode, DiagramEdge } from '../types';
import { isVerticalLayoutDirection, type LayoutDirection } from '../framework-types';
import type { LayoutEngine } from './layout-engine';
import type { ElkExperimentSettings } from './elk-options';
import { prepareLayoutEdges, prepareLayoutNodes } from './layout-inputs';

export interface AutoLayoutOptions {
  direction: LayoutDirection;
  cyclic?: boolean;
  elk?: ElkExperimentSettings;
}

export interface NodePositionUpdate {
  id: string;
  position: { x: number; y: number };
}

const TOP_SPINE_GAP = 48;

export async function autoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: AutoLayoutOptions,
  engine: LayoutEngine,
): Promise<NodePositionUpdate[]> {
  const lockedIds = new Set(nodes.filter((n) => n.data.locked).map((n) => n.id));
  const inputs = prepareLayoutNodes(nodes, edges);
  const edgeInputs = prepareLayoutEdges(edges);
  const useCyclicLayout = options.cyclic === true;

  const results = await engine(inputs, edgeInputs, {
    direction: options.direction,
    cyclic: useCyclicLayout,
    elk: options.elk,
  });
  const tightenedResults = useCyclicLayout
    ? results
    : tightenTopSpine(inputs, edgeInputs, results, options.direction);

  return tightenedResults.map((r) => {
    // Locked nodes keep their current position
    if (lockedIds.has(r.id)) {
      const node = nodes.find((n) => n.id === r.id)!;
      return { id: r.id, position: node.position };
    }
    return { id: r.id, position: { x: r.x, y: r.y } };
  });
}

function tightenTopSpine(
  nodes: { id: string; width: number; height: number }[],
  edges: { source: string; target: string }[],
  results: { id: string; x: number; y: number }[],
  direction: LayoutDirection,
): { id: string; x: number; y: number }[] {
  const chain = findTopSpine(edges, direction);
  if (chain.length < 3) return results;

  const positions = new Map(results.map((result) => [result.id, { ...result }]));
  const isVertical = isVerticalLayoutDirection(direction);
  const sizes = new Map(
    nodes.map((node) => [node.id, isVertical ? node.height : node.width]),
  );
  const visualAdjacency = buildVisualAdjacency(edges, direction);

  for (let i = 0; i < chain.length - 1; i++) {
    const current = positions.get(chain[i]);
    const next = positions.get(chain[i + 1]);
    const currentSize = sizes.get(chain[i]);
    const nextSize = sizes.get(chain[i + 1]);
    if (!current || !next || currentSize === undefined) continue;

    const currentGap = isVertical
      ? next.y - (current.y + currentSize)
      : direction === 'LR'
        ? next.x - (current.x + currentSize)
        : current.x - (next.x + (nextSize ?? currentSize));
    if (currentGap <= TOP_SPINE_GAP) continue;

    const shift = currentGap - TOP_SPINE_GAP;
    for (const id of collectReachable(chain[i + 1], visualAdjacency)) {
      const position = positions.get(id);
      if (!position) continue;
      if (isVertical) {
        position.y -= shift;
      } else if (direction === 'LR') {
        position.x -= shift;
      } else {
        position.x += shift;
      }
    }
  }

  return results.map((result) => positions.get(result.id) ?? result);
}

function findTopSpine(
  edges: { source: string; target: string }[],
  direction: LayoutDirection,
): string[] {
  const indegree = new Map<string, number>();
  const outdegree = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  function ensure(id: string) {
    if (!indegree.has(id)) indegree.set(id, 0);
    if (!outdegree.has(id)) outdegree.set(id, 0);
  }

  for (const edge of edges) {
    ensure(edge.source);
    ensure(edge.target);
    outdegree.set(edge.source, (outdegree.get(edge.source) ?? 0) + 1);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  const topNodes = [...(direction === 'TB' || direction === 'LR' ? indegree : outdegree).entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  if (topNodes.length !== 1) return [];

  const chain = [topNodes[0]];
  let current = topNodes[0];

  while (true) {
    const nextCandidates = direction === 'TB' || direction === 'LR'
      ? (outgoing.get(current) ?? [])
      : (incoming.get(current) ?? []);
    if (nextCandidates.length !== 1) break;

    const next = nextCandidates[0];
    const sharedDegree = direction === 'TB' || direction === 'LR'
      ? indegree.get(next) ?? 0
      : outdegree.get(next) ?? 0;
    if (sharedDegree !== 1) break;

    chain.push(next);
    current = next;
  }

  return chain;
}

function buildVisualAdjacency(
  edges: { source: string; target: string }[],
  direction: LayoutDirection,
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const from = direction === 'TB' || direction === 'LR' ? edge.source : edge.target;
    const to = direction === 'TB' || direction === 'LR' ? edge.target : edge.source;
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  return adjacency;
}

function collectReachable(start: string, adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return seen;
}
