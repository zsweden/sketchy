import { describe, it, expect } from 'vitest';
import type { DiagramEdge, DiagramNode } from '../../types';
import { findStronglyConnectedComponents } from '../../graph/derived';
import { autoLayout, elkEngine } from '..';
import { NODE_WIDTH, estimateHeight } from '../layout-engine';

type PositionMap = Map<string, { x: number; y: number }>;

interface LayoutMetrics {
  nodeOverlaps: number;
  edgeCrossings: number;
  edgeNodeOverlaps: number;
  totalEdgeLength: number;
  boundingArea: number;
}

interface Fixture {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

function node(id: string): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

const fixtures: Fixture[] = [
  {
    name: 'triangle',
    nodes: ['a', 'b', 'c'].map(node),
    edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
  },
  {
    name: 'four-cycle-chord',
    nodes: ['a', 'b', 'c', 'd'].map(node),
    edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'a'), edge('a', 'c')],
  },
  {
    name: 'figure-eight',
    nodes: ['a', 'b', 'c', 'd', 'e'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'c'),
    ],
  },
  {
    name: 'two-scc-cascade',
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
      edge('d', 'e'),
      edge('e', 'f'),
      edge('f', 'd'),
      edge('c', 'd'),
      edge('b', 'e'),
    ],
  },
  {
    name: 'dense-six-node-scc',
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(node),
    edges: [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'f'),
      edge('f', 'a'),
      edge('a', 'd'),
      edge('b', 'e'),
      edge('c', 'f'),
      edge('f', 'c'),
    ],
  },
];

