import {
  buildEdgeRoutingGeometry,
  computeEdgeRoutingPlacements,
  type EdgeRoutingPlacement,
  type EdgeRoutingPolicy,
} from '../edge-routing';
import type { LayoutDirection } from '../framework-types';
import type { LayoutEdgeInput, LayoutInput, LayoutResult } from './layout-engine';

type PositionLike = Pick<LayoutResult, 'x' | 'y'>;
type Point = { x: number; y: number };

export interface RoutedEdgeGeometry {
  edge: LayoutEdgeInput;
  points: Point[];
  placement: EdgeRoutingPlacement;
  sourceExitSide: 'left' | 'right' | 'top' | 'bottom';
  targetExitSide: 'left' | 'right' | 'top' | 'bottom';
}

export type AxisAlignedBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function getBox(
  node: LayoutInput,
  positions: ReadonlyMap<string, PositionLike>,
): AxisAlignedBox {
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

export function boxesIntersect(a: AxisAlignedBox, b: AxisAlignedBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function getPolylineLength(points: Point[]): number {
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

export function computeRoutedEdgeGeometries(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, PositionLike>,
  options?: {
    layoutDirection?: LayoutDirection;
    edgeRoutingPolicy?: EdgeRoutingPolicy;
    nodeNeighborhoodPadding?: number;
  },
): RoutedEdgeGeometry[] {
  const boxes = new Map(nodes.map((node) => [node.id, getBox(node, positions)]));
  const preparedEdges = edges.map((edge, index) => ({
    id: getEdgeKey(edge, index),
    source: edge.source,
    target: edge.target,
  }));

  const hasExplicitPlacements = edges.every((edge) => edge.sourceSide && edge.targetSide);
  const placements = hasExplicitPlacements
    ? new Map(
      edges.map((edge, index) => [
        getEdgeKey(edge, index),
        { sourceSide: edge.sourceSide!, targetSide: edge.targetSide! },
      ]),
    )
    : computeEdgeRoutingPlacements({
      edges: preparedEdges,
      nodeBoxes: boxes,
      layoutDirection: options?.layoutDirection ?? 'TB',
      policy: options?.edgeRoutingPolicy,
      nodeNeighborhoodPadding: options?.nodeNeighborhoodPadding,
    });

  return edges.flatMap((edge, index) => {
    const preparedEdge = preparedEdges[index];
    const placement = placements.get(preparedEdge.id);
    if (!placement) return [];
    const geometry = buildEdgeRoutingGeometry(preparedEdge, placement, boxes);
    if (geometry.points.length === 0) return [];
    return [{
      edge,
      points: geometry.points,
      placement,
      sourceExitSide: geometry.sourceExitSide,
      targetExitSide: geometry.targetExitSide,
    }];
  });
}
