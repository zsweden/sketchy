import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgePolarity,
} from '../core/types';
import { createEmptyDiagram } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge } from '../core/graph/validation';
import {
  VISIBLE_HANDLE_SIDES,
  getEffectiveHandleSide,
  getEdgeHandlePlacement,
  getHandlePoint,
  getSideFromHandleId,
  isHorizontalCardinalSide,
} from '../core/graph/ports';
import type { EdgeHandlePlacement } from '../core/graph/ports';
import type { BatchMutations } from './diagram-store-types';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../constants/layout';

// --- Framework helpers ---

export function getDefaultFramework(): Framework {
  const fw = getFramework('crt');
  if (!fw) throw new Error('CRT framework not registered');
  return fw;
}

export function createDiagramForFramework(framework: Framework): Diagram {
  const diagram = createEmptyDiagram(framework.id);
  return {
    ...diagram,
    settings: {
      ...diagram.settings,
      layoutDirection: framework.defaultLayoutDirection,
    },
  };
}

export function getDefaultEdgeFields(framework: Framework): Pick<DiagramEdge, 'polarity' | 'delay'> {
  return {
    ...(framework.supportsEdgePolarity ? { polarity: 'positive' as EdgePolarity } : {}),
    ...(framework.supportsEdgeDelay ? { delay: false } : {}),
  };
}

// --- Edge routing helpers ---

function getNodePositionMap(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  return new Map(nodes.map((node) => [node.id, node.position]));
}

interface Point {
  x: number;
  y: number;
}

interface NodeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface RoutedEdgeGeometry {
  edgeId: string;
  source: string;
  target: string;
  points: Point[];
}

const SIDE_VECTORS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const;

const EDGE_STUB = 28;
const EDGE_INTERSECTION_PENALTY = 10_000;
const EDGE_NODE_OVERLAP_PENALTY = 2_000;
const EDGE_LENGTH_PENALTY = 1;
function getNodeBoxes(nodes: DiagramNode[]): Map<string, NodeBox> {
  return new Map(nodes.map((node) => [
    node.id,
    {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + DEFAULT_NODE_WIDTH,
      bottom: node.position.y + DEFAULT_NODE_HEIGHT,
    },
  ]));
}

function offsetPoint(point: Point, side: 'top' | 'right' | 'bottom' | 'left', distance: number): Point {
  const vector = SIDE_VECTORS[side];
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  };
}

function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => (
    index === 0
      || point.x !== points[index - 1].x
      || point.y !== points[index - 1].y
  ));
}

function buildEdgePolyline(
  edge: Pick<DiagramEdge, 'id' | 'source' | 'target'>,
  placement: EdgeHandlePlacement,
  nodeBoxes: Map<string, NodeBox>,
): RoutedEdgeGeometry {
  const sourceBox = nodeBoxes.get(edge.source);
  const targetBox = nodeBoxes.get(edge.target);

  if (!sourceBox || !targetBox) {
    return {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      points: [],
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

  const sourceIsHorizontal = isHorizontalCardinalSide(sourceExitSide);
  const targetIsHorizontal = isHorizontalCardinalSide(targetExitSide);

  if (sourceIsHorizontal && targetIsHorizontal) {
    const midX = (startStub.x + endStub.x) / 2;
    points.push({ x: midX, y: startStub.y }, { x: midX, y: endStub.y });
  } else if (!sourceIsHorizontal && !targetIsHorizontal) {
    const midY = (startStub.y + endStub.y) / 2;
    points.push({ x: startStub.x, y: midY }, { x: endStub.x, y: midY });
  } else if (sourceIsHorizontal) {
    points.push({ x: endStub.x, y: startStub.y });
  } else {
    points.push({ x: startStub.x, y: endStub.y });
  }

  points.push(endStub, end);

  return {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    points: dedupePoints(points),
  };
}

function getSegmentLength(from: Point, to: Point): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += getSegmentLength(points[i], points[i + 1]);
  }
  return total;
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

function pointInBox(point: Point, box: NodeBox): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function segmentIntersectsBox(from: Point, to: Point, box: NodeBox): boolean {
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
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentIntersectsBox(points[i], points[i + 1], box)) return true;
  }
  return false;
}

