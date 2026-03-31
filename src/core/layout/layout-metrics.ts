import type { LayoutEdgeInput, LayoutInput, LayoutResult } from './layout-engine';

export interface LayoutMetrics {
  nodeOverlaps: number;
  edgeCrossings: number;
  edgeNodeOverlaps: number;
  totalEdgeLength: number;
  boundingArea: number;
}

type PositionLike = Pick<LayoutResult, 'x' | 'y'>;

export function computeLayoutMetrics(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, PositionLike>,
): LayoutMetrics {
  const boxes = new Map(nodes.map((node) => [node.id, getBox(node, positions)]));
  const segments = edges.flatMap((edge) => {
    const source = boxes.get(edge.source);
    const target = boxes.get(edge.target);
    if (!source || !target) return [];
    return [{
      edge,
      from: getCenter(source),
      to: getCenter(target),
    }];
  });

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
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (sharesEndpoint(a.edge, b.edge)) continue;
      if (segmentsIntersect(a.from, a.to, b.from, b.to)) {
        edgeCrossings++;
      }
    }
  }

  let edgeNodeOverlaps = 0;
  for (const segment of segments) {
    for (const node of nodes) {
      if (node.id === segment.edge.source || node.id === segment.edge.target) continue;
      const box = boxes.get(node.id);
      if (box && segmentIntersectsBox(segment.from, segment.to, box)) {
        edgeNodeOverlaps++;
      }
    }
  }

  let totalEdgeLength = 0;
  for (const segment of segments) {
    totalEdgeLength += Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
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
    totalEdgeLength: round(totalEdgeLength),
    boundingArea: round((maxX - minX) * (maxY - minY)),
  };
}

export function scoreLayoutMetrics(metrics: LayoutMetrics): number {
  return metrics.nodeOverlaps * 1_000_000_000
    + metrics.edgeCrossings * 50_000
    + metrics.edgeNodeOverlaps * 10_000
    + metrics.totalEdgeLength
    + metrics.boundingArea * 0.0025;
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}
