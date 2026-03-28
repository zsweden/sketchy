import ELK from 'elkjs';
import type { LayoutEngine } from './layout-engine';
import { RANK_SEP, NODE_SEP } from './layout-engine';

const elk = new ELK();

const DIRECTION_MAP: Record<string, string> = {
  TB: 'DOWN',
  BT: 'UP',
};

export const elkEngine: LayoutEngine = async (nodes, edges, options) => {
  const hasPositions = nodes.some((n) => n.position);

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION_MAP[options.direction] ?? 'DOWN',
      'elk.spacing.nodeNode': String(NODE_SEP),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(RANK_SEP),
      'elk.spacing.componentComponent': String(RANK_SEP),
      'elk.layered.compaction.connectedComponents': 'true',
      ...(hasPositions && {
        'elk.layered.crossingMinimization.semiInteractive': 'true',
      }),
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      ...(n.position && { x: n.position.x, y: n.position.y }),
    })),
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const laid = await elk.layout(graph);

  return (laid.children ?? [])
    .filter((c) => c.x !== undefined && c.y !== undefined)
    .map((c) => ({ id: c.id, x: c.x!, y: c.y! }));
};
