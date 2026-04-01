import { computeLegacyEdgeRoutingPlacements } from './legacy-algorithm';
import { computeLegacyPlusEdgeRoutingPlacements } from './legacy-plus-algorithm';
import type { EdgeRoutingInput, EdgeRoutingPlacement } from './shared';

export type EdgeRoutingAlgorithmId = 'legacy' | 'legacy-plus';

export const DEFAULT_EDGE_ROUTING_ALGORITHM: EdgeRoutingAlgorithmId = 'legacy';

const edgeRoutingAlgorithms: Record<
  EdgeRoutingAlgorithmId,
  (input: EdgeRoutingInput) => Map<string, EdgeRoutingPlacement>
> = {
  legacy: computeLegacyEdgeRoutingPlacements,
  'legacy-plus': computeLegacyPlusEdgeRoutingPlacements,
};

export function computeEdgeRoutingPlacements(
  algorithm: EdgeRoutingAlgorithmId,
  input: EdgeRoutingInput,
): Map<string, EdgeRoutingPlacement> {
  return edgeRoutingAlgorithms[algorithm](input);
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
