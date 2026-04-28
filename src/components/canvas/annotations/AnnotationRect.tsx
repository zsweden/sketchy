import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagram-store';
import { ANNOTATION_STROKE, ANNOTATION_STROKE_WIDTH, annotationHandleStyle, annotationResizeLineStyle } from './annotation-style';

interface AnnotationRectData {
  kind: 'rect';
  size: { width: number; height: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

function AnnotationRect({ id, data, selected }: NodeProps) {
  const d = data as unknown as AnnotationRectData;
  const resizeAnnotation = useDiagramStore((s) => s.resizeAnnotation);

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={30}
        minHeight={20}
        color="var(--accent)"
        handleStyle={annotationHandleStyle}
        lineStyle={annotationResizeLineStyle}
        onResizeEnd={(_, p) =>
          resizeAnnotation(id, {
            size: { width: p.width, height: p.height },
            position: { x: p.x, y: p.y },
          })
        }
      />
      <div
        data-testid={`annotation-rect-${id}`}
        className={`annotation annotation-rect ${selected ? 'selected' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: d.fill ?? 'transparent',
          border: `${d.strokeWidth ?? ANNOTATION_STROKE_WIDTH}px solid ${d.stroke ?? ANNOTATION_STROKE}`,
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

export default memo(AnnotationRect);
