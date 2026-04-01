import { describe, expect, it } from 'vitest';
import { compareTieBreakScores } from '../edge-optimization-algorithm';
import {
  buildEdgeRoutingGeometry,
  computeEdgeRoutingPlacements,
  type EdgeRoutingEdge,
  type EdgeRoutingNodeBox,
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
) {
  return computeEdgeRoutingPlacements({
    edges,
    nodeBoxes,
    layoutDirection: 'TB',
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
});
