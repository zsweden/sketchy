import { createEmptyDiagram } from '../core/types';
import type { Diagram, DiagramEdge, EdgePolarity } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework, getDefaultFramework } from '../frameworks/registry';

const defaultFramework = getDefaultFramework();

export function resolveFramework(frameworkId: string): Framework {
  return getFramework(frameworkId) ?? defaultFramework;
}

export function createDiagramForFramework(framework: Framework): Diagram {
  const diagram = createEmptyDiagram(framework.id);
  return {
    ...diagram,
    settings: {
      ...diagram.settings,
      layoutDirection: framework.defaultLayoutDirection,
    },
  };
}

export function getDefaultEdgeFields(
  framework: Framework,
): Pick<DiagramEdge, 'polarity' | 'delay'> {
  return {
    ...(framework.supportsEdgePolarity ? { polarity: 'positive' as EdgePolarity } : {}),
    ...(framework.supportsEdgeDelay ? { delay: false } : {}),
  };
}
