import type { DerivedCondition, DerivedIndicator } from '../framework-types';
import type { DiagramEdge } from '../types';

export interface NodeDegrees {
  indegree: number;
  outdegree: number;
}

export interface CausalLoop {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
  kind: 'reinforcing' | 'balancing';
  negativeEdgeCount: number;
  delayedEdgeCount: number;
}

export interface NamedCausalLoop extends CausalLoop {
  label: string;
}

export interface LoopSummary {
  totalLoops: number;
  reinforcingLoops: number;
  balancingLoops: number;
  delayedLoops: number;
}

export function computeNodeDegrees(
  edges: DiagramEdge[],
): Map<string, NodeDegrees> {
  const degrees = new Map<string, NodeDegrees>();

  const getOrCreate = (id: string): NodeDegrees => {
    let d = degrees.get(id);
    if (!d) {
      d = { indegree: 0, outdegree: 0 };
      degrees.set(id, d);
    }
    return d;
  };

  for (const edge of edges) {
    getOrCreate(edge.source).outdegree++;
    getOrCreate(edge.target).indegree++;
  }

  return degrees;
}

function matchesCondition(
  condition: DerivedCondition,
  degrees: NodeDegrees,
): boolean {
  switch (condition) {
    case 'indegree-zero':
      return degrees.indegree === 0;
    case 'leaf':
      return degrees.outdegree === 0;
    case 'indegree-and-outdegree':
      return degrees.indegree > 0 && degrees.outdegree > 0;
  }
}

// --- Connected subgraph for highlight ---

export interface ConnectedSubgraph {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

export function getConnectedSubgraph(
  edges: DiagramEdge[],
  selectedNodeId: string,
): ConnectedSubgraph {
  const nodeIds = new Set<string>([selectedNodeId]);
  const edgeIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return { nodeIds, edgeIds };
}

export function getDerivedIndicators(
  nodeId: string,
  degreesMap: Map<string, NodeDegrees>,
  indicators: DerivedIndicator[],
): DerivedIndicator[] {
  const degrees = degreesMap.get(nodeId) ?? { indegree: 0, outdegree: 0 };
  return indicators.filter((ind) => matchesCondition(ind.condition, degrees));
}

function getUniqueNodeIds(edges: DiagramEdge[]): string[] {
  return Array.from(new Set(edges.flatMap((edge) => [edge.source, edge.target])));
}

function getOutgoingEdges(edges: DiagramEdge[]): Map<string, DiagramEdge[]> {
  const outgoing = new Map<string, DiagramEdge[]>();

  for (const edge of edges) {
    const existing = outgoing.get(edge.source);
    if (existing) {
      existing.push(edge);
    } else {
      outgoing.set(edge.source, [edge]);
    }
  }

  return outgoing;
}

export function findStronglyConnectedComponents(
  nodeIds: string[],
  edges: DiagramEdge[],
): string[][] {
  const outgoing = getOutgoingEdges(edges);
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let index = 0;

  function strongConnect(nodeId: string) {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const edge of outgoing.get(nodeId) ?? []) {
      const nextId = edge.target;
      if (!indices.has(nextId)) {
        strongConnect(nextId);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(nextId)!));
      } else if (onStack.has(nextId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(nextId)!));
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;

    const component: string[] = [];
    let current = '';
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);

    components.push(component.sort());
  }

  for (const nodeId of [...nodeIds].sort()) {
    if (!indices.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return components.sort((a, b) => a[0].localeCompare(b[0]));
}

function canonicalizeCycle(
  nodeIds: string[],
  edgeIds: string[],
): { key: string; nodeIds: string[]; edgeIds: string[] } {
  let bestNodes = [...nodeIds];
  let bestEdges = [...edgeIds];
  let bestKey = nodeIds.join('>');

  for (let i = 1; i < nodeIds.length; i++) {
    const rotatedNodes = nodeIds.slice(i).concat(nodeIds.slice(0, i));
    const rotatedEdges = edgeIds.slice(i).concat(edgeIds.slice(0, i));
    const key = rotatedNodes.join('>');
    if (key < bestKey) {
      bestKey = key;
      bestNodes = rotatedNodes;
      bestEdges = rotatedEdges;
    }
  }

  return { key: bestKey, nodeIds: bestNodes, edgeIds: bestEdges };
}

export function findCausalLoops(edges: DiagramEdge[]): CausalLoop[] {
  const nodeIds = getUniqueNodeIds(edges);
  const components = findStronglyConnectedComponents(nodeIds, edges)
    .filter((component) => component.length >= 2);
  const outgoing = getOutgoingEdges(edges);
  const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  const loops = new Map<string, CausalLoop>();

  function recordLoop(nodePath: string[], edgePath: string[]) {
    const canonical = canonicalizeCycle(nodePath, edgePath);
    if (loops.has(canonical.key)) return;

    const negativeEdgeCount = canonical.edgeIds
      .filter((edgeId) => edgeMap.get(edgeId)?.polarity === 'negative')
      .length;
    const delayedEdgeCount = canonical.edgeIds
      .filter((edgeId) => edgeMap.get(edgeId)?.delay)
      .length;

    loops.set(canonical.key, {
      id: canonical.key,
      nodeIds: [...canonical.nodeIds],
      edgeIds: [...canonical.edgeIds],
      kind: negativeEdgeCount % 2 === 0 ? 'reinforcing' : 'balancing',
      negativeEdgeCount,
      delayedEdgeCount,
    });
  }

  for (const component of components) {
    const componentSet = new Set(component);

    function dfs(
      startId: string,
      currentId: string,
      pathNodes: string[],
      pathEdges: string[],
      visited: Set<string>,
    ) {
      for (const edge of outgoing.get(currentId) ?? []) {
        const nextId = edge.target;
        if (!componentSet.has(nextId)) continue;

        if (nextId === startId && pathNodes.length >= 2) {
          recordLoop(pathNodes, [...pathEdges, edge.id]);
          continue;
        }

        if (visited.has(nextId)) continue;

        visited.add(nextId);
        pathNodes.push(nextId);
        pathEdges.push(edge.id);
        dfs(startId, nextId, pathNodes, pathEdges, visited);
        pathEdges.pop();
        pathNodes.pop();
        visited.delete(nextId);
      }
    }

    for (const startId of component) {
      dfs(startId, startId, [startId], [], new Set([startId]));
    }
  }

  return Array.from(loops.values()).sort((a, b) =>
    a.nodeIds.join('>').localeCompare(b.nodeIds.join('>')),
  );
}

export function summarizeCausalLoops(loops: CausalLoop[]): LoopSummary {
  return {
    totalLoops: loops.length,
    reinforcingLoops: loops.filter((loop) => loop.kind === 'reinforcing').length,
    balancingLoops: loops.filter((loop) => loop.kind === 'balancing').length,
    delayedLoops: loops.filter((loop) => loop.delayedEdgeCount > 0).length,
  };
}

export function labelCausalLoops(loops: CausalLoop[]): NamedCausalLoop[] {
  let reinforcingIndex = 0;
  let balancingIndex = 0;

  return loops.map((loop) => ({
    ...loop,
    label: loop.kind === 'reinforcing'
      ? `R${++reinforcingIndex}`
      : `B${++balancingIndex}`,
  }));
}

export function getLoopSubgraph(loop: CausalLoop): ConnectedSubgraph {
  return {
    nodeIds: new Set(loop.nodeIds),
    edgeIds: new Set(loop.edgeIds),
  };
}
