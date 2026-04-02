export type ElkAlgorithm = 'layered' | 'force' | 'stress' | 'radial';
export type ElkAlgorithmOverride = ElkAlgorithm | null;

export type ElkLayeringStrategy =
  | 'NETWORK_SIMPLEX'
  | 'LONGEST_PATH'
  | 'LONGEST_PATH_SOURCE'
  | 'COFFMAN_GRAHAM'
  | 'INTERACTIVE'
  | 'STRETCH_WIDTH'
  | 'MIN_WIDTH'
  | 'BF_MODEL_ORDER'
  | 'DF_MODEL_ORDER';

export type ElkNodePlacementStrategy =
  | 'BRANDES_KOEPF'
  | 'NETWORK_SIMPLEX'
  | 'LINEAR_SEGMENTS'
  | 'SIMPLE'
  | 'INTERACTIVE';

export type ElkCycleBreakingStrategy =
  | 'GREEDY'
  | 'DEPTH_FIRST'
  | 'INTERACTIVE'
  | 'MODEL_ORDER'
  | 'GREEDY_MODEL_ORDER'
  | 'SCC_CONNECTIVITY'
  | 'SCC_NODE_TYPE'
  | 'DFS_NODE_ORDER'
  | 'BFS_NODE_ORDER';

export type ElkWrappingStrategy = 'OFF' | 'SINGLE_EDGE' | 'MULTI_EDGE';

export interface ElkExperimentSettings {
  algorithmOverride: ElkAlgorithmOverride;
  aspectRatio: number;
  nodeSpacing: number;
  componentSpacing: number;
  separateConnectedComponents: boolean;
  layeringStrategy: ElkLayeringStrategy;
  nodePlacementStrategy: ElkNodePlacementStrategy;
  cycleBreakingStrategy: ElkCycleBreakingStrategy;
  wrappingStrategy: ElkWrappingStrategy;
  favorStraightEdges: boolean;
  feedbackEdges: boolean;
  straightnessPriority: number;
  thoroughness: number;
}

export const DEFAULT_ELK_EXPERIMENT_SETTINGS: ElkExperimentSettings = {
  algorithmOverride: null,
  aspectRatio: 2.5,
  nodeSpacing: 40,
  componentSpacing: 80,
  separateConnectedComponents: true,
  layeringStrategy: 'NETWORK_SIMPLEX',
  nodePlacementStrategy: 'BRANDES_KOEPF',
  cycleBreakingStrategy: 'GREEDY',
  wrappingStrategy: 'OFF',
  favorStraightEdges: true,
  feedbackEdges: true,
  straightnessPriority: 10,
  thoroughness: 12,
};
