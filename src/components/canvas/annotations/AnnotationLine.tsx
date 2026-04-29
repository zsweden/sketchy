import { memo, useCallback, useEffect, useRef } from 'react';
import { type NodeProps, useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import type { Point } from '../../../core/types';
import { ANNOTATION_STROKE, ANNOTATION_STROKE_WIDTH, annotationHandleStyle } from './annotation-style';

interface AnnotationLineData {
  kind: 'line';
  size: { width: number; height: number };
  start: Point;
  end: Point;
  localStart: Point;
  localEnd: Point;
  stroke?: string;
  strokeWidth?: number;
}

interface EndpointDrag {
  endpoint: 'start' | 'end';
  pointerId: number | null;
  moved: boolean;
}

function AnnotationLine({ id, data, selected }: NodeProps) {
  const d = data as unknown as AnnotationLineData;
  const { screenToFlowPosition } = useReactFlow();
  const updateLineAnnotationEndpoint = useDiagramStore((s) => s.updateLineAnnotationEndpoint);
  const beginInteraction = useDiagramStore((s) => s.beginInteraction);
  const commitInteraction = useDiagramStore((s) => s.commitInteraction);
  const cancelInteraction = useDiagramStore((s) => s.cancelInteraction);
  const isStoreSelected = useUIStore((s) => s.selectedNodeIds.includes(id));
  const dragRef = useRef<EndpointDrag | null>(null);

  const isSelected = selected || isStoreSelected;
  const stroke = d.stroke ?? ANNOTATION_STROKE;
  const strokeWidth = d.strokeWidth ?? ANNOTATION_STROKE_WIDTH;

  const startEndpointDrag = useCallback((endpoint: 'start' | 'end', pointerId: number | null) => {
    beginInteraction();
    dragRef.current = {
      endpoint,
      pointerId,
      moved: false,
    };
  }, [beginInteraction]);

  useEffect(() => {
    const getEndpoint = (target: EventTarget | null): 'start' | 'end' | null => {
      if (!(target instanceof Element)) return null;
      const handle = target.closest<HTMLElement>(`[data-line-id="${id}"][data-line-endpoint]`);
      const endpoint = handle?.dataset.lineEndpoint;
      return endpoint === 'start' || endpoint === 'end' ? endpoint : null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const endpoint = getEndpoint(event.target);
      if (!endpoint || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      startEndpointDrag(endpoint, event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      drag.moved = true;
      updateLineAnnotationEndpoint(
        id,
        drag.endpoint,
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        { trackHistory: false },
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      if (drag.moved) commitInteraction();
      else cancelInteraction();
      dragRef.current = null;
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      cancelInteraction();
      dragRef.current = null;
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [
    beginInteraction,
    cancelInteraction,
    commitInteraction,
    id,
    screenToFlowPosition,
    startEndpointDrag,
    updateLineAnnotationEndpoint,
  ]);

  useEffect(() => {
    const getEndpoint = (target: EventTarget | null): 'start' | 'end' | null => {
      if (!(target instanceof Element)) return null;
      const handle = target.closest<HTMLElement>(`[data-line-id="${id}"][data-line-endpoint]`);
      const endpoint = handle?.dataset.lineEndpoint;
      return endpoint === 'start' || endpoint === 'end' ? endpoint : null;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (dragRef.current) return;
      const endpoint = getEndpoint(event.target);
      if (!endpoint || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      startEndpointDrag(endpoint, null);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== null) return;
      event.preventDefault();
      drag.moved = true;
      updateLineAnnotationEndpoint(
        id,
        drag.endpoint,
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        { trackHistory: false },
      );
    };

    const handleMouseUp = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== null) return;
      event.preventDefault();
      if (drag.moved) {
        commitInteraction();
      } else {
        cancelInteraction();
      }
      dragRef.current = null;
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    beginInteraction,
    cancelInteraction,
    commitInteraction,
    id,
    screenToFlowPosition,
    startEndpointDrag,
    updateLineAnnotationEndpoint,
  ]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
      <svg
        data-testid={`annotation-line-${id}`}
        className={`annotation annotation-line ${isSelected ? 'selected' : ''}`}
        width="100%"
        height="100%"
        viewBox={`0 0 ${d.size.width} ${d.size.height}`}
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        <line
          x1={d.localStart.x}
          y1={d.localStart.y}
          x2={d.localEnd.x}
          y2={d.localEnd.y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {isSelected && (
        <>
          <button
            type="button"
            aria-label="Move line start"
            data-testid={`annotation-line-${id}-start-handle`}
            data-line-id={id}
            data-line-endpoint="start"
            className="nodrag nopan"
            style={{
              position: 'absolute',
              left: d.localStart.x,
              top: d.localStart.y,
              width: 14,
              height: 14,
              padding: 0,
              ...annotationHandleStyle,
              transform: 'translate(-50%, -50%)',
              cursor: 'move',
              pointerEvents: 'auto',
              zIndex: 2,
            }}
          />
          <button
            type="button"
            aria-label="Move line end"
            data-testid={`annotation-line-${id}-end-handle`}
            data-line-id={id}
            data-line-endpoint="end"
            className="nodrag nopan"
            style={{
              position: 'absolute',
              left: d.localEnd.x,
              top: d.localEnd.y,
              width: 14,
              height: 14,
              padding: 0,
              ...annotationHandleStyle,
              transform: 'translate(-50%, -50%)',
              cursor: 'move',
              pointerEvents: 'auto',
              zIndex: 2,
            }}
          />
        </>
      )}
    </div>
  );
}

export default memo(AnnotationLine);
