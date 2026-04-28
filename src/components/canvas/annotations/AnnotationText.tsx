import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagram-store';
import { ANNOTATION_STROKE, annotationHandleStyle, annotationResizeLineStyle } from './annotation-style';

interface AnnotationTextData {
  kind: 'text';
  size: { width: number; height: number };
  text?: string;
  fontSize?: number;
  textColor?: string;
}

function AnnotationText({ id, data, selected }: NodeProps) {
  const d = data as unknown as AnnotationTextData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commitAnnotationData = useDiagramStore((s) => s.commitAnnotationData);
  const resizeAnnotation = useDiagramStore((s) => s.resizeAnnotation);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(d.text ?? '');
  }, [d.text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft !== (d.text ?? '')) {
      commitAnnotationData(id, { text: draft });
    }
  }, [draft, d.text, id, commitAnnotationData]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      (e.target as HTMLTextAreaElement).blur();
    }
    e.stopPropagation();
  }, []);

  return (
    <>
      <NodeResizer
        isVisible={!!selected && !editing}
        minWidth={60}
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
        data-testid={`annotation-text-${id}`}
        className={`annotation annotation-text ${selected ? 'selected' : ''} ${editing ? 'editing' : ''}`}
        onDoubleClick={() => setEditing(true)}
        style={{
          width: '100%',
          height: '100%',
          fontSize: d.fontSize ?? 14,
          color: d.textColor ?? ANNOTATION_STROKE,
          padding: 4,
          boxSizing: 'border-box',
        }}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            className="annotation-text-textarea nodrag nowheel"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              border: 'none',
              background: 'transparent',
              fontSize: 'inherit',
              color: 'inherit',
              padding: 0,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', pointerEvents: 'none' }}>
            {d.text || <span style={{ opacity: 0.4 }}>Double-click to edit</span>}
          </div>
        )}
      </div>
    </>
  );
}

export default memo(AnnotationText);
