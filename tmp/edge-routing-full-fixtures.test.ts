import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../src/core/types';
import { autoLayout } from '../src/core/layout/auto-layout';
import { elkEngine } from '../src/core/layout/elk-engine';
import {
  compareGraphMetrics,
  computeLayoutMetrics,
  scoreLayoutMetrics,
  type LayoutMetrics,
} from '../src/core/layout/layout-metrics';
import { prepareLayoutNodes } from '../src/core/layout/layout-inputs';
import { getLayoutPerfFixtures } from '../src/test/layout-benchmark-fixtures';
import {
  compareEdgeRoutingObjectiveScores,
  computeEdgeRoutingPlacements,
  scoreObjectiveEdgeRouting,
  type EdgeRoutingAlgorithmId,
  type EdgeRoutingObjectiveScore,
} from '../src/core/edge-routing';

const describePerf = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;
const SELECTED_FIXTURE_ID = process.env.EDGE_ROUTING_FIXTURE_ID;
const SELECTED_ALGORITHM = process.env.EDGE_ROUTING_ALGORITHM as EdgeRoutingAlgorithmId | undefined;
const RESULT_PATH = process.env.EDGE_ROUTING_RESULT_PATH;

interface RoutingFixture {
  id: string;
  direction: 'TB' | 'BT';
  cyclic?: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ComparisonRow {
  fixture: string;
  algorithm: EdgeRoutingAlgorithmId;
  nodeCount: number;
  edgeCount: number;
  iterations: number;
  timeMs: number;
  evalMetrics: LayoutMetrics;
  evalScore: number;
  scoreMetrics: EdgeRoutingObjectiveScore;
}

function n(id: string, x: number, y: number): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x, y },
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

function getCldFixtures(): RoutingFixture[] {
  return [
    {
      id: 'cld-triangle',
      direction: 'TB',
      cyclic: true,
      nodes: ['a', 'b', 'c'].map((id) => n(id, 0, 0)),
      edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    },
    {
      id: 'cld-four-cycle-chord',
      direction: 'TB',
      cyclic: true,
      nodes: ['a', 'b', 'c', 'd'].map((id) => n(id, 0, 0)),
      edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'a'), edge('a', 'c')],
    },
    {
      id: 'cld-figure-eight',
      direction: 'TB',
      cyclic: true,
      nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => n(id, 0, 0)),
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
      id: 'cld-two-scc-cascade',
      direction: 'TB',
      cyclic: true,
      nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => n(id, 0, 0)),
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
      id: 'cld-dense-six-node-scc',
      direction: 'TB',
      cyclic: true,
      nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => n(id, 0, 0)),
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
}

