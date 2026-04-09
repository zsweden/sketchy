import { expandBox, polylinesIntersect, polylinesIntersectOutsideBoxes } from './geometry';
import type { Point } from './geometry';
import type { EdgeRoutingEdge, EdgeRoutingNodeBox, EdgeRoutingPolicy } from './types';
import { DEFAULT_EDGE_ROUTING_POLICY } from './types';

const EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING = 36;

interface EdgeRoutingCrossingOptions {
  policy?: EdgeRoutingPolicy;
  nodeNeighborhoodPadding?: number;
}

function sharesEndpoint(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

function isReciprocalEdgePair(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  return a.source === b.target && a.target === b.source;
}

function getEdgeDirectionAtNode(
  edge: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  nodeId: string,
): 'incoming' | 'outgoing' | null {
  if (edge.source === nodeId) return 'outgoing';
  if (edge.target === nodeId) return 'incoming';
  return null;
}

function sharedEndpointsHaveSameDirection(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
): boolean {
  const sharedNodeIds = [
    ...(a.source === b.source || a.source === b.target ? [a.source] : []),
    ...(a.target !== a.source && (a.target === b.source || a.target === b.target) ? [a.target] : []),
  ];

  return sharedNodeIds.every((nodeId) => getEdgeDirectionAtNode(a, nodeId) === getEdgeDirectionAtNode(b, nodeId));
}

function getEndpointNeighborhoods(
  edges: ReadonlyArray<Pick<EdgeRoutingEdge, 'source' | 'target'>>,
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  padding: number,
): EdgeRoutingNodeBox[] {
  const nodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  return [...nodeIds].flatMap((nodeId) => {
    const box = nodeBoxes.get(nodeId);
    return box ? [expandBox(box, padding)] : [];
  });
}

export function shouldCountCrossingBetweenEdges(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  aPoints: Point[],
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  bPoints: Point[],
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  options?: EdgeRoutingCrossingOptions,
): boolean {
  if (!polylinesIntersect(aPoints, bPoints)) return false;

  const policy = options?.policy ?? DEFAULT_EDGE_ROUTING_POLICY;
  const sharedEndpoint = sharesEndpoint(a, b);

  if (!sharedEndpoint) return true;

  switch (policy) {
    case 'legacy':
      return false;
    case 'reciprocal-only':
      return isReciprocalEdgePair(a, b);
    case 'shared-endpoint-anywhere':
      return true;
    case 'shared-endpoint-outside-buffer':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      );
    case 'shared-endpoint-outside-buffer-same-type-only':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      ) || !sharedEndpointsHaveSameDirection(a, b);
    case 'shared-endpoint-same-type-forgiven':
      return !sharedEndpointsHaveSameDirection(a, b);
    case 'shared-endpoint-outside-buffer-same-type-rewarded':
      return polylinesIntersectOutsideBoxes(
        aPoints,
        bPoints,
        getEndpointNeighborhoods([a, b], nodeBoxes, options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING),
      ) || !sharedEndpointsHaveSameDirection(a, b);
  }
}

export function shouldRewardSharedEndpointCrossingAlignment(
  a: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  aPoints: Point[],
  b: Pick<EdgeRoutingEdge, 'source' | 'target'>,
  bPoints: Point[],
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>,
  options?: EdgeRoutingCrossingOptions,
): boolean {
  if ((options?.policy ?? DEFAULT_EDGE_ROUTING_POLICY) !== 'shared-endpoint-outside-buffer-same-type-rewarded') {
    return false;
  }
  if (!sharesEndpoint(a, b) || !polylinesIntersect(aPoints, bPoints)) return false;

  const endpointNeighborhoods = getEndpointNeighborhoods(
    [a, b],
    nodeBoxes,
    options?.nodeNeighborhoodPadding ?? EDGE_ROUTING_NODE_NEIGHBORHOOD_PADDING,
  );

  return !polylinesIntersectOutsideBoxes(aPoints, bPoints, endpointNeighborhoods)
    && sharedEndpointsHaveSameDirection(a, b);
}
