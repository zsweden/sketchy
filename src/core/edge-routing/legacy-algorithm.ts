import type { EdgeRoutingInput, EdgeRoutingPlacement } from './shared';
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

export function computeLegacyEdgeRoutingPlacements({
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
    for (const edge of edges) {
      const candidates = createPlacementCandidates(edge, nodeBoxes, layoutDirection);
      let bestPlacement = placements.get(edge.id) ?? candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;

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
