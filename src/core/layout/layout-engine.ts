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
}

/** A layout engine computes top-left positions for a set of nodes. */
export type LayoutEngine = (
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  options: LayoutEngineOptions,
) => Promise<LayoutResult[]>;

export function estimateHeight(label: string): number {
  const charsPerLine = 30;
  const lineHeight = 24;
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  return Math.max(MIN_NODE_HEIGHT, lines * lineHeight + 24);
}
