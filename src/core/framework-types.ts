interface JunctionOption {
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
  edgeTags?: EdgeTag[];
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

interface JunctionState {
  visible: boolean;
  isMath: boolean;
  options: JunctionOption[];
  current: JunctionOption;
  next: JunctionOption;
}

/**
 * Compute junction visibility and current/next option for a node.
 * Returns null when the junction toggle should not be shown.
 */
export function getJunctionState(
  framework: Framework,
  indegree: number,
  currentJunctionType: string,
): JunctionState | null {
  const options = getJunctionOptions(framework);
  if (options.length === 0) return null;
  const isMath = options.some((o) => o.id === 'add' || o.id === 'multiply');
  if (isMath ? indegree < 1 : indegree < 2) return null;
  const currentIdx = options.findIndex((o) => o.id === currentJunctionType);
  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  return {
    visible: true,
    isMath,
    options,
    current: options[safeIdx],
    next: options[(safeIdx + 1) % options.length],
  };
}

export interface NodeTag {
  id: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
  exclusive: boolean;
}

interface EdgeTag {
  id: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
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
