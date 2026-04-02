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

export interface LayoutPerfFixture {
  id: string;
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  cyclic?: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export function getLayoutPerfFixtures(): LayoutPerfFixture[] {
  const chain50 = buildChain(50);
  const chain100 = buildChain(100);
  const chain500 = buildChain(500);
  const tree127 = buildTree(7, 2);
  const dense100 = buildDenseGraph(100, 3);
  const cyclic8 = buildCyclicGraph(8, 4);
  const cyclic12 = buildCyclicGraph(12, 4);

  return [
    { id: 'layout-50-chain', direction: 'BT', ...chain50 },
    { id: 'layout-100-chain', direction: 'BT', ...chain100 },
    { id: 'layout-500-chain', direction: 'BT', ...chain500 },
    { id: 'layout-127-tree', direction: 'TB', ...tree127 },
    { id: 'layout-100-dense', direction: 'TB', ...dense100 },
    { id: 'layout-8-cyclic', direction: 'TB', cyclic: true, ...cyclic8 },
    { id: 'layout-12-cyclic', direction: 'TB', cyclic: true, ...cyclic12 },
  ];
}
