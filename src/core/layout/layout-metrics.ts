import {
  VISIBLE_HANDLE_SIDES,
  getEffectiveHandleSide,
  getEdgeHandlePlacement,
  getHandlePoint,
  isHorizontalCardinalSide,
} from '../graph/ports';
import type { CardinalHandleSide } from '../types';
import type { EdgeHandleSide } from '../types';
import type { LayoutEdgeInput, LayoutInput, LayoutResult } from './layout-engine';

export interface LayoutMetrics {
  nodeOverlaps: number;
  edgeCrossings: number;
  edgeNodeOverlaps: number;
  connectorConflicts: number;
  totalEdgeLength: number;
  boundingArea: number;
}

type PositionLike = Pick<LayoutResult, 'x' | 'y'>;
type Point = { x: number; y: number };
type NodeBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type EdgePlacement = { sourceSide: EdgeHandleSide; targetSide: EdgeHandleSide };

interface RoutedEdgeGeometry {
  edge: LayoutEdgeInput;
  points: Point[];
  placement: EdgePlacement;
  sourceExitSide: CardinalHandleSide;
  targetExitSide: CardinalHandleSide;
}

const EDGE_STUB = 28;
const EDGE_INTERSECTION_PENALTY = 10_000;
const EDGE_NODE_OVERLAP_PENALTY = 2_000;
const EDGE_LENGTH_PENALTY = 1;
const SIDE_VECTORS: Record<'top' | 'right' | 'bottom' | 'left', Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function computeLayoutMetrics(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, PositionLike>,
): LayoutMetrics {
  const boxes = new Map(nodes.map((node) => [node.id, getBox(node, positions)]));
  const geometries = computeRoutedEdgeGeometries(nodes, edges, positions);

  let nodeOverlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = boxes.get(nodes[i].id);
      const b = boxes.get(nodes[j].id);
      if (a && b && boxesIntersect(a, b)) {
        nodeOverlaps++;
      }
    }
  }

  let edgeCrossings = 0;
  for (let i = 0; i < geometries.length; i++) {
    for (let j = i + 1; j < geometries.length; j++) {
      const a = geometries[i];
      const b = geometries[j];
      if (sharesEndpoint(a.edge, b.edge)) continue;
      if (polylinesIntersect(a.points, b.points)) {
        edgeCrossings++;
      }
    }
  }

  let edgeNodeOverlaps = 0;
  for (const geometry of geometries) {
    for (const node of nodes) {
      if (node.id === geometry.edge.source || node.id === geometry.edge.target) continue;
      const box = boxes.get(node.id);
      if (box && polylineIntersectsBox(geometry.points, box)) {
        edgeNodeOverlaps++;
      }
    }
  }

  const connectorConflicts = computeConnectorConflicts(nodes, geometries);

  let totalEdgeLength = 0;
  for (const geometry of geometries) {
    totalEdgeLength += getPolylineLength(geometry.points);
  }

  const allBoxes = [...boxes.values()];
  const minX = Math.min(...allBoxes.map((box) => box.left));
  const minY = Math.min(...allBoxes.map((box) => box.top));
  const maxX = Math.max(...allBoxes.map((box) => box.right));
  const maxY = Math.max(...allBoxes.map((box) => box.bottom));

  return {
    nodeOverlaps,
    edgeCrossings,
    edgeNodeOverlaps,
    connectorConflicts,
    totalEdgeLength: round(totalEdgeLength),
    boundingArea: round((maxX - minX) * (maxY - minY)),
  };
}

export function scoreLayoutMetrics(metrics: LayoutMetrics): number {
  return metrics.nodeOverlaps * 1_000_000_000
    + metrics.edgeCrossings * 50_000
    + metrics.edgeNodeOverlaps * 10_000
    + metrics.connectorConflicts * 7_500
    + metrics.totalEdgeLength
    + metrics.boundingArea * 0.0025;
}

