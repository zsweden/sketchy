import { describe, it, expect } from 'vitest';
import {
  getEdgeHandlePlacement,
  getSourceHandleId,
  getTargetHandleId,
} from '../ports';

describe('getEdgeHandlePlacement', () => {
  it('uses horizontal handles when target is mostly to the right', () => {
    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 200, y: 50 }, 'TB'),
    ).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    });
  });

  it('uses vertical handles when target is mostly below', () => {
    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 40, y: 200 }, 'TB'),
    ).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });
  });

  it('falls back to layout direction when positions overlap', () => {
    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 0, y: 0 }, 'TB'),
    ).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });

    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 0, y: 0 }, 'BT'),
    ).toEqual({
      sourceSide: 'top',
      targetSide: 'bottom',
    });
  });
});

describe('handle ids', () => {
  it('builds source and target handle ids from sides', () => {
    expect(getSourceHandleId('left')).toBe('source-left');
    expect(getTargetHandleId('right')).toBe('target-right');
  });
});
