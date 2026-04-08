import { describe, it, expect } from 'vitest';
import {
  getCenter,
  offsetPoint,
  dedupePoints,
  expandBox,
  getPolylineLength,
  polylineIntersectsBox,
  polylinesIntersect,
  type Point,
  type BoundingBox,
} from '../geometry';

describe('geometry', () => {
  describe('getCenter', () => {
    it('returns the center of a box', () => {
      const box: BoundingBox = { left: 0, top: 0, right: 100, bottom: 80 };
      expect(getCenter(box)).toEqual({ x: 50, y: 40 });
    });

    it('handles negative coordinates', () => {
      const box: BoundingBox = { left: -100, top: -50, right: 100, bottom: 50 };
      expect(getCenter(box)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('offsetPoint', () => {
    const origin: Point = { x: 10, y: 20 };

    it('offsets top (negative y)', () => {
      expect(offsetPoint(origin, 'top', 5)).toEqual({ x: 10, y: 15 });
    });

    it('offsets right (positive x)', () => {
      expect(offsetPoint(origin, 'right', 5)).toEqual({ x: 15, y: 20 });
    });

    it('offsets bottom (positive y)', () => {
      expect(offsetPoint(origin, 'bottom', 5)).toEqual({ x: 10, y: 25 });
    });

    it('offsets left (negative x)', () => {
      expect(offsetPoint(origin, 'left', 5)).toEqual({ x: 5, y: 20 });
    });
  });

  describe('dedupePoints', () => {
    it('removes consecutive duplicates', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ];
      expect(dedupePoints(points)).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ]);
    });

    it('keeps non-consecutive duplicates', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
      ];
      expect(dedupePoints(points)).toHaveLength(3);
    });

    it('returns single point unchanged', () => {
      expect(dedupePoints([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
    });

    it('returns empty array for empty input', () => {
      expect(dedupePoints([])).toEqual([]);
    });
  });

  describe('expandBox', () => {
    it('expands box by padding in all directions', () => {
      const box: BoundingBox = { left: 10, top: 20, right: 50, bottom: 60 };
      expect(expandBox(box, 5)).toEqual({ left: 5, top: 15, right: 55, bottom: 65 });
    });

    it('handles zero padding', () => {
      const box: BoundingBox = { left: 0, top: 0, right: 100, bottom: 100 };
      expect(expandBox(box, 0)).toEqual(box);
    });
  });

  describe('getPolylineLength', () => {
    it('computes Manhattan distance for two points', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
      expect(getPolylineLength(points)).toBe(7); // |3| + |4|
    });

    it('sums segments for multiple points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ];
      expect(getPolylineLength(points)).toBe(20);
    });

    it('returns 0 for single point', () => {
      expect(getPolylineLength([{ x: 5, y: 5 }])).toBe(0);
    });

    it('returns 0 for empty array', () => {
      expect(getPolylineLength([])).toBe(0);
    });
  });

  describe('polylineIntersectsBox', () => {
    const box: BoundingBox = { left: 10, top: 10, right: 30, bottom: 30 };

    it('detects segment passing through box', () => {
      const points: Point[] = [{ x: 0, y: 20 }, { x: 40, y: 20 }];
      expect(polylineIntersectsBox(points, box)).toBe(true);
    });

    it('detects segment starting inside box', () => {
      const points: Point[] = [{ x: 20, y: 20 }, { x: 50, y: 50 }];
      expect(polylineIntersectsBox(points, box)).toBe(true);
    });

    it('returns false for segment outside box', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
      expect(polylineIntersectsBox(points, box)).toBe(false);
    });

    it('returns false for single point outside box', () => {
      expect(polylineIntersectsBox([{ x: 0, y: 0 }], box)).toBe(false);
    });
  });

  describe('polylinesIntersect', () => {
    it('detects crossing polylines', () => {
      const a: Point[] = [{ x: 0, y: 5 }, { x: 10, y: 5 }];
      const b: Point[] = [{ x: 5, y: 0 }, { x: 5, y: 10 }];
      expect(polylinesIntersect(a, b)).toBe(true);
    });

    it('returns false for parallel polylines', () => {
      const a: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const b: Point[] = [{ x: 0, y: 5 }, { x: 10, y: 5 }];
      expect(polylinesIntersect(a, b)).toBe(false);
    });

    it('returns false for non-overlapping polylines', () => {
      const a: Point[] = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
      const b: Point[] = [{ x: 10, y: 10 }, { x: 20, y: 10 }];
      expect(polylinesIntersect(a, b)).toBe(false);
    });

    it('detects T-intersection', () => {
      const a: Point[] = [{ x: 0, y: 5 }, { x: 10, y: 5 }];
      const b: Point[] = [{ x: 5, y: 5 }, { x: 5, y: 10 }];
      expect(polylinesIntersect(a, b)).toBe(true);
    });

    it('returns false for collinear non-overlapping segments', () => {
      const a: Point[] = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
      const b: Point[] = [{ x: 6, y: 0 }, { x: 10, y: 0 }];
      expect(polylinesIntersect(a, b)).toBe(false);
    });
  });
});
