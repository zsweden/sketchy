import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagram-store';

interface AnnotationLineData {
  kind: 'line';
  size: { width: number; height: number };
  stroke?: string;
  strokeWidth?: number;
}

function AnnotationLine({ id, data, selected }: NodeProps) {
  const d = data as unknown as AnnotationLineData;
  const resizeAnnotation = useDiagramStore((s) => s.resizeAnnotation);

  const stroke = d.stroke ?? 'var(--text-primary)';
  const strokeWidth = d.strokeWidth ?? 2;

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={20}
        minHeight={20}
        onResizeEnd={(_, p) =>
          resizeAnnotation(id, {
            size: { width: p.width, height: p.height },
            position: { x: p.x, y: p.y },
          })
        }
      />
      <svg
        data-testid={`annotation-line-${id}`}
        className={`annotation annotation-line ${selected ? 'selected' : ''}`}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  );
}

export default memo(AnnotationLine);
