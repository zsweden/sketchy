const GRID_SIZE = 20;
export const DEFAULT_NODE_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 60;
export const ARROW_MARKER_SIZE = 14;

/** Snap a node position so its center aligns to the nearest grid point. */
export function snapNodePositionToGrid(
  x: number,
  y: number,
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  const cx = x + nodeWidth / 2;
  const cy = y + nodeHeight / 2;
  return {
    x: Math.round(cx / GRID_SIZE) * GRID_SIZE - nodeWidth / 2,
    y: Math.round(cy / GRID_SIZE) * GRID_SIZE - nodeHeight / 2,
  };
}
