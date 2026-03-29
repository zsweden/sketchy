import type { Framework } from '../core/framework-types';

export const cldFramework: Framework = {
  id: 'cld',
  name: 'Causal Loop Diagram',
  description: 'Model variables and feedback loops with signed causal links',
  defaultLayoutDirection: 'TB',
  supportsJunctions: false,
  allowsCycles: true,
  supportsEdgePolarity: true,
  supportsEdgeDelay: true,
  edgeLabel: 'influences',
  nodeTags: [],
  derivedIndicators: [],
};
