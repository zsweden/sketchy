import type { DiagramEdge } from '../types';
import type { LayoutDirection } from '../framework-types';
import { findStronglyConnectedComponents } from '../graph/derived';
import { NODE_SEP, NODE_WIDTH } from './layout-engine';
import type { LayoutEngine, LayoutInput, LayoutResult } from './layout-engine';
import { elkLayeredEngine } from './elk-engine';

export const cyclicLayoutEngine: LayoutEngine = async (nodes, edges, options) => {
  const results = await elkLayeredEngine(nodes, edges, { ...options, cyclic: true });
  return relaxCyclicComponents(nodes, edges, results, options.direction);
};

function relaxCyclicComponents(
  nodes: LayoutInput[],
  edges: DiagramEdge[] | Array<{ source: string; target: string }>,
  results: LayoutResult[],
  direction: LayoutDirection,
): LayoutResult[] {
  const positions = new Map(results.map((result) => [result.id, result]));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const components = findStronglyConnectedComponents(
    nodes.map((node) => node.id),
    edges.map((edge, index) => ({
      id: `layout-edge-${index}`,
      source: edge.source,
      target: edge.target,
    })),
  ).filter((component) => component.length >= 2);

  for (const component of components) {
    const positioned = component
      .map((nodeId) => {
        const node = nodeMap.get(nodeId);
        const position = positions.get(nodeId);
        if (!node || !position) return null;
        return { nodeId, node, position };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (positioned.length < 2) continue;
    applyForceRelaxation(positioned, edges, positions, direction);
  }

  return results.map((result) => positions.get(result.id) ?? result);
}

function applyForceRelaxation(
  positioned: Array<{
    nodeId: string;
    node: LayoutInput;
    position: LayoutResult;
  }>,
  edges: Array<{ source: string; target: string }>,
  positions: Map<string, LayoutResult>,
  direction: LayoutDirection,
): void {
  const componentIds = new Set(positioned.map((entry) => entry.nodeId));
  const sorted = [...positioned].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const originalCenters = new Map(
    sorted.map((entry) => [
      entry.nodeId,
      {
        x: entry.position.x + entry.node.width / 2,
        y: entry.position.y + entry.node.height / 2,
      },
    ]),
  );
  const points = new Map(originalCenters);
  const componentCenter = averagePoint([...points.values()]);
  const internalEdges = edges.filter(
    (edge) => componentIds.has(edge.source) && componentIds.has(edge.target),
  );
  const anchorMap = buildExternalAnchorMap(componentIds, edges, positions);

  seedCollapsedLayouts(sorted, points, componentCenter, direction);

  const connectionCounts = new Map<string, number>();
  for (const entry of sorted) connectionCounts.set(entry.nodeId, 0);
  for (const edge of internalEdges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
  }

  const avgWidth = sorted.reduce((sum, entry) => sum + entry.node.width, 0) / sorted.length;
  const idealEdgeLength = Math.max(120, avgWidth * 0.55);
  const repulsion = Math.max(90, avgWidth * 0.45);
  const iterations = Math.min(200, Math.max(96, sorted.length * 22));
  const springStrength = 0.11;
  const anchorStrength = 0.05;
  const centerStrength = 0.035;
  const memoryStrength = 0.08;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const cooling = 1 - iteration / iterations;
    const displacements = new Map(sorted.map((entry) => [entry.nodeId, { x: 0, y: 0 }]));

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const pointA = points.get(a.nodeId)!;

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const pointB = points.get(b.nodeId)!;
        let dx = pointA.x - pointB.x;
        let dy = pointA.y - pointB.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1) {
          const bias = deterministicBias(i, j, direction);
          dx = bias.x;
          dy = bias.y;
          dist = Math.hypot(dx, dy);
        }
        const force = (repulsion * repulsion) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const dispA = displacements.get(a.nodeId)!;
        const dispB = displacements.get(b.nodeId)!;
        dispA.x += ux * force;
        dispA.y += uy * force;
        dispB.x -= ux * force;
        dispB.y -= uy * force;
      }
    }

    for (const edge of internalEdges) {
      const source = points.get(edge.source);
      const target = points.get(edge.target);
      if (!source || !target) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 1) {
        const bias = deterministicBias(
          sorted.findIndex((entry) => entry.nodeId === edge.source),
          sorted.findIndex((entry) => entry.nodeId === edge.target),
          direction,
        );
        dx = bias.x;
        dy = bias.y;
        dist = Math.hypot(dx, dy);
      }
      const degreeBias =
        ((connectionCounts.get(edge.source) ?? 0) + (connectionCounts.get(edge.target) ?? 0)) * 2;
      const force = (dist - (idealEdgeLength + degreeBias)) * springStrength;
      const ux = dx / dist;
      const uy = dy / dist;
      const dispSource = displacements.get(edge.source)!;
      const dispTarget = displacements.get(edge.target)!;
      dispSource.x += ux * force;
      dispSource.y += uy * force;
      dispTarget.x -= ux * force;
      dispTarget.y -= uy * force;
    }

    for (const entry of sorted) {
      const displacement = displacements.get(entry.nodeId)!;
      const anchor = anchorMap.get(entry.nodeId);
      const current = points.get(entry.nodeId)!;
      const original = originalCenters.get(entry.nodeId)!;

      if (anchor) {
        displacement.x += (anchor.x - current.x) * anchorStrength;
        displacement.y += (anchor.y - current.y) * anchorStrength;
      }

      displacement.x += (componentCenter.x - current.x) * centerStrength;
      displacement.y += (componentCenter.y - current.y) * centerStrength;
      displacement.x += (original.x - current.x) * memoryStrength;
      displacement.y += (original.y - current.y) * memoryStrength;
    }

    const maxStep = 12 * cooling + 2;
    for (const entry of sorted) {
      if (entry.node.locked) continue;
      const displacement = displacements.get(entry.nodeId)!;
      const magnitude = Math.hypot(displacement.x, displacement.y);
      if (magnitude < 0.001) continue;
      const scale = Math.min(maxStep, magnitude * 0.02) / magnitude;
      const point = points.get(entry.nodeId)!;
      point.x += displacement.x * scale;
      point.y += displacement.y * scale;
    }

    resolveOverlaps(sorted, points);
  }

  for (let pass = 0; pass < 4; pass++) {
    compactComponent(points, sorted, componentCenter, direction, 0.82, 0.58);
    resolveOverlaps(sorted, points);
  }

  const finalCenter = averagePoint([...points.values()]);
  const recenterDx = componentCenter.x - finalCenter.x;
  const recenterDy = componentCenter.y - finalCenter.y;

  for (const entry of sorted) {
    const point = points.get(entry.nodeId)!;
    const centeredX = point.x + recenterDx;
    const centeredY = point.y + recenterDy;
    positions.set(entry.nodeId, {
      id: entry.nodeId,
      x: centeredX - entry.node.width / 2,
      y: centeredY - entry.node.height / 2,
    });
  }
}

