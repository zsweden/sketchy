import type { LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide } from '../types';
import {
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
  getEdgeHandlePlacement,
  getPrimaryFlowSides,
  getHandlePoint,
  isCornerHandleSide,
  isHorizontalCardinalSide,
} from '../graph/ports';
import {
  dedupePoints,
  expandBox,
  getCenter,
  getPolylineLength,
  offsetPoint,
  polylineIntersectsBox,
  polylinesIntersect,
  polylinesIntersectOutsideBoxes,
} from './geometry';
import type { BoundingBox, Point } from './geometry';

export type { Point } from './geometry';
export { getPolylineLength, polylineIntersectsBox, polylinesIntersect } from './geometry';

export type EdgeRoutingNodeBox = BoundingBox;

export interface EdgeRoutingEdge {
  id: string;
  source: string;
  target: string;
}

export interface EdgeRoutingPlacement {
  sourceSide: EdgeHandleSide;
  targetSide: EdgeHandleSide;
}

export type EdgeRoutingPolicy =
  | 'legacy'
  | 'reciprocal-only'
  | 'shared-endpoint-outside-buffer'
  | 'shared-endpoint-outside-buffer-same-type-only'
  | 'shared-endpoint-outside-buffer-same-type-rewarded'
  | 'shared-endpoint-anywhere';

export const DEFAULT_EDGE_ROUTING_POLICY: EdgeRoutingPolicy = 'shared-endpoint-outside-buffer-same-type-only';
export const EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING = 36;

export interface EdgeRoutingInput {
  edges: EdgeRoutingEdge[];
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>;
  layoutDirection: LayoutDirection;
  policy?: EdgeRoutingPolicy;
  nodeNeighborhoodPadding?: number;
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

export type EdgeRoutingPoint = Point;

interface EdgeRoutingCrossingOptions {
  policy?: EdgeRoutingPolicy;
  nodeNeighborhoodPadding?: number;
}

const EDGE_STUB = 28;

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
    : getPrimaryFlowSides(layoutDirection);

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

export function sharesEndpoint(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

export function isReciprocalEdgePair(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.target && a.target === b.source;
}

export function shouldCountCrossingBetweenEdges(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  aPoints: Point[],
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  bPoints: Point[],
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  options?: EdgeRoutingCrossingOptions,
): boolean {
  if (!polylinesIntersect(aPoints, bPoints)) return false;

  const policy = options?.policy ?? DEFAULT_EDGE_ROUTING_POLICY;
  const sharedEndpoint = sharesEndpoint(a, b);

  if (!sharedEndpoint) return true;

  switch (policy) {
    case 'legacy':
      return false;
    case 'reciprocal-only':
      return isReciprocalEdgePair(a, b);
    case 'shared-endpoint-anywhere':
      return true;
    case 'shared-endpoint-outside-buffer':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      );
    case 'shared-endpoint-outside-buffer-same-type-only':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      ) || !sharedEndpointsHaveSameDirection(a, b);
    case 'shared-endpoint-outside-buffer-same-type-rewarded':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      ) || !sharedEndpointsHaveSameDirection(a, b);
  }
}

export function shouldRewardSharedEndpointCrossingAlignment(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  aPoints: Point[],
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  bPoints: Point[],
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  options?: EdgeRoutingCrossingOptions,
): boolean {
  if ((options?.policy ?? DEFAULT_EDGE_ROUTING_POLICY) !== 'shared-endpoint-outside-buffer-same-type-rewarded') {
    return false;
  }
  if (!sharesEndpoint(a, b) || !polylinesIntersect(aPoints, bPoints)) return false;

  const endpointNeighborhoods = getEndpointNeighborhoods(
    [a, b],
    nodeBoxes,
    options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING,
  );

  return !polylinesIntersectOutsideBoxes(aPoints, bPoints, endpointNeighborhoods)
    && sharedEndpointsHaveSameDirection(a, b);
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
  options?: EdgeRoutingCrossingOptions,
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
      if (shouldCountCrossingBetweenEdges(
        geometry.edge,
        geometry.points,
        other.edge,
        other.points,
        nodeBoxes,
        options,
      )) {
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

    if (isCornerHandleSide(geometry.placement.sourceSide)) cornerHandleCount++;
    if (isCornerHandleSide(geometry.placement.targetSide)) cornerHandleCount++;

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

function getEndpointNeighborhoods(
  edges: ReadonlyArray<Pick<EdgeRoutingEdge, 'source' | 'target'>>,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  padding: number,
): EdgeRoutingNodeBox[] {
  const nodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  return [...nodeIds].flatMap((nodeId) => {
    const box = nodeBoxes.get(nodeId);
    return box ? [expandBox(box, padding)] : [];
  });
}

function sharedEndpointsHaveSameDirection(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  const sharedNodeIds = [
    ...(a.source === b.source || a.source === b.target ? [a.source] : []),
    ...(a.target !== a.source && (a.target === b.source || a.target === b.target) ? [a.target] : []),
  ];

  return sharedNodeIds.every((nodeId) => getEdgeDirectionAtNode(a, nodeId) === getEdgeDirectionAtNode(b, nodeId));
}

function getEdgeDirectionAtNode(
  edge: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  nodeId: string,
): 'incoming' | 'outgoing' | null {
  if (edge.source === nodeId) return 'outgoing';
  if (edge.target === nodeId) return 'incoming';
  return null;
}
