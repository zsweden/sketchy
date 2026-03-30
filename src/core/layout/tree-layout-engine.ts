import type { LayoutEngine } from './layout-engine';
import { elkLayeredEngine } from './elk-engine';

export const treeLayoutEngine: LayoutEngine = async (nodes, edges, options) =>
  elkLayeredEngine(nodes, edges, { ...options, cyclic: false });
