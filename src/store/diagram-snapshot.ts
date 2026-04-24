import type { Diagram } from '../core/types';
import type { DiagramSnapshot } from './diagram-store-types';

export function snapshot(state: { diagram: Diagram }): DiagramSnapshot {
  return {
    nodes: state.diagram.nodes,
    edges: state.diagram.edges,
    annotations: state.diagram.annotations,
  };
}
