import {
  buildEdgeRoutingGeometry,
  computeEdgeRoutingPlacements,
  polylineIntersectsBox,
  polylinesIntersect,
  sharesEndpoint,
  type EdgeRoutingPlacement,
} from '../edge-routing';
import { VISIBLE_HANDLE_SIDES } from '../graph/ports';
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
type EdgePlacement = EdgeRoutingPlacement;

interface RoutedEdgeGeometry {
  edge: LayoutEdgeInput;
  points: Point[];
  placement: EdgePlacement;
  sourceExitSide: 'left' | 'right' | 'top' | 'bottom';
  targetExitSide: 'left' | 'right' | 'top' | 'bottom';
}

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
      layoutDirection: 'TB',
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

function boxesIntersect(
  a: ReturnType<typeof getBox>,
  b: ReturnType<typeof getBox>,
) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function computeConnectorConflicts(
  nodes: LayoutInput[],
  geometries: RoutedEdgeGeometry[],
) {
  const usage = new Map<string, { incoming: number; outgoing: number }>();

  for (const node of nodes) {
    for (const side of VISIBLE_HANDLE_SIDES) {
      usage.set(`${node.id}:${side}`, { incoming: 0, outgoing: 0 });
    }
  }

  for (const geometry of geometries) {
    const sourceUsage = usage.get(`${geometry.edge.source}:${geometry.placement.sourceSide}`);
    const targetUsage = usage.get(`${geometry.edge.target}:${geometry.placement.targetSide}`);
    if (sourceUsage) sourceUsage.outgoing += 1;
    if (targetUsage) targetUsage.incoming += 1;
  }

  let conflicts = 0;
  for (const handleUsage of usage.values()) {
    conflicts += handleUsage.incoming * handleUsage.outgoing;
  }

  return conflicts;
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
