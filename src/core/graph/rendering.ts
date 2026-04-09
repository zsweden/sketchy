import type { DiagramEdge } from '../types';
import type { Framework } from '../framework-types';
import { getJunctionOptions } from '../framework-types';
import type { ConnectedSubgraph } from './derived';

export type HighlightState = 'highlighted' | 'dimmed' | 'none';

interface HighlightContext {
  searchLower: string;
  highlightSets: ConnectedSubgraph | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedLoopId: string | null;
}

/**
 * Compute the highlight state for a single node based on search, selection,
 * and connectivity highlighting. Pure function — no store access.
 */
export function computeNodeHighlightState(
  nodeId: string,
  nodeLabel: string,
  ctx: HighlightContext,
): HighlightState {
  if (ctx.searchLower) {
    return nodeLabel.toLowerCase().includes(ctx.searchLower) ? 'highlighted' : 'dimmed';
  }

  if (!ctx.highlightSets) return 'none';

  const inHighlightedSet = ctx.highlightSets.nodeIds.has(nodeId);

  if (ctx.selectedLoopId || (ctx.selectedEdgeIds.length === 1 && ctx.selectedNodeIds.length === 0)) {
    return inHighlightedSet ? 'highlighted' : 'dimmed';
  }

  if (ctx.selectedNodeIds.length === 1) {
    if (nodeId === ctx.selectedNodeIds[0]) return 'highlighted';
    if (!inHighlightedSet) return 'dimmed';
  }

  return 'none';
}

interface EdgeLabelParts {
  label: string;
  showBg: boolean;
}

/**
 * Compute the display label for an edge based on polarity, delay, and edge tags.
 * Returns the joined label string and whether a background should be shown.
 */
export function computeEdgeLabel(
  edge: DiagramEdge,
  framework: Framework,
  targetJunctionType?: string,
): EdgeLabelParts {
  const parts: string[] = [];
  let showBg = false;

  if (framework.supportsEdgePolarity) {
    showBg = true;
    const isMath = getJunctionOptions(framework).some((o) => o.id === 'add' || o.id === 'multiply');
    if (!isMath) {
      parts.push(edge.polarity === 'negative' ? '-' : '+');
    } else {
      const isMultiply = targetJunctionType === 'multiply';
      if (edge.polarity === 'negative') {
        parts.push(isMultiply ? '÷' : '-');
      } else {
        parts.push(isMultiply ? '×' : '+');
      }
    }
  }

  if (framework.supportsEdgeDelay && edge.delay) {
    showBg = true;
    parts.push('D');
  }

  if (edge.edgeTag) {
    const tagName = framework.edgeTags?.find((t) => t.id === edge.edgeTag)?.shortName;
    if (tagName) {
      showBg = true;
      parts.push(tagName);
    }
  }

  return { label: parts.join(' '), showBg };
}
