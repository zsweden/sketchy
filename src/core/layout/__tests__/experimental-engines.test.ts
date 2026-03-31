import { describe, expect, it } from 'vitest';
import { computeLayoutMetrics } from '../layout-metrics';
import { experimentalLayoutEngines } from '..';
import { prepareLayoutEdges, prepareLayoutNodes } from '../layout-inputs';
import { buildChain, buildCyclicGraph } from '../../../test/layout-benchmark-fixtures';

describe('experimental layout engines', () => {
  it.each(experimentalLayoutEngines)('returns positions for every node: $label', async ({ engine }) => {
    const { nodes, edges } = buildChain(8);
    const layoutNodes = prepareLayoutNodes(nodes, edges);
    const layoutEdges = prepareLayoutEdges(edges);
    const results = await engine(layoutNodes, layoutEdges, { direction: 'TB' });

    expect(results).toHaveLength(nodes.length);
    expect(new Set(results.map((result) => result.id)).size).toBe(nodes.length);
    expect(results.every((result) => Number.isFinite(result.x) && Number.isFinite(result.y))).toBe(true);
  });

  it('keeps graphology ForceAtlas2 cyclic output free of node overlaps on a small SCC', async () => {
    const { nodes, edges } = buildCyclicGraph(8, 4);
    const layoutNodes = prepareLayoutNodes(nodes, edges);
    const layoutEdges = prepareLayoutEdges(edges);
    const graphology = experimentalLayoutEngines.find((engine) => engine.id === 'graphology-forceatlas2');
    expect(graphology).toBeDefined();

    const results = await graphology!.engine(layoutNodes, layoutEdges, { direction: 'TB', cyclic: true });
    const metrics = computeLayoutMetrics(
      layoutNodes,
      layoutEdges,
      new Map(results.map((result) => [result.id, { x: result.x, y: result.y }])),
    );

    expect(metrics.nodeOverlaps).toBe(0);
  });
});
