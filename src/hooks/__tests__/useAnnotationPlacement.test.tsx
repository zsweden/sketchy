import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnotationPlacement } from '../useAnnotationPlacement';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
  };
});

function resetStores() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
    pendingAnnotationTool: null,
  });
}

beforeEach(resetStores);

function setup() {
  const ignoreNextPaneClickRef = { current: false };
  const { result } = renderHook(() =>
    useAnnotationPlacement({ ignoreNextPaneClickRef }),
  );

  const pane = document.createElement('div');
  pane.className = 'react-flow__pane';
  pane.setPointerCapture = vi.fn();
  pane.releasePointerCapture = vi.fn();
  document.body.appendChild(pane);

  const targetEl = document.createElement('div');
  pane.appendChild(targetEl);

  function makeEvent(
    overrides: Partial<{
      clientX: number;
      clientY: number;
      pointerId: number;
      button: number;
      pointerType: string;
      target: Element;
    }> = {},
  ): React.PointerEvent<HTMLDivElement> {
    const target = overrides.target ?? targetEl;
    return {
      clientX: overrides.clientX ?? 100,
      clientY: overrides.clientY ?? 100,
      pointerId: overrides.pointerId ?? 1,
      button: overrides.button ?? 0,
      pointerType: overrides.pointerType ?? 'mouse',
      target,
      currentTarget: pane,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      nativeEvent: { stopImmediatePropagation: vi.fn() },
    } as unknown as React.PointerEvent<HTMLDivElement>;
  }

  return { result, ignoreNextPaneClickRef, pane, targetEl, makeEvent };
}

describe('useAnnotationPlacement', () => {
  describe('without a pending tool', () => {
    it('ignores pointer events when no tool is pending', () => {
      const { result, makeEvent } = setup();
      act(() => result.current.onPointerDown(makeEvent()));
      act(() => result.current.onPointerUp(makeEvent()));
      expect(useDiagramStore.getState().diagram.annotations).toHaveLength(0);
    });
  });

  describe('with a pending tool — click only', () => {
    it('places an annotation centered on the click and exits placement mode', () => {
      useUIStore.getState().setPendingAnnotationTool('rect');
      const { result, ignoreNextPaneClickRef, makeEvent } = setup();

      act(() => result.current.onPointerDown(makeEvent({ clientX: 200, clientY: 150 })));
      act(() => result.current.onPointerUp(makeEvent({ clientX: 200, clientY: 150 })));

      const annotations = useDiagramStore.getState().diagram.annotations;
      expect(annotations).toHaveLength(1);
      expect(annotations[0].kind).toBe('rect');
      // Default rect size is 160×100; centered on (200,150) → (120,100).
      expect(annotations[0].position).toEqual({ x: 120, y: 100 });
      expect(annotations[0].size).toEqual({ width: 160, height: 100 });

      expect(useUIStore.getState().pendingAnnotationTool).toBeNull();
      expect(ignoreNextPaneClickRef.current).toBe(true);
      expect(useUIStore.getState().selectedNodeIds).toEqual([annotations[0].id]);
    });
  });

  describe('with a pending tool — drag', () => {
    it('creates immediately and live-resizes an annotation while dragging', () => {
      useUIStore.getState().setPendingAnnotationTool('ellipse');
      const { result, ignoreNextPaneClickRef, makeEvent } = setup();

      act(() => result.current.onPointerDown(makeEvent({ clientX: 50, clientY: 50 })));

      // Mouse-down starts the draw gesture immediately.
      let annotations = useDiagramStore.getState().diagram.annotations;
      expect(annotations).toHaveLength(1);
      expect(annotations[0].kind).toBe('ellipse');
      expect(annotations[0].position).toEqual({ x: 50, y: 50 });
      expect(annotations[0].size).toEqual({ width: 20, height: 20 });

      // Tiny moves still resize the live annotation rather than waiting for a threshold.
      act(() => result.current.onPointerMove(makeEvent({ clientX: 52, clientY: 52 })));
      annotations = useDiagramStore.getState().diagram.annotations;
      expect(annotations).toHaveLength(1);
      expect(annotations[0].size).toEqual({ width: 20, height: 20 });

      act(() => result.current.onPointerMove(makeEvent({ clientX: 200, clientY: 180 })));
      annotations = useDiagramStore.getState().diagram.annotations;
      expect(annotations).toHaveLength(1);
      expect(annotations[0].kind).toBe('ellipse');
      expect(annotations[0].position).toEqual({ x: 50, y: 50 });
      expect(annotations[0].size).toEqual({ width: 150, height: 130 });

      // Drag further and release
      act(() => result.current.onPointerMove(makeEvent({ clientX: 250, clientY: 200 })));
      act(() => result.current.onPointerUp(makeEvent({ clientX: 250, clientY: 200 })));

      annotations = useDiagramStore.getState().diagram.annotations;
      expect(annotations[0].size).toEqual({ width: 200, height: 150 });
      expect(useUIStore.getState().pendingAnnotationTool).toBeNull();
      expect(ignoreNextPaneClickRef.current).toBe(true);
      expect(useUIStore.getState().selectedNodeIds).toEqual([annotations[0].id]);
    });

    it('inverts position when dragged up-and-left of the start point', () => {
      useUIStore.getState().setPendingAnnotationTool('rect');
      const { result, makeEvent } = setup();

      act(() => result.current.onPointerDown(makeEvent({ clientX: 200, clientY: 200 })));
      act(() => result.current.onPointerMove(makeEvent({ clientX: 100, clientY: 130 })));
      act(() => result.current.onPointerUp(makeEvent({ clientX: 100, clientY: 130 })));

      const a = useDiagramStore.getState().diagram.annotations[0];
      expect(a.position).toEqual({ x: 100, y: 130 });
      expect(a.size).toEqual({ width: 100, height: 70 });
    });
  });

  describe('Escape', () => {
    it('clears the pending tool on Escape', () => {
      useUIStore.getState().setPendingAnnotationTool('text');
      // Render the hook to attach the keydown listener.
      setup();
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(useUIStore.getState().pendingAnnotationTool).toBeNull();
    });
  });

  describe('non-pane targets', () => {
    it('ignores pointerdown on a node element', () => {
      useUIStore.getState().setPendingAnnotationTool('rect');
      const { result, makeEvent } = setup();

      const node = document.createElement('div');
      node.className = 'react-flow__node';
      const pane = document.createElement('div');
      pane.className = 'react-flow__pane';
      pane.appendChild(node);
      document.body.appendChild(pane);

      act(() =>
        result.current.onPointerDown(makeEvent({ target: node, clientX: 10, clientY: 10 })),
      );
      act(() =>
        result.current.onPointerUp(makeEvent({ target: node, clientX: 10, clientY: 10 })),
      );

      expect(useDiagramStore.getState().diagram.annotations).toHaveLength(0);
      // Pending tool stays armed because the click never registered.
      expect(useUIStore.getState().pendingAnnotationTool).toBe('rect');

      document.body.removeChild(pane);
    });
  });
});