function buildExternalAnchorMap(
  componentIds: Set<string>,
  edges: Array<{ source: string; target: string }>,
  positions: Map<string, LayoutResult>,
): Map<string, { x: number; y: number }> {
  const anchors = new Map<string, { sumX: number; sumY: number; count: number }>();

  for (const edge of edges) {
    const sourceInside = componentIds.has(edge.source);
    const targetInside = componentIds.has(edge.target);
    if (sourceInside === targetInside) continue;

    const insideId = sourceInside ? edge.source : edge.target;
    const outsideId = sourceInside ? edge.target : edge.source;
    const outside = positions.get(outsideId);
    if (!outside) continue;

    const anchor = anchors.get(insideId) ?? { sumX: 0, sumY: 0, count: 0 };
    anchor.sumX += outside.x;
    anchor.sumY += outside.y;
    anchor.count += 1;
    anchors.set(insideId, anchor);
  }

  return new Map(
    [...anchors.entries()].map(([nodeId, anchor]) => [
      nodeId,
      { x: anchor.sumX / anchor.count, y: anchor.sumY / anchor.count },
    ]),
  );
}

function seedCollapsedLayouts(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, { x: number; y: number }>,
  center: { x: number; y: number },
  direction: LayoutDirection,
): void {
  const xs = [...points.values()].map((point) => point.x);
  const ys = [...points.values()].map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const collapsed = spanX < NODE_WIDTH * 0.6 && spanY < NODE_WIDTH * 0.6;
  if (!collapsed) return;

  const cols = Math.ceil(Math.sqrt(positioned.length));
  const rows = Math.ceil(positioned.length / cols);
  const horizontalStep = NODE_WIDTH + NODE_SEP * 0.5;
  const averageHeight = positioned.reduce((sum, entry) => sum + entry.node.height, 0) / positioned.length;
  const verticalStep = averageHeight + NODE_SEP * 0.5;

  positioned.forEach((entry, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const xOffset = (col - (cols - 1) / 2) * horizontalStep;
    const yOffset = (row - (rows - 1) / 2) * verticalStep;
    points.set(entry.nodeId, {
      x: center.x + (direction === 'TB' ? xOffset : xOffset * 0.9),
      y: center.y + yOffset,
    });
  });
}

