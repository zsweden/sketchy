import type { LayoutEngine } from './layout-engine';
import { DEFAULT_ELK_EXPERIMENT_SETTINGS, type ElkAlgorithm } from './elk-options';

import ELK from 'elkjs/lib/elk.bundled.js';

const elkInstance = new ELK();

const DIRECTION_MAP: Record<string, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
};

export function getDefaultElkAlgorithm(cyclic?: boolean): ElkAlgorithm {
  return cyclic ? 'force' : 'layered';
}

export function resolveElkAlgorithm(
  algorithmOverride: ElkAlgorithm | null | undefined,
  cyclic?: boolean,
): ElkAlgorithm {
  return algorithmOverride ?? getDefaultElkAlgorithm(cyclic);
}

function createElkEngine(algorithm: ElkAlgorithm): LayoutEngine {
  return async (nodes, edges, options) => {
    const hasPositions = nodes.some((node) => node.position);
    const cyclic = options.cyclic === true;
    const isLayered = algorithm === 'layered';
    const elkOptions = { ...DEFAULT_ELK_EXPERIMENT_SETTINGS, ...options.elk };

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': algorithm,
        'elk.direction': DIRECTION_MAP[options.direction] ?? 'DOWN',
        'elk.spacing.nodeNode': String(elkOptions.nodeSpacing),
        'elk.separateConnectedComponents': String(elkOptions.separateConnectedComponents),
        'elk.spacing.componentComponent': String(elkOptions.componentSpacing),
        'elk.aspectRatio': String(elkOptions.aspectRatio),
        ...(isLayered && {
          'elk.edgeRouting': cyclic ? 'SPLINES' : 'ORTHOGONAL',
          'elk.layered.spacing.nodeNodeBetweenLayers': String(elkOptions.componentSpacing),
          'elk.layered.layering.strategy': elkOptions.layeringStrategy,
          'elk.layered.nodePlacement.strategy': elkOptions.nodePlacementStrategy,
          'elk.layered.cycleBreaking.strategy': elkOptions.cycleBreakingStrategy,
          'elk.layered.wrapping.strategy': elkOptions.wrappingStrategy,
          'elk.layered.thoroughness': String(elkOptions.thoroughness),
        }),
        ...(cyclic && isLayered && {
          'elk.layered.feedbackEdges': String(elkOptions.feedbackEdges),
          'elk.layered.nodePlacement.favorStraightEdges': String(elkOptions.favorStraightEdges),
          'elk.layered.priority.straightness': String(elkOptions.straightnessPriority),
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

    const elk = elkInstance;

    let laid;
    try {
      laid = await elk.layout(graph);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Layout engine failed: ${msg}`, { cause: err });
    }

    return (laid.children ?? [])
      .filter((child) => child.x !== undefined && child.y !== undefined)
      .map((child) => ({
        id: child.id,
        x: child.x!,
        y: child.y!,
      }));
  };
}

export const elkEngine: LayoutEngine = async (nodes, edges, options) =>
  createElkEngine(
    resolveElkAlgorithm(
      options.elk?.algorithmOverride ?? DEFAULT_ELK_EXPERIMENT_SETTINGS.algorithmOverride,
      options.cyclic,
    ),
  )(
    nodes,
    edges,
    options,
  );
