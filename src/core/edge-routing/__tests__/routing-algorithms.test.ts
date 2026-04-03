import { describe, expect, it } from 'vitest';
import { compareTieBreakScores } from '../edge-optimization-algorithm';
import {
  buildEdgeRoutingGeometry,
  computeEdgeRoutingPlacements,
  createPlacementCandidates,
  getPolylineLength,
  polylinesIntersect,
  shouldRewardSharedEndpointCrossingAlignment,
  shouldCountCrossingBetweenEdges,
  type EdgeRoutingEdge,
  type EdgeRoutingNodeBox,
  type EdgeRoutingPolicy,
} from '../index';

function boxes(entries: Array<[string, number, number, number, number]>): Map<string, EdgeRoutingNodeBox> {
  return new Map(entries.map(([id, left, top, right, bottom]) => [
    id,
    { left, top, right, bottom },
  ]));
}

function route(
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  edges: EdgeRoutingEdge[],
  policy?: EdgeRoutingPolicy,
) {
  return computeEdgeRoutingPlacements({
    edges,
    nodeBoxes,
    layoutDirection: 'TB',
    policy,
  });
}

describe('edge routing', () => {
  it('returns a placement for every edge', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 240, 48],
      ['b', 320, 0, 560, 48],
      ['c', 640, 0, 880, 48],
    ]);
    const edges = [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ];

    const placements = route(nodeBoxes, edges);
    expect(placements.size).toBe(edges.length);
    expect(placements.get('ab')).toBeDefined();
    expect(placements.get('bc')).toBeDefined();
  });

  it('legacy plus prefers middle handles before same-side sharing on score ties', () => {
    expect(compareTieBreakScores(
      {
        mixedDirectionPenalty: 0,
        sameDirectionReward: 0,
        cornerPenalty: 0,
      },
      {
        mixedDirectionPenalty: 0,
        sameDirectionReward: 1,
        cornerPenalty: 1,
      },
    )).toBeLessThan(0);
  });

  it('uses right-exiting split corner handles for mostly horizontal adjacency', () => {
    const nodeBoxes = boxes([
      ['a', 0, 100, 240, 148],
      ['b', 320, 0, 560, 48],
    ]);
    const placements = route(nodeBoxes, [{ id: 'ab', source: 'a', target: 'b' }]);

    expect(placements.get('ab')).toEqual({
      sourceSide: 'topright-right',
      targetSide: 'bottomleft-left',
    });
  });

  it('renders explicit split-corner placements with the encoded exit direction', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 240, 48],
      ['b', 40, 200, 280, 248],
    ]);
    const geometry = buildEdgeRoutingGeometry(
      { id: 'ab', source: 'a', target: 'b' },
      { sourceSide: 'bottomright-bottom', targetSide: 'topleft-top' },
      nodeBoxes,
    );

    expect(geometry.sourceExitSide).toBe('bottom');
    expect(geometry.targetExitSide).toBe('top');
    expect(geometry.points[0]).toEqual({ x: 232, y: 48 });
    expect(geometry.points[1]).toEqual({ x: 232, y: 76 });
  });


  it('legacy mode exempts reciprocal crossings', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 60 }, { x: 180, y: 60 }],
      reverse,
      [{ x: 120, y: 20 }, { x: 120, y: 100 }],
      nodeBoxes,
      { policy: 'legacy' },
    )).toBe(false);
  });

  it('reciprocal-only mode penalizes reciprocal crossings', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 60 }, { x: 180, y: 60 }],
      reverse,
      [{ x: 120, y: 20 }, { x: 120, y: 100 }],
      nodeBoxes,
      { policy: 'reciprocal-only' },
    )).toBe(true);
  });

  it('shared-endpoint-outside-buffer ignores crossings inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      reverse,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer' },
    )).toBe(false);

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 60 }, { x: 180, y: 60 }],
      reverse,
      [{ x: 120, y: 20 }, { x: 120, y: 100 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer' },
    )).toBe(true);
  });

  it('shared-endpoint-anywhere counts crossings even inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      reverse,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-anywhere' },
    )).toBe(true);
  });

  it('same-type-only buffer mode ignores same-direction crossings inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
      ['c', 0, 200, 40, 240],
    ]);
    const first = { source: 'a', target: 'b' };
    const second = { source: 'a', target: 'c' };

    expect(shouldCountCrossingBetweenEdges(
      first,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      second,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-only' },
    )).toBe(false);
  });

  it('same-type-only buffer mode penalizes mixed-direction crossings inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      reverse,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-only' },
    )).toBe(true);
  });

  it('rewarded same-type buffer mode rewards same-direction crossings inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
      ['c', 0, 200, 40, 240],
    ]);
    const first = { source: 'a', target: 'b' };
    const second = { source: 'a', target: 'c' };

    expect(shouldCountCrossingBetweenEdges(
      first,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      second,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded' },
    )).toBe(false);
    expect(shouldRewardSharedEndpointCrossingAlignment(
      first,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      second,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded' },
    )).toBe(true);
  });

  it('rewarded same-type buffer mode still penalizes mixed-direction crossings inside node neighborhoods', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 40, 40],
      ['b', 200, 0, 240, 40],
    ]);
    const forward = { source: 'a', target: 'b' };
    const reverse = { source: 'b', target: 'a' };

    expect(shouldCountCrossingBetweenEdges(
      forward,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      reverse,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded' },
    )).toBe(true);
    expect(shouldRewardSharedEndpointCrossingAlignment(
      forward,
      [{ x: 20, y: 20 }, { x: 60, y: 20 }],
      reverse,
      [{ x: 60, y: -20 }, { x: 60, y: 60 }],
      nodeBoxes,
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded' },
    )).toBe(false);
  });

  it('changes reciprocal edge placement when crossing policy is stricter', () => {
    const nodeBoxes = boxes([
      ['growth', -380, 176, -220, 236],
      ['regulatory', -680, 376, -520, 436],
      ['lower-cost', -380, 596, -220, 656],
    ]);
    const edges = [
      { id: 'growth-regulatory', source: 'growth', target: 'regulatory' },
      { id: 'regulatory-growth', source: 'regulatory', target: 'growth' },
      { id: 'regulatory-lower-cost', source: 'regulatory', target: 'lower-cost' },
    ];

    const legacyPlacements = route(nodeBoxes, edges, 'legacy');
    const strictPlacements = route(nodeBoxes, edges, 'shared-endpoint-anywhere');

    expect(legacyPlacements.get('growth-regulatory')).toEqual({
      sourceSide: 'bottomleft-bottom',
      targetSide: 'topright-top',
    });
    expect(strictPlacements.get('growth-regulatory')).toEqual({
      sourceSide: 'bottomleft-bottom',
      targetSide: 'right',
    });
  });

  it('does not treat collinear overlapping segments as crossings', () => {
    const vertical1 = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    const vertical2 = [{ x: 0, y: 50 }, { x: 0, y: 150 }];
    expect(polylinesIntersect(vertical1, vertical2)).toBe(false);

    const horizontal1 = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const horizontal2 = [{ x: 50, y: 0 }, { x: 150, y: 0 }];
    expect(polylinesIntersect(horizontal1, horizontal2)).toBe(false);
  });

  it('still detects true crossings between non-collinear segments', () => {
    const horizontal = [{ x: 0, y: 50 }, { x: 100, y: 50 }];
    const vertical = [{ x: 50, y: 0 }, { x: 50, y: 100 }];
    expect(polylinesIntersect(horizontal, vertical)).toBe(true);
  });

  it('shrinks stubs for closely-spaced facing handles', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 160, 60],
      ['b', 0, 80, 160, 140],
    ]);
    const edge = { id: 'e1', source: 'a', target: 'b' };

    const geo = buildEdgeRoutingGeometry(edge, { sourceSide: 'bottom', targetSide: 'top' }, nodeBoxes);
    const length = getPolylineLength(geo.points);
    // Gap is 20px (60 to 80), so length should reflect that, not inflate to 92
    expect(length).toBe(20);
  });

  it('prefers flow-aligned handles for reciprocal edges on close nodes', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 160, 60],
      ['b', 0, 80, 160, 140],
    ]);
    const edges = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-a', source: 'b', target: 'a' },
    ];

    const placements = computeEdgeRoutingPlacements({
      edges,
      nodeBoxes,
      layoutDirection: 'TB',
    });

    const ab = placements.get('a-b')!;
    const ba = placements.get('b-a')!;
    // Both should use vertical exits (bottom/top), not detour through right/left
    expect(['bottom', 'bottomleft-bottom', 'bottomright-bottom']).toContain(ab.sourceSide);
    expect(['top', 'topleft-top', 'topright-top']).toContain(ab.targetSide);
    expect(['top', 'topleft-top', 'topright-top']).toContain(ba.sourceSide);
    expect(['bottom', 'bottomleft-bottom', 'bottomright-bottom']).toContain(ba.targetSide);
  });

  it('flow-aligned candidate ordering puts flow-direction sides first in TB', () => {
    const nodeBoxes = boxes([
      ['a', 0, 0, 160, 60],
      ['b', 0, 200, 160, 260],
    ]);
    const candidates = createPlacementCandidates({ source: 'a', target: 'b' }, nodeBoxes, 'TB');

    const bottomRightBottom = candidates.findIndex(
      (c) => c.sourceSide === 'bottomright-bottom' && c.targetSide === 'topright-top',
    );
    const bottomRightRight = candidates.findIndex(
      (c) => c.sourceSide === 'bottomright-right' && c.targetSide === 'topright-top',
    );
    expect(bottomRightBottom).toBeLessThan(bottomRightRight);
  });
});
