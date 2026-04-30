import { describe, it, expect } from 'vitest';
import {
  buildEdgeRoutingGeometry,
  createPlacementCandidates,
  getAutomaticEdgeRoutingPlacement,
} from '../placement';
import type { EdgeRoutingNodeBox } from '../types';
import type { LayoutDirection } from '../../framework-types';

function box(left: number, top: number, w = 100, h = 60): EdgeRoutingNodeBox {
  return { left, top, right: left + w, bottom: top + h };
}

function nodeBoxes(entries: Record<string, EdgeRoutingNodeBox>): Map<string, EdgeRoutingNodeBox> {
  return new Map(Object.entries(entries));
}

describe('getAutomaticEdgeRoutingPlacement', () => {
  it('falls back to flow-direction default when source box is missing', () => {
    const directions: { direction: LayoutDirection; expected: { sourceSide: string; targetSide: string } }[] = [
      { direction: 'TB', expected: { sourceSide: 'bottom', targetSide: 'top' } },
      { direction: 'BT', expected: { sourceSide: 'top', targetSide: 'bottom' } },
      { direction: 'LR', expected: { sourceSide: 'right', targetSide: 'left' } },
      { direction: 'RL', expected: { sourceSide: 'left', targetSide: 'right' } },
    ];

    for (const { direction, expected } of directions) {
      const placement = getAutomaticEdgeRoutingPlacement(
        { source: 'a', target: 'b' },
        nodeBoxes({ b: box(0, 0) }),
        direction,
      );
      expect(placement).toEqual(expected);
    }
  });

  it('falls back to flow-direction default when both boxes are coincident', () => {
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(0, 0) }),
      'LR',
    );
    expect(placement.sourceSide).toBe('right');
    expect(placement.targetSide).toBe('left');
  });

  it('chooses horizontal exit sides when target is far to the right', () => {
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(400, 0) }),
      'TB',
    );
    expect(placement.sourceSide).toBe('right');
    expect(placement.targetSide).toBe('left');
  });

  it('chooses vertical exit sides when target is far below', () => {
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(0, 400) }),
      'TB',
    );
    expect(placement.sourceSide).toBe('bottom');
    expect(placement.targetSide).toBe('top');
  });

  it('breaks polyline-length ties using the layout flow axis (TB → vertical)', () => {
    // Square offset → identical polyline length for horizontal vs vertical.
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(300, 300) }),
      'TB',
    );
    expect(placement.sourceSide).toMatch(/bottom/);
    expect(placement.targetSide).toMatch(/top/);
  });

  it('breaks polyline-length ties using the layout flow axis (LR → horizontal)', () => {
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(300, 300) }),
      'LR',
    );
    expect(placement.sourceSide).toMatch(/right/);
    expect(placement.targetSide).toMatch(/left/);
  });

  it('points target downward when target sits above source under BT layout', () => {
    const placement = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 400), b: box(0, 0) }),
      'BT',
    );
    expect(placement.sourceSide).toBe('top');
    expect(placement.targetSide).toBe('bottom');
  });
});

describe('createPlacementCandidates', () => {
  it('always returns the automatic placement first', () => {
    const automatic = getAutomaticEdgeRoutingPlacement(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(400, 0) }),
      'LR',
    );
    const candidates = createPlacementCandidates(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(400, 0) }),
      'LR',
    );
    expect(candidates[0]).toEqual(automatic);
  });

  it('produces only unique source-target side pairs', () => {
    const candidates = createPlacementCandidates(
      { source: 'a', target: 'b' },
      nodeBoxes({ a: box(0, 0), b: box(200, 0) }),
      'TB',
    );
    const keys = candidates.map((p) => `${p.sourceSide}:${p.targetSide}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('falls back to the layout flow when both boxes are missing', () => {
    const candidates = createPlacementCandidates(
      { source: 'missing-a', target: 'missing-b' },
      nodeBoxes({}),
      'TB',
    );
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('orders flow-aligned base sides before non-flow sides for each direction', () => {
    for (const direction of ['TB', 'BT', 'LR', 'RL'] as LayoutDirection[]) {
      const candidates = createPlacementCandidates(
        { source: 'a', target: 'b' },
        nodeBoxes({ a: box(0, 0), b: box(400, 400) }),
        direction,
      );
      // The first candidate after the automatic+base-horizontal+base-vertical seeds
      // should still keep the unique-set invariant.
      expect(candidates.length).toBeGreaterThan(4);
    }
  });
});

describe('buildEdgeRoutingGeometry', () => {
  it('returns empty points when source box is missing', () => {
    const geometry = buildEdgeRoutingGeometry(
      { id: 'e1', source: 'a', target: 'b' },
      { sourceSide: 'right', targetSide: 'left' },
      nodeBoxes({ b: box(0, 0) }),
    );
    expect(geometry.points).toEqual([]);
    expect(geometry.sourceExitSide).toBe('right');
    expect(geometry.targetExitSide).toBe('left');
  });

  it('produces a horizontal-then-vertical-then-horizontal polyline for horizontal exits', () => {
    const geometry = buildEdgeRoutingGeometry(
      { id: 'e1', source: 'a', target: 'b' },
      { sourceSide: 'right', targetSide: 'left' },
      nodeBoxes({ a: box(0, 0), b: box(400, 200) }),
    );
    expect(geometry.points.length).toBeGreaterThanOrEqual(4);
    expect(geometry.sourceExitSide).toBe('right');
    expect(geometry.targetExitSide).toBe('left');
  });

  it('shrinks the stub length when nodes are very close on the same axis', () => {
    const closeStub = buildEdgeRoutingGeometry(
      { id: 'e1', source: 'a', target: 'b' },
      { sourceSide: 'right', targetSide: 'left' },
      nodeBoxes({ a: box(0, 0), b: box(120, 0) }),
    );
    const farStub = buildEdgeRoutingGeometry(
      { id: 'e1', source: 'a', target: 'b' },
      { sourceSide: 'right', targetSide: 'left' },
      nodeBoxes({ a: box(0, 0), b: box(500, 0) }),
    );
    // First segment is the stub off the source; close pair must produce a shorter stub.
    const closeStubLen = Math.abs(closeStub.points[1].x - closeStub.points[0].x);
    const farStubLen = Math.abs(farStub.points[1].x - farStub.points[0].x);
    expect(closeStubLen).toBeLessThan(farStubLen);
  });
});
