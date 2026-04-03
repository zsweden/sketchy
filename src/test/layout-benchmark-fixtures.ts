import type { DiagramEdge, DiagramNode } from '../core/types';

function makeNode(id: string, x = 0, y = 0, tags: string[] = []): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x, y },
    data: { label: `Node ${id}`, tags, junctionType: 'or' },
  };
}

function makeEdge(source: string, target: string, id?: string): DiagramEdge {
  return { id: id ?? `${source}->${target}`, source, target };
}

export function buildChain(n: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: n }, (_, i) => makeNode(String(i), i * 50, 0));
  const edges = Array.from({ length: n - 1 }, (_, i) => makeEdge(String(i), String(i + 1)));
  return { nodes, edges };
}

export function buildTree(
  depth: number,
  branching: number,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  let nextId = 0;

  function addLevel(parentId: string, level: number) {
    if (level >= depth) return;
    for (let i = 0; i < branching; i++) {
      const childId = String(nextId++);
      nodes.push(makeNode(childId, nextId * 30, level * 100));
      edges.push(makeEdge(parentId, childId));
      addLevel(childId, level + 1);
    }
  }

  const rootId = String(nextId++);
  nodes.push(makeNode(rootId, 0, 0));
  addLevel(rootId, 1);
  return { nodes, edges };
}

export function buildCyclicGraph(
  nodeCount: number,
  cycleSize: number,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: nodeCount }, (_, i) => makeNode(String(i)));
  const edges: DiagramEdge[] = [];

  const numCycles = Math.floor(nodeCount / cycleSize);
  for (let cycle = 0; cycle < numCycles; cycle++) {
    const start = cycle * cycleSize;
    for (let i = 0; i < cycleSize; i++) {
      const from = String(start + i);
      const to = String(start + ((i + 1) % cycleSize));
      edges.push(makeEdge(from, to));
    }
  }

  return { nodes, edges };
}

export function buildDenseGraph(
  nodeCount: number,
  edgesPerNode: number,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(String(i), (i % 10) * 60, Math.floor(i / 10) * 80),
  );
  const edges: DiagramEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < edgesPerNode; j++) {
      const target = (i + j + 1) % nodeCount;
      if (target === i) continue;
      const key = `${i}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(makeEdge(String(i), String(target)));
    }
  }

  return { nodes, edges };
}

