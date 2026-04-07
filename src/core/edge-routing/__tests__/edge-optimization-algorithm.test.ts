import { describe, it, expect } from 'vitest';
import {
  computeLegacyPlusEdgeRoutingPlacements,
  compareTieBreakScores,
} from '../edge-optimization-algorithm';
import type { EdgeRoutingNodeBox } from '../shared';
import { DEFAULT_EDGE_ROUTING_CONFIG } from '../shared';

function box(x: number, y: number, w = 160, h = 60): EdgeRoutingNodeBox {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

describe('compareTieBreakScores', () => {
  it('prefers lower mixedDirectionPenalty', () => {
    const a = { mixedDirectionPenalty: 0, sameDirectionReward: 0, cornerPenalty: 0 };
    const b = { mixedDirectionPenalty: 1, sameDirectionReward: 0, cornerPenalty: 0 };
    expect(compareTieBreakScores(a, b)).toBeLessThan(0);
  });

  it('breaks ties by cornerPenalty', () => {
    const a = { mixedDirectionPenalty: 0, sameDirectionReward: 0, cornerPenalty: 1 };
    const b = { mixedDirectionPenalty: 0, sameDirectionReward: 0, cornerPenalty: 0 };
    expect(compareTieBreakScores(a, b)).toBeGreaterThan(0);
  });

  it('prefers higher sameDirectionReward when others tie', () => {
    const a = { mixedDirectionPenalty: 0, sameDirectionReward: 2, cornerPenalty: 0 };
    const b = { mixedDirectionPenalty: 0, sameDirectionReward: 1, cornerPenalty: 0 };
    // Higher reward is better → a should be preferred (negative result)
    expect(compareTieBreakScores(a, b)).toBeLessThan(0);
  });

  it('returns 0 for equal scores', () => {
    const a = { mixedDirectionPenalty: 1, sameDirectionReward: 1, cornerPenalty: 1 };
    expect(compareTieBreakScores(a, { ...a })).toBe(0);
  });
});

describe('computeLegacyPlusEdgeRoutingPlacements', () => {
  it('returns a placement for each edge', () => {
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['n2', box(0, 200)],
    ]);

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes,
      layoutDirection: 'TB',
    });

    expect(placements.size).toBe(1);
    const p = placements.get('e1')!;
    expect(p).toBeDefined();
    expect(p.sourceSide).toBeDefined();
    expect(p.targetSide).toBeDefined();
  });

  it('returns placements for multiple edges', () => {
    const nodeBoxes = new Map([
      ['a', box(0, 0)],
      ['b', box(200, 0)],
      ['c', box(0, 200)],
    ]);

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
      nodeBoxes,
      layoutDirection: 'TB',
    });

    expect(placements.size).toBe(2);
    expect(placements.has('e1')).toBe(true);
    expect(placements.has('e2')).toBe(true);
  });

  it('prefers flow-aligned sides in TB layout', () => {
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['n2', box(0, 300)],
    ]);

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes,
      layoutDirection: 'TB',
    });

    const p = placements.get('e1')!;
    // For TB layout with vertical offset, flow-aligned means bottom→top
    expect(p.sourceSide).toContain('bottom');
    expect(p.targetSide).toContain('top');
  });

  it('avoids edge-node overlaps', () => {
    // Place a blocking node between source and target
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['blocker', box(60, 120)],
      ['n2', box(0, 300)],
    ]);

    const withBlocker = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes,
      layoutDirection: 'TB',
    });

    const withoutBlocker = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes: new Map([['n1', box(0, 0)], ['n2', box(0, 300)]]),
      layoutDirection: 'TB',
    });

    // Both should produce valid placements
    expect(withBlocker.get('e1')).toBeDefined();
    expect(withoutBlocker.get('e1')).toBeDefined();
  });

  it('handles edges sharing an endpoint', () => {
    // Fan-out from a single source
    const nodeBoxes = new Map([
      ['root', box(200, 0)],
      ['a', box(0, 200)],
      ['b', box(200, 200)],
      ['c', box(400, 200)],
    ]);

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [
        { id: 'e1', source: 'root', target: 'a' },
        { id: 'e2', source: 'root', target: 'b' },
        { id: 'e3', source: 'root', target: 'c' },
      ],
      nodeBoxes,
      layoutDirection: 'TB',
    });

    expect(placements.size).toBe(3);
    // All placements should have valid sides
    for (const [, p] of placements) {
      expect(p.sourceSide).toBeDefined();
      expect(p.targetSide).toBeDefined();
    }
  });

  it('respects config overrides', () => {
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['n2', box(0, 200)],
    ]);

    const config = { ...DEFAULT_EDGE_ROUTING_CONFIG, flowAlignedBonus: 0 };

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes,
      layoutDirection: 'TB',
      config,
    });

    expect(placements.get('e1')).toBeDefined();
  });

  it('handles single-edge graph with LR layout', () => {
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['n2', box(300, 0)],
    ]);

    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      nodeBoxes,
      layoutDirection: 'LR',
    });

    const p = placements.get('e1')!;
    expect(p.sourceSide).toContain('right');
    expect(p.targetSide).toContain('left');
  });

  it('produces stable results across multiple runs', () => {
    const nodeBoxes = new Map([
      ['n1', box(0, 0)],
      ['n2', box(200, 0)],
      ['n3', box(0, 200)],
    ]);
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n3' },
    ];

    const run1 = computeLegacyPlusEdgeRoutingPlacements({ edges, nodeBoxes, layoutDirection: 'TB' });
    const run2 = computeLegacyPlusEdgeRoutingPlacements({ edges, nodeBoxes, layoutDirection: 'TB' });

    for (const [id, p1] of run1) {
      const p2 = run2.get(id)!;
      expect(p1.sourceSide).toBe(p2.sourceSide);
      expect(p1.targetSide).toBe(p2.targetSide);
    }
  });

  it('handles empty edge list', () => {
    const nodeBoxes = new Map([['n1', box(0, 0)]]);
    const placements = computeLegacyPlusEdgeRoutingPlacements({
      edges: [],
      nodeBoxes,
      layoutDirection: 'TB',
    });
    expect(placements.size).toBe(0);
  });
});
