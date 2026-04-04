import type { LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide } from '../types';
import {
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
  getEdgeHandlePlacement,
  getPrimaryFlowSides,
  getHandlePoint,
  isHorizontalCardinalSide,
} from '../graph/ports';
import {
  dedupePoints,
  expandBox,
  getCenter,
  offsetPoint,
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
  | 'shared-endpoint-anywhere'
  | 'shared-endpoint-same-type-forgiven';

export const DEFAULT_EDGE_ROUTING_POLICY: EdgeRoutingPolicy = 'shared-endpoint-outside-buffer-same-type-only';
const EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING = 36;

export interface EdgeRoutingConfig {
  edgeCrossingPenalty: number;
  edgeNodeOverlapPenalty: number;
  flowAlignedBonus: number;
  crossingPolicy: EdgeRoutingPolicy;
  mixedDirectionPenalty: number;
}

export const DEFAULT_EDGE_ROUTING_CONFIG: EdgeRoutingConfig = {
  edgeCrossingPenalty: 1_000,
  edgeNodeOverlapPenalty: 100_000,
  flowAlignedBonus: 1_000,
  crossingPolicy: 'shared-endpoint-same-type-forgiven',
  mixedDirectionPenalty: 1_000,
};

export interface EdgeRoutingInput {
  edges: EdgeRoutingEdge[];
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>;
  layoutDirection: LayoutDirection;
  policy?: EdgeRoutingPolicy;
  nodeNeighborhoodPadding?: number;
  config?: EdgeRoutingConfig;
}

interface EdgeRoutingGeometry {
  edge: EdgeRoutingEdge;
  placement: EdgeRoutingPlacement;
  points: Point[];
  sourceExitSide: CardinalHandleSide;
  targetExitSide: CardinalHandleSide;
}

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

  const flowSides = getPrimaryFlowSides(layoutDirection);
  const flowSourceBase = flowSides.sourceSide;
  const flowTargetBase = flowSides.targetSide;

  const sortedSides = [...VISIBLE_HANDLE_SIDES].sort((a, b) => {
    const aFlow = getBaseHandleSide(a) === flowSourceBase || getBaseHandleSide(a) === flowTargetBase;
    const bFlow = getBaseHandleSide(b) === flowSourceBase || getBaseHandleSide(b) === flowTargetBase;
    if (aFlow && !bFlow) return -1;
    if (!aFlow && bFlow) return 1;
    return 0;
  });

  const seen = new Set<string>();
  const candidates = [
    automatic,
    baseHorizontal,
    baseVertical,
    ...sortedSides.flatMap((sourceSide) =>
      sortedSides.map((targetSide) => ({ sourceSide, targetSide })),
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

  // Shrink stubs when handles face each other and nodes are close,
  // so the polyline length reflects actual visual distance.
  let stubLength = EDGE_STUB;
  const sourceHoriz = isHorizontalCardinalSide(sourceExitSide);
  const targetHoriz = isHorizontalCardinalSide(targetExitSide);
  if (sourceHoriz === targetHoriz) {
    const gap = sourceHoriz
      ? Math.abs(end.x - start.x)
      : Math.abs(end.y - start.y);
    if (gap < EDGE_STUB * 2) {
      stubLength = Math.max(4, gap / 2);
    }
  }

  const startStub = offsetPoint(start, sourceExitSide, stubLength);
  const endStub = offsetPoint(end, targetExitSide, stubLength);
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

function sharesEndpoint(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

function isReciprocalEdgePair(
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
    case 'shared-endpoint-same-type-forgiven':
      return !sharedEndpointsHaveSameDirection(a, b);
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