function sharesEndpoint(
  a: Pick<DiagramEdge, 'source' | 'target'>,
  b: Pick<DiagramEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

function createPlacementCandidates(
  edge: Pick<DiagramEdge, 'source' | 'target'>,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement[] {
  const positions = getNodePositionMap(nodes);
  const automatic = getAutomaticEdgeSides(edge.source, edge.target, nodes, settings);
  const sourcePosition = positions.get(edge.source);
  const targetPosition = positions.get(edge.target);

  const baseHorizontal = sourcePosition && targetPosition
    ? (() => {
      return sourcePosition.x <= targetPosition.x
        ? { sourceSide: 'right' as const, targetSide: 'left' as const }
        : { sourceSide: 'left' as const, targetSide: 'right' as const };
    })()
    : { sourceSide: 'right' as const, targetSide: 'left' as const };
  const baseVertical = sourcePosition && targetPosition
    ? (() => {
      return sourcePosition.y <= targetPosition.y
        ? { sourceSide: 'bottom' as const, targetSide: 'top' as const }
        : { sourceSide: 'top' as const, targetSide: 'bottom' as const };
    })()
    : {
      sourceSide: settings.layoutDirection === 'TB' ? 'bottom' as const : 'top' as const,
      targetSide: settings.layoutDirection === 'TB' ? 'top' as const : 'bottom' as const,
    };

  const seen = new Set<string>();
  const allPlacements = VISIBLE_HANDLE_SIDES.flatMap((sourceSide) =>
    VISIBLE_HANDLE_SIDES.map((targetSide) => ({ sourceSide, targetSide })),
  );
  const candidates = [automatic, baseHorizontal, baseVertical, ...allPlacements];

  return candidates.filter((placement) => {
    const key = `${placement.sourceSide}-${placement.targetSide}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getOptimizedEdgePlacements(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): Map<string, EdgeHandlePlacement> {
  const nodeBoxes = getNodeBoxes(nodes);
  const placements = new Map<string, EdgeHandlePlacement>();

  for (const edge of edges) {
    placements.set(edge.id, createPlacementCandidates(edge, nodes, settings)[0]);
  }

  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    for (const edge of edges) {
      const candidates = createPlacementCandidates(edge, nodes, settings);
      let bestPlacement = placements.get(edge.id) ?? candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        const geometry = buildEdgePolyline(edge, candidate, nodeBoxes);
        let score = getPolylineLength(geometry.points) * EDGE_LENGTH_PENALTY;

        for (const [nodeId, box] of nodeBoxes.entries()) {
          if (nodeId === edge.source || nodeId === edge.target) continue;
          if (polylineIntersectsBox(geometry.points, box)) {
            score += EDGE_NODE_OVERLAP_PENALTY;
          }
        }

        for (const other of edges) {
          if (other.id === edge.id) continue;
          const otherPlacement = placements.get(other.id);
          if (!otherPlacement) continue;
          if (sharesEndpoint(edge, other)) continue;
          const otherGeometry = buildEdgePolyline(other, otherPlacement, nodeBoxes);
          if (polylinesIntersect(geometry.points, otherGeometry.points)) {
            score += EDGE_INTERSECTION_PENALTY;
          }
        }

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = candidate;
        }
      }

      placements.set(edge.id, bestPlacement);
    }
  }

  return placements;
}

export function getAutomaticEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  const positions = getNodePositionMap(nodes);
  return getEdgeHandlePlacement(
    positions.get(source),
    positions.get(target),
    settings.layoutDirection,
  );
}

export function resolveEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
  handles?: {
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  },
): EdgeHandlePlacement {
  const explicitSourceSide = getSideFromHandleId(handles?.sourceHandleId, 'source');
  const explicitTargetSide = getSideFromHandleId(handles?.targetHandleId, 'target');
  const automaticSides = getAutomaticEdgeSides(source, target, nodes, settings);

  if (explicitSourceSide && explicitTargetSide) {
    return { sourceSide: explicitSourceSide, targetSide: explicitTargetSide };
  }

  return {
    sourceSide: explicitSourceSide ?? automaticSides.sourceSide,
    targetSide: explicitTargetSide ?? automaticSides.targetSide,
  };
}

export function getStoredOrAutomaticEdgeSides(
  edge: Pick<DiagramEdge, 'source' | 'target' | 'sourceSide' | 'targetSide'>,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  const automaticSides = getAutomaticEdgeSides(edge.source, edge.target, nodes, settings);
  return {
    sourceSide: edge.sourceSide ?? automaticSides.sourceSide,
    targetSide: edge.targetSide ?? automaticSides.targetSide,
  };
}

export function captureOptimizedEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  const placements = getOptimizedEdgePlacements(edges, nodes, settings);
  return edges.map((edge) => ({
    ...edge,
    ...(placements.get(edge.id) ?? getAutomaticEdgeSides(edge.source, edge.target, nodes, settings)),
  }));
}

export function ensureFixedEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  return edges.map((edge) => ({
    ...edge,
    ...getStoredOrAutomaticEdgeSides(edge, nodes, settings),
  }));
}

// --- Snapshot ---

export function snapshot(state: { diagram: Diagram }): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  return { nodes: state.diagram.nodes, edges: state.diagram.edges };
}

// --- Batch mutation helpers ---

export function batchAddNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const n of mutations.addNodes ?? []) {
    const realId = crypto.randomUUID();
    idMap.set(n.id, realId);
    nodes.push({
      id: realId,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        tags: n.tags ?? [],
        junctionType: 'or',
        ...(n.notes ? { notes: n.notes } : {}),
      },
    });
  }
  return nodes;
}

export function batchUpdateNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const upd of mutations.updateNodes ?? []) {
    const realId = idMap.get(upd.id) ?? upd.id;
    nodes = nodes.map((node) => {
      if (node.id !== realId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(upd.label !== undefined ? { label: upd.label } : {}),
          ...(upd.tags !== undefined ? { tags: upd.tags } : {}),
          ...(upd.notes !== undefined ? { notes: upd.notes || undefined } : {}),
        },
      };
    });
  }
  return nodes;
}

export function batchRemoveNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  if (!mutations.removeNodeIds?.length) return { nodes, edges };
  const removeSet = new Set(mutations.removeNodeIds.map((id) => idMap.get(id) ?? id));
  return {
    nodes: nodes.filter((n) => !removeSet.has(n.id)),
    edges: edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)),
  };
}

export function batchAddEdges(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  framework: Framework,
  settings: DiagramSettings,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of mutations.addEdges ?? []) {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    const result = validateEdge(edges, source, target, {
      allowCycles: framework.allowsCycles,
    });
    if (result.valid) {
      const routingSides = settings.edgeRoutingMode === 'fixed'
        ? resolveEdgeSides(source, target, nodes, settings)
        : {};
      edges.push({
        id: crypto.randomUUID(),
        source,
        target,
        ...routingSides,
        ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
        ...(framework.supportsEdgePolarity ? { polarity: e.polarity ?? 'positive' as EdgePolarity } : {}),
        ...(framework.supportsEdgeDelay && e.delay ? { delay: true } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      });
      const incomingCount = edges.filter((ex) => ex.target === target).length;
      if (framework.supportsJunctions && incomingCount === 2) {
        nodes = nodes.map((n) =>
          n.id === target ? { ...n, data: { ...n.data, junctionType: 'or' as const } } : n,
        );
      }
    }
  }
  return { nodes, edges };
}

export function batchUpdateEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
  framework: Framework,
): DiagramEdge[] {
  for (const upd of mutations.updateEdges ?? []) {
    const updates: Partial<DiagramEdge> = {};
    if (upd.confidence) updates.confidence = upd.confidence;
    if (framework.supportsEdgePolarity && upd.polarity) updates.polarity = upd.polarity;
    if (framework.supportsEdgeDelay && upd.delay !== undefined) updates.delay = upd.delay;
    if (upd.notes !== undefined) updates.notes = upd.notes || undefined;
    if (Object.keys(updates).length > 0) {
      edges = edges.map((e) =>
        e.id === upd.id ? { ...e, ...updates } : e,
      );
    }
  }
  return edges;
}

export function batchRemoveEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
): DiagramEdge[] {
  if (!mutations.removeEdgeIds?.length) return edges;
  const removeSet = new Set(mutations.removeEdgeIds);
  return edges.filter((e) => !removeSet.has(e.id));
}
