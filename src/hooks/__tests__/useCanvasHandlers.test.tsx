import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import { useCanvasHandlers } from '../useCanvasHandlers';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

const { toast } = mocks;

function resetStores() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    toasts: [],
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
  toast.mockClear();
  toast.warning.mockClear();
  toast.error.mockClear();
}

function setup(initialNodes: Node[] = [], initialEdges: Edge[] = []) {
  const setLocalNodes = vi.fn();
  const setLocalEdges = vi.fn();
  const screenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }));
  const tryFitViewOnDimensions = vi.fn();
  const ignoreNextPaneClickRef = { current: false };
  const suppressSelectionUntilRef = { current: 0 };

  const { result, rerender } = renderHook(
    ({ nodes }: { nodes: Node[] }) =>
      useCanvasHandlers({
        localNodes: nodes,
        setLocalNodes,
        setLocalEdges,
        screenToFlowPosition,
        ignoreNextPaneClickRef,
        suppressSelectionUntilRef,
        tryFitViewOnDimensions,
      }),
    { initialProps: { nodes: initialNodes } },
  );

  return {
    result,
    rerender,
    setLocalNodes,
    setLocalEdges,
    screenToFlowPosition,
    tryFitViewOnDimensions,
    ignoreNextPaneClickRef,
    suppressSelectionUntilRef,
    initialEdges,
  };
}

beforeEach(resetStores);

