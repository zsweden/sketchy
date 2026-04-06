import {
  polylineIntersectsBox,
  shouldCountCrossingBetweenEdges,
  type EdgeRoutingPolicy,
} from '../edge-routing';
import type { LayoutDirection } from '../framework-types';
import { VISIBLE_HANDLE_SIDES } from '../graph/ports';
import type { LayoutEdgeInput, LayoutInput } from './layout-engine';
import {
  type RoutedEdgeGeometry,
  boxesIntersect,
  computeRoutedEdgeGeometries,
  getBox,
  getPolylineLength,
} from './routed-edge-geometry';

export type { RoutedEdgeGeometry } from './routed-edge-geometry';
export { computeRoutedEdgeGeometries } from './routed-edge-geometry';

export interface LayoutMetrics {
  nodeOverlaps: number;
  edgeCrossings: number;
  edgeNodeOverlaps: number;
  connectorConflicts: number;
  totalEdgeLength: number;
  boundingArea: number;
}

export function computeLayoutMetrics(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, Pick<{ x: number; y: number }, 'x' | 'y'>>,
  options?: {
    layoutDirection?: LayoutDirection;
    edgeRoutingPolicy?: EdgeRoutingPolicy;
    nodeNeighborhoodPadding?: number;
  },
): LayoutMetrics {
  const boxes = new Map(nodes.map((node) => [node.id, getBox(node, positions)]));
  const geometries = computeRoutedEdgeGeometries(nodes, edges, positions, options);

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
      if (shouldCountCrossingBetweenEdges(
        a.edge,
        a.points,
        b.edge,
        b.points,
        boxes,
        {
          policy: options?.edgeRoutingPolicy,
          nodeNeighborhoodPadding: options?.nodeNeighborhoodPadding,
        },
      )) {
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}
