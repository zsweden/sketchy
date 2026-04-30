import { describe, it, expect } from 'vitest';
import {
  shouldCountCrossingBetweenEdges,
  shouldRewardSharedEndpointCrossingAlignment,
} from '../crossing';
import type { Point } from '../geometry';
import type { EdgeRoutingNodeBox, EdgeRoutingPolicy } from '../types';

function box(left: number, top: number, w = 100, h = 60): EdgeRoutingNodeBox {
  return { left, top, right: left + w, bottom: top + h };
}

const horizontalLine = (y: number): Point[] => [
  { x: 0, y },
  { x: 500, y },
];

const verticalLine = (x: number): Point[] => [
  { x, y: 0 },
  { x, y: 500 },
];

describe('shouldCountCrossingBetweenEdges — non-intersecting', () => {
  it('returns false when polylines do not intersect, regardless of policy', () => {
    const policies: EdgeRoutingPolicy[] = [
      'legacy',
      'reciprocal-only',
      'shared-endpoint-anywhere',
      'shared-endpoint-outside-buffer',
      'shared-endpoint-outside-buffer-same-type-only',
      'shared-endpoint-outside-buffer-same-type-rewarded',
      'shared-endpoint-same-type-forgiven',
    ];

    for (const policy of policies) {
      const result = shouldCountCrossingBetweenEdges(
        { source: 'a', target: 'b' },
        horizontalLine(0),
        { source: 'c', target: 'd' },
        horizontalLine(50),
        new Map(),
        { policy },
      );
      expect(result, `policy=${policy}`).toBe(false);
    }
  });

  it('returns true when polylines intersect and edges share no endpoint, regardless of policy', () => {
    const policies: EdgeRoutingPolicy[] = [
      'legacy',
      'reciprocal-only',
      'shared-endpoint-anywhere',
      'shared-endpoint-outside-buffer',
      'shared-endpoint-outside-buffer-same-type-only',
      'shared-endpoint-outside-buffer-same-type-rewarded',
      'shared-endpoint-same-type-forgiven',
    ];

    for (const policy of policies) {
      const result = shouldCountCrossingBetweenEdges(
        { source: 'a', target: 'b' },
        horizontalLine(100),
        { source: 'c', target: 'd' },
        verticalLine(250),
        new Map(),
        { policy },
      );
      expect(result, `policy=${policy}`).toBe(true);
    }
  });
});

describe('shouldCountCrossingBetweenEdges — shared-endpoint policies', () => {
  const intersectingHorizontal = horizontalLine(50);
  const intersectingVertical = verticalLine(250);

  it('legacy policy ignores shared-endpoint crossings', () => {
    const result = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      intersectingHorizontal,
      { source: 'a', target: 'c' },
      intersectingVertical,
      new Map(),
      { policy: 'legacy' },
    );
    expect(result).toBe(false);
  });

  it('reciprocal-only counts crossings only when edges form a bidirectional pair', () => {
    const reciprocal = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      intersectingHorizontal,
      { source: 'b', target: 'a' },
      intersectingVertical,
      new Map(),
      { policy: 'reciprocal-only' },
    );
    expect(reciprocal).toBe(true);

    const sharedSourceOnly = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      intersectingHorizontal,
      { source: 'a', target: 'c' },
      intersectingVertical,
      new Map(),
      { policy: 'reciprocal-only' },
    );
    expect(sharedSourceOnly).toBe(false);
  });

  it('shared-endpoint-anywhere always counts shared-endpoint intersections', () => {
    const result = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      intersectingHorizontal,
      { source: 'a', target: 'c' },
      intersectingVertical,
      new Map(),
      { policy: 'shared-endpoint-anywhere' },
    );
    expect(result).toBe(true);
  });

  it('shared-endpoint-outside-buffer ignores intersections inside endpoint neighborhoods', () => {
    // Both edges share endpoint 'a' at origin; they intersect very close to it.
    const nearOrigin: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const otherNearOrigin: Point[] = [{ x: 0, y: 100 }, { x: 100, y: 0 }];

    const insideBuffer = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      nearOrigin,
      { source: 'a', target: 'c' },
      otherNearOrigin,
      new Map([
        ['a', box(-20, -20, 40, 40)],
        ['b', box(80, 80, 40, 40)],
        ['c', box(80, -60, 40, 40)],
      ]),
      { policy: 'shared-endpoint-outside-buffer', nodeNeighborhoodPadding: 200 },
    );
    expect(insideBuffer).toBe(false);
  });

  it('shared-endpoint-outside-buffer counts intersections that happen far from any endpoint', () => {
    // Axis-aligned segments crossing at (250, 20), well outside every expanded endpoint box.
    const aToB: Point[] = [{ x: 20, y: 20 }, { x: 520, y: 20 }];
    const aToC: Point[] = [{ x: 250, y: 0 }, { x: 250, y: 500 }];

    const result = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      aToB,
      { source: 'a', target: 'c' },
      aToC,
      new Map([
        ['a', box(0, 0, 40, 40)],
        ['b', box(500, 0, 40, 40)],
        ['c', box(0, 500, 40, 40)],
      ]),
      { policy: 'shared-endpoint-outside-buffer', nodeNeighborhoodPadding: 30 },
    );
    expect(result).toBe(true);
  });

  it('shared-endpoint-same-type-forgiven ignores crossings when both edges share endpoint with the same direction', () => {
    // Both edges leave node 'a' as outgoing → same direction at the shared endpoint.
    const sameDirection = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      horizontalLine(50),
      { source: 'a', target: 'c' },
      verticalLine(250),
      new Map(),
      { policy: 'shared-endpoint-same-type-forgiven' },
    );
    expect(sameDirection).toBe(false);

    // Edges meet at 'a' from opposite sides → mixed direction → counted.
    const mixedDirection = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      horizontalLine(50),
      { source: 'c', target: 'a' },
      verticalLine(250),
      new Map(),
      { policy: 'shared-endpoint-same-type-forgiven' },
    );
    expect(mixedDirection).toBe(true);
  });

  it('shared-endpoint-outside-buffer-same-type-only counts mixed-direction crossings even inside the buffer', () => {
    const mixedInsideBuffer = shouldCountCrossingBetweenEdges(
      { source: 'a', target: 'b' },
      [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      { source: 'c', target: 'a' },
      [{ x: 0, y: 100 }, { x: 100, y: 0 }],
      new Map([
        ['a', box(-20, -20, 40, 40)],
        ['b', box(80, 80, 40, 40)],
        ['c', box(-20, 80, 40, 40)],
      ]),
      { policy: 'shared-endpoint-outside-buffer-same-type-only', nodeNeighborhoodPadding: 200 },
    );
    expect(mixedInsideBuffer).toBe(true);
  });
});

