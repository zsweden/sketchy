import type { LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide } from '../types';
import {
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
  getEdgeHandlePlacement,
  getHandlePoint,
  isCornerHandleSide,
  isHorizontalCardinalSide,
} from '../graph/ports';

export interface EdgeRoutingNodeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface EdgeRoutingEdge {
  id: string;
  source: string;
  target: string;
}

export interface EdgeRoutingPlacement {
  sourceSide: EdgeHandleSide;
  targetSide: EdgeHandleSide;
}

export interface EdgeRoutingInput {
  edges: EdgeRoutingEdge[];
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>;
  layoutDirection: LayoutDirection;
}

export interface EdgeRoutingGeometry {
  edge: EdgeRoutingEdge;
  placement: EdgeRoutingPlacement;
  points: Point[];
  sourceExitSide: CardinalHandleSide;
  targetExitSide: CardinalHandleSide;
}

export interface EdgeRoutingObjectiveScore {
  crossings: number;
  edgeNodeOverlaps: number;
  mixedHandleConflicts: number;
  totalLength: number;
  sameDirectionSharing: number;
  cornerHandleCount: number;
}

type Point = { x: number; y: number };

const EDGE_STUB = 28;
const SIDE_VECTORS: Record<CardinalHandleSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function getAutomaticEdgeRoutingPlacement(
  edge: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  layoutDirection: LayoutDirection,
): EdgeRoutingPlacement {
  const sourceBox = nodeBoxes.get(edge.source);
  const targetBox = nodeBoxes.get(edge.target);

  return getEdgeHandlePlacement(
    sourceBox ? getCenter(sourceBox) : undefined,
    targetBox ? getCenter(targetBox) : undefined,
    layoutDirection,
  );
}

