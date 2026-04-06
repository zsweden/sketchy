export interface JunctionOption {
  id: string;
  symbol: string;
  label: string;
  description: string;
}

const LOGIC_JUNCTION_OPTIONS: JunctionOption[] = [
  { id: 'or', symbol: '', label: 'OR', description: 'Any single cause is sufficient' },
  { id: 'and', symbol: '&', label: 'AND', description: 'All incoming causes required' },
];

export interface Framework {
  id: string;
  name: string;
  /** Three-letter abbreviation used in filenames (e.g. CRT, FRT, VSM). */
  abbreviation: string;
  description: string;
  defaultLayoutDirection: LayoutDirection;
  supportsJunctions: boolean;
  allowsCycles?: boolean;
  supportsEdgePolarity?: boolean;
  supportsNodeValues?: boolean;
  supportsEdgeDelay?: boolean;
  junctionOptions?: JunctionOption[];
  nodeTags: NodeTag[];
  derivedIndicators: DerivedIndicator[];
  edgeLabel?: string;
  /** Optional AI prompt fragment with domain-specific reasoning guidance. */
  systemPromptHint?: string;
}

/** Returns the junction options for a framework, defaulting to logic AND/OR. */
export function getJunctionOptions(framework: Framework): JunctionOption[] {
  if (!framework.supportsJunctions) return [];
  return framework.junctionOptions ?? LOGIC_JUNCTION_OPTIONS;
}

/** Returns the default junction type id for a framework. */
export function getDefaultJunctionType(framework: Framework): string {
  const options = getJunctionOptions(framework);
  return options.length > 0 ? options[0].id : 'or';
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

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export function isVerticalLayoutDirection(direction: LayoutDirection): boolean {
  return direction === 'TB' || direction === 'BT';
}
