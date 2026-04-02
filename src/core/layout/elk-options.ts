export type ElkAlgorithm = 'layered' | 'force' | 'stress' | 'radial';

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
  algorithm: ElkAlgorithm;
  aspectRatio: number;
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
  algorithm: 'layered',
  aspectRatio: 2.5,
  layeringStrategy: 'NETWORK_SIMPLEX',
  nodePlacementStrategy: 'BRANDES_KOEPF',
  cycleBreakingStrategy: 'GREEDY',
  wrappingStrategy: 'OFF',
  favorStraightEdges: true,
  feedbackEdges: true,
  straightnessPriority: 10,
  thoroughness: 12,
};

export const ELK_ALGORITHM_OPTIONS: Array<{ value: ElkAlgorithm; label: string }> = [
  { value: 'layered', label: 'Layered' },
  { value: 'force', label: 'Force' },
  { value: 'stress', label: 'Stress' },
  { value: 'radial', label: 'Radial' },
];

export const ELK_LAYERING_STRATEGY_OPTIONS: Array<{ value: ElkLayeringStrategy; label: string }> = [
  { value: 'NETWORK_SIMPLEX', label: 'Network Simplex' },
  { value: 'MIN_WIDTH', label: 'Min Width' },
  { value: 'STRETCH_WIDTH', label: 'Stretch Width' },
  { value: 'COFFMAN_GRAHAM', label: 'Coffman Graham' },
  { value: 'LONGEST_PATH', label: 'Longest Path' },
  { value: 'LONGEST_PATH_SOURCE', label: 'Longest Path Source' },
  { value: 'INTERACTIVE', label: 'Interactive' },
  { value: 'BF_MODEL_ORDER', label: 'BF Model Order' },
  { value: 'DF_MODEL_ORDER', label: 'DF Model Order' },
];

export const ELK_NODE_PLACEMENT_OPTIONS: Array<{ value: ElkNodePlacementStrategy; label: string }> = [
  { value: 'BRANDES_KOEPF', label: 'Brandes Koepf' },
  { value: 'NETWORK_SIMPLEX', label: 'Network Simplex' },
  { value: 'LINEAR_SEGMENTS', label: 'Linear Segments' },
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'INTERACTIVE', label: 'Interactive' },
];

export const ELK_CYCLE_BREAKING_OPTIONS: Array<{ value: ElkCycleBreakingStrategy; label: string }> = [
  { value: 'GREEDY', label: 'Greedy' },
  { value: 'SCC_CONNECTIVITY', label: 'SCC Connectivity' },
  { value: 'MODEL_ORDER', label: 'Model Order' },
  { value: 'GREEDY_MODEL_ORDER', label: 'Greedy Model Order' },
  { value: 'DEPTH_FIRST', label: 'Depth First' },
  { value: 'DFS_NODE_ORDER', label: 'DFS Node Order' },
  { value: 'BFS_NODE_ORDER', label: 'BFS Node Order' },
  { value: 'SCC_NODE_TYPE', label: 'SCC Node Type' },
  { value: 'INTERACTIVE', label: 'Interactive' },
];

export const ELK_WRAPPING_OPTIONS: Array<{ value: ElkWrappingStrategy; label: string }> = [
  { value: 'OFF', label: 'Off' },
  { value: 'SINGLE_EDGE', label: 'Single Edge' },
  { value: 'MULTI_EDGE', label: 'Multi Edge' },
];