export function compareGraphMetrics(a: LayoutMetrics, b: LayoutMetrics): number {
  if (a.nodeOverlaps !== b.nodeOverlaps) {
    return a.nodeOverlaps - b.nodeOverlaps;
  }
  if (a.edgeCrossings !== b.edgeCrossings) {
    return a.edgeCrossings - b.edgeCrossings;
  }
  if (a.edgeNodeOverlaps !== b.edgeNodeOverlaps) {
    return a.edgeNodeOverlaps - b.edgeNodeOverlaps;
  }
  if (a.connectorConflicts !== b.connectorConflicts) {
    return a.connectorConflicts - b.connectorConflicts;
  }
  if (a.totalEdgeLength !== b.totalEdgeLength) {
    return a.totalEdgeLength - b.totalEdgeLength;
  }
  if (a.boundingArea !== b.boundingArea) {
    return a.boundingArea - b.boundingArea;
  }
  return scoreLayoutMetrics(a) - scoreLayoutMetrics(b);
}

export function computeRoutedEdgeGeometries(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, PositionLike>,
): RoutedEdgeGeometry[] {
  const boxes = new Map(nodes.map((node) => [node.id, getBox(node, positions)]));
  const placements = new Map<string, EdgePlacement>();

  for (const [index, edge] of edges.entries()) {
    placements.set(getEdgeKey(edge, index), createPlacementCandidates(edge, boxes)[0]);
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const [index, edge] of edges.entries()) {
      const key = getEdgeKey(edge, index);
      const candidates = createPlacementCandidates(edge, boxes);
      let bestPlacement = placements.get(key) ?? candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        const geometry = buildEdgePolyline(edge, candidate, boxes);
        if (geometry.points.length === 0) continue;

        let score = getPolylineLength(geometry.points) * EDGE_LENGTH_PENALTY;

        for (const [nodeId, box] of boxes.entries()) {
          if (nodeId === edge.source || nodeId === edge.target) continue;
          if (polylineIntersectsBox(geometry.points, box)) {
            score += EDGE_NODE_OVERLAP_PENALTY;
          }
        }

        for (const [otherIndex, other] of edges.entries()) {
          if (otherIndex === index) continue;
          if (sharesEndpoint(edge, other)) continue;
          const otherPlacement = placements.get(getEdgeKey(other, otherIndex));
          if (!otherPlacement) continue;
          const otherGeometry = buildEdgePolyline(other, otherPlacement, boxes);
          if (otherGeometry.points.length === 0) continue;
          if (polylinesIntersect(geometry.points, otherGeometry.points)) {
            score += EDGE_INTERSECTION_PENALTY;
          }
        }

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = candidate;
        }
      }

      placements.set(key, bestPlacement);
    }
  }

  return edges.flatMap((edge, index) => {
    const placement = placements.get(getEdgeKey(edge, index));
    if (!placement) return [];
    const geometry = buildEdgePolyline(edge, placement, boxes);
    return geometry.points.length === 0 ? [] : [geometry];
  });
}

function getBox(
  node: LayoutInput,
  positions: ReadonlyMap<string, PositionLike>,
) {
  const position = positions.get(node.id);
  if (!position) {
    throw new Error(`Missing position for ${node.id}`);
  }
  return {
    left: position.x,
    top: position.y,
    right: position.x + node.width,
    bottom: position.y + node.height,
  };
}

function getCenter(box: ReturnType<typeof getBox>) {
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  };
}

function boxesIntersect(
  a: ReturnType<typeof getBox>,
  b: ReturnType<typeof getBox>,
) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function sharesEndpoint(a: LayoutEdgeInput, b: LayoutEdgeInput) {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

function computeConnectorConflicts(
  nodes: LayoutInput[],
  geometries: RoutedEdgeGeometry[],
) {
  const usage = new Map<string, Record<'left' | 'right' | 'top' | 'bottom', { incoming: number; outgoing: number }>>();

  for (const node of nodes) {
    usage.set(node.id, {
      left: { incoming: 0, outgoing: 0 },
      right: { incoming: 0, outgoing: 0 },
      top: { incoming: 0, outgoing: 0 },
      bottom: { incoming: 0, outgoing: 0 },
    });
  }

  for (const geometry of geometries) {
    const sourceUsage = usage.get(geometry.edge.source);
    const targetUsage = usage.get(geometry.edge.target);
    if (sourceUsage) sourceUsage[geometry.sourceExitSide].outgoing += 1;
    if (targetUsage) targetUsage[geometry.targetExitSide].incoming += 1;
  }

  let conflicts = 0;
  for (const nodeUsage of usage.values()) {
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      conflicts += nodeUsage[side].incoming * nodeUsage[side].outgoing;
    }
  }

  return conflicts;
}

