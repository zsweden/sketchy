import { describe, expect, it } from 'vitest';
import type { LayoutEdgeInput, LayoutInput } from '../layout-engine';
import {
  compareGraphMetrics,
  computeLayoutMetrics,
  computeRoutedEdgeGeometries,
  scoreLayoutMetrics,
  type LayoutMetrics,
} from '../layout-metrics';

function box(id: string, w = 100, h = 60): LayoutInput {
  return { id, width: w, height: h };
}

function pos(entries: [string, number, number][]): Map<string, { x: number; y: number }> {
  return new Map(entries.map(([id, x, y]) => [id, { x, y }]));
}

describe('computeLayoutMetrics', () => {
  it('reports zero for all metrics when nodes are well separated with no edges', () => {
    const nodes = [box('a'), box('b')];
    const positions = pos([['a', 0, 0], ['b', 300, 0]]);
    const metrics = computeLayoutMetrics(nodes, [], positions);
    expect(metrics.nodeOverlaps).toBe(0);
    expect(metrics.edgeCrossings).toBe(0);
    expect(metrics.edgeNodeOverlaps).toBe(0);
    expect(metrics.connectorConflicts).toBe(0);
    expect(metrics.totalEdgeLength).toBe(0);
  });

  it('detects node overlaps when bounding boxes intersect', () => {
    const nodes = [box('a'), box('b')];
    // Place b so it overlaps with a (a is at 0,0 with w=100,h=60; b at 50,30)
    const positions = pos([['a', 0, 0], ['b', 50, 30]]);
    const metrics = computeLayoutMetrics(nodes, [], positions);
    expect(metrics.nodeOverlaps).toBe(1);
  });

  it('does not count touching-but-not-overlapping nodes', () => {
    const nodes = [box('a'), box('b')];
    // b starts exactly where a ends horizontally
    const positions = pos([['a', 0, 0], ['b', 100, 0]]);
    const metrics = computeLayoutMetrics(nodes, [], positions);
    expect(metrics.nodeOverlaps).toBe(0);
  });

  it('counts multiple pairwise overlaps', () => {
    const nodes = [box('a'), box('b'), box('c')];
    // All three overlap each other
    const positions = pos([['a', 0, 0], ['b', 10, 10], ['c', 20, 20]]);
    const metrics = computeLayoutMetrics(nodes, [], positions);
    expect(metrics.nodeOverlaps).toBe(3); // a-b, a-c, b-c
  });

  it('computes bounding area', () => {
    const nodes = [box('a', 50, 50), box('b', 50, 50)];
    const positions = pos([['a', 0, 0], ['b', 200, 100]]);
    // bounding box: (0,0) to (250,150) → area = 250*150 = 37500
    const metrics = computeLayoutMetrics(nodes, [], positions);
    expect(metrics.boundingArea).toBe(37500);
  });

  it('computes total edge length for a simple vertical edge', () => {
    const nodes = [box('a', 100, 60), box('b', 100, 60)];
    const edges: LayoutEdgeInput[] = [{ source: 'a', target: 'b' }];
    // a at (0,0), b directly below at (0,200) — well separated
    const positions = pos([['a', 0, 0], ['b', 0, 200]]);
    const metrics = computeLayoutMetrics(nodes, edges, positions);
    expect(metrics.totalEdgeLength).toBeGreaterThan(0);
  });

  it('detects edge crossings between non-adjacent edges', () => {
    // X-pattern: a→d and b→c cross each other
    const nodes = [box('a'), box('b'), box('c'), box('d')];
    const edges: LayoutEdgeInput[] = [
      { source: 'a', target: 'd' },
      { source: 'b', target: 'c' },
    ];
    // a top-left, b top-right, c bottom-left, d bottom-right
    const positions = pos([
      ['a', 0, 0],
      ['b', 400, 0],
      ['c', 0, 400],
      ['d', 400, 400],
    ]);
    const metrics = computeLayoutMetrics(nodes, edges, positions);
    expect(metrics.edgeCrossings).toBeGreaterThanOrEqual(1);
  });

  it('does not count crossings between edges sharing an endpoint', () => {
    const nodes = [box('a'), box('b'), box('c')];
    const edges: LayoutEdgeInput[] = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ];
    // Fan-out from a — shared endpoint means no crossing counted
    const positions = pos([['a', 0, 0], ['b', 300, 200], ['c', -300, 200]]);
    const metrics = computeLayoutMetrics(nodes, edges, positions);
    expect(metrics.edgeCrossings).toBe(0);
  });
});

