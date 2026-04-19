import RBush from 'rbush';
import type { EdgeRoutingEdge, EdgeRoutingInput, EdgeRoutingNodeBox, EdgeRoutingPlacement } from './shared';
import { isCornerHandleSide, getBaseHandleSide, getPrimaryFlowSides } from '../graph/ports';
import {
  buildEdgeRoutingGeometry,
  createPlacementCandidates,
  DEFAULT_EDGE_ROUTING_CONFIG,
  getPolylineLength,
  polylineIntersectsBox,
  shouldRewardSharedEndpointCrossingAlignment,
  shouldCountCrossingBetweenEdges,
} from './shared';
import type { Point } from './geometry';

const EDGE_LENGTH_PENALTY = 1;
const EDGE_SAME_TYPE_BUFFER_ALIGNMENT_REWARD = 400;

interface HandleUsage {
  incoming: number;
  outgoing: number;
}

interface TieBreakScore {
  mixedDirectionPenalty: number;
  sameDirectionReward: number;
  cornerPenalty: number;
}

interface GeometrySnapshot {
  points: ReturnType<typeof buildEdgeRoutingGeometry>['points'];
}

interface NodeTreeItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodeId: string;
  box: EdgeRoutingNodeBox;
}

interface EdgeTreeItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  edgeId: string;
  edge: EdgeRoutingEdge;
  geometry: GeometrySnapshot;
}

function getPolylineBbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function computeLegacyPlusEdgeRoutingPlacements({
  edges,
  nodeBoxes,
  layoutDirection,
  policy,
  nodeNeighborhoodPadding,
  config: configOverride,
}: EdgeRoutingInput): Map<string, EdgeRoutingPlacement> {
  const config = configOverride ?? DEFAULT_EDGE_ROUTING_CONFIG;
  const effectivePolicy = configOverride?.crossingPolicy ?? policy;
  const placements = new Map<string, EdgeRoutingPlacement>();
  const flowSides = getPrimaryFlowSides(layoutDirection);

  const getGeometry = (
    edge: EdgeRoutingInput['edges'][number],
    placement: EdgeRoutingPlacement,
  ): GeometrySnapshot => {
    const geometry = buildEdgeRoutingGeometry(edge, placement, nodeBoxes);
    return { points: geometry.points };
  };

  // Build a static R-tree over node boxes once. This replaces the O(N) scan
  // previously done per candidate with an O(log N + k) lookup.
  const nodeTree = new RBush<NodeTreeItem>();
  const nodeItems: NodeTreeItem[] = [];
  for (const [nodeId, box] of nodeBoxes) {
    nodeItems.push({
      minX: box.left,
      minY: box.top,
      maxX: box.right,
      maxY: box.bottom,
      nodeId,
      box,
    });
  }
  nodeTree.load(nodeItems);

  for (const edge of edges) {
    placements.set(edge.id, createPlacementCandidates(edge, nodeBoxes, layoutDirection)[0]);
  }

  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    const handleUsage = createHandleUsageMap(edges, placements);

    // Build a dynamic R-tree over edge geometries for this pass. We'll mutate
    // it in place as placements update: `remove` + `insert` after each edge is
    // scored. This keeps neighbour queries accurate within the pass.
    const edgeTree = new RBush<EdgeTreeItem>();
    const edgeItemById = new Map<string, EdgeTreeItem>();
    const initialEdgeItems: EdgeTreeItem[] = [];
    for (const edge of edges) {
      const placement = placements.get(edge.id);
      if (!placement) continue;
      const geometry = getGeometry(edge, placement);
      if (geometry.points.length === 0) continue;
      const bbox = getPolylineBbox(geometry.points);
      const item: EdgeTreeItem = { ...bbox, edgeId: edge.id, edge, geometry };
      initialEdgeItems.push(item);
      edgeItemById.set(edge.id, item);
    }
    edgeTree.load(initialEdgeItems);

    for (const edge of edges) {
      const currentPlacement = placements.get(edge.id)
        ?? createPlacementCandidates(edge, nodeBoxes, layoutDirection)[0];
      removePlacementUsage(handleUsage, edge, currentPlacement);

      const candidates = createPlacementCandidates(edge, nodeBoxes, layoutDirection);
      let bestPlacement = currentPlacement;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestTieBreak = getTieBreakScore(edge, currentPlacement, handleUsage);

      for (const candidate of candidates) {
        const geometry = getGeometry(edge, candidate);
        if (geometry.points.length === 0) continue;

        const length = getPolylineLength(geometry.points);
        let score = length * EDGE_LENGTH_PENALTY;
        const candidateBbox = getPolylineBbox(geometry.points);

        // Node overlap: query the node R-tree for nodes whose bbox overlaps
        // the candidate's polyline bbox, then run the exact polyline–box
        // intersection only on that subset.
        const overlappingNodes = nodeTree.search(candidateBbox);
        for (const nodeItem of overlappingNodes) {
          if (nodeItem.nodeId === edge.source || nodeItem.nodeId === edge.target) continue;
          if (polylineIntersectsBox(geometry.points, nodeItem.box)) {
            score += config.edgeNodeOverlapPenalty;
          }
        }

        // Edge crossing / alignment: query the edge R-tree for edges whose
        // geometry bbox overlaps the candidate's bbox. The exact crossing
        // check runs only on that subset.
        const overlappingEdges = edgeTree.search(candidateBbox);
        for (const otherItem of overlappingEdges) {
          if (otherItem.edgeId === edge.id) continue;
          const other = otherItem.edge;
          const otherGeometry = otherItem.geometry;
          if (otherGeometry.points.length === 0) continue;
          if (shouldCountCrossingBetweenEdges(
            edge,
            geometry.points,
            other,
            otherGeometry.points,
            nodeBoxes,
            { policy: effectivePolicy, nodeNeighborhoodPadding },
          )) {
            score += config.edgeCrossingPenalty;
          }
          if (shouldRewardSharedEndpointCrossingAlignment(
            edge,
            geometry.points,
            other,
            otherGeometry.points,
            nodeBoxes,
            { policy: effectivePolicy, nodeNeighborhoodPadding },
          )) {
            score -= EDGE_SAME_TYPE_BUFFER_ALIGNMENT_REWARD;
          }
        }

        if (config.flowAlignedBonus > 0) {
          const srcBase = getBaseHandleSide(candidate.sourceSide);
          const tgtBase = getBaseHandleSide(candidate.targetSide);
          if (srcBase === flowSides.sourceSide && tgtBase === flowSides.targetSide) {
            score -= config.flowAlignedBonus;
          }
        }

        if (config.mixedDirectionPenalty > 0) {
          const srcUsage = handleUsage.get(`${edge.source}:${candidate.sourceSide}`);
          const tgtUsage = handleUsage.get(`${edge.target}:${candidate.targetSide}`);
          if (srcUsage && srcUsage.incoming > 0) score += config.mixedDirectionPenalty;
          if (tgtUsage && tgtUsage.outgoing > 0) score += config.mixedDirectionPenalty;
        }

        const tieBreak = getTieBreakScore(edge, candidate, handleUsage);

        if (
          score < bestScore
          || (score === bestScore && compareTieBreakScores(tieBreak, bestTieBreak) < 0)
        ) {
          bestScore = score;
          bestTieBreak = tieBreak;
          bestPlacement = candidate;
        }
      }

      placements.set(edge.id, bestPlacement);
      addPlacementUsage(handleUsage, edge, bestPlacement);

      // Keep the edge tree in sync: remove the stale geometry for this edge
      // and insert the freshly-chosen one so subsequent edges in this pass
      // score against the updated placement.
      const oldItem = edgeItemById.get(edge.id);
      if (oldItem) edgeTree.remove(oldItem, edgeItemEquals);
      const newGeometry = getGeometry(edge, bestPlacement);
      if (newGeometry.points.length === 0) {
        edgeItemById.delete(edge.id);
      } else {
        const newBbox = getPolylineBbox(newGeometry.points);
        const newItem: EdgeTreeItem = { ...newBbox, edgeId: edge.id, edge, geometry: newGeometry };
        edgeTree.insert(newItem);
        edgeItemById.set(edge.id, newItem);
      }
    }
  }

  return placements;
}

