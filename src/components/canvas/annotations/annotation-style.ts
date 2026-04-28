import type { CSSProperties } from 'react';

export const ANNOTATION_STROKE = 'var(--text)';
export const ANNOTATION_STROKE_WIDTH = 2;

export const annotationHandleStyle: CSSProperties = {
  width: 10,
  height: 10,
  display: 'block',
  appearance: 'none',
  borderRadius: 2,
  border: '1.5px solid var(--accent)',
  background: 'var(--surface)',
  boxShadow: 'none',
};

export const annotationResizeLineStyle: CSSProperties = {
  borderColor: 'var(--accent)',
};
