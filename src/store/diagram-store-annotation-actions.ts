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
      const size = DEFAULT_ANNOTATION_SIZE[kind];
      const annotation: Annotation = kind === 'line'
        ? {
          id,
          kind,
          start: position,
          end: { x: position.x + size.width, y: position.y + size.height },
          data: {},
        }
        : {
          id,
          kind,
          position,
          size: { ...size },
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
