import { describe, it, expect } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { autoLayout } from '../auto-layout';
import { elkEngine } from '../elk-engine';
import { NODE_WIDTH, estimateHeight } from '../layout-engine';
import { computeLayoutMetrics, scoreLayoutMetrics, type LayoutMetrics } from '../layout-metrics';

const describePerfSensitive = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;

type PositionMap = Map<string, { x: number; y: number }>;

interface Fixture {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

function node(id: string): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

const fixtures: Fixture[] = [
  {
    name: 'triangle',
    nodes: ['a', 'b', 'c'].map(node),
    edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
  },
  {
    name: 'four-cycle-chord',
    nodes: ['a', 'b', 'c', 'd'].map(node),
    edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'a'), edge('a', 'c')],
  },
  {
    name: 'figure-eight',
    nodes: ['a', 'b', 'c', 'd', 'e'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'c'),
    ],
  },
  {
    name: 'two-scc-cascade',
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
      edge('d', 'e'),
      edge('e', 'f'),
      edge('f', 'd'),
      edge('c', 'd'),
      edge('b', 'e'),
    ],
  },
  {
    name: 'dense-six-node-scc',
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'f'),
      edge('f', 'a'),
      edge('a', 'd'),
      edge('b', 'e'),
      edge('c', 'f'),
      edge('f', 'c'),
    ],
  },
];

function computeNodeHeights(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Map<string, number> {
  const deg = new Map<string, { indegree: number; outdegree: number }>();
  for (const n of nodes) deg.set(n.id, { indegree: 0, outdegree: 0 });
  for (const e of edges) {
    const s = deg.get(e.source);
    const t = deg.get(e.target);
    if (s) s.outdegree++;
    if (t) t.indegree++;
  }

  const heights = new Map<string, number>();
  for (const n of nodes) {
    const d = deg.get(n.id) ?? { indegree: 0, outdegree: 0 };
    const hasBadges = n.data.tags.length > 0
      || (d.indegree === 0 && d.outdegree > 0)
      || (d.indegree > 0 && d.outdegree > 0);
    heights.set(n.id, estimateHeight(n.data.label, hasBadges));
  }
  return heights;
}

async function layoutCurrent(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Promise<PositionMap> {
  const updates = await autoLayout(nodes, edges, { direction: 'TB', cyclic: true }, elkEngine);
  return new Map(updates.map((update) => [update.id, update.position]));
}

function computeMetrics(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  positions: PositionMap,
): LayoutMetrics {
  const heights = computeNodeHeights(nodes, edges);
  return computeLayoutMetrics(
    nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: heights.get(node.id) ?? 48,
    })),
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
    positions,
  );
}

describePerfSensitive('CLD layout metrics', () => {
  it('keeps direct cyclic ELK layout within guardrails on representative CLD fixtures', async () => {
    const rows: Array<Record<string, number | string>> = [];
    const aggregate = {
      nodeOverlaps: 0,
      edgeCrossings: 0,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 0,
      boundingArea: 0,
    };

    for (const fixture of fixtures) {
      const currentPositions = await layoutCurrent(fixture.nodes, fixture.edges);
      const current = computeMetrics(fixture.nodes, fixture.edges, currentPositions);

      rows.push({
        fixture: fixture.name,
        currentCrossings: current.edgeCrossings,
        currentEdgeNode: current.edgeNodeOverlaps,
        currentConnectorConflicts: current.connectorConflicts,
        currentLength: current.totalEdgeLength,
        currentArea: current.boundingArea,
        currentScore: scoreLayoutMetrics(current),
      });

      aggregate.nodeOverlaps += current.nodeOverlaps;
      aggregate.edgeCrossings += current.edgeCrossings;
      aggregate.edgeNodeOverlaps += current.edgeNodeOverlaps;
      aggregate.connectorConflicts += current.connectorConflicts;
      aggregate.totalEdgeLength += current.totalEdgeLength;
      aggregate.boundingArea += current.boundingArea;

      expect(current.nodeOverlaps, `${fixture.name}: node overlaps`).toBe(0);
    }

    const fixtureMetrics = new Map(rows.map((row) => [row.fixture as string, row]));
    expect(fixtureMetrics.get('triangle')?.currentCrossings).toBe(0);
    expect(fixtureMetrics.get('four-cycle-chord')?.currentCrossings).toBe(0);
    expect(fixtureMetrics.get('figure-eight')?.currentCrossings).toBe(0);
    expect(fixtureMetrics.get('two-scc-cascade')?.currentCrossings).toBe(0);
    expect(fixtureMetrics.get('dense-six-node-scc')?.currentCrossings).toBeLessThanOrEqual(2);
    expect(fixtureMetrics.get('triangle')?.currentEdgeNode).toBe(0);
    expect(fixtureMetrics.get('four-cycle-chord')?.currentEdgeNode).toBe(0);
    expect(fixtureMetrics.get('figure-eight')?.currentEdgeNode).toBeLessThanOrEqual(1);
    expect(fixtureMetrics.get('two-scc-cascade')?.currentEdgeNode).toBe(0);
    expect(fixtureMetrics.get('dense-six-node-scc')?.currentEdgeNode).toBeLessThanOrEqual(3);

    expect(aggregate.nodeOverlaps).toBe(0);
    expect(aggregate.edgeCrossings).toBeLessThanOrEqual(2);
    expect(aggregate.edgeNodeOverlaps).toBeLessThanOrEqual(4);
    expect(aggregate.connectorConflicts).toBeLessThanOrEqual(6);
    expect(scoreLayoutMetrics(aggregate)).toBeLessThan(120_000);
  });
});
