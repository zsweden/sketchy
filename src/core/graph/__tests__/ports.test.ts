import { describe, it, expect } from 'vitest';
import {
  getEdgeHandlePlacement,
  getHandlePoint,
  getSideFromHandleId,
  getSourceHandleId,
  getTargetHandleId,
} from '../ports';

describe('getEdgeHandlePlacement', () => {
  it('uses horizontal handles when target is mostly to the right', () => {
    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 200, y: 50 }, 'TB'),
    ).toEqual({
      sourceSide: 'bottomright-right',
      targetSide: 'topleft-left',
    });
  });

  it('uses vertical handles when target is mostly below', () => {
    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 40, y: 200 }, 'TB'),
    ).toEqual({
      sourceSide: 'bottomright-bottom',
      targetSide: 'topleft-top',
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

    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 0, y: 0 }, 'LR'),
    ).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    });

    expect(
      getEdgeHandlePlacement({ x: 0, y: 0 }, { x: 0, y: 0 }, 'RL'),
    ).toEqual({
      sourceSide: 'left',
      targetSide: 'right',
    });
  });
});

describe('handle ids', () => {
  it('builds source and target handle ids from sides', () => {
    expect(getSourceHandleId('left')).toBe('source-left');
    expect(getTargetHandleId('bottomright-right')).toBe('target-bottomright-right');
  });

  it('parses expanded handle ids', () => {
    expect(getSideFromHandleId('source-left', 'source')).toBe('left');
    expect(getSideFromHandleId('target-topright-right', 'target')).toBe('topright-right');
  });
});

describe('getHandlePoint', () => {
  const box = { left: 0, top: 0, right: 240, bottom: 48 };

  it('offsets split corner points away from the exact corner', () => {
    expect(getHandlePoint(box, 'topright-top')).toEqual({ x: 232, y: 0 });
    expect(getHandlePoint(box, 'topright-right')).toEqual({ x: 240, y: 8 });
    expect(getHandlePoint(box, 'bottomleft-bottom')).toEqual({ x: 8, y: 48 });
    expect(getHandlePoint(box, 'bottomleft-left')).toEqual({ x: 0, y: 40 });
  });
});
