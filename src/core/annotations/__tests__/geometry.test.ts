import { describe, expect, it } from 'vitest';
import {
  createAnnotation,
  getClickPlacementPatch,
  getDragResizePatch,
  getLineNodeGeometry,
  moveLineToNodePosition,
} from '../geometry';

describe('annotation geometry', () => {
  it('creates line annotations from explicit endpoints', () => {
    expect(createAnnotation('line', { x: 10, y: 20 }, 'a1')).toMatchObject({
      id: 'a1',
      kind: 'line',
      start: { x: 10, y: 20 },
      end: { x: 210, y: 140 },
      data: {},
    });
  });

  it('derives a padded node box for line annotations', () => {
    const geometry = getLineNodeGeometry({
      id: 'a1',
      kind: 'line',
      start: { x: 50, y: 80 },
      end: { x: 10, y: 20 },
      data: {},
    });

    expect(geometry).toEqual({
      position: { x: -2, y: 8 },
      size: { width: 64, height: 84 },
      localStart: { x: 52, y: 72 },
      localEnd: { x: 12, y: 12 },
    });
  });

  it('moves a line by its derived React Flow node position', () => {
    const moved = moveLineToNodePosition(
      {
        id: 'a1',
        kind: 'line',
        start: { x: 50, y: 80 },
        end: { x: 10, y: 20 },
        data: {},
      },
      { x: 100, y: 200 },
    );

    expect(moved.start).toEqual({ x: 152, y: 272 });
    expect(moved.end).toEqual({ x: 112, y: 212 });
  });

  it('builds drag resize patches in every direction', () => {
    expect(getDragResizePatch({ x: 100, y: 100 }, { x: 40, y: 60 })).toEqual({
      size: { width: 60, height: 40 },
      position: { x: 40, y: 60 },
    });
    expect(getDragResizePatch({ x: 100, y: 100 }, { x: 105, y: 108 })).toEqual({
      size: { width: 20, height: 20 },
      position: { x: 100, y: 100 },
    });
  });

  it('centers default shapes on click placement', () => {
    expect(getClickPlacementPatch('rect', { x: 200, y: 150 })).toEqual({
      size: { width: 160, height: 100 },
      position: { x: 120, y: 100 },
    });
  });
});