function computeNodeHeights(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Map<string, number> {
  const deg = new Map<string, { indegree: number; outdegree: number }>();
  for (const n of nodes) deg.set(n.id, { indegree: 0, outdegree: 0 });
  for (const e of edges) {
    const s = deg.get(e.source);
    const t = deg.get(e.target);
    if (s) s.outdegree++;
    if (t) t.indegree++;
  }

  const heights = new Map<string, number>();
  for (const n of nodes) {
    const d = deg.get(n.id) ?? { indegree: 0, outdegree: 0 };
    const hasBadges = n.data.tags.length > 0
      || (d.indegree === 0 && d.outdegree > 0)
      || (d.indegree > 0 && d.outdegree > 0);
    heights.set(n.id, estimateHeight(n.data.label, hasBadges));
  }
  return heights;
}

async function layoutCircularBaseline(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Promise<PositionMap> {
  const heights = computeNodeHeights(nodes, edges);
  const layoutNodes = nodes.map((n) => ({
    id: n.id,
    width: NODE_WIDTH,
    height: heights.get(n.id) ?? 48,
    position: n.position,
    locked: n.data.locked,
  }));
  const layoutEdges = edges.map((e) => ({ source: e.source, target: e.target }));
  const engineResults = await elkEngine(layoutNodes, layoutEdges, { direction: 'TB', cyclic: false });
  const positions = new Map(engineResults.map((result) => [result.id, { x: result.x, y: result.y }]));
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
  const components = findStronglyConnectedComponents(
    nodes.map((n) => n.id),
    edges,
  ).filter((component) => component.length >= 2);

  for (const component of components) {
    const positioned = component
      .map((nodeId) => {
        const nodeInfo = nodeMap.get(nodeId);
        const position = positions.get(nodeId);
        if (!nodeInfo || !position) return null;
        return { nodeId, node: nodeInfo, position };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (positioned.length < 2) continue;

    const centerX = positioned.reduce((sum, entry) => sum + entry.position.x, 0) / positioned.length;
    const centerY = positioned.reduce((sum, entry) => sum + entry.position.y, 0) / positioned.length;
    const radius = Math.max(
      140,
      ...positioned.map((entry) => Math.max(entry.node.width, entry.node.height)),
    );
    const sorted = [...positioned].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const angleStep = (Math.PI * 2) / sorted.length;

    sorted.forEach((entry, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      positions.set(entry.nodeId, {
        x: centerX + radius * Math.cos(angle) - entry.node.width / 2,
        y: centerY + radius * Math.sin(angle) - entry.node.height / 2,
      });
    });
  }

  return positions;
}

async function layoutCurrent(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Promise<PositionMap> {
  const updates = await autoLayout(nodes, edges, { direction: 'TB', cyclic: true }, elkEngine);
  return new Map(updates.map((update) => [update.id, update.position]));
}

function computeMetrics(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  positions: PositionMap,
): LayoutMetrics {
  const heights = computeNodeHeights(nodes, edges);
  const boxes = new Map(nodes.map((n) => [n.id, getBox(n.id, positions, heights)]));
  const segments = edges.map((e) => ({
    edge: e,
    from: getCenter(e.source, boxes),
    to: getCenter(e.target, boxes),
  }));

  let nodeOverlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (boxesIntersect(boxes.get(nodes[i].id)!, boxes.get(nodes[j].id)!)) {
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
    for (const n of nodes) {
      if (n.id === segment.edge.source || n.id === segment.edge.target) continue;
      if (segmentIntersectsBox(segment.from, segment.to, boxes.get(n.id)!)) {
        edgeNodeOverlaps++;
      }
    }
  }

  let totalEdgeLength = 0;
  for (const segment of segments) {
    totalEdgeLength += Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
  }

  const allBoxes = [...boxes.values()];
  const minX = Math.min(...allBoxes.map((b) => b.left));
  const minY = Math.min(...allBoxes.map((b) => b.top));
  const maxX = Math.max(...allBoxes.map((b) => b.right));
  const maxY = Math.max(...allBoxes.map((b) => b.bottom));

  return {
    nodeOverlaps,
    edgeCrossings,
    edgeNodeOverlaps,
    totalEdgeLength: round(totalEdgeLength),
    boundingArea: round((maxX - minX) * (maxY - minY)),
  };
}

function getBox(
  nodeId: string,
  positions: PositionMap,
  heights: Map<string, number>,
) {
  const position = positions.get(nodeId);
  if (!position) {
    throw new Error(`Missing position for ${nodeId}`);
  }
  const height = heights.get(nodeId) ?? 48;
  return {
    left: position.x,
    top: position.y,
    right: position.x + NODE_WIDTH,
    bottom: position.y + height,
  };
}

function getCenter(
  nodeId: string,
  boxes: Map<string, ReturnType<typeof getBox>>,
) {
  const box = boxes.get(nodeId);
  if (!box) {
    throw new Error(`Missing box for ${nodeId}`);
  }
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

function sharesEndpoint(a: DiagramEdge, b: DiagramEdge) {
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

describe('CLD layout metrics', () => {
  it('compares the current cyclic layout against the old circular baseline', async () => {
    const rows: Array<Record<string, number | string>> = [];
    const aggregate = {
      baseline: {
        nodeOverlaps: 0,
        edgeCrossings: 0,
        edgeNodeOverlaps: 0,
        totalEdgeLength: 0,
        boundingArea: 0,
      },
      current: {
        nodeOverlaps: 0,
        edgeCrossings: 0,
        edgeNodeOverlaps: 0,
        totalEdgeLength: 0,
        boundingArea: 0,
      },
    };

    for (const fixture of fixtures) {
      const baselinePositions = await layoutCircularBaseline(fixture.nodes, fixture.edges);
      const currentPositions = await layoutCurrent(fixture.nodes, fixture.edges);
      const baseline = computeMetrics(fixture.nodes, fixture.edges, baselinePositions);
      const current = computeMetrics(fixture.nodes, fixture.edges, currentPositions);

      rows.push({
        fixture: fixture.name,
        baselineCrossings: baseline.edgeCrossings,
        currentCrossings: current.edgeCrossings,
        baselineEdgeNode: baseline.edgeNodeOverlaps,
        currentEdgeNode: current.edgeNodeOverlaps,
        baselineLength: baseline.totalEdgeLength,
        currentLength: current.totalEdgeLength,
        baselineArea: baseline.boundingArea,
        currentArea: current.boundingArea,
      });

      aggregate.baseline.nodeOverlaps += baseline.nodeOverlaps;
      aggregate.baseline.edgeCrossings += baseline.edgeCrossings;
      aggregate.baseline.edgeNodeOverlaps += baseline.edgeNodeOverlaps;
      aggregate.baseline.totalEdgeLength += baseline.totalEdgeLength;
      aggregate.baseline.boundingArea += baseline.boundingArea;

      aggregate.current.nodeOverlaps += current.nodeOverlaps;
      aggregate.current.edgeCrossings += current.edgeCrossings;
      aggregate.current.edgeNodeOverlaps += current.edgeNodeOverlaps;
      aggregate.current.totalEdgeLength += current.totalEdgeLength;
      aggregate.current.boundingArea += current.boundingArea;
    }

    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.table([
      {
        layout: 'baseline',
        ...aggregate.baseline,
      },
      {
        layout: 'current',
        ...aggregate.current,
      },
    ]);

    expect(fixtures.length).toBeGreaterThan(0);
  });
});