function orientation(
  p: { x: number; y: number },
  q: { x: number; y: number },
  r: { x: number; y: number },
) {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function onSegment(
  p: { x: number; y: number },
  q: { x: number; y: number },
  r: { x: number; y: number },
) {
  return q.x <= Math.max(p.x, r.x)
    && q.x >= Math.min(p.x, r.x)
    && q.y <= Math.max(p.y, r.y)
    && q.y >= Math.min(p.y, r.y);
}

function segmentsIntersect(
  p1: { x: number; y: number },
  q1: { x: number; y: number },
  p2: { x: number; y: number },
  q2: { x: number; y: number },
) {
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

function pointInBox(point: { x: number; y: number }, box: ReturnType<typeof getBox>) {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function segmentIntersectsBox(
  from: { x: number; y: number },
  to: { x: number; y: number },
  box: ReturnType<typeof getBox>,
) {
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

function polylineIntersectsBox(points: Point[], box: NodeBox): boolean {
  for (let index = 0; index < points.length - 1; index++) {
    if (segmentIntersectsBox(points[index], points[index + 1], box)) return true;
  }
  return false;
}

function polylinesIntersect(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

function createPlacementCandidates(
  edge: LayoutEdgeInput,
  boxes: ReadonlyMap<string, NodeBox>,
): EdgePlacement[] {
  const sourceBox = boxes.get(edge.source);
  const targetBox = boxes.get(edge.target);
  const sourceCenter = sourceBox ? getCenter(sourceBox) : null;
  const targetCenter = targetBox ? getCenter(targetBox) : null;

  const automatic = getAutomaticPlacement(sourceCenter, targetCenter);
  const baseHorizontal = sourceCenter && targetCenter && sourceCenter.x > targetCenter.x
    ? { sourceSide: 'left' as const, targetSide: 'right' as const }
    : { sourceSide: 'right' as const, targetSide: 'left' as const };
  const baseVertical = sourceCenter && targetCenter && sourceCenter.y > targetCenter.y
    ? { sourceSide: 'top' as const, targetSide: 'bottom' as const }
    : { sourceSide: 'bottom' as const, targetSide: 'top' as const };

  const seen = new Set<string>();
  return [automatic, baseHorizontal, baseVertical, ...VISIBLE_HANDLE_SIDES.flatMap((sourceSide) =>
    VISIBLE_HANDLE_SIDES.map((targetSide) => ({ sourceSide, targetSide })),
  )].filter((placement) => {
    const key = `${placement.sourceSide}-${placement.targetSide}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAutomaticPlacement(
  sourceCenter: Point | null,
  targetCenter: Point | null,
): EdgePlacement {
  if (!sourceCenter || !targetCenter) {
    return { sourceSide: 'right', targetSide: 'left' };
  }
  return getEdgeHandlePlacement(sourceCenter, targetCenter, 'TB');
}

function buildEdgePolyline(
  edge: LayoutEdgeInput,
  placement: EdgePlacement,
  boxes: ReadonlyMap<string, NodeBox>,
): RoutedEdgeGeometry {
  const sourceBox = boxes.get(edge.source);
  const targetBox = boxes.get(edge.target);
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
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const sourceExitSide = getEffectiveHandleSide(placement.sourceSide, dx, dy);
  const targetExitSide = getEffectiveHandleSide(placement.targetSide, -dx, -dy);
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
    sourceExitSide,
    targetExitSide,
    points: dedupePoints(points),
  };
}

function offsetPoint(point: Point, side: 'top' | 'right' | 'bottom' | 'left', distance: number): Point {
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

function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += Math.abs(points[index + 1].x - points[index].x)
      + Math.abs(points[index + 1].y - points[index].y);
  }
  return total;
}

function getEdgeKey(edge: LayoutEdgeInput, index: number): string {
  return `${index}:${edge.source}->${edge.target}`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
