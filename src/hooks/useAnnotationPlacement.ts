import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { DEFAULT_ANNOTATION_SIZE } from '../store/diagram-store-annotation-actions';

const MIN_DRAW_SIZE = 20;

interface PlacementDrag {
  pointerId: number;
  startFlow: { x: number; y: number };
  annotationId: string;
  isDragging: boolean;
}

interface UseAnnotationPlacementOptions {
  ignoreNextPaneClickRef: React.RefObject<boolean>;
}

export function useAnnotationPlacement({
  ignoreNextPaneClickRef,
}: UseAnnotationPlacementOptions) {
  const { screenToFlowPosition } = useReactFlow();
  const pendingTool = useUIStore((s) => s.pendingAnnotationTool);
  const setPendingAnnotationTool = useUIStore((s) => s.setPendingAnnotationTool);
  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const addAnnotation = useDiagramStore((s) => s.addAnnotation);
  const resizeAnnotation = useDiagramStore((s) => s.resizeAnnotation);

  const dragRef = useRef<PlacementDrag | null>(null);
  const pendingToolRef = useRef(pendingTool);
  useEffect(() => {
    pendingToolRef.current = pendingTool;
  }, [pendingTool]);

  useEffect(() => {
    if (!pendingTool) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingAnnotationTool(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingTool, setPendingAnnotationTool]);

  const resizePlacedAnnotation = useCallback(
    (annotationId: string, startFlow: { x: number; y: number }, currFlow: { x: number; y: number }) => {
      const width = Math.max(MIN_DRAW_SIZE, Math.abs(currFlow.x - startFlow.x));
      const height = Math.max(MIN_DRAW_SIZE, Math.abs(currFlow.y - startFlow.y));
      const x = currFlow.x < startFlow.x ? startFlow.x - width : startFlow.x;
      const y = currFlow.y < startFlow.y ? startFlow.y - height : startFlow.y;
      resizeAnnotation(
        annotationId,
        {
          size: { width, height },
          position: { x, y },
        },
        { trackHistory: false },
      );
    },
    [resizeAnnotation],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const tool = pendingToolRef.current;
      if (!tool) return;
      if (event.button !== 0) return;
      if (event.pointerType === 'touch') return;
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('.react-flow__pane')) return;
      if (event.target.closest('.react-flow__node, .react-flow__edge')) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const startFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const annotationId = addAnnotation(tool, startFlow);
      resizePlacedAnnotation(annotationId, startFlow, startFlow);
      dragRef.current = {
        pointerId: event.pointerId,
        startFlow,
        annotationId,
        isDragging: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [addAnnotation, resizePlacedAnnotation, screenToFlowPosition],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const tool = pendingToolRef.current;
      if (!drag || !tool || event.pointerId !== drag.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      drag.isDragging = true;
      const currFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      resizePlacedAnnotation(drag.annotationId, drag.startFlow, currFlow);
    },
    [resizePlacedAnnotation, screenToFlowPosition],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const tool = pendingToolRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // No-op: pointer capture may not be active.
      }

      if (tool) {
        if (!drag.isDragging) {
          const size = DEFAULT_ANNOTATION_SIZE[tool];
          const position = {
            x: drag.startFlow.x - size.width / 2,
            y: drag.startFlow.y - size.height / 2,
          };
          resizeAnnotation(
            drag.annotationId,
            { size, position },
            { trackHistory: false },
          );
        }
        ignoreNextPaneClickRef.current = true;
        setSelectedNodes([drag.annotationId]);
      }

      setPendingAnnotationTool(null);
      dragRef.current = null;
    },
    [ignoreNextPaneClickRef, resizeAnnotation, setPendingAnnotationTool, setSelectedNodes],
  );

  const onPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
  }, []);

  return {
    pendingTool,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