function resolveOverlaps(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, { x: number; y: number }>,
): void {
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < positioned.length; i++) {
      const a = positioned[i];
      const pointA = points.get(a.nodeId)!;

      for (let j = i + 1; j < positioned.length; j++) {
        const b = positioned[j];
        const pointB = points.get(b.nodeId)!;
        let dx = pointB.x - pointA.x;
        let dy = pointB.y - pointA.y;
        if (dx === 0 && dy === 0) {
          const bias = deterministicBias(i, j, 'TB');
          dx = bias.x;
          dy = bias.y;
        }

        const minX = (a.node.width + b.node.width) / 2 + NODE_SEP * 0.5;
        const minY = (a.node.height + b.node.height) / 2 + NODE_SEP * 0.5;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const moveAlongX = overlapX < overlapY;
        const signX = dx === 0 ? 1 : Math.sign(dx);
        const signY = dy === 0 ? 1 : Math.sign(dy);

        if (moveAlongX) {
          distributeOverlap(pointA, pointB, overlapX, signX, a.node.locked, b.node.locked, 'x');
        } else {
          distributeOverlap(pointA, pointB, overlapY, signY, a.node.locked, b.node.locked, 'y');
        }
      }
    }
  }
}

function compactComponent(
  points: Map<string, { x: number; y: number }>,
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  center: { x: number; y: number },
  direction: LayoutDirection,
  horizontalScale: number,
  verticalScale: number,
): void {
  const effectiveVerticalScale = direction === 'TB' || direction === 'BT'
    ? verticalScale
    : Math.min(0.75, verticalScale + 0.08);

  for (const entry of positioned) {
    if (entry.node.locked) continue;
    const point = points.get(entry.nodeId)!;
    point.x = center.x + (point.x - center.x) * horizontalScale;
    point.y = center.y + (point.y - center.y) * effectiveVerticalScale;
  }
}

function distributeOverlap(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  amount: number,
  sign: number,
  lockedA: boolean | undefined,
  lockedB: boolean | undefined,
  axis: 'x' | 'y',
): void {
  if (lockedA && lockedB) return;
  const shift = amount / 2 + 1;

  if (lockedA) {
    pointB[axis] += sign * (amount + 2);
    return;
  }
  if (lockedB) {
    pointA[axis] -= sign * (amount + 2);
    return;
  }

  pointA[axis] -= sign * shift;
  pointB[axis] += sign * shift;
}

function deterministicBias(i: number, j: number, direction: LayoutDirection): { x: number; y: number } {
  const base = (j - i + 1) * 7;
  return direction === 'BT'
    ? { x: base, y: -base * 0.6 }
    : { x: base, y: base * 0.6 };
}

function averagePoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}
