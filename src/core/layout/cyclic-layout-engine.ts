import type { LayoutDirection } from '../framework-types';
import { findStronglyConnectedComponents } from '../graph/derived';
import { NODE_SEP, NODE_WIDTH } from './layout-engine';
import type { LayoutEngine, LayoutEdgeInput, LayoutInput, LayoutResult } from './layout-engine';
import { computeLayoutMetrics, computeRoutedEdgeGeometries, scoreLayoutMetrics } from './layout-metrics';
import { elkLayeredEngine } from './elk-engine';

type Point = { x: number; y: number };

interface PositionedEntry {
  nodeId: string;
  node: LayoutInput;
  position: LayoutResult;
}

interface ScoringContext {
  componentIds: Set<string>;
  allNodes: LayoutInput[];
  allEdges: LayoutEdgeInput[];
}

interface ExternalInfluence {
  inbound?: Point;
  outbound?: Point;
  combined?: Point;
  inboundCount: number;
  outboundCount: number;
  weight: number;
}

interface CycleOrderEntry {
  nodeId: string;
  node: LayoutInput;
  preferredAngle: number;
  weight: number;
}

interface ComponentTemplate {
  width: number;
  height: number;
  relativePositions: Map<string, { x: number; y: number }>;
}

interface CondensedGroup {
  id: string;
  nodeIds: string[];
  nodes: LayoutInput[];
  internalEdges: LayoutEdgeInput[];
  width: number;
  height: number;
  positionHint?: { x: number; y: number };
  template?: ComponentTemplate;
}

type SeedVariant = 'elk' | 'anchor' | 'anchor-flipped' | 'axis';

export const cyclicLayoutEngine: LayoutEngine = async (nodes, edges, options) => {
  const components = findStronglyConnectedComponents(
    nodes.map((node) => node.id),
    edges.map((edge, index) => ({
      id: `layout-edge-${index}`,
      source: edge.source,
      target: edge.target,
    })),
  );
  const cyclicComponents = components.filter((component) => component.length >= 2);
  const directPositions = await layoutDirectCyclic(nodes, edges, options.direction, cyclicComponents);
  const shouldTryCondensed = cyclicComponents.length > 1 || nodes.length <= 12;

  if (!shouldTryCondensed) {
    return nodes.map((node) => directPositions.get(node.id) ?? {
      id: node.id,
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
    });
  }

  const condensedPositions = await layoutCondensedCyclic(
    nodes,
    edges,
    options.direction,
    components,
  );
  const directMetrics = computeLayoutMetrics(nodes, edges, directPositions);
  const condensedMetrics = computeLayoutMetrics(nodes, edges, condensedPositions);
  const bestPositions = compareGraphMetrics(condensedMetrics, directMetrics) < 0
    ? condensedPositions
    : directPositions;

  return nodes.map((node) => bestPositions.get(node.id) ?? {
    id: node.id,
    x: node.position?.x ?? 0,
    y: node.position?.y ?? 0,
  });
};

async function layoutCondensedCyclic(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  direction: LayoutDirection,
  components: string[][],
): Promise<Map<string, LayoutResult>> {
  const condensed = await buildCondensedGraph(nodes, edges, components, direction);
  const condensedResults = await elkLayeredEngine(
    condensed.nodes,
    condensed.edges,
    { direction, cyclic: false },
  );

  const positions = seedExpandedPositions(condensed.groups, condensedResults);
  const condensedPositions = new Map(condensedResults.map((result) => [result.id, result]));
  const cyclicGroups = [...condensed.groups]
    .filter((group) => group.nodeIds.length >= 2)
    .sort((a, b) => {
      const positionA = condensedPositions.get(a.id) ?? a.positionHint ?? { x: 0, y: 0 };
      const positionB = condensedPositions.get(b.id) ?? b.positionHint ?? { x: 0, y: 0 };
      return positionA.y - positionB.y || positionA.x - positionB.x || a.id.localeCompare(b.id);
    });

  for (const group of cyclicGroups) {
    const positioned = group.nodes
      .map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return { nodeId: node.id, node, position };
      })
      .filter((entry): entry is PositionedEntry => entry !== null);

    if (positioned.length < 2) continue;
    optimizeCyclicComponent(positioned, nodes, edges, positions, direction);
  }

  return positions;
}

