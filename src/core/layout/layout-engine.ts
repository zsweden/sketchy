import type { LayoutDirection } from '../framework-types';

export const NODE_WIDTH = 240;
export const MIN_NODE_HEIGHT = 48;
export const RANK_SEP = 80;
export const NODE_SEP = 40;

export interface LayoutInput {
  id: string;
  width: number;
  height: number;
  /** Current position hint — engines may use this for ordering. */
  position?: { x: number; y: number };
  /** When true, layout engine should treat this node's position as fixed. */
  locked?: boolean;
}

export interface LayoutEdgeInput {
  source: string;
  target: string;
}

export interface LayoutResult {
  id: string;
  x: number;
  y: number;
}

export interface LayoutEngineOptions {
  direction: LayoutDirection;
  cyclic?: boolean;
}

/** A layout engine computes top-left positions for a set of nodes. */
export type LayoutEngine = (
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  options: LayoutEngineOptions,
) => Promise<LayoutResult[]>;

const BADGE_ROW_HEIGHT = 20;

export function estimateHeight(label: string, hasBadges = false): number {
  const charsPerLine = 30;
  const lineHeight = 24;
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  const base = Math.max(MIN_NODE_HEIGHT, lines * lineHeight + 24);
  return hasBadges ? base + BADGE_ROW_HEIGHT : base;
}
