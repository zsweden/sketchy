import { describe, it, expect } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { findStronglyConnectedComponents } from '../../graph/derived';
import { autoLayout, elkEngine } from '..';
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

async function layoutCircularBaseline(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Promise<PositionMap> {
  const heights = computeNodeHeights(nodes, edges);
  const layoutNodes = nodes.map((n) => ({
    id: n.id,
    width: NODE_WIDTH,
    height: heights.get(n.id) ?? 48,
    position: n.position,
    locked: n.data.locked,
  }));
  const layoutEdges = edges.map((e) => ({ source: e.source, target: e.target }));
  const engineResults = await elkEngine(layoutNodes, layoutEdges, { direction: 'TB', cyclic: false });
  const positions = new Map(engineResults.map((result) => [result.id, { x: result.x, y: result.y }]));
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
  const components = findStronglyConnectedComponents(
    nodes.map((n) => n.id),
    edges,
  ).filter((component) => component.length >= 2);

  for (const component of components) {
    const positioned = component
      .map((nodeId) => {
        const nodeInfo = nodeMap.get(nodeId);
        const position = positions.get(nodeId);
        if (!nodeInfo || !position) return null;
        return { nodeId, node: nodeInfo, position };
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
        x: centerX + radius * Math.cos(angle) - entry.node.width / 2,
        y: centerY + radius * Math.sin(angle) - entry.node.height / 2,
      });
    });
  }

  return positions;
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
  it('keeps routed cyclic layout quality within guardrails and better than the old baseline overall', async () => {
    const rows: Array<Record<string, number | string>> = [];
    const aggregate = {
      baseline: {
        nodeOverlaps: 0,
        edgeCrossings: 0,
        edgeNodeOverlaps: 0,
        connectorConflicts: 0,
        totalEdgeLength: 0,
        boundingArea: 0,
      },
      current: {
        nodeOverlaps: 0,
        edgeCrossings: 0,
        edgeNodeOverlaps: 0,
        connectorConflicts: 0,
        totalEdgeLength: 0,
        boundingArea: 0,
      },
    };

    for (const fixture of fixtures) {
      const baselinePositions = await layoutCircularBaseline(fixture.nodes, fixture.edges);
      const currentPositions = await layoutCurrent(fixture.nodes, fixture.edges);
      const baseline = computeMetrics(fixture.nodes, fixture.edges, baselinePositions);
      const current = computeMetrics(fixture.nodes, fixture.edges, currentPositions);

      rows.push({
        fixture: fixture.name,
        baselineCrossings: baseline.edgeCrossings,
        currentCrossings: current.edgeCrossings,
        baselineEdgeNode: baseline.edgeNodeOverlaps,
        currentEdgeNode: current.edgeNodeOverlaps,
        baselineConnectorConflicts: baseline.connectorConflicts,
        currentConnectorConflicts: current.connectorConflicts,
        baselineLength: baseline.totalEdgeLength,
        currentLength: current.totalEdgeLength,
        baselineArea: baseline.boundingArea,
        currentArea: current.boundingArea,
      });

      aggregate.baseline.nodeOverlaps += baseline.nodeOverlaps;
      aggregate.baseline.edgeCrossings += baseline.edgeCrossings;
      aggregate.baseline.edgeNodeOverlaps += baseline.edgeNodeOverlaps;
      aggregate.baseline.connectorConflicts += baseline.connectorConflicts;
      aggregate.baseline.totalEdgeLength += baseline.totalEdgeLength;
      aggregate.baseline.boundingArea += baseline.boundingArea;

      aggregate.current.nodeOverlaps += current.nodeOverlaps;
      aggregate.current.edgeCrossings += current.edgeCrossings;
      aggregate.current.edgeNodeOverlaps += current.edgeNodeOverlaps;
      aggregate.current.connectorConflicts += current.connectorConflicts;
      aggregate.current.totalEdgeLength += current.totalEdgeLength;
      aggregate.current.boundingArea += current.boundingArea;

      expect(current.nodeOverlaps, `${fixture.name}: node overlaps`).toBe(0);
      expect(current.boundingArea, `${fixture.name}: bounding area`).toBeLessThan(baseline.boundingArea);
      expect(current.totalEdgeLength, `${fixture.name}: edge length`).toBeLessThan(baseline.totalEdgeLength);
    }

    const fixtureMetrics = new Map(rows.map((row) => [row.fixture as string, row]));
    expect(fixtureMetrics.get('triangle')?.currentEdgeNode).toBe(0);
    expect(fixtureMetrics.get('four-cycle-chord')?.currentEdgeNode).toBeLessThanOrEqual(4);
    expect(fixtureMetrics.get('figure-eight')?.currentEdgeNode).toBeLessThanOrEqual(2);
    expect(fixtureMetrics.get('two-scc-cascade')?.currentEdgeNode).toBe(0);
    expect(fixtureMetrics.get('dense-six-node-scc')?.currentEdgeNode).toBeLessThanOrEqual(4);

    expect(scoreLayoutMetrics(aggregate.current)).toBeLessThan(scoreLayoutMetrics(aggregate.baseline));
    expect(aggregate.current.edgeNodeOverlaps).toBeLessThanOrEqual(10);
    expect(aggregate.current.totalEdgeLength).toBeLessThan(aggregate.baseline.totalEdgeLength);
    expect(aggregate.current.boundingArea).toBeLessThan(aggregate.baseline.boundingArea);
  });
});