async function layoutDirectCyclic(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  direction: LayoutDirection,
  components: string[][],
): Promise<Map<string, LayoutResult>> {
  const results = await elkLayeredEngine(nodes, edges, { direction, cyclic: true });
  const positions = new Map(results.map((result) => [result.id, result]));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  for (const component of components) {
    const positioned = component
      .map((nodeId) => {
        const node = nodeMap.get(nodeId);
        const position = positions.get(nodeId);
        if (!node || !position) return null;
        return { nodeId, node, position };
      })
      .filter((entry): entry is PositionedEntry => entry !== null);

    if (positioned.length < 2) continue;
    optimizeCyclicComponent(positioned, nodes, edges, positions, direction);
  }

  return positions;
}

async function buildCondensedGraph(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  components: string[][],
  direction: LayoutDirection,
): Promise<{
  groups: CondensedGroup[];
  nodes: LayoutInput[];
  edges: LayoutEdgeInput[];
}> {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const nodeToGroupId = new Map<string, string>();

  const groups = await Promise.all(
    components.map(async (component, index) => {
      const groupNodes = component
        .map((nodeId) => nodeMap.get(nodeId))
        .filter((node): node is LayoutInput => node !== undefined);
      const componentIds = new Set(component);
      const internalEdges = edges.filter(
        (edge) => componentIds.has(edge.source) && componentIds.has(edge.target),
      );
      const positionHint = averageNodePosition(groupNodes);
      const groupId = component.length >= 2 ? `scc:${index}` : component[0];

      for (const nodeId of component) {
        nodeToGroupId.set(nodeId, groupId);
      }

      if (component.length < 2) {
        const node = groupNodes[0];
        return {
          id: groupId,
          nodeIds: component,
          nodes: groupNodes,
          internalEdges,
          width: node?.width ?? NODE_WIDTH,
          height: node?.height ?? 48,
          positionHint,
        };
      }

      const template = await buildComponentTemplate(groupNodes, internalEdges, direction);
      return {
        id: groupId,
        nodeIds: component,
        nodes: groupNodes,
        internalEdges,
        width: template.width,
        height: template.height,
        positionHint,
        template,
      };
    }),
  );

  const condensedEdges = new Map<string, LayoutEdgeInput>();
  for (const edge of edges) {
    const sourceGroup = nodeToGroupId.get(edge.source);
    const targetGroup = nodeToGroupId.get(edge.target);
    if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) continue;
    const key = `${sourceGroup}->${targetGroup}`;
    if (!condensedEdges.has(key)) {
      condensedEdges.set(key, { source: sourceGroup, target: targetGroup });
    }
  }

  return {
    groups,
    nodes: groups.map((group) => ({
      id: group.id,
      width: group.width,
      height: group.height,
      position: group.positionHint,
    })),
    edges: [...condensedEdges.values()],
  };
}

async function buildComponentTemplate(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  direction: LayoutDirection,
): Promise<ComponentTemplate> {
  const results = await elkLayeredEngine(nodes, edges, { direction, cyclic: true });
  const positions = new Map(results.map((result) => [result.id, result]));
  const positioned = nodes
    .map((node) => {
      const position = positions.get(node.id) ?? {
        id: node.id,
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
      };
      positions.set(node.id, position);
      return { nodeId: node.id, node, position };
    })
    .filter((entry): entry is PositionedEntry => entry !== null);

  optimizeCyclicComponent(positioned, nodes, edges, positions, direction);

  const bounds = measureBounds(nodes, positions);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const padding = NODE_SEP * 0.5;

  return {
    width: round(bounds.width + padding),
    height: round(bounds.height + padding),
    relativePositions: new Map(nodes.map((node) => {
      const position = positions.get(node.id) ?? { x: 0, y: 0 };
      return [node.id, {
        x: position.x - center.x,
        y: position.y - center.y,
      }];
    })),
  };
}

function seedExpandedPositions(
  groups: CondensedGroup[],
  condensedResults: LayoutResult[],
): Map<string, LayoutResult> {
  const groupPositions = new Map(condensedResults.map((result) => [result.id, result]));
  const positions = new Map<string, LayoutResult>();

  for (const group of groups) {
    const groupPosition = groupPositions.get(group.id) ?? {
      id: group.id,
      x: group.positionHint?.x ?? 0,
      y: group.positionHint?.y ?? 0,
    };

    if (group.nodeIds.length < 2 || !group.template) {
      const node = group.nodes[0];
      if (node) {
        positions.set(node.id, {
          id: node.id,
          x: groupPosition.x,
          y: groupPosition.y,
        });
      }
      continue;
    }

    const centerX = groupPosition.x + group.width / 2;
    const centerY = groupPosition.y + group.height / 2;
    for (const node of group.nodes) {
      const relative = group.template.relativePositions.get(node.id) ?? { x: 0, y: 0 };
      positions.set(node.id, {
        id: node.id,
        x: centerX + relative.x,
        y: centerY + relative.y,
      });
    }
  }

  return positions;
}