describe('useCanvasHandlers', () => {
  describe('clearCanvasSelection', () => {
    it('clears UI store selections and local node/edge selected flags', () => {
      useUIStore.setState({
        selectedNodeIds: ['n1'],
        selectedEdgeIds: ['e1'],
        selectedLoopId: 'loop1',
      });
      const { result, setLocalNodes, setLocalEdges } = setup();

      act(() => result.current.clearCanvasSelection());

      const uiState = useUIStore.getState();
      expect(uiState.selectedNodeIds).toEqual([]);
      expect(uiState.selectedEdgeIds).toEqual([]);
      expect(uiState.selectedLoopId).toBeNull();
      expect(setLocalNodes).toHaveBeenCalled();
      expect(setLocalEdges).toHaveBeenCalled();
    });
  });

  describe('onConnect', () => {
    it('adds an edge between two nodes', () => {
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      const { result } = setup();

      act(() =>
        result.current.onConnect({
          source: sourceId,
          target: targetId,
          sourceHandle: null,
          targetHandle: null,
        }),
      );

      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });

    it('shows the offer-to-switch toast when moving an edge anchor in dynamic routing mode', () => {
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });

      const { result } = setup();
      act(() =>
        result.current.onConnect({
          source: sourceId,
          target: targetId,
          sourceHandle: 'source-top',
          targetHandle: 'target-bottom',
        }),
      );

      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('Optimize Continuously'),
        expect.objectContaining({ action: expect.any(Object) }),
      );
    });

    it('ignores connections missing source or target', () => {
      const { result } = setup();
      act(() =>
        result.current.onConnect({
          source: null,
          target: 'n1',
          sourceHandle: null,
          targetHandle: null,
        }),
      );
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });
  });

  describe('onPaneClick', () => {
    it('clears selection and closes context menu', () => {
      useUIStore.setState({ selectedNodeIds: ['n1'], contextMenu: { x: 0, y: 0 } });
      const { result } = setup();

      act(() => result.current.onPaneClick());

      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('respects ignoreNextPaneClickRef once', () => {
      useUIStore.setState({ selectedNodeIds: ['n1'] });
      const { result, ignoreNextPaneClickRef } = setup();
      ignoreNextPaneClickRef.current = true;

      act(() => result.current.onPaneClick());
      expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
      expect(ignoreNextPaneClickRef.current).toBe(false);

      act(() => result.current.onPaneClick());
      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    });
  });

  describe('onDoubleClick', () => {
    function makeEvent(target: Element, clientX = 50, clientY = 50) {
      return {
        target,
        clientX,
        clientY,
      } as unknown as React.MouseEvent<HTMLDivElement>;
    }

    it('creates a node at the double-click position on the pane', () => {
      const { result, screenToFlowPosition } = setup();
      const pane = document.createElement('div');
      pane.className = 'react-flow__pane';
      document.body.appendChild(pane);

      act(() => result.current.onDoubleClick(makeEvent(pane, 120, 80)));

      expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 120, y: 80 });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      document.body.removeChild(pane);
    });

    it('does not create a node when double-clicking a node', () => {
      const { result } = setup();
      const node = document.createElement('div');
      node.className = 'react-flow__node';
      const pane = document.createElement('div');
      pane.className = 'react-flow__pane';
      pane.appendChild(node);
      document.body.appendChild(pane);

      act(() => result.current.onDoubleClick(makeEvent(node)));

      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      document.body.removeChild(pane);
    });

    it('sets the selection suppression window so stray selection events are ignored', () => {
      const { result, suppressSelectionUntilRef } = setup();
      const pane = document.createElement('div');
      pane.className = 'react-flow__pane';
      document.body.appendChild(pane);

      act(() => result.current.onDoubleClick(makeEvent(pane)));

      expect(suppressSelectionUntilRef.current).toBeGreaterThan(Date.now());
      document.body.removeChild(pane);
    });
  });

  describe('onSelectionChange', () => {
    it('updates UI store with selected node and edge ids', () => {
      const { result } = setup();

      act(() =>
        result.current.onSelectionChange({
          nodes: [{ id: 'n1' } as Node, { id: 'n2' } as Node],
          edges: [{ id: 'e1' } as Edge],
        }),
      );

      expect(useUIStore.getState().selectedNodeIds).toEqual(['n1', 'n2']);
      expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1']);
    });

    it('ignores non-empty selection updates during the suppression window', () => {
      const { result, suppressSelectionUntilRef } = setup();
      suppressSelectionUntilRef.current = Date.now() + 500;

      act(() =>
        result.current.onSelectionChange({
          nodes: [{ id: 'n1' } as Node],
          edges: [],
        }),
      );

      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    });
  });

  describe('onNodesChange', () => {
    it('batches node + edge removals into a single store update via microtask flush', async () => {
      const n1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const n2 = useDiagramStore.getState().addNode({ x: 100, y: 0 });
      useDiagramStore.getState().addEdge(n1, n2);
      const edgeId = useDiagramStore.getState().diagram.edges[0].id;
      const batchApplySpy = vi.spyOn(useDiagramStore.getState(), 'batchApply');

      const { result } = setup();
      act(() => {
        result.current.onNodesChange([{ type: 'remove', id: n1 } as NodeChange]);
        result.current.onEdgesChange([{ type: 'remove', id: edgeId } as EdgeChange]);
      });

      await Promise.resolve(); // let the queued microtask fire
      expect(batchApplySpy).toHaveBeenCalledTimes(1);
      expect(batchApplySpy).toHaveBeenCalledWith({
        removeNodeIds: [n1],
        removeEdgeIds: [edgeId],
      });
    });

    it('snaps position changes to grid when snapToGrid is enabled', () => {
      const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateSettings({ snapToGrid: true });
      const dragSpy = vi.spyOn(useDiagramStore.getState(), 'dragNodes');

      const nodes: Node[] = [{
        id: nodeId,
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 160, height: 60 },
      } as Node];
      const { result } = setup(nodes);

      act(() =>
        result.current.onNodesChange([
          {
            type: 'position',
            id: nodeId,
            position: { x: 37, y: 42 },
            dragging: true,
          } as NodeChange,
        ]),
      );

      expect(dragSpy).toHaveBeenCalledTimes(1);
      const [args] = dragSpy.mock.calls[0];
      const snapped = args[0].position;
      // Snap is deterministic to a grid — assert both coords were rounded (differ from raw).
      expect(snapped.x).not.toBe(37);
      expect(snapped.y).not.toBe(42);
    });

    it('calls tryFitViewOnDimensions when dimension changes arrive', () => {
      const { result, tryFitViewOnDimensions } = setup();
      act(() =>
        result.current.onNodesChange([
          { type: 'dimensions', id: 'n1', dimensions: { width: 100, height: 40 } } as NodeChange,
        ]),
      );
      expect(tryFitViewOnDimensions).toHaveBeenCalled();
    });
  });

  describe('onNodeDragStop', () => {
    it('commits dragged node positions', () => {
      const commitSpy = vi.spyOn(useDiagramStore.getState(), 'commitDraggedNodes');
      const { result } = setup();
      act(() => result.current.onNodeDragStop());
      expect(commitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('context menu handlers', () => {
    function makeMouseEvent(clientX = 50, clientY = 50) {
      return {
        clientX,
        clientY,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.MouseEvent;
    }

    it('onPaneContextMenu opens a canvas context menu at the pointer position', () => {
      const { result } = setup();
      const e = makeMouseEvent(300, 200);
      act(() => result.current.onPaneContextMenu(e));

      const menu = useUIStore.getState().contextMenu;
      expect(menu).toEqual({ x: 300, y: 200 });
    });

    it('onNodeContextMenu opens the context menu targeted to the node', () => {
      const { result } = setup();
      const e = makeMouseEvent(100, 100);
      act(() => result.current.onNodeContextMenu(e, { id: 'n1' } as Node));

      expect(useUIStore.getState().contextMenu).toEqual({
        x: 100,
        y: 100,
        nodeId: 'n1',
      });
    });

    it('onEdgeContextMenu opens the context menu targeted to the edge', () => {
      const { result } = setup();
      const e = makeMouseEvent(100, 100);
      act(() => result.current.onEdgeContextMenu(e, { id: 'e1' } as Edge));

      expect(useUIStore.getState().contextMenu).toEqual({
        x: 100,
        y: 100,
        edgeId: 'e1',
      });
    });
  });
});
