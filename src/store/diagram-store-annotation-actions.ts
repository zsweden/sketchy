import type { Annotation } from '../core/types';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';
import { createAnnotation, DEFAULT_ANNOTATION_SIZE } from '../core/annotations/geometry';

export { DEFAULT_ANNOTATION_SIZE };

export function createDiagramAnnotationActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'addAnnotation'
  | 'updateAnnotationData'
  | 'commitAnnotationData'
  | 'resizeAnnotation'
  | 'updateLineAnnotationEndpoint'
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
      const annotation = createAnnotation(kind, position, id);
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
        (a) => {
          if (a.kind === 'line') {
            const start = patch.position ?? a.start;
            return {
              ...a,
              start,
              end: {
                x: start.x + patch.size.width,
                y: start.y + patch.size.height,
              },
            };
          }
          return {
            ...a,
            size: patch.size,
            ...(patch.position ? { position: patch.position } : {}),
          };
        },
        { trackHistory: options?.trackHistory ?? true },
      );
    },

    updateLineAnnotationEndpoint: (id, endpoint, position, options) => {
      patchAnnotation(
        id,
        (a) => (a.kind === 'line' ? { ...a, [endpoint]: position } : a),
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