function optimizeCyclicComponent(
  positioned: PositionedEntry[],
  allNodes: LayoutInput[],
  edges: Array<{ source: string; target: string }>,
  positions: Map<string, LayoutResult>,
  direction: LayoutDirection,
): void {
  const componentIds = new Set(positioned.map((entry) => entry.nodeId));
  const sorted = [...positioned].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const nodeLookup = new Map(allNodes.map((node) => [node.id, node]));
  const originalCenters = new Map(
    sorted.map((entry) => [
      entry.nodeId,
      {
        x: entry.position.x + entry.node.width / 2,
        y: entry.position.y + entry.node.height / 2,
      },
    ]),
  );
  const componentCenter = averagePoint([...originalCenters.values()]);
  const internalEdges = edges.filter(
    (edge) => componentIds.has(edge.source) && componentIds.has(edge.target),
  );
  const obstacleEdges = edges.filter(
    (edge) => componentIds.has(edge.source) || componentIds.has(edge.target),
  );
  const externalInfluence = buildExternalInfluenceMap(componentIds, edges, positions, nodeLookup);
  const anchorMap = new Map(
    [...externalInfluence.entries()]
      .filter(([, influence]) => influence.combined)
      .map(([nodeId, influence]) => [nodeId, influence.combined!]),
  );
  const cycleOrder = buildCycleOrder(sorted, originalCenters, componentCenter, externalInfluence);
  const connectionCounts = buildConnectionCounts(sorted, internalEdges);
  const scoringContext = buildScoringContext(componentIds, allNodes, edges);

  let bestScore = Number.POSITIVE_INFINITY;
  let bestPoints: Map<string, Point> | null = null;
  const variants: SeedVariant[] = ['elk', 'anchor', 'anchor-flipped', 'axis'];

  for (const variant of variants) {
    const seeded = createSeedPoints(
      variant,
      sorted,
      originalCenters,
      componentCenter,
      cycleOrder,
      anchorMap,
      direction,
    );
    const relaxed = runForceRelaxation(
      sorted,
      internalEdges,
      seeded,
      originalCenters,
      componentCenter,
      anchorMap,
      connectionCounts,
      allNodes,
      obstacleEdges,
      positions,
      direction,
    );

    for (const candidate of enumerateSymmetryCandidates(relaxed, componentCenter)) {
      const score = scoreCandidate(scoringContext, sorted, positions, candidate);
      if (score < bestScore) {
        bestScore = score;
        bestPoints = clonePoints(candidate);
      }
    }
  }

  const finalPoints = bestPoints ?? originalCenters;
  for (const entry of sorted) {
    const point = finalPoints.get(entry.nodeId);
    if (!point) continue;
    positions.set(entry.nodeId, {
      id: entry.nodeId,
      x: point.x - entry.node.width / 2,
      y: point.y - entry.node.height / 2,
    });
  }
}