describe('shouldRewardSharedEndpointCrossingAlignment', () => {
  it('only applies under the same-type-rewarded policy', () => {
    const policies: EdgeRoutingPolicy[] = [
      'legacy',
      'reciprocal-only',
      'shared-endpoint-anywhere',
      'shared-endpoint-outside-buffer',
      'shared-endpoint-outside-buffer-same-type-only',
      'shared-endpoint-same-type-forgiven',
    ];

    for (const policy of policies) {
      const result = shouldRewardSharedEndpointCrossingAlignment(
        { source: 'a', target: 'b' },
        horizontalLine(50),
        { source: 'a', target: 'c' },
        verticalLine(250),
        new Map(),
        { policy },
      );
      expect(result, `policy=${policy}`).toBe(false);
    }
  });

  it('rewards same-direction shared-endpoint crossings inside the endpoint buffer', () => {
    const result = shouldRewardSharedEndpointCrossingAlignment(
      { source: 'a', target: 'b' },
      [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      { source: 'a', target: 'c' },
      [{ x: 0, y: 100 }, { x: 100, y: 0 }],
      new Map([
        ['a', box(-20, -20, 40, 40)],
        ['b', box(80, 80, 40, 40)],
        ['c', box(80, -20, 40, 40)],
      ]),
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded', nodeNeighborhoodPadding: 200 },
    );
    expect(result).toBe(true);
  });

  it('does not reward when edges meet at the shared endpoint with mixed directions', () => {
    const result = shouldRewardSharedEndpointCrossingAlignment(
      { source: 'a', target: 'b' },
      [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      { source: 'c', target: 'a' },
      [{ x: 0, y: 100 }, { x: 100, y: 0 }],
      new Map([
        ['a', box(-20, -20, 40, 40)],
        ['b', box(80, 80, 40, 40)],
        ['c', box(-20, 80, 40, 40)],
      ]),
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded', nodeNeighborhoodPadding: 200 },
    );
    expect(result).toBe(false);
  });

  it('does not reward when no endpoint is shared', () => {
    const result = shouldRewardSharedEndpointCrossingAlignment(
      { source: 'a', target: 'b' },
      horizontalLine(100),
      { source: 'c', target: 'd' },
      verticalLine(250),
      new Map(),
      { policy: 'shared-endpoint-outside-buffer-same-type-rewarded' },
    );
    expect(result).toBe(false);
  });
});