export function createPlacementCandidates(
  edge: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  layoutDirection: LayoutDirection,
): EdgeRoutingPlacement[] {
  const automatic = getAutomaticEdgeRoutingPlacement(edge, nodeBoxes, layoutDirection);
  const sourceBox = nodeBoxes.get(edge.source);
  const targetBox = nodeBoxes.get(edge.target);
  const sourceCenter = sourceBox ? getCenter(sourceBox) : undefined;
  const targetCenter = targetBox ? getCenter(targetBox) : undefined;

  const baseHorizontal = sourceCenter && targetCenter
    ? (sourceCenter.x <= targetCenter.x
      ? { sourceSide: 'right' as const, targetSide: 'left' as const }
      : { sourceSide: 'left' as const, targetSide: 'right' as const })
    : { sourceSide: 'right' as const, targetSide: 'left' as const };

  const baseVertical = sourceCenter && targetCenter
    ? (sourceCenter.y <= targetCenter.y
      ? { sourceSide: 'bottom' as const, targetSide: 'top' as const }
      : { sourceSide: 'top' as const, targetSide: 'bottom' as const })
    : {
      sourceSide: layoutDirection === 'TB' ? 'bottom' as const : 'top' as const,
      targetSide: layoutDirection === 'TB' ? 'top' as const : 'bottom' as const,
    };

  const seen = new Set<string>();
  const candidates = [
    automatic,
    baseHorizontal,
    baseVertical,
    ...VISIBLE_HANDLE_SIDES.flatMap((sourceSide) =>
      VISIBLE_HANDLE_SIDES.map((targetSide) => ({ sourceSide, targetSide })),
    ),
  ];

  return candidates.filter((placement) => {
    const key = `${placement.sourceSide}:${placement.targetSide}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildEdgeRoutingGeometry(
  edge: EdgeRoutingEdge,
  placement: EdgeRoutingPlacement,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
): EdgeRoutingGeometry {
  const sourceBox = nodeBoxes.get(edge.source);
  const targetBox = nodeBoxes.get(edge.target);

  if (!sourceBox || !targetBox) {
    return {
      edge,
      placement,
      points: [],
      sourceExitSide: 'right',
      targetExitSide: 'left',
    };
  }

  const start = getHandlePoint(sourceBox, placement.sourceSide);
  const end = getHandlePoint(targetBox, placement.targetSide);
  const sourceExitSide = getBaseHandleSide(placement.sourceSide);
  const targetExitSide = getBaseHandleSide(placement.targetSide);
  const startStub = offsetPoint(start, sourceExitSide, EDGE_STUB);
  const endStub = offsetPoint(end, targetExitSide, EDGE_STUB);
  const points: Point[] = [start, startStub];

  const sourceHorizontal = isHorizontalCardinalSide(sourceExitSide);
  const targetHorizontal = isHorizontalCardinalSide(targetExitSide);

  if (sourceHorizontal && targetHorizontal) {
    const midX = (startStub.x + endStub.x) / 2;
    points.push({ x: midX, y: startStub.y }, { x: midX, y: endStub.y });
  } else if (!sourceHorizontal && !targetHorizontal) {
    const midY = (startStub.y + endStub.y) / 2;
    points.push({ x: startStub.x, y: midY }, { x: endStub.x, y: midY });
  } else if (sourceHorizontal) {
    points.push({ x: endStub.x, y: startStub.y });
  } else {
    points.push({ x: startStub.x, y: endStub.y });
  }

  points.push(endStub, end);

  return {
    edge,
    placement,
    points: dedupePoints(points),
    sourceExitSide,
    targetExitSide,
  };
}

export function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += Math.abs(points[index + 1].x - points[index].x)
      + Math.abs(points[index + 1].y - points[index].y);
  }
  return total;
}

export function polylineIntersectsBox(points: Point[], box: EdgeRoutingNodeBox): boolean {
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

export function sharesEndpoint(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

export function compareEdgeRoutingObjectiveScores(
  a: EdgeRoutingObjectiveScore,
  b: EdgeRoutingObjectiveScore,
): number {
  if (a.crossings !== b.crossings) return a.crossings - b.crossings;
  if (a.edgeNodeOverlaps !== b.edgeNodeOverlaps) {
    return a.edgeNodeOverlaps - b.edgeNodeOverlaps;
  }
  if (a.mixedHandleConflicts !== b.mixedHandleConflicts) {
    return a.mixedHandleConflicts - b.mixedHandleConflicts;
  }
  if (a.totalLength !== b.totalLength) return a.totalLength - b.totalLength;
  if (a.sameDirectionSharing !== b.sameDirectionSharing) {
    return b.sameDirectionSharing - a.sameDirectionSharing;
  }
  if (a.cornerHandleCount !== b.cornerHandleCount) {
    return a.cornerHandleCount - b.cornerHandleCount;
  }
  return 0;
}

export function scoreObjectiveEdgeRouting(
  edges: EdgeRoutingEdge[],
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  placements: ReadonlyMap<string, EdgeRoutingPlacement>,
): EdgeRoutingObjectiveScore {
  const geometries = edges.flatMap((edge) => {
    const placement = placements.get(edge.id);
    if (!placement) return [];
    const geometry = buildEdgeRoutingGeometry(edge, placement, nodeBoxes);
    return geometry.points.length === 0 ? [] : [geometry];
  });

  let crossings = 0;
  for (let index = 0; index < geometries.length; index++) {
    for (let otherIndex = index + 1; otherIndex < geometries.length; otherIndex++) {
      const geometry = geometries[index];
      const other = geometries[otherIndex];
      if (sharesEndpoint(geometry.edge, other.edge)) continue;
      if (polylinesIntersect(geometry.points, other.points)) {
        crossings++;
      }
    }
  }

  let edgeNodeOverlaps = 0;
  for (const geometry of geometries) {
    for (const [nodeId, box] of nodeBoxes.entries()) {
      if (nodeId === geometry.edge.source || nodeId === geometry.edge.target) continue;
      if (polylineIntersectsBox(geometry.points, box)) {
        edgeNodeOverlaps++;
      }
    }
  }

  let totalLength = 0;
  let cornerHandleCount = 0;
  const handleUsage = new Map<string, { incoming: number; outgoing: number }>();

  for (const geometry of geometries) {
    totalLength += getPolylineLength(geometry.points);

    if (isCornerHandle(geometry.placement.sourceSide)) cornerHandleCount++;
    if (isCornerHandle(geometry.placement.targetSide)) cornerHandleCount++;

    const sourceKey = `${geometry.edge.source}:${geometry.placement.sourceSide}`;
    const targetKey = `${geometry.edge.target}:${geometry.placement.targetSide}`;
    const sourceUsage = handleUsage.get(sourceKey) ?? { incoming: 0, outgoing: 0 };
    sourceUsage.outgoing += 1;
    handleUsage.set(sourceKey, sourceUsage);

    const targetUsage = handleUsage.get(targetKey) ?? { incoming: 0, outgoing: 0 };
    targetUsage.incoming += 1;
    handleUsage.set(targetKey, targetUsage);
  }

  let mixedHandleConflicts = 0;
  let sameDirectionSharing = 0;
  for (const usage of handleUsage.values()) {
    if (usage.incoming > 0 && usage.outgoing > 0) {
      mixedHandleConflicts++;
    }
    sameDirectionSharing += Math.max(0, usage.incoming - 1) + Math.max(0, usage.outgoing - 1);
  }

  return {
    crossings,
    edgeNodeOverlaps,
    mixedHandleConflicts,
    totalLength,
    sameDirectionSharing,
    cornerHandleCount,
  };
}

function getCenter(box: EdgeRoutingNodeBox): Point {
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  };
}

function offsetPoint(point: Point, side: CardinalHandleSide, distance: number): Point {
  const vector = SIDE_VECTORS[side];
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  };
}

function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0
    || point.x !== points[index - 1].x
    || point.y !== points[index - 1].y);
}

function pointInBox(point: Point, box: EdgeRoutingNodeBox): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function segmentIntersectsBox(from: Point, to: Point, box: EdgeRoutingNodeBox): boolean {
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

  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true;
  }
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function isCornerHandle(side: EdgeHandleSide): boolean {
  return isCornerHandleSide(side);
}
