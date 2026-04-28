import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { DEFAULT_ANNOTATION_SIZE } from '../store/diagram-store-annotation-actions';

const DRAG_THRESHOLD_PX = 5;
const MIN_DRAW_SIZE = 20;

interface PlacementDrag {
  pointerId: number;
  startScreen: { x: number; y: number };
  startFlow: { x: number; y: number };
  annotationId: string | null;
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
      dragRef.current = {
        pointerId: event.pointerId,
        startScreen: { x: event.clientX, y: event.clientY },
        startFlow,
        annotationId: null,
        isDragging: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [screenToFlowPosition],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const tool = pendingToolRef.current;
      if (!drag || !tool || event.pointerId !== drag.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const dx = event.clientX - drag.startScreen.x;
      const dy = event.clientY - drag.startScreen.y;

      if (!drag.isDragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.isDragging = true;
        drag.annotationId = addAnnotation(tool, drag.startFlow);
      }

      if (!drag.annotationId) return;
      const currFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const width = Math.max(MIN_DRAW_SIZE, Math.abs(currFlow.x - drag.startFlow.x));
      const height = Math.max(MIN_DRAW_SIZE, Math.abs(currFlow.y - drag.startFlow.y));
      const x = Math.min(drag.startFlow.x, currFlow.x);
      const y = Math.min(drag.startFlow.y, currFlow.y);
      resizeAnnotation(drag.annotationId, {
        size: { width, height },
        position: { x, y },
      });
    },
    [addAnnotation, resizeAnnotation, screenToFlowPosition],
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
        let placedId = drag.annotationId;
        if (!drag.isDragging) {
          const size = DEFAULT_ANNOTATION_SIZE[tool];
          const position = {
            x: drag.startFlow.x - size.width / 2,
            y: drag.startFlow.y - size.height / 2,
          };
          placedId = addAnnotation(tool, position);
        }
        if (placedId) {
          ignoreNextPaneClickRef.current = true;
          setSelectedNodes([placedId]);
        }
      }

      setPendingAnnotationTool(null);
      dragRef.current = null;
    },
    [addAnnotation, ignoreNextPaneClickRef, setPendingAnnotationTool, setSelectedNodes],
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
