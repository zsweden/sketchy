import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { autoLayout } from '../auto-layout';
import { elkEngine } from '../elk-engine';
import { experimentalLayoutEngines } from '../experimental-engines';
import { prepareLayoutEdges, prepareLayoutNodes } from '../layout-inputs';
import { computeLayoutMetrics, scoreLayoutMetrics } from '../layout-metrics';
import { getLayoutPerfFixtures } from '../../../test/layout-benchmark-fixtures';

const describePerf = process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;

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

async function benchAsync<T>(fn: () => Promise<T>) {
  const before = performance.now();
  const value = await fn();
  return {
    value,
    timeMs: Math.round((performance.now() - before) * 100) / 100,
  };
}

async function runCurrentAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: 'TB' | 'BT',
  cyclic?: boolean,
) {
  const updates = await autoLayout(nodes, edges, { direction, cyclic }, elkEngine);
  return new Map(updates.map((update) => [update.id, update.position]));
}

async function runRawEngine(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: 'TB' | 'BT',
  cyclic: boolean | undefined,
  engine: (typeof experimentalLayoutEngines)[number]['engine'],
) {
  const layoutNodes = prepareLayoutNodes(nodes, edges);
  const layoutEdges = prepareLayoutEdges(edges);
  const results = await engine(layoutNodes, layoutEdges, { direction, cyclic });
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
  it('benchmarks alternative engines across the shared perf fixtures', async () => {
    const rows: BenchmarkRow[] = [];
    const fixtures = getLayoutPerfFixtures();

    for (const fixture of fixtures) {
      const current = await benchAsync(async () =>
        runCurrentAutoLayout(fixture.nodes, fixture.edges, fixture.direction, fixture.cyclic),
      );
      const currentMetrics = computeMetrics(fixture.nodes, fixture.edges, current.value);
      rows.push({
        fixture: fixture.id,
        engine: 'current-auto',
        timeMs: current.timeMs,
        score: Math.round(scoreLayoutMetrics(currentMetrics)),
        ...currentMetrics,
      });

      for (const experimental of experimentalLayoutEngines) {
        try {
          const run = await benchAsync(async () =>
            runRawEngine(
              fixture.nodes,
              fixture.edges,
              fixture.direction,
              fixture.cyclic,
              experimental.engine,
            ),
          );
          const metrics = computeMetrics(fixture.nodes, fixture.edges, run.value);
          rows.push({
            fixture: fixture.id,
            engine: experimental.id,
            timeMs: run.timeMs,
            score: Math.round(scoreLayoutMetrics(metrics)),
            ...metrics,
          });
        } catch (error) {
          rows.push({
            fixture: fixture.id,
            engine: experimental.id,
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

    console.table(rows);
    expect(rows.length).toBe(fixtures.length * (experimentalLayoutEngines.length + 1));
    const successfulRows = rows.filter((row) => row.timeMs !== null && row.score !== null);
    expect(successfulRows.length).toBeGreaterThan(0);
    expect(successfulRows.every((row) => Number.isFinite(row.timeMs) && Number.isFinite(row.score))).toBe(true);
  }, 180_000);
});
