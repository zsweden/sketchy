import { computeLegacyPlusEdgeRoutingPlacements } from './edge-optimization-algorithm';
import type { EdgeRoutingInput, EdgeRoutingPlacement } from './shared';

export function computeEdgeRoutingPlacements(
  input: EdgeRoutingInput,
): Map<string, EdgeRoutingPlacement> {
  return computeLegacyPlusEdgeRoutingPlacements(input);
}

export {
  buildEdgeRoutingGeometry,
  createPlacementCandidates,
  DEFAULT_EDGE_ROUTING_CONFIG,
  DEFAULT_EDGE_ROUTING_POLICY,
  getAutomaticEdgeRoutingPlacement,
  getPolylineLength,
  polylineIntersectsBox,
  polylinesIntersect,
  shouldRewardSharedEndpointCrossingAlignment,
  shouldCountCrossingBetweenEdges,
  type EdgeRoutingConfig,
  type EdgeRoutingEdge,
  type EdgeRoutingNodeBox,
  type EdgeRoutingPlacement,
  type EdgeRoutingPolicy,
} from './shared';
