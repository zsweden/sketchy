import type { LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide } from '../types';
import {
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
  getDirectionalHandleSide,
  getEdgeHandlePlacement,
  getPrimaryFlowSides,
  getHandlePoint,
  isHorizontalCardinalSide,
  opposite,
} from '../graph/ports';
import {
  dedupePoints,
  getCenter,
  getPolylineLength as computePolylineLength,
  offsetPoint,
} from './geometry';
import type { Point } from './geometry';
import type { EdgeRoutingEdge, EdgeRoutingNodeBox, EdgeRoutingPlacement } from './types';

const EDGE_STUB = 28;

interface EdgeRoutingGeometry {
  edge: EdgeRoutingEdge;
  placement: EdgeRoutingPlacement;
  points: Point[];
  sourceExitSide: CardinalHandleSide;
  targetExitSide: CardinalHandleSide;
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

export function getAutomaticEdgeRoutingPlacement(
  edge: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  layoutDirection: LayoutDirection,
): EdgeRoutingPlacement {
  const sourceBox = nodeBoxes.get(edge.source);
  const targetBox = nodeBoxes.get(edge.target);

  if (!sourceBox || !targetBox) {
    return getEdgeHandlePlacement(
      sourceBox ? getCenter(sourceBox) : undefined,
      targetBox ? getCenter(targetBox) : undefined,
      layoutDirection,
    );
  }

  const sourceCenter = getCenter(sourceBox);
  const targetCenter = getCenter(targetBox);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (dx === 0 && dy === 0) {
    return getEdgeHandlePlacement(sourceCenter, targetCenter, layoutDirection);
  }

  const hSourceBase = dx >= 0 ? 'right' as const : 'left' as const;
  const hTargetBase = opposite(hSourceBase);
  const horizontalPlacement: EdgeRoutingPlacement = {
    sourceSide: getDirectionalHandleSide(hSourceBase, dx, dy),
    targetSide: getDirectionalHandleSide(hTargetBase, -dx, -dy),
  };

  const vSourceBase = dy >= 0 ? 'bottom' as const : 'top' as const;
  const vTargetBase = opposite(vSourceBase);
  const verticalPlacement: EdgeRoutingPlacement = {
    sourceSide: getDirectionalHandleSide(vSourceBase, dx, dy),
    targetSide: getDirectionalHandleSide(vTargetBase, -dx, -dy),
  };

  const dummyEdge = { id: '', source: edge.source, target: edge.target };
  const hLength = computePolylineLength(buildEdgeRoutingGeometry(dummyEdge, horizontalPlacement, nodeBoxes).points);
  const vLength = computePolylineLength(buildEdgeRoutingGeometry(dummyEdge, verticalPlacement, nodeBoxes).points);

  if (hLength < vLength) return horizontalPlacement;
  if (vLength < hLength) return verticalPlacement;

  const flowSides = getPrimaryFlowSides(layoutDirection);
  const flowIsVertical = flowSides.sourceSide === 'top' || flowSides.sourceSide === 'bottom';
  return flowIsVertical ? verticalPlacement : horizontalPlacement;
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

  const baseHorizontal: { sourceSide: EdgeHandleSide; targetSide: EdgeHandleSide } = sourceCenter && targetCenter
    ? (sourceCenter.x <= targetCenter.x
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' })
    : { sourceSide: 'right', targetSide: 'left' };

  const baseVertical: { sourceSide: EdgeHandleSide; targetSide: EdgeHandleSide } = sourceCenter && targetCenter
    ? (sourceCenter.y <= targetCenter.y
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' })
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
