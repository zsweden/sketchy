import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../src/core/types';
import { autoLayout } from '../src/core/layout/auto-layout';
import { elkEngine } from '../src/core/layout/elk-engine';
import { loadSkyFile } from '../src/core/persistence/sky-io';
import { getFramework } from '../src/frameworks/registry';
import {
  computeLayoutMetrics,
  scoreLayoutMetrics,
  type LayoutMetrics,
} from '../src/core/layout/layout-metrics';
import { prepareLayoutNodes } from '../src/core/layout/layout-inputs';
import { getLayoutPerfFixtures } from '../src/test/layout-benchmark-fixtures';
import {
  DEFAULT_EDGE_ROUTING_ALGORITHM,
  computeEdgeRoutingPlacements,
  scoreObjectiveEdgeRouting,
  type EdgeRoutingObjectiveScore,
} from '../src/core/edge-routing';

const describePerf = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;
const SELECTED_FIXTURE_ID = process.env.EDGE_ROUTING_FIXTURE_ID;
const RESULT_PATH = process.env.EDGE_ROUTING_RESULT_PATH;
const SKY_FIXTURE_DIR = 'src/core/persistence/__tests__/fixtures/desktop-sky-samples';

interface RoutingFixture {
  id: string;
  direction: 'TB' | 'BT';
  cyclic?: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ComparisonRow {
  fixture: string;
  algorithm: typeof DEFAULT_EDGE_ROUTING_ALGORITHM;
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

function hasUninitializedPositions(nodes: DiagramNode[]) {
  return nodes.every((node) => node.position.x === 0 && node.position.y === 0);
}

async function getSkyFixtures(): Promise<RoutingFixture[]> {
  const fixtureDir = path.resolve(process.cwd(), SKY_FIXTURE_DIR);
  const filenames = (await fs.readdir(fixtureDir))
    .filter((name) => name.endsWith('.sky'))
    .sort();

  return Promise.all(filenames.map(async (filename) => {
    const content = await fs.readFile(path.join(fixtureDir, filename), 'utf8');
    const result = await loadSkyFile(new File([content], filename, { type: 'application/json' }));
    const framework = getFramework(result.diagram.frameworkId);
    let nodes = result.diagram.nodes;

    if (nodes.length > 0 && (result.needsLayout || hasUninitializedPositions(nodes))) {
      const updates = await autoLayout(
        result.diagram.nodes,
        result.diagram.edges,
        {
          direction: result.diagram.settings.layoutDirection,
          cyclic: framework?.allowsCycles === true,
        },
        elkEngine,
      );
      const positions = new Map(updates.map((update) => [update.id, update.position]));
      nodes = result.diagram.nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      }));
    }

    return {
      id: `sky-${path.basename(filename, '.sky')}`,
      direction: result.diagram.settings.layoutDirection,
      cyclic: framework?.allowsCycles === true,
      nodes,
      edges: result.diagram.edges,
    };
  }));
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

  return [...generated, ...cldWithPositions, ...await getSkyFixtures()];
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
) {
  const layoutNodes = prepareLayoutNodes(fixture.nodes, fixture.edges);
  const positions = toPositionMap(fixture.nodes);
  const edges = fixture.edges.map((currentEdge) => ({
    id: currentEdge.id,
    source: currentEdge.source,
    target: currentEdge.target,
  }));
  const nodeBoxes = getNodeBoxes(fixture.nodes, fixture.edges);
  const placements = computeEdgeRoutingPlacements({
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
): ComparisonRow {
  const iterations = getIterations(fixture);
  computeMetricsForAlgorithm(fixture);
  const started = performance.now();
  let metrics = computeMetricsForAlgorithm(fixture);
  for (let index = 1; index < iterations; index++) {
    metrics = computeMetricsForAlgorithm(fixture);
  }
  const elapsed = (performance.now() - started) / iterations;

  return {
    fixture: fixture.id,
    algorithm: DEFAULT_EDGE_ROUTING_ALGORITHM,
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
    }>,
  };

  aggregates.byAlgorithm[DEFAULT_EDGE_ROUTING_ALGORITHM] = {
    fixtureCount: rows.length,
    timeMs: round(rows.reduce((sum, row) => sum + row.timeMs, 0)),
    evalScore: round(rows.reduce((sum, row) => sum + row.evalScore, 0)),
    nodeOverlaps: rows.reduce((sum, row) => sum + row.evalMetrics.nodeOverlaps, 0),
    edgeCrossings: rows.reduce((sum, row) => sum + row.evalMetrics.edgeCrossings, 0),
    edgeNodeOverlaps: rows.reduce((sum, row) => sum + row.evalMetrics.edgeNodeOverlaps, 0),
    connectorConflicts: rows.reduce((sum, row) => sum + row.evalMetrics.connectorConflicts, 0),
    totalEdgeLength: round(rows.reduce((sum, row) => sum + row.evalMetrics.totalEdgeLength, 0)),
    boundingArea: round(rows.reduce((sum, row) => sum + row.evalMetrics.boundingArea, 0)),
    score: rows.reduce<EdgeRoutingObjectiveScore>((acc, row) => ({
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
  };

  return aggregates;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

describePerf('perf: edge routing comparison on full fixture set', () => {
  it('measures the primary routing algorithm across all available fixtures', async () => {
    const allFixtures = await buildFixtureSet();
    const fixtures = SELECTED_FIXTURE_ID
      ? allFixtures.filter((fixture) => fixture.id === SELECTED_FIXTURE_ID)
      : allFixtures;
    const rows: ComparisonRow[] = [];

    for (const fixture of fixtures) {
      rows.push(measure(fixture));
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

    expect(rows).toHaveLength(fixtures.length);
  }, 120_000);
});
