import type { Annotation, AnnotationKind } from '../core/types';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export const DEFAULT_ANNOTATION_SIZE: Record<AnnotationKind, { width: number; height: number }> = {
  text: { width: 180, height: 40 },
  rect: { width: 160, height: 100 },
  ellipse: { width: 160, height: 100 },
  line: { width: 200, height: 120 },
};

export function createDiagramAnnotationActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'addAnnotation'
  | 'updateAnnotationData'
  | 'commitAnnotationData'
  | 'resizeAnnotation'
  | 'deleteAnnotations'
> {
  const { applyDiagramChange } = context;

  const patchAnnotation = (
    id: string,
    patch: (ann: Annotation) => Annotation,
    options?: { trackHistory?: boolean },
  ) => {
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        annotations: diagram.annotations.map((a) => (a.id === id ? patch(a) : a)),
      }),
      options,
    );
  };

  return {
    addAnnotation: (kind, position) => {
      const id = crypto.randomUUID();
      const annotation: Annotation = {
        id,
        kind,
        position,
        size: { ...DEFAULT_ANNOTATION_SIZE[kind] },
        data: {},
      };
      applyDiagramChange(
        (diagram) => ({ ...diagram, annotations: [...diagram.annotations, annotation] }),
        { trackHistory: true },
      );
      return id;
    },

    updateAnnotationData: (id, data) => {
      patchAnnotation(id, (a) => ({ ...a, data: { ...a.data, ...data } }));
    },

    commitAnnotationData: (id, data) => {
      patchAnnotation(id, (a) => ({ ...a, data: { ...a.data, ...data } }), { trackHistory: true });
    },

    resizeAnnotation: (id, patch, options) => {
      patchAnnotation(
        id,
        (a) => ({
          ...a,
          size: patch.size,
          ...(patch.position ? { position: patch.position } : {}),
        }),
        { trackHistory: options?.trackHistory ?? true },
      );
    },

    deleteAnnotations: (ids) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      applyDiagramChange(
        (diagram) => ({
          ...diagram,
          annotations: diagram.annotations.filter((a) => !idSet.has(a.id)),
        }),
        { trackHistory: true },
      );
    },
  };
}
