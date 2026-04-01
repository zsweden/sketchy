import { computeLegacyPlusEdgeRoutingPlacements } from './legacy-plus-algorithm';
import type { EdgeRoutingInput, EdgeRoutingPlacement } from './shared';

export const DEFAULT_EDGE_ROUTING_ALGORITHM = 'legacy-plus';
export type EdgeRoutingAlgorithmId = typeof DEFAULT_EDGE_ROUTING_ALGORITHM;

export function computeEdgeRoutingPlacements(
  input: EdgeRoutingInput,
): Map<string, EdgeRoutingPlacement> {
  return computeLegacyPlusEdgeRoutingPlacements(input);
}

export {
  buildEdgeRoutingGeometry,
  compareEdgeRoutingObjectiveScores,
  createPlacementCandidates,
  getAutomaticEdgeRoutingPlacement,
  getPolylineLength,
  polylineIntersectsBox,
  polylinesIntersect,
  scoreObjectiveEdgeRouting,
  sharesEndpoint,
  type EdgeRoutingEdge,
  type EdgeRoutingGeometry,
  type EdgeRoutingInput,
  type EdgeRoutingNodeBox,
  type EdgeRoutingObjectiveScore,
  type EdgeRoutingPlacement,
} from './shared';
