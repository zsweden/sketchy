import type { LayoutEngine } from './layout-engine';
import { RANK_SEP, NODE_SEP } from './layout-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let elkInstance: any = null;

async function getElk() {
  if (!elkInstance) {
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
    elkInstance = new ELK();
  }
  return elkInstance;
}

const DIRECTION_MAP: Record<string, string> = {
  TB: 'DOWN',
  BT: 'UP',
};

export const elkLayeredEngine: LayoutEngine = async (nodes, edges, options) => {
  const hasPositions = nodes.some((n) => n.position);
  const cyclic = options.cyclic === true;

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION_MAP[options.direction] ?? 'DOWN',
      'elk.edgeRouting': cyclic ? 'SPLINES' : 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(NODE_SEP),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(RANK_SEP),
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': String(RANK_SEP),
      'elk.aspectRatio': '2.5',
      ...(cyclic && {
        'elk.layered.feedbackEdges': 'true',
        'elk.layered.nodePlacement.favorStraightEdges': 'true',
        'elk.layered.priority.straightness': '10',
        'elk.layered.thoroughness': '12',
      }),
      ...(hasPositions && {
        'elk.layered.crossingMinimization.semiInteractive': 'true',
      }),
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      ...(n.position && { x: n.position.x, y: n.position.y }),
      ...(n.locked && {
        layoutOptions: {
          'elk.position': `(${n.position?.x ?? 0}, ${n.position?.y ?? 0})`,
          'elk.layered.layering.layerConstraint': 'NONE',
        },
      }),
    })),
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const elk = await getElk();
  const laid = await elk.layout(graph);

  return (laid.children ?? [])
    .filter((c: { x?: number; y?: number }) => c.x !== undefined && c.y !== undefined)
    .map((c: { id: string; x: number; y: number }) => ({ id: c.id, x: c.x, y: c.y }));
};

export const elkEngine: LayoutEngine = async (nodes, edges, options) =>
  elkLayeredEngine(nodes, edges, { ...options, cyclic: false });