function runForceRelaxation(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  internalEdges: Array<{ source: string; target: string }>,
  initialPoints: Map<string, Point>,
  originalCenters: Map<string, Point>,
  componentCenter: Point,
  anchorMap: Map<string, Point>,
  connectionCounts: Map<string, number>,
  allNodes: LayoutInput[],
  obstacleEdges: Array<{ source: string; target: string }>,
  settledPositions: Map<string, LayoutResult>,
  direction: LayoutDirection,
): Map<string, Point> {
  const points = clonePoints(initialPoints);
  const nodeLookup = new Map(allNodes.map((node) => [node.id, node]));
  const avgWidth = positioned.reduce((sum, entry) => sum + entry.node.width, 0) / positioned.length;
  const idealEdgeLength = Math.max(120, avgWidth * 0.55);
  const repulsion = Math.max(90, avgWidth * 0.45);
  const iterations = Math.min(200, Math.max(96, positioned.length * 22));
  const springStrength = 0.11;
  const anchorStrength = 0.05;
  const centerStrength = 0.035;
  const memoryStrength = 0.08;
  const edgeRepulsionStrength = 0.28;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const cooling = 1 - iteration / iterations;
    const displacements = new Map(positioned.map((entry) => [entry.nodeId, { x: 0, y: 0 }]));

    for (let i = 0; i < positioned.length; i++) {
      const a = positioned[i];
      const pointA = points.get(a.nodeId)!;

      for (let j = i + 1; j < positioned.length; j++) {
        const b = positioned[j];
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
          positioned.findIndex((entry) => entry.nodeId === edge.source),
          positioned.findIndex((entry) => entry.nodeId === edge.target),
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

    for (const entry of positioned) {
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

    applyEdgeRepulsion(
      positioned,
      obstacleEdges,
      nodeLookup,
      points,
      settledPositions,
      displacements,
      edgeRepulsionStrength,
    );

    const maxStep = 12 * cooling + 2;
    for (const entry of positioned) {
      if (entry.node.locked) continue;
      const displacement = displacements.get(entry.nodeId)!;
      const magnitude = Math.hypot(displacement.x, displacement.y);
      if (magnitude < 0.001) continue;
      const scale = Math.min(maxStep, magnitude * 0.02) / magnitude;
      const point = points.get(entry.nodeId)!;
      point.x += displacement.x * scale;
      point.y += displacement.y * scale;
    }

    resolveOverlaps(positioned, points);
  }

  for (let pass = 0; pass < 4; pass++) {
    compactComponent(points, positioned, componentCenter, direction, 0.82, 0.58);
    resolveOverlaps(positioned, points);
  }

  const finalCenter = averagePoint([...points.values()]);
  const recenterDx = componentCenter.x - finalCenter.x;
  const recenterDy = componentCenter.y - finalCenter.y;
  for (const entry of positioned) {
    const point = points.get(entry.nodeId)!;
    point.x += recenterDx;
    point.y += recenterDy;
  }

  return points;
}

function buildConnectionCounts(
  positioned: Array<{ nodeId: string }>,
  internalEdges: Array<{ source: string; target: string }>,
): Map<string, number> {
  const connectionCounts = new Map<string, number>();
  for (const entry of positioned) connectionCounts.set(entry.nodeId, 0);
  for (const edge of internalEdges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
  }
  return connectionCounts;
}

function buildScoringContext(
  componentIds: Set<string>,
  allNodes: LayoutInput[],
  edges: Array<{ source: string; target: string }>,
): ScoringContext {
  return {
    componentIds,
    allNodes,
    allEdges: edges,
  };
}

function scoreCandidate(
  scoringContext: ScoringContext,
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  positions: Map<string, LayoutResult>,
  candidatePoints: Map<string, Point>,
): number {
  const candidatePositions = new Map<string, { x: number; y: number }>();

  for (const node of scoringContext.allNodes) {
    if (scoringContext.componentIds.has(node.id)) {
      const point = candidatePoints.get(node.id);
      if (!point) continue;
      candidatePositions.set(node.id, {
        x: point.x - node.width / 2,
        y: point.y - node.height / 2,
      });
      continue;
    }

    const position = positions.get(node.id);
    if (position) {
      candidatePositions.set(node.id, position);
    }
  }

  const metrics = computeLayoutMetrics(scoringContext.allNodes, scoringContext.allEdges, candidatePositions);
  const edgeProximityPenalty = computeEdgeProximityPenalty(
    scoringContext.allNodes,
    scoringContext.allEdges,
    candidatePositions,
    scoringContext.componentIds,
  );
  const maxDisplacement = positioned.reduce((max, entry) => {
    const point = candidatePoints.get(entry.nodeId);
    const current = positions.get(entry.nodeId);
    if (!point || !current) return max;
    const candidateTopLeft = { x: point.x - entry.node.width / 2, y: point.y - entry.node.height / 2 };
    return Math.max(max, Math.hypot(candidateTopLeft.x - current.x, candidateTopLeft.y - current.y));
  }, 0);

  return scoreLayoutMetrics(metrics) + edgeProximityPenalty * 9_000 + maxDisplacement * 0.25;
}

function createSeedPoints(
  variant: SeedVariant,
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  originalCenters: Map<string, Point>,
  center: Point,
  cycleOrder: CycleOrderEntry[],
  anchorMap: Map<string, Point>,
  direction: LayoutDirection,
): Map<string, Point> {
  const points = clonePoints(originalCenters);

  if (variant === 'elk') {
    seedCollapsedLayouts(positioned, points, center, direction);
    return points;
  }

  if (variant === 'anchor' || variant === 'anchor-flipped') {
    if (anchorMap.size === 0) {
      seedOriginalAngleLayout(positioned, points, center, direction, variant === 'anchor-flipped');
      return points;
    }
    seedAnchorLayout(positioned, points, center, cycleOrder, direction, anchorMap, variant === 'anchor-flipped');
    return points;
  }

  seedAxisLayout(positioned, points, center, cycleOrder);
  return points;
}

function seedOriginalAngleLayout(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, Point>,
  center: Point,
  direction: LayoutDirection,
  flip: boolean,
): void {
  const avgWidth = positioned.reduce((sum, entry) => sum + entry.node.width, 0) / positioned.length;
  const avgHeight = positioned.reduce((sum, entry) => sum + entry.node.height, 0) / positioned.length;
  const radiusX = Math.max(avgWidth * 0.95, (avgWidth + NODE_SEP * 1.05) * positioned.length / (Math.PI * 2));
  const radiusY = Math.max(avgHeight * 1.1, (avgHeight + NODE_SEP * 0.8) * positioned.length / (Math.PI * 2));
  const verticalScale = direction === 'BT' ? 0.92 : 1;

  for (const entry of positioned) {
    const original = points.get(entry.nodeId) ?? center;
    let angle = Math.atan2(original.y - center.y, original.x - center.x);
    if (flip) angle += Math.PI;

    points.set(entry.nodeId, {
      x: center.x + radiusX * Math.cos(angle),
      y: center.y + radiusY * verticalScale * Math.sin(angle),
    });
  }
}

function seedAnchorLayout(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, Point>,
  center: Point,
  cycleOrder: CycleOrderEntry[],
  direction: LayoutDirection,
  anchorMap: Map<string, Point>,
  flip: boolean,
): void {
  const avgWidth = positioned.reduce((sum, entry) => sum + entry.node.width, 0) / positioned.length;
  const avgHeight = positioned.reduce((sum, entry) => sum + entry.node.height, 0) / positioned.length;
  const radiusX = Math.max(avgWidth * 0.95, (avgWidth + NODE_SEP * 1.05) * positioned.length / (Math.PI * 2));
  const radiusY = Math.max(avgHeight * 1.1, (avgHeight + NODE_SEP * 0.8) * positioned.length / (Math.PI * 2));
  const verticalScale = direction === 'BT' ? 0.92 : 1;
  const adjustedOrder = cycleOrder.map((entry) => {
    const anchor = anchorMap.get(entry.nodeId);
    return {
      ...entry,
      preferredAngle: anchor
        ? Math.atan2(anchor.y - center.y, anchor.x - center.x)
        : entry.preferredAngle,
    };
  });
  placeCycleEntriesOnEllipse(points, adjustedOrder, center, radiusX, radiusY * verticalScale, flip);
}

function seedAxisLayout(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, Point>,
  center: Point,
  cycleOrder: CycleOrderEntry[],
): void {
  const ordered = [...positioned].sort((a, b) => {
    const pointA = points.get(a.nodeId)!;
    const pointB = points.get(b.nodeId)!;
    return pointA.x - pointB.x || pointA.y - pointB.y;
  });
  const avgWidth = positioned.reduce((sum, entry) => sum + entry.node.width, 0) / positioned.length;
  const avgHeight = positioned.reduce((sum, entry) => sum + entry.node.height, 0) / positioned.length;
  const effectiveOrder = cycleOrder.length === positioned.length
    ? cycleOrder
    : ordered.map((entry) => ({
      nodeId: entry.nodeId,
      node: entry.node,
      preferredAngle: Math.atan2(points.get(entry.nodeId)!.y - center.y, points.get(entry.nodeId)!.x - center.x),
      weight: 1,
    }));
  const radiusX = Math.max(avgWidth * 0.9, (avgWidth + NODE_SEP) * effectiveOrder.length / (Math.PI * 2));
  const radiusY = Math.max(avgHeight * 0.95, (avgHeight + NODE_SEP * 0.7) * effectiveOrder.length / (Math.PI * 2));
  placeCycleEntriesOnEllipse(points, effectiveOrder, center, radiusX, radiusY, false);
}

function enumerateSymmetryCandidates(
  points: Map<string, Point>,
  center: Point,
): Map<string, Point>[] {
  return [
    clonePoints(points),
    transformPoints(points, center, (point) => ({ x: 2 * center.x - point.x, y: point.y })),
    transformPoints(points, center, (point) => ({ x: point.x, y: 2 * center.y - point.y })),
    transformPoints(points, center, (point) => ({
      x: center.x - (point.x - center.x),
      y: center.y - (point.y - center.y),
    })),
  ];
}

function transformPoints(
  points: Map<string, Point>,
  _center: Point,
  transform: (point: Point) => Point,
): Map<string, Point> {
  const transformed = new Map<string, Point>();
  for (const [nodeId, point] of points.entries()) {
    transformed.set(nodeId, transform(point));
  }
  return transformed;
}

function buildExternalInfluenceMap(
  componentIds: Set<string>,
  edges: Array<{ source: string; target: string }>,
  positions: Map<string, LayoutResult>,
  nodeLookup: ReadonlyMap<string, LayoutInput>,
): Map<string, ExternalInfluence> {
  const anchors = new Map<string, {
    inboundSumX: number;
    inboundSumY: number;
    inboundCount: number;
    outboundSumX: number;
    outboundSumY: number;
    outboundCount: number;
  }>();

  for (const edge of edges) {
    const sourceInside = componentIds.has(edge.source);
    const targetInside = componentIds.has(edge.target);
    if (sourceInside === targetInside) continue;

    const insideId = sourceInside ? edge.source : edge.target;
    const outsideId = sourceInside ? edge.target : edge.source;
    const outside = resolveNodeCenter(outsideId, positions, nodeLookup);
    if (!outside) continue;

    const anchor = anchors.get(insideId) ?? {
      inboundSumX: 0,
      inboundSumY: 0,
      inboundCount: 0,
      outboundSumX: 0,
      outboundSumY: 0,
      outboundCount: 0,
    };
    if (sourceInside) {
      anchor.outboundSumX += outside.x;
      anchor.outboundSumY += outside.y;
      anchor.outboundCount += 1;
    } else {
      anchor.inboundSumX += outside.x;
      anchor.inboundSumY += outside.y;
      anchor.inboundCount += 1;
    }
    anchors.set(insideId, anchor);
  }

  return new Map(
    [...anchors.entries()].map(([nodeId, anchor]) => [
      nodeId,
      {
        inbound: anchor.inboundCount > 0
          ? { x: anchor.inboundSumX / anchor.inboundCount, y: anchor.inboundSumY / anchor.inboundCount }
          : undefined,
        outbound: anchor.outboundCount > 0
          ? { x: anchor.outboundSumX / anchor.outboundCount, y: anchor.outboundSumY / anchor.outboundCount }
          : undefined,
        combined: combineInfluenceAnchors(anchor),
        inboundCount: anchor.inboundCount,
        outboundCount: anchor.outboundCount,
        weight: anchor.inboundCount + anchor.outboundCount,
      } satisfies ExternalInfluence,
    ]),
  );
}

function combineInfluenceAnchors(anchor: {
  inboundSumX: number;
  inboundSumY: number;
  inboundCount: number;
  outboundSumX: number;
  outboundSumY: number;
  outboundCount: number;
}): Point | undefined {
  const total = anchor.inboundCount + anchor.outboundCount;
  if (total === 0) return undefined;
  return {
    x: (anchor.inboundSumX + anchor.outboundSumX) / total,
    y: (anchor.inboundSumY + anchor.outboundSumY) / total,
  };
}

function buildCycleOrder(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  originalCenters: ReadonlyMap<string, Point>,
  center: Point,
  externalInfluence: ReadonlyMap<string, ExternalInfluence>,
): CycleOrderEntry[] {
  return positioned
    .map((entry) => {
      const original = originalCenters.get(entry.nodeId) ?? center;
      const influence = externalInfluence.get(entry.nodeId);
      const anchor = influence?.combined ?? original;
      const preferredAngle = Math.atan2(anchor.y - center.y, anchor.x - center.x);
      const bridgeBias = Math.abs((influence?.outboundCount ?? 0) - (influence?.inboundCount ?? 0));
      const weight = 1 + (influence?.weight ?? 0) * 0.65 + bridgeBias * 0.25;

      return {
        nodeId: entry.nodeId,
        node: entry.node,
        preferredAngle,
        weight,
        sortAngle: normalizeAngle(preferredAngle),
        externalWeight: influence?.weight ?? 0,
        bridgeBias,
      };
    })
    .sort((a, b) =>
      a.sortAngle - b.sortAngle
      || b.externalWeight - a.externalWeight
      || b.bridgeBias - a.bridgeBias
      || a.nodeId.localeCompare(b.nodeId))
    .map(({ nodeId, node, preferredAngle, weight }) => ({ nodeId, node, preferredAngle, weight }));
}

function placeCycleEntriesOnEllipse(
  points: Map<string, Point>,
  cycleOrder: CycleOrderEntry[],
  center: Point,
  radiusX: number,
  radiusY: number,
  flip: boolean,
): void {
  if (cycleOrder.length === 0) return;

  const step = (Math.PI * 2) / cycleOrder.length;
  const baseAngle = -Math.PI / 2;
  const targetAngles = cycleOrder.map((entry) => normalizeAngle(entry.preferredAngle + (flip ? Math.PI : 0)));
  const offsets = targetAngles.map((angle, index) => normalizeAngle(angle - (baseAngle + index * step)));
  offsets.push(0);

  let bestOffset = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const offset of offsets) {
    const cost = cycleOrder.reduce((sum, entry, index) => {
      const candidateAngle = baseAngle + offset + index * step;
      return sum + angularDistance(candidateAngle, targetAngles[index]) * entry.weight;
    }, 0);
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }

  cycleOrder.forEach((entry, index) => {
    const angle = baseAngle + bestOffset + index * step;
    points.set(entry.nodeId, {
      x: center.x + radiusX * Math.cos(angle),
      y: center.y + radiusY * Math.sin(angle),
    });
  });
}

function resolveNodeCenter(
  nodeId: string,
  positions: ReadonlyMap<string, LayoutResult>,
  nodeLookup: ReadonlyMap<string, LayoutInput>,
): Point | undefined {
  const position = positions.get(nodeId);
  const node = nodeLookup.get(nodeId);
  if (!position || !node) return undefined;
  return {
    x: position.x + node.width / 2,
    y: position.y + node.height / 2,
  };
}

function applyEdgeRepulsion(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  obstacleEdges: Array<{ source: string; target: string }>,
  nodeLookup: ReadonlyMap<string, LayoutInput>,
  points: ReadonlyMap<string, Point>,
  settledPositions: ReadonlyMap<string, LayoutResult>,
  displacements: Map<string, Point>,
  strength: number,
): void {
  const currentPositions = new Map<string, { x: number; y: number }>();
  for (const [nodeId, position] of settledPositions.entries()) {
    currentPositions.set(nodeId, { x: position.x, y: position.y });
  }
  for (const [nodeId, point] of points.entries()) {
    const node = nodeLookup.get(nodeId);
    if (!node) continue;
    currentPositions.set(nodeId, {
      x: point.x - node.width / 2,
      y: point.y - node.height / 2,
    });
  }

  const geometries = computeRoutedEdgeGeometries(
    [...nodeLookup.values()],
    obstacleEdges,
    currentPositions,
  );

  for (const entry of positioned) {
    if (entry.node.locked) continue;
    const point = points.get(entry.nodeId);
    const displacement = displacements.get(entry.nodeId);
    if (!point || !displacement) continue;

    const clearance = Math.max(entry.node.width, entry.node.height) * 0.6 + NODE_SEP * 0.35;

    for (const geometry of geometries) {
      if (geometry.edge.source === entry.nodeId || geometry.edge.target === entry.nodeId) continue;

      for (let index = 0; index < geometry.points.length - 1; index++) {
        const segmentFrom = geometry.points[index];
        const segmentTo = geometry.points[index + 1];
        const closest = getClosestPointOnSegment(point, segmentFrom, segmentTo);
        if (closest.distance >= clearance) continue;

        let dx = point.x - closest.point.x;
        let dy = point.y - closest.point.y;
        let distance = closest.distance;
        if (distance < 0.001) {
          const fallback = perpendicularUnit(segmentFrom, segmentTo)
            ?? deterministicBias(0, 1, 'TB');
          dx = fallback.x;
          dy = fallback.y;
          distance = Math.hypot(dx, dy);
        }

        const scale = (clearance - distance) * strength;
        const interiorBias = closest.t > 0.08 && closest.t < 0.92 ? 1.25 : 0.6;
        displacement.x += (dx / distance) * scale * interiorBias;
        displacement.y += (dy / distance) * scale * interiorBias;
      }
    }
  }
}

function computeEdgeProximityPenalty(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
  targetIds: ReadonlySet<string>,
): number {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const centers = new Map<string, Point>();
  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    centers.set(node.id, { x: position.x + node.width / 2, y: position.y + node.height / 2 });
  }
  const geometries = computeRoutedEdgeGeometries(nodes, edges, positions);

  let penalty = 0;
  for (const geometry of geometries) {
    if (!nodeLookup.has(geometry.edge.source) || !nodeLookup.has(geometry.edge.target)) continue;

    for (const node of nodes) {
      if (!targetIds.has(node.id)) continue;
      if (node.id === geometry.edge.source || node.id === geometry.edge.target) continue;
      const point = centers.get(node.id);
      if (!point) continue;

      const clearance = Math.max(node.width, node.height) * 0.6 + NODE_SEP * 0.35;
      for (let index = 0; index < geometry.points.length - 1; index++) {
        const closest = getClosestPointOnSegment(point, geometry.points[index], geometry.points[index + 1]);
        if (closest.distance >= clearance) continue;
        const interiorBias = closest.t > 0.08 && closest.t < 0.92 ? 1 : 0.35;
        penalty += ((clearance - closest.distance) / clearance) * interiorBias;
      }
    }
  }

  return penalty;
}