function getSkyFixtures(): RoutingFixture[] {
  return [
    {
      id: 'sky-4box-layout',
      direction: 'TB',
      nodes: [
        n('3468', 370.09, -321.26),
        n('c3d0', 644.69, -502.33),
        n('3b81', 363.0, -500.82),
        n('5ae9', 645.25, -319.73),
      ],
      edges: [edge('3b81', '5ae9'), edge('c3d0', '3468')],
    },
    {
      id: 'sky-4box-layout-v2-cross-edge',
      direction: 'TB',
      nodes: [
        n('3468', 643.5, -368.9),
        n('c3d0', 644.7, -502.3),
        n('3b81', 363.0, -500.8),
        n('5ae9', 363.7, -370.8),
      ],
      edges: [edge('3b81', '5ae9'), edge('c3d0', '3468'), edge('3b81', '3468')],
    },
    {
      id: 'sky-6box-layout',
      direction: 'TB',
      nodes: [
        n('3468', 311.28, 126.14),
        n('c3d0', 2.56, 1.28),
        n('3b81', 280, 0),
        n('5ae9', -4.72, 131.14),
        n('7f0d', 22.95, 228.22),
        n('b747', 288.52, 223.77),
      ],
      edges: [edge('3b81', '5ae9'), edge('c3d0', '3468'), edge('3468', '7f0d'), edge('5ae9', 'b747')],
    },
    {
      id: 'sky-9box-layout',
      direction: 'TB',
      nodes: [
        n('3468', 710.65, 133.57),
        n('c3d0', 2.56, 1.28),
        n('3b81', 280, 0),
        n('5ae9', 287.13, 130.61),
        n('7f0d', 1.28, 256.64),
        n('b747', 421.28, 256.64),
        n('c06d', -0.72, 370.64),
      ],
      edges: [
        edge('3b81', '5ae9'),
        edge('c3d0', '3468'),
        edge('3468', '7f0d'),
        edge('5ae9', 'b747'),
        edge('c06d', '5ae9'),
        edge('c3d0', '5ae9'),
        edge('5ae9', '7f0d'),
      ],
    },
    {
      id: 'sky-9box-layout-v2',
      direction: 'TB',
      nodes: [
        n('3468', 136.28, 128.64),
        n('c3d0', 51.12, -0.007),
        n('3b81', 160.1, 354.05),
        n('5ae9', 416.28, 128.64),
        n('7f0d', 136.28, 256.64),
        n('b747', 436.28, 256.64),
        n('c06d', 566.28, 0.64),
      ],
      edges: [
        edge('3b81', '5ae9'),
        edge('c3d0', '3468'),
        edge('3468', '7f0d'),
        edge('5ae9', 'b747'),
        edge('c06d', '5ae9'),
        edge('c3d0', '5ae9'),
        edge('5ae9', '7f0d'),
      ],
    },
    {
      id: 'sky-4box-layout-v3-offset',
      direction: 'TB',
      nodes: [
        n('3468', 564.99, -366.24),
        n('c3d0', 746.02, -418.33),
        n('3b81', 382.33, -402.15),
        n('5ae9', 530.51, -170.24),
      ],
      edges: [edge('3b81', '5ae9'), edge('c3d0', '3468')],
    },
    {
      id: 'sky-9box-layout-v3-no-pins',
      direction: 'TB',
      nodes: [
        n('3468', 140, 128),
        n('c3d0', 59.01, 3.1),
        n('3b81', 326.33, 0.78),
        n('5ae9', 420, 128),
        n('7f0d', 140, 256),
        n('b747', 440, 256),
        n('c06d', 570, 0),
      ],
      edges: [
        edge('3b81', '5ae9'),
        edge('c3d0', '3468'),
        edge('3468', '7f0d'),
        edge('5ae9', 'b747'),
        edge('c06d', '5ae9'),
        edge('c3d0', '5ae9'),
        edge('5ae9', '7f0d'),
      ],
    },
  ];
}

async function buildFixtureSet(): Promise<RoutingFixture[]> {
  const generated = getLayoutPerfFixtures().map((fixture) => ({
    id: fixture.id,
    direction: fixture.direction,
    cyclic: fixture.cyclic,
    nodes: fixture.nodes,
    edges: fixture.edges,
  }));

  const cldWithPositions = await Promise.all(
    getCldFixtures().map(async (fixture) => {
      const updates = await autoLayout(
        fixture.nodes,
        fixture.edges,
        { direction: fixture.direction, cyclic: fixture.cyclic },
        elkEngine,
      );
      const positions = new Map(updates.map((update) => [update.id, update.position]));
      return {
        ...fixture,
        nodes: fixture.nodes.map((node) => ({
          ...node,
          position: positions.get(node.id) ?? node.position,
        })),
      };
    }),
  );

  return [...generated, ...cldWithPositions, ...getSkyFixtures()];
}

function toPositionMap(nodes: DiagramNode[]) {
  return new Map(nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]));
}

function getNodeBoxes(nodes: DiagramNode[], edges: DiagramEdge[]) {
  const layoutNodes = prepareLayoutNodes(nodes, edges);
  const positions = toPositionMap(nodes);
  return new Map(layoutNodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) {
      throw new Error(`Missing position for ${node.id}`);
    }
    return [
      node.id,
      {
        left: position.x,
        top: position.y,
        right: position.x + node.width,
        bottom: position.y + node.height,
      },
    ];
  }));
}

