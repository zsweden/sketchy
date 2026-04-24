import { create } from 'zustand';
import { createDiagramForFramework, resolveFramework } from './diagram-helpers';
import { createDiagramStoreContext } from './diagram-store-context';
import { createDiagramActions, initialFramework } from './diagram-store-diagram-actions';
import { createDiagramAnnotationActions } from './diagram-store-annotation-actions';
import { createDiagramEdgeActions } from './diagram-store-edge-actions';
import { createDiagramNodeActions } from './diagram-store-node-actions';
import type { DiagramState } from './diagram-store-types';
import type { Framework } from '../core/framework-types';


export const useDiagramStore = create<DiagramState>((set, get) => {
  const context = createDiagramStoreContext(set, get);

  return {
    diagram: createDiagramForFramework(initialFramework),
    ...createDiagramNodeActions(context),
    ...createDiagramEdgeActions(context),
    ...createDiagramAnnotationActions(context),
    ...createDiagramActions(context),
    canUndo: false,
    canRedo: false,
  };
});

/** Selector hook — derives framework from diagram.frameworkId via the registry. */
export function useFramework(): Framework {
  return useDiagramStore((s) => resolveFramework(s.diagram.frameworkId));
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__diagramStore = useDiagramStore;
  (window as unknown as Record<string, unknown>).__sketchy_addEdge = (
    source: string,
    target: string,
  ) => useDiagramStore.getState().addEdge(source, target);
}