function getClosestPointOnSegment(
  point: Point,
  from: Point,
  to: Point,
): { point: Point; distance: number; t: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared < 0.001) {
    return {
      point: from,
      distance: Math.hypot(point.x - from.x, point.y - from.y),
      t: 0,
    };
  }

  const rawT = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  const closest = {
    x: from.x + dx * t,
    y: from.y + dy * t,
  };

  return {
    point: closest,
    distance: Math.hypot(point.x - closest.x, point.y - closest.y),
    t,
  };
}

function perpendicularUnit(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return null;
  return { x: -dy / length, y: dx / length };
}

function normalizeAngle(angle: number): number {
  let normalized = angle % (Math.PI * 2);
  if (normalized < 0) normalized += Math.PI * 2;
  return normalized;
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI * 2 - diff);
}

function seedCollapsedLayouts(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, Point>,
  center: Point,
  direction: LayoutDirection,
): void {
  const xs = [...points.values()].map((point) => point.x);
  const ys = [...points.values()].map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const collapsed = spanX < NODE_WIDTH * 0.6 && spanY < NODE_WIDTH * 0.6;
  if (!collapsed) return;

  const cols = Math.ceil(Math.sqrt(positioned.length));
  const horizontalStep = NODE_WIDTH + NODE_SEP * 0.5;
  const averageHeight = positioned.reduce((sum, entry) => sum + entry.node.height, 0) / positioned.length;
  const verticalStep = averageHeight + NODE_SEP * 0.5;

  positioned.forEach((entry, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const xOffset = (col - (cols - 1) / 2) * horizontalStep;
    const yOffset = (row - (Math.ceil(positioned.length / cols) - 1) / 2) * verticalStep;
    points.set(entry.nodeId, {
      x: center.x + (direction === 'TB' ? xOffset : xOffset * 0.9),
      y: center.y + yOffset,
    });
  });
}

