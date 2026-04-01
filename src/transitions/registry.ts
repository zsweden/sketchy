import { computeNodeDegrees } from '../core/graph/derived';
import type { Diagram, DiagramEdge, DiagramNode } from '../core/types';
import { createEmptyDiagram } from '../core/types';
import { getFramework } from '../frameworks/registry';

export type DiagramTransitionId = 'crt_to_frt' | 'frt_to_prt' | 'prt_to_stt';

export interface DiagramTransition {
  id: DiagramTransitionId;
  sourceFrameworkId: string;
  targetFrameworkId: string;
  label: string;
  derive: (source: Diagram) => Diagram;
}

export interface DerivedDiagramResult {
  diagram: Diagram;
  transition: DiagramTransition;
}

const FRAMEWORK_SUFFIX: Record<string, string> = {
  crt: 'CRT',
  frt: 'FRT',
  prt: 'PRT',
  stt: 'STT',
};

function createDerivedNode(
  node: DiagramNode,
  options: {
    label?: string;
    tags?: string[];
  } = {},
): DiagramNode {
  return {
    ...node,
    data: {
      ...node.data,
      label: options.label ?? node.data.label,
      tags: options.tags ?? [],
    },
  };
}

function createDerivedEdge(
  edge: DiagramEdge,
  options: {
    reverse?: boolean;
  } = {},
): DiagramEdge {
  const base = {
    id: edge.id,
    confidence: edge.confidence,
    notes: edge.notes,
  };

  if (options.reverse) {
    return {
      ...base,
      source: edge.target,
      target: edge.source,
    };
  }

  return {
    ...base,
    source: edge.source,
    target: edge.target,
  };
}

function createDerivedDiagramBase(source: Diagram, targetFrameworkId: string): Diagram {
  const targetFramework = getFramework(targetFrameworkId);
  if (!targetFramework) {
    throw new Error(`Unknown target framework "${targetFrameworkId}"`);
  }

  const diagram = createEmptyDiagram(targetFramework.id);
  return {
    ...diagram,
    name: deriveDiagramName(source.name, targetFramework.id),
    settings: {
      ...diagram.settings,
      layoutDirection: targetFramework.defaultLayoutDirection,
    },
  };
}

function deriveCrtToFrt(source: Diagram): Diagram {
  const diagram = createDerivedDiagramBase(source, 'frt');
  const degrees = computeNodeDegrees(source.edges);

  return {
    ...diagram,
    nodes: source.nodes.map((node) => {
      const nodeDegrees = degrees.get(node.id) ?? { indegree: 0, outdegree: 0 };
      if (nodeDegrees.indegree === 0) {
        return createDerivedNode(node, {
          label: `Injection: address ${node.data.label}`,
          tags: ['injection'],
        });
      }
      if (node.data.tags.includes('ude')) {
        return createDerivedNode(node, {
          label: `Desired outcome: ${node.data.label}`,
          tags: ['de'],
        });
      }
      return createDerivedNode(node);
    }),
    edges: source.edges.map((edge) => createDerivedEdge(edge)),
  };
}

function deriveFrtToPrt(source: Diagram): Diagram {
  const diagram = createDerivedDiagramBase(source, 'prt');

  return {
    ...diagram,
    nodes: source.nodes.map((node) => createDerivedNode(node, {
      tags: node.data.tags.includes('de') ? ['goal'] : ['io'],
    })),
    edges: source.edges.map((edge) => createDerivedEdge(edge)),
  };
}

function derivePrtToStt(source: Diagram): Diagram {
  const diagram = createDerivedDiagramBase(source, 'stt');
  const degrees = computeNodeDegrees(source.edges);

  return {
    ...diagram,
    nodes: source.nodes.map((node) => {
      if (node.data.tags.includes('goal')) {
        return createDerivedNode(node, { tags: ['objective'] });
      }

      const nodeDegrees = degrees.get(node.id) ?? { indegree: 0, outdegree: 0 };
      if (nodeDegrees.indegree === 0 || node.data.tags.includes('obstacle')) {
        return createDerivedNode(node, { tags: ['tactic'] });
      }

      return createDerivedNode(node, { tags: ['strategy'] });
    }),
    edges: source.edges.map((edge) => createDerivedEdge(edge, { reverse: true })),
  };
}

const transitions: DiagramTransition[] = [
  {
    id: 'crt_to_frt',
    sourceFrameworkId: 'crt',
    targetFrameworkId: 'frt',
    label: 'CRT -> FRT',
    derive: deriveCrtToFrt,
  },
  {
    id: 'frt_to_prt',
    sourceFrameworkId: 'frt',
    targetFrameworkId: 'prt',
    label: 'FRT -> PRT',
    derive: deriveFrtToPrt,
  },
  {
    id: 'prt_to_stt',
    sourceFrameworkId: 'prt',
    targetFrameworkId: 'stt',
    label: 'PRT -> STT',
    derive: derivePrtToStt,
  },
];

const transitionsById = new Map(transitions.map((transition) => [transition.id, transition]));
const nextTransitionsByFramework = new Map(
  transitions.map((transition) => [transition.sourceFrameworkId, transition]),
);

export function listDiagramTransitions(): DiagramTransition[] {
  return [...transitions];
}

export function getDiagramTransition(id: DiagramTransitionId): DiagramTransition | undefined {
  return transitionsById.get(id);
}

export function getNextDiagramTransition(frameworkId: string): DiagramTransition | undefined {
  return nextTransitionsByFramework.get(frameworkId);
}

export function deriveDiagramFromTransition(
  source: Diagram,
  transitionId: DiagramTransitionId,
): DerivedDiagramResult | null {
  const transition = getDiagramTransition(transitionId);
  if (!transition || transition.sourceFrameworkId !== source.frameworkId) {
    return null;
  }

  return {
    diagram: transition.derive(source),
    transition,
  };
}

export function getFrameworkSuffix(frameworkId: string): string {
  return FRAMEWORK_SUFFIX[frameworkId] ?? frameworkId.toUpperCase();
}

export function deriveDiagramName(sourceName: string, targetFrameworkId: string): string {
  const basename = sourceName.replace(/\.sky$/i, '').trim() || 'Untitled Diagram';
  const suffixPattern = /_(CRT|FRT|PRT|STT)$/;
  const targetSuffix = getFrameworkSuffix(targetFrameworkId);

  if (suffixPattern.test(basename)) {
    return basename.replace(suffixPattern, `_${targetSuffix}`);
  }

  return `${basename}_${targetSuffix}`;
}
