import { computeLegacyPlusEdgeRoutingPlacements } from './edge-optimization-algorithm';
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
  buildOrthogonalEdgePoints,
  compareEdgeRoutingObjectiveScores,
  createPlacementCandidates,
  DEFAULT_EDGE_ROUTING_POLICY,
  EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING,
  getAutomaticEdgeRoutingPlacement,
  getPolylineLength,
  isReciprocalEdgePair,
  polylineIntersectsBox,
  polylinesIntersect,
  scoreObjectiveEdgeRouting,
  sharesEndpoint,
  shouldRewardSharedEndpointCrossingAlignment,
  shouldCountCrossingBetweenEdges,
  type EdgeRoutingEdge,
  type EdgeRoutingGeometry,
  type EdgeRoutingInput,
  type EdgeRoutingNodeBox,
  type EdgeRoutingObjectiveScore,
  type EdgeRoutingPoint,
  type EdgeRoutingPlacement,
  type EdgeRoutingPolicy,
} from './shared';
