export interface Framework {
  id: string;
  name: string;
  description: string;
  defaultLayoutDirection: LayoutDirection;
  supportsJunctions: boolean;
  allowsCycles?: boolean;
  supportsEdgePolarity?: boolean;
  supportsEdgeDelay?: boolean;
  nodeTags: NodeTag[];
  derivedIndicators: DerivedIndicator[];
  edgeLabel?: string;
}

export interface NodeTag {
  id: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
  exclusive: boolean;
}

export type DerivedCondition = 'indegree-zero' | 'leaf' | 'indegree-and-outdegree';

export interface DerivedIndicator {
  id: string;
  name: string;
  shortName: string;
  color: string;
  condition: DerivedCondition;
  description: string;
}

export type LayoutDirection = 'TB' | 'BT';
