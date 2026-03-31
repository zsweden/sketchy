import { describe, expect, it } from 'vitest';
import type { LayoutInput, LayoutEdgeInput } from '../layout-engine';
import { compareGraphMetrics } from '../cyclic-layout-engine';
import { computeLayoutMetrics, scoreLayoutMetrics } from '../layout-metrics';

const nodes: LayoutInput[] = [
  { id: 'a', width: 120, height: 60 },
  { id: 'b', width: 120, height: 60 },
  { id: 'c', width: 120, height: 60 },
];

const edges: LayoutEdgeInput[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];

describe('layout connector conflict scoring', () => {
  it('penalizes incoming and outgoing flow on the same side of a node', () => {
    const conflicted = computeLayoutMetrics(
      nodes,
      edges,
      new Map([
        ['a', { x: 0, y: 0 }],
        ['b', { x: 240, y: 80 }],
        ['c', { x: 0, y: 180 }],
      ]),
    );

    const separated = computeLayoutMetrics(
      nodes,
      edges,
      new Map([
        ['a', { x: 0, y: 0 }],
        ['b', { x: 240, y: 80 }],
        ['c', { x: 480, y: 180 }],
      ]),
    );

    expect(conflicted.connectorConflicts).toBeGreaterThan(separated.connectorConflicts);
    expect(scoreLayoutMetrics(conflicted)).toBeGreaterThan(scoreLayoutMetrics(separated));
  });

  it('prefers layouts without node overlaps even if crossings are lower', () => {
    const overlapHeavy = {
      nodeOverlaps: 1,
      edgeCrossings: 0,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 100,
      boundingArea: 100,
    };
    const crossingOnly = {
      nodeOverlaps: 0,
      edgeCrossings: 1,
      edgeNodeOverlaps: 0,
      connectorConflicts: 0,
      totalEdgeLength: 2_000,
      boundingArea: 5_000,
    };

    expect(compareGraphMetrics(overlapHeavy, crossingOnly)).toBeGreaterThan(0);
    expect(compareGraphMetrics(crossingOnly, overlapHeavy)).toBeLessThan(0);
  });
});
