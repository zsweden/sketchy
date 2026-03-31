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

type ElkAlgorithm = 'layered' | 'force' | 'stress' | 'radial';

function createElkEngine(algorithm: ElkAlgorithm): LayoutEngine {
  return async (nodes, edges, options) => {
    const hasPositions = nodes.some((node) => node.position);
    const cyclic = options.cyclic === true;
    const isLayered = algorithm === 'layered';

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': algorithm,
        'elk.direction': DIRECTION_MAP[options.direction] ?? 'DOWN',
        'elk.spacing.nodeNode': String(NODE_SEP),
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': String(RANK_SEP),
        'elk.aspectRatio': '2.5',
        ...(isLayered && {
          'elk.edgeRouting': cyclic ? 'SPLINES' : 'ORTHOGONAL',
          'elk.layered.spacing.nodeNodeBetweenLayers': String(RANK_SEP),
        }),
        ...(cyclic && isLayered && {
          'elk.layered.feedbackEdges': 'true',
          'elk.layered.nodePlacement.favorStraightEdges': 'true',
          'elk.layered.priority.straightness': '10',
          'elk.layered.thoroughness': '12',
        }),
        ...(hasPositions && isLayered && {
          'elk.layered.crossingMinimization.semiInteractive': 'true',
        }),
      },
      children: nodes.map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
        ...(node.position && { x: node.position.x, y: node.position.y }),
        ...(node.locked && isLayered && {
          layoutOptions: {
            'elk.position': `(${node.position?.x ?? 0}, ${node.position?.y ?? 0})`,
            'elk.layered.layering.layerConstraint': 'NONE',
          },
        }),
      })),
      edges: edges.map((edge, index) => ({
        id: `e${index}`,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    const elk = await getElk();
    const laid = await elk.layout(graph);

    return (laid.children ?? [])
      .filter((child: { x?: number; y?: number }) => child.x !== undefined && child.y !== undefined)
      .map((child: { id: string; x: number; y: number }) => ({
        id: child.id,
        x: child.x,
        y: child.y,
      }));
  };
}

export const elkLayeredEngine = createElkEngine('layered');
export const elkForceEngine = createElkEngine('force');
export const elkStressEngine = createElkEngine('stress');
export const elkRadialEngine = createElkEngine('radial');

export const elkEngine: LayoutEngine = async (nodes, edges, options) =>
  elkLayeredEngine(nodes, edges, options);

export { createElkEngine };