function computeMetricsForAlgorithm(
  fixture: RoutingFixture,
  algorithm: EdgeRoutingAlgorithmId,
) {
  const layoutNodes = prepareLayoutNodes(fixture.nodes, fixture.edges);
  const positions = toPositionMap(fixture.nodes);
  const edges = fixture.edges.map((currentEdge) => ({
    id: currentEdge.id,
    source: currentEdge.source,
    target: currentEdge.target,
  }));
  const nodeBoxes = getNodeBoxes(fixture.nodes, fixture.edges);
  const placements = computeEdgeRoutingPlacements(algorithm, {
    edges,
    nodeBoxes,
    layoutDirection: fixture.direction,
  });

  const edgesWithPlacements = fixture.edges.map((currentEdge) => {
    const placement = placements.get(currentEdge.id);
    if (!placement) {
      throw new Error(`Missing placement for edge ${currentEdge.id}`);
    }
    return {
      source: currentEdge.source,
      target: currentEdge.target,
      sourceSide: placement.sourceSide,
      targetSide: placement.targetSide,
    };
  });

  const evalMetrics = computeLayoutMetrics(layoutNodes, edgesWithPlacements, positions);
  return {
    evalMetrics,
    evalScore: scoreLayoutMetrics(evalMetrics),
    scoreMetrics: scoreObjectiveEdgeRouting(edges, nodeBoxes, placements),
  };
}

function getIterations(fixture: RoutingFixture): number {
  if (fixture.edges.length >= 250) return 1;
  if (fixture.edges.length >= 50) return 3;
  if (fixture.edges.length >= 10) return 10;
  return 50;
}

function measure(
  fixture: RoutingFixture,
  algorithm: EdgeRoutingAlgorithmId,
): ComparisonRow {
  const iterations = getIterations(fixture);
  computeMetricsForAlgorithm(fixture, algorithm);
  const started = performance.now();
  let metrics = computeMetricsForAlgorithm(fixture, algorithm);
  for (let index = 1; index < iterations; index++) {
    metrics = computeMetricsForAlgorithm(fixture, algorithm);
  }
  const elapsed = (performance.now() - started) / iterations;

  return {
    fixture: fixture.id,
    algorithm,
    nodeCount: fixture.nodes.length,
    edgeCount: fixture.edges.length,
    iterations,
    timeMs: Math.round(elapsed * 1000) / 1000,
    evalMetrics: metrics.evalMetrics,
    evalScore: metrics.evalScore,
    scoreMetrics: metrics.scoreMetrics,
  };
}

