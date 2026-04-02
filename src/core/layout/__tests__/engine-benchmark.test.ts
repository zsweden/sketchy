import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { autoLayout } from '../auto-layout';
import {
  elkEngine,
  elkForceEngine,
  elkRadialEngine,
  elkStressEngine,
} from '../elk-engine';
import { prepareLayoutEdges, prepareLayoutNodes } from '../layout-inputs';
import { computeLayoutMetrics, scoreLayoutMetrics } from '../layout-metrics';
import { getLayoutPerfFixtures } from '../../../test/layout-benchmark-fixtures';

const describePerf = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;
const SHOULD_LOG = process.env.RUN_PERF_TESTS === '1';

interface BenchmarkFixture {
  id: string;
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  cyclic?: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface BenchmarkRow {
  fixture: string;
  engine: string;
  timeMs: number | null;
  score: number | null;
  nodeOverlaps: number | null;
  edgeCrossings: number | null;
  edgeNodeOverlaps: number | null;
  connectorConflicts: number | null;
  totalEdgeLength: number | null;
  boundingArea: number | null;
  error?: string;
}

const engines = [
  { id: 'current-auto', engine: elkEngine, useAutoLayout: true },
  { id: 'elk-force', engine: elkForceEngine, useAutoLayout: false },
  { id: 'elk-stress', engine: elkStressEngine, useAutoLayout: false },
  { id: 'elk-radial', engine: elkRadialEngine, useAutoLayout: false },
] as const;

function getEngineBenchmarkFixtures() {
  const selected = new Set([
    'layout-100-chain',
    'layout-127-tree',
    'layout-100-dense',
    'layout-12-cyclic',
  ]);
  return getLayoutPerfFixtures().filter((fixture) => selected.has(fixture.id)) as BenchmarkFixture[];
}

async function benchAsync<T>(fn: () => Promise<T>) {
  const before = performance.now();
  const value = await fn();
  return {
    value,
    timeMs: Math.round((performance.now() - before) * 100) / 100,
  };
}

async function runAutoLayoutWithEngine(
  fixture: BenchmarkFixture,
  engine: (typeof engines)[number]['engine'],
) {
  const updates = await autoLayout(
    fixture.nodes,
    fixture.edges,
    { direction: fixture.direction, cyclic: fixture.cyclic },
    engine,
  );
  return new Map(updates.map((update) => [update.id, update.position]));
}

async function runRawEngine(
  fixture: BenchmarkFixture,
  engine: (typeof engines)[number]['engine'],
) {
  const layoutNodes = prepareLayoutNodes(fixture.nodes, fixture.edges);
  const layoutEdges = prepareLayoutEdges(fixture.edges);
  const results = await engine(layoutNodes, layoutEdges, {
    direction: fixture.direction,
    cyclic: fixture.cyclic,
  });
  return new Map(results.map((result) => [result.id, { x: result.x, y: result.y }]));
}

function computeMetrics(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  positions: Map<string, { x: number; y: number }>,
) {
  return computeLayoutMetrics(
    prepareLayoutNodes(nodes, edges),
    prepareLayoutEdges(edges),
    positions,
  );
}

describePerf('perf: layout engine comparison', () => {
  it('benchmarks the available layout engines across the shared perf fixtures', async () => {
    const rows: BenchmarkRow[] = [];
    const fixtures = getEngineBenchmarkFixtures();

    for (const fixture of fixtures) {
      for (const entry of engines) {
        try {
          const run = await benchAsync(async () => (
            entry.useAutoLayout
              ? runAutoLayoutWithEngine(fixture, entry.engine)
              : runRawEngine(fixture, entry.engine)
          ));
          const metrics = computeMetrics(fixture.nodes, fixture.edges, run.value);
          rows.push({
            fixture: fixture.id,
            engine: entry.id,
            timeMs: run.timeMs,
            score: Math.round(scoreLayoutMetrics(metrics)),
            ...metrics,
          });
        } catch (error) {
          rows.push({
            fixture: fixture.id,
            engine: entry.id,
            timeMs: null,
            score: null,
            nodeOverlaps: null,
            edgeCrossings: null,
            edgeNodeOverlaps: null,
            connectorConflicts: null,
            totalEdgeLength: null,
            boundingArea: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (SHOULD_LOG) {
      console.table(rows);
    }

    expect(rows.length).toBe(fixtures.length * engines.length);
    const successfulRows = rows.filter((row) => row.timeMs !== null && row.score !== null);
    expect(successfulRows.length).toBeGreaterThan(0);
    expect(
      successfulRows.every((row) => Number.isFinite(row.timeMs) && Number.isFinite(row.score)),
    ).toBe(true);
  }, 240_000);
});
