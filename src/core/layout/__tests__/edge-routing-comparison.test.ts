import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../../../constants/layout';
import {
  computeLayoutMetrics,
} from '../layout-metrics';
import { buildChain, buildCyclicGraph, buildDenseGraph, buildTree } from '../../../test/layout-benchmark-fixtures';
import {
  DEFAULT_EDGE_ROUTING_ALGORITHM,
  computeEdgeRoutingPlacements,
  scoreObjectiveEdgeRouting,
} from '../../edge-routing';

const describePerf = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;
const SHOULD_LOG = process.env.RUN_PERF_TESTS === '1';

interface RoutingFixture {
  id: string;
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ComparisonRow {
  fixture: string;
  algorithm: typeof DEFAULT_EDGE_ROUTING_ALGORITHM;
  timeMs: number;
  evalMetrics: ReturnType<typeof computeMetricsForAlgorithm>['evalMetrics'];
  objectiveMetrics: ReturnType<typeof computeMetricsForAlgorithm>['objectiveMetrics'];
}

function getRoutingFixtures(): RoutingFixture[] {
  const chain40 = buildChain(40);
  const tree31 = buildTree(5, 2);
  const dense24 = buildDenseGraph(24, 3);
  const cyclic12 = buildCyclicGraph(12, 4);

  return [
    { id: 'route-40-chain', direction: 'BT', ...chain40 },
    { id: 'route-31-tree', direction: 'TB', ...tree31 },
    { id: 'route-24-dense', direction: 'TB', ...dense24 },
    { id: 'route-12-cyclic', direction: 'TB', ...cyclic12 },
  ];
}

function toLayoutNodes(nodes: DiagramNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  }));
}

function toPositionMap(nodes: DiagramNode[]) {
  return new Map(nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]));
}

function computeMetricsForAlgorithm(
  fixture: RoutingFixture,
) {
  const placements = computeEdgeRoutingPlacements({
    edges: fixture.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    nodeBoxes: new Map(fixture.nodes.map((node) => [
      node.id,
      {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + DEFAULT_NODE_WIDTH,
        bottom: node.position.y + DEFAULT_NODE_HEIGHT,
      },
    ])),
    layoutDirection: fixture.direction,
  });

  const edgesWithPlacements = fixture.edges.map((edge) => {
    const placement = placements.get(edge.id);
    if (!placement) {
      throw new Error(`Missing placement for edge ${edge.id}`);
    }
    return {
      source: edge.source,
      target: edge.target,
      sourceSide: placement.sourceSide,
      targetSide: placement.targetSide,
    };
  });

  return {
    evalMetrics: computeLayoutMetrics(
      toLayoutNodes(fixture.nodes),
      edgesWithPlacements,
      toPositionMap(fixture.nodes),
    ),
    objectiveMetrics: scoreObjectiveEdgeRouting(
      fixture.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      new Map(fixture.nodes.map((node) => [
        node.id,
        {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + DEFAULT_NODE_WIDTH,
          bottom: node.position.y + DEFAULT_NODE_HEIGHT,
        },
      ])),
      placements,
    ),
  };
}

function measure(
  fixture: RoutingFixture,
  iterations = 1,
) {
  const started = performance.now();
  let metrics = computeMetricsForAlgorithm(fixture);
  for (let index = 1; index < iterations; index++) {
    metrics = computeMetricsForAlgorithm(fixture);
  }
  const elapsed = (performance.now() - started) / iterations;

  return {
    fixture: fixture.id,
    algorithm: DEFAULT_EDGE_ROUTING_ALGORITHM,
    timeMs: Math.round(elapsed * 100) / 100,
    evalMetrics: metrics.evalMetrics,
    objectiveMetrics: metrics.objectiveMetrics,
  };
}

function formatEvalMetrics(row: ComparisonRow): string {
  return [
    `nodeOverlaps=${row.evalMetrics.nodeOverlaps}`,
    `edgeCrossings=${row.evalMetrics.edgeCrossings}`,
    `edgeNodeOverlaps=${row.evalMetrics.edgeNodeOverlaps}`,
    `connectorConflicts=${row.evalMetrics.connectorConflicts}`,
    `totalEdgeLength=${row.evalMetrics.totalEdgeLength}`,
    `boundingArea=${row.evalMetrics.boundingArea}`,
  ].join(' ');
}

function formatObjectiveMetrics(row: ComparisonRow): string {
  return [
    `crossings=${row.objectiveMetrics.crossings}`,
    `edgeNodeOverlaps=${row.objectiveMetrics.edgeNodeOverlaps}`,
    `mixedHandleConflicts=${row.objectiveMetrics.mixedHandleConflicts}`,
    `totalLength=${row.objectiveMetrics.totalLength}`,
    `sameDirectionSharing=${row.objectiveMetrics.sameDirectionSharing}`,
    `cornerHandleCount=${row.objectiveMetrics.cornerHandleCount}`,
  ].join(' ');
}

describePerf('perf: edge routing comparison', () => {
  it('prints speed and evaluator scores for the primary routing algorithm', () => {
    const rows: ComparisonRow[] = [];

    for (const fixture of getRoutingFixtures()) {
      rows.push(measure(fixture));
    }

    if (SHOULD_LOG) {
      for (const row of rows) {
        console.log(`[edge-routing] ${row.fixture} ${row.algorithm}: ${row.timeMs}ms`);
        console.log(`[edge-routing]   eval      ${formatEvalMetrics(row)}`);
        console.log(`[edge-routing]   score     ${formatObjectiveMetrics(row)}`);
      }
    }

    expect(rows).toHaveLength(getRoutingFixtures().length);
    for (const row of rows) {
      expect(Number.isFinite(row.timeMs)).toBe(true);
      expect(Number.isFinite(row.evalMetrics.totalEdgeLength)).toBe(true);
      expect(Number.isFinite(row.objectiveMetrics.totalLength)).toBe(true);
    }
  }, 60_000);
});
