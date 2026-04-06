import { describe, it, expect } from 'vitest';
import { getBox, boxesIntersect, getPolylineLength } from '../routed-edge-geometry';

describe('getBox', () => {
  it('computes bounding box from node and position', () => {
    const node = { id: 'a', width: 100, height: 50 };
    const positions = new Map([['a', { x: 10, y: 20 }]]);
    const box = getBox(node, positions);
    expect(box).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
  });

  it('throws when position is missing', () => {
    const node = { id: 'a', width: 100, height: 50 };
    const positions = new Map<string, { x: number; y: number }>();
    expect(() => getBox(node, positions)).toThrow('Missing position for a');
  });
});

describe('boxesIntersect', () => {
  it('returns true for overlapping boxes', () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 };
    const b = { left: 50, top: 50, right: 150, bottom: 150 };
    expect(boxesIntersect(a, b)).toBe(true);
  });

  it('returns false for non-overlapping boxes', () => {
    const a = { left: 0, top: 0, right: 50, bottom: 50 };
    const b = { left: 100, top: 100, right: 200, bottom: 200 };
    expect(boxesIntersect(a, b)).toBe(false);
  });

  it('returns false for adjacent boxes (touching edges)', () => {
    const a = { left: 0, top: 0, right: 50, bottom: 50 };
    const b = { left: 50, top: 0, right: 100, bottom: 50 };
    expect(boxesIntersect(a, b)).toBe(false);
  });
});

describe('getPolylineLength', () => {
  it('computes Manhattan length of a polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    expect(getPolylineLength(points)).toBe(150);
  });

  it('returns 0 for a single point', () => {
    expect(getPolylineLength([{ x: 5, y: 5 }])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(getPolylineLength([])).toBe(0);
  });
});
