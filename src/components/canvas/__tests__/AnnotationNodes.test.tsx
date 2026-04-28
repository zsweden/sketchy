import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../../../store/diagram-store';
import AnnotationEllipse from '../annotations/AnnotationEllipse';
import AnnotationLine from '../annotations/AnnotationLine';
import AnnotationRect from '../annotations/AnnotationRect';
import AnnotationText from '../annotations/AnnotationText';

vi.mock('@xyflow/react', () => ({
  NodeResizer: ({ isVisible, onResizeEnd }: {
    isVisible?: boolean;
    onResizeEnd?: (event: unknown, params: { width: number; height: number; x: number; y: number }) => void;
  }) => (
    isVisible ? (
      <button
        data-testid="node-resizer"
        onClick={() => onResizeEnd?.({}, { width: 111, height: 55, x: 9, y: 8 })}
      >
      resize
      </button>
    ) : null
  ),
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}));

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
}

function nodeProps(id: string, data: Record<string, unknown>, selected = false) {
  return {
    id,
    data,
    selected,
    type: 'annotation',
    isConnectable: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    dragHandle: '',
    parentId: '',
    deletable: true,
    selectable: true,
  } as never;
}

function lineData(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'line',
    size: { width: 224, height: 144 },
    start: { x: 20, y: 30 },
    end: { x: 220, y: 150 },
    localStart: { x: 12, y: 12 },
    localEnd: { x: 212, y: 132 },
    ...overrides,
  };
}

beforeEach(resetStore);

describe('annotation node renderers', () => {
  it('renders and resizes rectangle annotations', () => {
    const id = useDiagramStore.getState().addAnnotation('rect', { x: 1, y: 2 });

    render(
      <AnnotationRect
        {...nodeProps(id, { kind: 'rect', size: { width: 160, height: 100 }, fill: '#ffeeaa' }, true)}
      />,
    );

    expect(screen.getByTestId(`annotation-rect-${id}`)).toHaveStyle({ backgroundColor: 'rgb(255, 238, 170)' });
    fireEvent.click(screen.getByTestId('node-resizer'));

    const annotation = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
    expect(annotation.size).toEqual({ width: 111, height: 55 });
    expect(annotation.position).toEqual({ x: 9, y: 8 });
  });

  it('renders ellipse annotations with selected state', () => {
    const id = useDiagramStore.getState().addAnnotation('ellipse', { x: 0, y: 0 });

    render(
      <AnnotationEllipse
        {...nodeProps(id, { kind: 'ellipse', size: { width: 160, height: 100 }, stroke: '#123456' }, true)}
      />,
    );

    const ellipse = screen.getByTestId(`annotation-ellipse-${id}`);
    expect(ellipse).toHaveClass('selected');
    expect((ellipse as HTMLElement).style.borderRadius).toBe('50%');
    expect(screen.getByTestId('node-resizer')).toBeInTheDocument();
  });

  it('renders line annotations with configured stroke', () => {
    const id = useDiagramStore.getState().addAnnotation('line', { x: 0, y: 0 });

    render(
      <AnnotationLine
        {...nodeProps(id, lineData({ stroke: '#abcdef', strokeWidth: 3 }))}
      />,
    );

    const line = screen.getByTestId(`annotation-line-${id}`).querySelector('line')!;
    expect(line).toHaveAttribute('stroke', '#abcdef');
    expect(line).toHaveAttribute('stroke-width', '3');
  });

  it('renders line annotations with the app text color by default', () => {
    const id = useDiagramStore.getState().addAnnotation('line', { x: 0, y: 0 });

    render(
      <AnnotationLine
        {...nodeProps(id, lineData())}
      />,
    );

    const line = screen.getByTestId(`annotation-line-${id}`).querySelector('line')!;
    expect(line).toHaveAttribute('stroke', 'var(--text)');
    expect(line).toHaveAttribute('stroke-linecap', 'round');
  });

  it('renders draggable endpoint handles when a line is selected', () => {
    const id = useDiagramStore.getState().addAnnotation('line', { x: 0, y: 0 });

    render(
      <AnnotationLine
        {...nodeProps(id, lineData(), true)}
      />,
    );

    expect(screen.queryByTestId('node-resizer')).not.toBeInTheDocument();
    const startHandle = screen.getByTestId(`annotation-line-${id}-start-handle`);
    const endHandle = screen.getByTestId(`annotation-line-${id}-end-handle`);
    expect(startHandle.style.background).toBe('var(--surface)');
    expect(startHandle.style.borderRadius).toBe('2px');
    expect(startHandle.style.width).toBe('10px');
    expect(endHandle.style.background).toBe('var(--surface)');
    expect(endHandle.style.borderRadius).toBe('2px');
    expect(endHandle.style.width).toBe('10px');
  });

  it('commits text annotation edits on blur', () => {
    const id = useDiagramStore.getState().addAnnotation('text', { x: 0, y: 0 });
    useDiagramStore.getState().commitAnnotationData(id, { text: 'Old text' });

    render(
      <AnnotationText
        {...nodeProps(id, { kind: 'text', size: { width: 180, height: 40 }, text: 'Old text' })}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId(`annotation-text-${id}`));
    const textarea = screen.getByDisplayValue('Old text');
    fireEvent.change(textarea, { target: { value: 'New text' } });
    fireEvent.blur(textarea);

    const annotation = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
    expect(annotation.data.text).toBe('New text');
  });
});
