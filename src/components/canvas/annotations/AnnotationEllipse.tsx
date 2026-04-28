import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagram-store';
import { ANNOTATION_STROKE, ANNOTATION_STROKE_WIDTH, annotationHandleStyle, annotationResizeLineStyle } from './annotation-style';

interface AnnotationEllipseData {
  kind: 'ellipse';
  size: { width: number; height: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

function AnnotationEllipse({ id, data, selected }: NodeProps) {
  const d = data as unknown as AnnotationEllipseData;
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
        data-testid={`annotation-ellipse-${id}`}
        className={`annotation annotation-ellipse ${selected ? 'selected' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: d.fill ?? 'transparent',
          border: `${d.strokeWidth ?? ANNOTATION_STROKE_WIDTH}px solid ${d.stroke ?? ANNOTATION_STROKE}`,
          borderRadius: '50%',
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

export default memo(AnnotationEllipse);
