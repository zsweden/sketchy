import type { CardinalHandleSide } from '../types';

export type Point = { x: number; y: number };

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const SIDE_VECTORS: Record<CardinalHandleSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function getCenter(box: BoundingBox): Point {
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  };
}

export function offsetPoint(point: Point, side: CardinalHandleSide, distance: number): Point {
  const vector = SIDE_VECTORS[side];
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  };
}

export function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0
    || point.x !== points[index - 1].x
    || point.y !== points[index - 1].y);
}

export function expandBox(box: BoundingBox, padding: number): BoundingBox {
  return {
    left: box.left - padding,
    top: box.top - padding,
    right: box.right + padding,
    bottom: box.bottom + padding,
  };
}

export function pointInBox(point: Point, box: BoundingBox): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

export function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += Math.abs(points[index + 1].x - points[index].x)
      + Math.abs(points[index + 1].y - points[index].y);
  }
  return total;
}

export function polylineIntersectsBox(points: Point[], box: BoundingBox): boolean {
  for (let index = 0; index < points.length - 1; index++) {
    if (segmentIntersectsBox(points[index], points[index + 1], box)) return true;
  }
  return false;
}

export function polylinesIntersect(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

export function polylinesIntersectOutsideBoxes(
  a: Point[],
  b: Point[],
  boxes: readonly BoundingBox[],
): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const samples = getSegmentIntersectionSamples(a[i], a[i + 1], b[j], b[j + 1]);
      if (samples.some((sample) => !boxes.some((box) => pointInBox(sample, box)))) {
        return true;
      }
    }
  }
  return false;
}

function segmentIntersectsBox(from: Point, to: Point, box: BoundingBox): boolean {
  if (pointInBox(from, box) || pointInBox(to, box)) return true;

  const topLeft = { x: box.left, y: box.top };
  const topRight = { x: box.right, y: box.top };
  const bottomLeft = { x: box.left, y: box.bottom };
  const bottomRight = { x: box.right, y: box.bottom };

  return segmentsIntersect(from, to, topLeft, topRight)
    || segmentsIntersect(from, to, topRight, bottomRight)
    || segmentsIntersect(from, to, bottomRight, bottomLeft)
    || segmentsIntersect(from, to, bottomLeft, topLeft);
}

function orientation(p: Point, q: Point, r: Point): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return q.x <= Math.max(p.x, r.x)
    && q.x >= Math.min(p.x, r.x)
    && q.y <= Math.max(p.y, r.y)
    && q.y >= Math.min(p.y, r.y);
}

function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // True crossing: segments pass through each other
  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true;
  }
  // Collinear overlap: segments lie on the same line — not a crossing
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    return false;
  }
  // T-intersection: one endpoint touches the other segment
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function getSegmentIntersectionSamples(
  p1: Point,
  q1: Point,
  p2: Point,
  q2: Point,
): Point[] {
  if (!segmentsIntersect(p1, q1, p2, q2)) return [];

  const firstVertical = p1.x === q1.x;
  const secondVertical = p2.x === q2.x;

  if (firstVertical !== secondVertical) {
    return [{
      x: firstVertical ? p1.x : p2.x,
      y: firstVertical ? p2.y : p1.y,
    }];
  }

  if (firstVertical && secondVertical && p1.x === p2.x) {
    const start = Math.max(Math.min(p1.y, q1.y), Math.min(p2.y, q2.y));
    const end = Math.min(Math.max(p1.y, q1.y), Math.max(p2.y, q2.y));
    return getOverlapSamples({ x: p1.x, y: start }, { x: p1.x, y: end });
  }

  if (!firstVertical && !secondVertical && p1.y === p2.y) {
    const start = Math.max(Math.min(p1.x, q1.x), Math.min(p2.x, q2.x));
    const end = Math.min(Math.max(p1.x, q1.x), Math.max(p2.x, q2.x));
    return getOverlapSamples({ x: start, y: p1.y }, { x: end, y: p1.y });
  }

  return [p1];
}

function getOverlapSamples(start: Point, end: Point): Point[] {
  if (start.x === end.x && start.y === end.y) return [start];
  return [
    start,
    end,
    {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
  ];
}
