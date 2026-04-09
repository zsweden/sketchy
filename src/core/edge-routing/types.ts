import type { EdgeHandleSide } from '../types';
import type { BoundingBox } from './geometry';

export type EdgeRoutingNodeBox = BoundingBox;

export interface EdgeRoutingEdge {
  id: string;
  source: string;
  target: string;
}

export interface EdgeRoutingPlacement {
  sourceSide: EdgeHandleSide;
  targetSide: EdgeHandleSide;
}

export type EdgeRoutingPolicy =
  | 'legacy'
  | 'reciprocal-only'
  | 'shared-endpoint-outside-buffer'
  | 'shared-endpoint-outside-buffer-same-type-only'
  | 'shared-endpoint-outside-buffer-same-type-rewarded'
  | 'shared-endpoint-anywhere'
  | 'shared-endpoint-same-type-forgiven';

export const DEFAULT_EDGE_ROUTING_POLICY: EdgeRoutingPolicy = 'shared-endpoint-outside-buffer-same-type-only';

export interface EdgeRoutingConfig {
  edgeCrossingPenalty: number;
  edgeNodeOverlapPenalty: number;
  flowAlignedBonus: number;
  crossingPolicy: EdgeRoutingPolicy;
  mixedDirectionPenalty: number;
}

export const DEFAULT_EDGE_ROUTING_CONFIG: EdgeRoutingConfig = {
  edgeCrossingPenalty: 1_000,
  edgeNodeOverlapPenalty: 100_000,
  flowAlignedBonus: 1_000,
  crossingPolicy: 'shared-endpoint-same-type-forgiven',
  mixedDirectionPenalty: 1_000,
};

export interface EdgeRoutingInput {
  edges: EdgeRoutingEdge[];
  nodeBoxes: ReadonlyMap<string, EdgeRoutingNodeBox>;
  layoutDirection: import('../framework-types').LayoutDirection;
  policy?: EdgeRoutingPolicy;
  nodeNeighborhoodPadding?: number;
  config?: EdgeRoutingConfig;
}