function summarize(rows: ComparisonRow[]) {
  const fixtures = [...new Set(rows.map((row) => row.fixture))];
  const aggregates = {
    byAlgorithm: {} as Record<string, {
      fixtureCount: number;
      timeMs: number;
      evalScore: number;
      nodeOverlaps: number;
      edgeCrossings: number;
      edgeNodeOverlaps: number;
      connectorConflicts: number;
      totalEdgeLength: number;
      boundingArea: number;
      score: EdgeRoutingObjectiveScore;
      winsVsLegacy: number;
      tiesVsLegacy: number;
      lossesVsLegacy: number;
    }>,
    deltasVsLegacy: {} as Record<string, {
      betterOnEval: number;
      equalOnEval: number;
      worseOnEval: number;
      faster: number;
      slower: number;
      timeDeltaMs: number;
      evalScoreDelta: number;
    }>,
  };

  for (const algorithm of ['legacy', 'legacy-plus'] as const) {
    const algorithmRows = rows.filter((row) => row.algorithm === algorithm);
    aggregates.byAlgorithm[algorithm] = {
      fixtureCount: algorithmRows.length,
      timeMs: round(algorithmRows.reduce((sum, row) => sum + row.timeMs, 0)),
      evalScore: round(algorithmRows.reduce((sum, row) => sum + row.evalScore, 0)),
      nodeOverlaps: algorithmRows.reduce((sum, row) => sum + row.evalMetrics.nodeOverlaps, 0),
      edgeCrossings: algorithmRows.reduce((sum, row) => sum + row.evalMetrics.edgeCrossings, 0),
      edgeNodeOverlaps: algorithmRows.reduce((sum, row) => sum + row.evalMetrics.edgeNodeOverlaps, 0),
      connectorConflicts: algorithmRows.reduce((sum, row) => sum + row.evalMetrics.connectorConflicts, 0),
      totalEdgeLength: round(algorithmRows.reduce((sum, row) => sum + row.evalMetrics.totalEdgeLength, 0)),
      boundingArea: round(algorithmRows.reduce((sum, row) => sum + row.evalMetrics.boundingArea, 0)),
      score: algorithmRows.reduce<EdgeRoutingObjectiveScore>((acc, row) => ({
        crossings: acc.crossings + row.scoreMetrics.crossings,
        edgeNodeOverlaps: acc.edgeNodeOverlaps + row.scoreMetrics.edgeNodeOverlaps,
        mixedHandleConflicts: acc.mixedHandleConflicts + row.scoreMetrics.mixedHandleConflicts,
        totalLength: round(acc.totalLength + row.scoreMetrics.totalLength),
        sameDirectionSharing: acc.sameDirectionSharing + row.scoreMetrics.sameDirectionSharing,
        cornerHandleCount: acc.cornerHandleCount + row.scoreMetrics.cornerHandleCount,
      }), {
        crossings: 0,
        edgeNodeOverlaps: 0,
        mixedHandleConflicts: 0,
        totalLength: 0,
        sameDirectionSharing: 0,
        cornerHandleCount: 0,
      }),
      winsVsLegacy: 0,
      tiesVsLegacy: 0,
      lossesVsLegacy: 0,
    };
  }

  const delta = {
    betterOnEval: 0,
    equalOnEval: 0,
    worseOnEval: 0,
    faster: 0,
    slower: 0,
    timeDeltaMs: 0,
    evalScoreDelta: 0,
  };

  for (const fixture of fixtures) {
    const baseline = rows.find((row) => row.fixture === fixture && row.algorithm === 'legacy');
    const candidate = rows.find((row) => row.fixture === fixture && row.algorithm === 'legacy-plus');
    if (!baseline || !candidate) continue;

    const evalCompare = compareGraphMetrics(candidate.evalMetrics, baseline.evalMetrics);
    if (evalCompare < 0) delta.betterOnEval += 1;
    else if (evalCompare > 0) delta.worseOnEval += 1;
    else delta.equalOnEval += 1;

    if (candidate.timeMs < baseline.timeMs) delta.faster += 1;
    else if (candidate.timeMs > baseline.timeMs) delta.slower += 1;

    delta.timeDeltaMs += candidate.timeMs - baseline.timeMs;
    delta.evalScoreDelta += candidate.evalScore - baseline.evalScore;

    const aggregateRow = aggregates.byAlgorithm['legacy-plus'];
    if (evalCompare < 0) aggregateRow.winsVsLegacy += 1;
    else if (evalCompare > 0) aggregateRow.lossesVsLegacy += 1;
    else aggregateRow.tiesVsLegacy += 1;
  }

  delta.timeDeltaMs = round(delta.timeDeltaMs);
  delta.evalScoreDelta = round(delta.evalScoreDelta);
  aggregates.deltasVsLegacy['legacy-plus'] = delta;

  return aggregates;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

describePerf('perf: edge routing comparison on full fixture set', () => {
  it('compares supported routing algorithms across all available fixtures', async () => {
    const allFixtures = await buildFixtureSet();
    const fixtures = SELECTED_FIXTURE_ID
      ? allFixtures.filter((fixture) => fixture.id === SELECTED_FIXTURE_ID)
      : allFixtures;
    const algorithms = SELECTED_ALGORITHM
      ? [SELECTED_ALGORITHM]
      : (['legacy', 'legacy-plus'] as const);
    const rows: ComparisonRow[] = [];

    for (const fixture of fixtures) {
      for (const algorithm of algorithms) {
        rows.push(measure(fixture, algorithm));
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      fixtureCount: fixtures.length,
      rows,
      summary: summarize(rows),
    };

    const outputPath = RESULT_PATH
      ? path.resolve(process.cwd(), RESULT_PATH)
      : path.resolve(process.cwd(), 'tmp/edge-routing-full-fixtures-results.json');
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

    expect(rows).toHaveLength(fixtures.length * algorithms.length);
  }, 120_000);
});
