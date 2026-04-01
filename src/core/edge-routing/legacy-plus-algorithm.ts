import type { EdgeRoutingInput, EdgeRoutingPlacement } from './shared';
import { isCornerHandleSide } from '../graph/ports';
import {
  buildEdgeRoutingGeometry,
  createPlacementCandidates,
  getPolylineLength,
  polylineIntersectsBox,
  polylinesIntersect,
  sharesEndpoint,
} from './shared';

const EDGE_INTERSECTION_PENALTY = 10_000;
const EDGE_NODE_OVERLAP_PENALTY = 2_000;
const EDGE_LENGTH_PENALTY = 1;

interface HandleUsage {
  incoming: number;
  outgoing: number;
}

interface TieBreakScore {
  mixedDirectionPenalty: number;
  sameDirectionReward: number;
  cornerPenalty: number;
}

export function computeLegacyPlusEdgeRoutingPlacements({
  edges,
  nodeBoxes,
  layoutDirection,
}: EdgeRoutingInput): Map<string, EdgeRoutingPlacement> {
  const placements = new Map<string, EdgeRoutingPlacement>();

  for (const edge of edges) {
    placements.set(edge.id, createPlacementCandidates(edge, nodeBoxes, layoutDirection)[0]);
  }

  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    const handleUsage = createHandleUsageMap(edges, placements);

    for (const edge of edges) {
      const currentPlacement = placements.get(edge.id) ?? createPlacementCandidates(edge, nodeBoxes, layoutDirection)[0];
      removePlacementUsage(handleUsage, edge, currentPlacement);

      const candidates = createPlacementCandidates(edge, nodeBoxes, layoutDirection);
      let bestPlacement = currentPlacement;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestTieBreak = getTieBreakScore(edge, currentPlacement, handleUsage);

      for (const candidate of candidates) {
        const geometry = buildEdgeRoutingGeometry(edge, candidate, nodeBoxes);
        if (geometry.points.length === 0) continue;

        let score = getPolylineLength(geometry.points) * EDGE_LENGTH_PENALTY;

        for (const [nodeId, box] of nodeBoxes.entries()) {
          if (nodeId === edge.source || nodeId === edge.target) continue;
          if (polylineIntersectsBox(geometry.points, box)) {
            score += EDGE_NODE_OVERLAP_PENALTY;
          }
        }

        for (const other of edges) {
          if (other.id === edge.id) continue;
          if (sharesEndpoint(edge, other)) continue;
          const otherPlacement = placements.get(other.id);
          if (!otherPlacement) continue;
          const otherGeometry = buildEdgeRoutingGeometry(other, otherPlacement, nodeBoxes);
          if (otherGeometry.points.length === 0) continue;
          if (polylinesIntersect(geometry.points, otherGeometry.points)) {
            score += EDGE_INTERSECTION_PENALTY;
          }
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
    }
  }

  return placements;
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

function compareTieBreakScores(a: TieBreakScore, b: TieBreakScore): number {
  if (a.mixedDirectionPenalty !== b.mixedDirectionPenalty) {
    return a.mixedDirectionPenalty - b.mixedDirectionPenalty;
  }
  if (a.sameDirectionReward !== b.sameDirectionReward) {
    return b.sameDirectionReward - a.sameDirectionReward;
  }
  if (a.cornerPenalty !== b.cornerPenalty) {
    return a.cornerPenalty - b.cornerPenalty;
  }
  return 0;
}

function isCornerHandle(side: EdgeRoutingPlacement['sourceSide']): boolean {
  return isCornerHandleSide(side);
}
