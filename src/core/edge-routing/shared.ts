// Re-export barrel — split into types.ts, placement.ts, crossing.ts
export { getPolylineLength, polylineIntersectsBox, polylinesIntersect } from './geometry';

export {
  DEFAULT_EDGE_ROUTING_CONFIG,
  DEFAULT_EDGE_ROUTING_POLICY,
  type EdgeRoutingConfig,
  type EdgeRoutingEdge,
  type EdgeRoutingInput,
  type EdgeRoutingNodeBox,
  type EdgeRoutingPlacement,
  type EdgeRoutingPolicy,
} from './types';

export {
  buildEdgeRoutingGeometry,
  createPlacementCandidates,
  getAutomaticEdgeRoutingPlacement,
} from './placement';

export {
  shouldCountCrossingBetweenEdges,
  shouldRewardSharedEndpointCrossingAlignment,
} from './crossing';