describe('computeRoutedEdgeGeometries', () => {
  it('returns a geometry for each edge', () => {
    const nodes = [box('a'), box('b'), box('c')];
    const edges: LayoutEdgeInput[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    const positions = pos([['a', 0, 0], ['b', 0, 200], ['c', 0, 400]]);
    const geometries = computeRoutedEdgeGeometries(nodes, edges, positions);
    expect(geometries.length).toBe(2);
  });

  it('produces non-empty point arrays for each geometry', () => {
    const nodes = [box('a'), box('b')];
    const edges: LayoutEdgeInput[] = [{ source: 'a', target: 'b' }];
    const positions = pos([['a', 0, 0], ['b', 300, 0]]);
    const geometries = computeRoutedEdgeGeometries(nodes, edges, positions);
    expect(geometries[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('each geometry has the original edge reference', () => {
    const nodes = [box('a'), box('b')];
    const edges: LayoutEdgeInput[] = [{ source: 'a', target: 'b' }];
    const positions = pos([['a', 0, 0], ['b', 300, 0]]);
    const geometries = computeRoutedEdgeGeometries(nodes, edges, positions);
    expect(geometries[0].edge).toEqual(edges[0]);
  });
});

describe('scoreLayoutMetrics', () => {
  it('returns 0 for perfect metrics', () => {
    const perfect: LayoutMetrics = {
      nodeOverlaps: 0,
      edgeCrossings: 0,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 0,
      boundingArea: 0,
    };
    expect(scoreLayoutMetrics(perfect)).toBe(0);
  });

  it('node overlaps dominate the score', () => {
    const withOverlap: LayoutMetrics = {
      nodeOverlaps: 1,
      edgeCrossings: 0,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 0,
      boundingArea: 0,
    };
    const withManyCrossings: LayoutMetrics = {
      nodeOverlaps: 0,
      edgeCrossings: 10,
      edgeNodeOverlaps: 10,
      connectorConflicts: 10,
      totalEdgeLength: 10000,
      boundingArea: 100000,
    };
    expect(scoreLayoutMetrics(withOverlap)).toBeGreaterThan(scoreLayoutMetrics(withManyCrossings));
  });

  it('edge crossings outweigh edge-node overlaps', () => {
    const crossings: LayoutMetrics = {
      nodeOverlaps: 0,
      edgeCrossings: 1,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 0,
      boundingArea: 0,
    };
    const edgeNode: LayoutMetrics = {
      nodeOverlaps: 0,
      edgeCrossings: 0,
      edgeNodeOverlaps: 1,
      connectorConflicts: 0,
      totalEdgeLength: 0,
      boundingArea: 0,
    };
    expect(scoreLayoutMetrics(crossings)).toBeGreaterThan(scoreLayoutMetrics(edgeNode));
  });
});

describe('compareGraphMetrics', () => {
  const base: LayoutMetrics = {
    nodeOverlaps: 0,
    edgeCrossings: 0,
    edgeNodeOverlaps: 0,
    connectorConflicts: 0,
    totalEdgeLength: 100,
    boundingArea: 1000,
  };

  it('returns 0 for identical metrics', () => {
    expect(compareGraphMetrics(base, base)).toBe(0);
  });

  it('compares by nodeOverlaps first', () => {
    const worse = { ...base, nodeOverlaps: 1 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
    expect(compareGraphMetrics(base, worse)).toBeLessThan(0);
  });

  it('compares by edgeCrossings when nodeOverlaps tie', () => {
    const worse = { ...base, edgeCrossings: 1 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
  });

  it('compares by edgeNodeOverlaps when crossings also tie', () => {
    const worse = { ...base, edgeNodeOverlaps: 1 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
  });

  it('compares by connectorConflicts next', () => {
    const worse = { ...base, connectorConflicts: 1 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
  });

  it('compares by totalEdgeLength next', () => {
    const worse = { ...base, totalEdgeLength: 200 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
  });

  it('compares by boundingArea last', () => {
    const worse = { ...base, boundingArea: 2000 };
    expect(compareGraphMetrics(worse, base)).toBeGreaterThan(0);
  });

  it('falls through to composite score when all fields equal', () => {
    // When all individual fields match, it falls through to scoreLayoutMetrics diff
    const a = { ...base };
    const b = { ...base };
    expect(compareGraphMetrics(a, b)).toBe(0);
  });
});