function resolveOverlaps(
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  points: Map<string, Point>,
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
  points: Map<string, Point>,
  positioned: Array<{ nodeId: string; node: LayoutInput }>,
  center: Point,
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
  pointA: Point,
  pointB: Point,
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

function deterministicBias(i: number, j: number, direction: LayoutDirection): Point {
  const base = (j - i + 1) * 7;
  return direction === 'BT'
    ? { x: base, y: -base * 0.6 }
    : { x: base, y: base * 0.6 };
}

function averagePoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function averageNodePosition(nodes: LayoutInput[]): Point | undefined {
  const positioned = nodes.filter((node) => node.position);
  if (positioned.length === 0) return undefined;
  return {
    x: positioned.reduce((sum, node) => sum + (node.position?.x ?? 0), 0) / positioned.length,
    y: positioned.reduce((sum, node) => sum + (node.position?.y ?? 0), 0) / positioned.length,
  };
}

function measureBounds(
  nodes: LayoutInput[],
  positions: Map<string, LayoutResult>,
) {
  const boxes = nodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      left: position.x,
      top: position.y,
      right: position.x + node.width,
      bottom: position.y + node.height,
    };
  });

  const minX = Math.min(...boxes.map((box) => box.left));
  const minY = Math.min(...boxes.map((box) => box.top));
  const maxX = Math.max(...boxes.map((box) => box.right));
  const maxY = Math.max(...boxes.map((box) => box.bottom));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function compareGraphMetrics(
  a: ReturnType<typeof computeLayoutMetrics>,
  b: ReturnType<typeof computeLayoutMetrics>,
) {
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clonePoints(points: Map<string, Point>): Map<string, Point> {
  return new Map([...points.entries()].map(([nodeId, point]) => [nodeId, { ...point }]));
}