function edgeItemEquals(a: EdgeTreeItem, b: EdgeTreeItem): boolean {
  return a.edgeId === b.edgeId;
}

function createHandleUsageMap(
  edges: EdgeRoutingInput['edges'],
  placements: ReadonlyMap<string, EdgeRoutingPlacement>,
): Map<string, HandleUsage> {
  const usage = new Map<string, HandleUsage>();

  for (const edge of edges) {
    const placement = placements.get(edge.id);
    if (!placement) continue;
    addPlacementUsage(usage, edge, placement);
  }

  return usage;
}

function addPlacementUsage(
  usage: Map<string, HandleUsage>,
  edge: { source: string; target: string },
  placement: EdgeRoutingPlacement,
) {
  const sourceKey = `${edge.source}:${placement.sourceSide}`;
  const sourceUsage = usage.get(sourceKey) ?? { incoming: 0, outgoing: 0 };
  sourceUsage.outgoing += 1;
  usage.set(sourceKey, sourceUsage);

  const targetKey = `${edge.target}:${placement.targetSide}`;
  const targetUsage = usage.get(targetKey) ?? { incoming: 0, outgoing: 0 };
  targetUsage.incoming += 1;
  usage.set(targetKey, targetUsage);
}

function removePlacementUsage(
  usage: Map<string, HandleUsage>,
  edge: { source: string; target: string },
  placement: EdgeRoutingPlacement,
) {
  decrementUsage(usage, `${edge.source}:${placement.sourceSide}`, 'outgoing');
  decrementUsage(usage, `${edge.target}:${placement.targetSide}`, 'incoming');
}

function decrementUsage(
  usage: Map<string, HandleUsage>,
  key: string,
  direction: keyof HandleUsage,
) {
  const entry = usage.get(key);
  if (!entry) return;
  entry[direction] = Math.max(0, entry[direction] - 1);
  if (entry.incoming === 0 && entry.outgoing === 0) {
    usage.delete(key);
  }
}

function getTieBreakScore(
  edge: { source: string; target: string },
  placement: EdgeRoutingPlacement,
  usage: ReadonlyMap<string, HandleUsage>,
): TieBreakScore {
  const sourceUsage = usage.get(`${edge.source}:${placement.sourceSide}`) ?? { incoming: 0, outgoing: 0 };
  const targetUsage = usage.get(`${edge.target}:${placement.targetSide}`) ?? { incoming: 0, outgoing: 0 };

  return {
    mixedDirectionPenalty: Number(sourceUsage.incoming > 0) + Number(targetUsage.outgoing > 0),
    sameDirectionReward: Number(sourceUsage.outgoing > 0) + Number(targetUsage.incoming > 0),
    cornerPenalty: Number(isCornerHandle(placement.sourceSide)) + Number(isCornerHandle(placement.targetSide)),
  };
}

export function compareTieBreakScores(a: TieBreakScore, b: TieBreakScore): number {
  if (a.mixedDirectionPenalty !== b.mixedDirectionPenalty) {
    return a.mixedDirectionPenalty - b.mixedDirectionPenalty;
  }
  if (a.cornerPenalty !== b.cornerPenalty) {
    return a.cornerPenalty - b.cornerPenalty;
  }
  if (a.sameDirectionReward !== b.sameDirectionReward) {
    return b.sameDirectionReward - a.sameDirectionReward;
  }
  return 0;
}

function isCornerHandle(side: EdgeRoutingPlacement['sourceSide']): boolean {
  return isCornerHandleSide(side);
}
