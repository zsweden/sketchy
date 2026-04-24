import {
  computeEdgeRoutingPlacements,
  getAutomaticEdgeRoutingPlacement,
  type EdgeRoutingConfig,
  type EdgeRoutingNodeBox,
  type EdgeRoutingPolicy,
} from '../core/edge-routing';
import {
  getSideFromHandleId,
  type EdgeHandlePlacement,
} from '../core/graph/ports';
import type { DiagramEdge, DiagramNode, DiagramSettings } from '../core/types';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../constants/layout';

function getNodeBoxes(nodes: DiagramNode[]): Map<string, EdgeRoutingNodeBox> {
  return new Map(nodes.map((node) => [
    node.id,
    {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + DEFAULT_NODE_WIDTH,
      bottom: node.position.y + DEFAULT_NODE_HEIGHT,
    },
  ]));
}

export function getOptimizedEdgePlacements(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
  policy?: EdgeRoutingPolicy,
  config?: EdgeRoutingConfig,
): Map<string, EdgeHandlePlacement> {
  return computeEdgeRoutingPlacements({
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    nodeBoxes: getNodeBoxes(nodes),
    layoutDirection: settings.layoutDirection,
    policy,
    config,
  });
}

export function getAutomaticEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  return getAutomaticEdgeRoutingPlacement(
    { source, target },
    getNodeBoxes(nodes),
    settings.layoutDirection,
  );
}

export function resolveEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
  handles?: {
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  },
): EdgeHandlePlacement {
  const explicitSourceSide = getSideFromHandleId(handles?.sourceHandleId, 'source');
  const explicitTargetSide = getSideFromHandleId(handles?.targetHandleId, 'target');
  const automaticSides = getAutomaticEdgeSides(source, target, nodes, settings);

  if (explicitSourceSide && explicitTargetSide) {
    return { sourceSide: explicitSourceSide, targetSide: explicitTargetSide };
  }

  return {
    sourceSide: explicitSourceSide ?? automaticSides.sourceSide,
    targetSide: explicitTargetSide ?? automaticSides.targetSide,
  };
}

export function getStoredOrAutomaticEdgeSides(
  edge: Pick<DiagramEdge, 'source' | 'target' | 'sourceSide' | 'targetSide'>,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  const automaticSides = getAutomaticEdgeSides(edge.source, edge.target, nodes, settings);
  return {
    sourceSide: edge.sourceSide ?? automaticSides.sourceSide,
    targetSide: edge.targetSide ?? automaticSides.targetSide,
  };
}

export function captureOptimizedEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
  policy?: EdgeRoutingPolicy,
  config?: EdgeRoutingConfig,
): DiagramEdge[] {
  const placements = getOptimizedEdgePlacements(edges, nodes, settings, policy, config);
  return edges.map((edge) => ({
    ...edge,
    ...(placements.get(edge.id)
      ?? getAutomaticEdgeSides(edge.source, edge.target, nodes, settings)),
  }));
}

export function ensureFixedEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  return edges.map((edge) => ({
    ...edge,
    ...getStoredOrAutomaticEdgeSides(edge, nodes, settings),
  }));
}
