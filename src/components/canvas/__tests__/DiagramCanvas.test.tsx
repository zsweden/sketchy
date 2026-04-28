import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiagramCanvas from '../DiagramCanvas';
import { mergeRFNodesWithLocalState } from '../local-node-state';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import { uiEvents } from '../../../store/ui-events';
import type { EdgeChange, NodeChange } from '@xyflow/react';

const mocks = vi.hoisted(() => ({
  degreesMap: new Map(),
  highlightSets: { nodes: new Set<string>(), edges: new Set<string>() },
  rfNodes: [] as never[],
  rfEdges: [] as never[],
  defaultEdgeOptions: {},
  activeTheme: { js: { minimapFallback: '#999' } },
  useRFNodeEdgeBuilder: vi.fn(),
  screenToFlowPosition: vi.fn(() => ({ x: 200, y: 100 })),
  fitView: vi.fn(),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  getInternalNode: vi.fn(() => undefined),
  setCenter: vi.fn(),
  updateNodeInternals: vi.fn(),
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

vi.mock('../EntityNode', () => ({
  default: () => null,
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    edges,
    zoomOnDoubleClick,
    onConnect,
    onSelectionChange,
    onPaneClick,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onNodeDragStart,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    selectionOnDrag,
    panOnDrag,
    nodesDraggable,
    nodesConnectable,
    elementsSelectable,
  }: {
    nodes: Array<{ id: string; selected?: boolean }>;
    edges: Array<{ id: string; selected?: boolean }>;
    zoomOnDoubleClick?: boolean;
    selectionOnDrag?: boolean;
    panOnDrag?: boolean | number[];
    nodesDraggable?: boolean;
    nodesConnectable?: boolean;
    elementsSelectable?: boolean;
    onConnect: (connection: {
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }) => void;
    onNodesChange?: (changes: NodeChange[]) => void;
    onEdgesChange?: (changes: EdgeChange[]) => void;
    onSelectionChange?: (params: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> }) => void;
    onNodeDragStart?: () => void;
    onPaneClick?: () => void;
    onPaneContextMenu?: (event: {
      clientX: number;
      clientY: number;
      preventDefault: () => void;
      stopPropagation?: () => void;
    }) => void;
    onNodeContextMenu?: (
      event: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      },
      node: { id: string },
    ) => void;
    onEdgeContextMenu?: (
      event: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      },
      edge: { id: string },
    ) => void;
    onNodeDragStop?: () => void;
  }) => (
    <div>
      <div data-testid="zoom-on-double-click">{String(zoomOnDoubleClick)}</div>
      <div data-testid="selection-on-drag">{String(selectionOnDrag)}</div>
      <div data-testid="pan-on-drag">{JSON.stringify(panOnDrag)}</div>
      <div data-testid="nodes-draggable">{String(nodesDraggable)}</div>
      <div data-testid="nodes-connectable">{String(nodesConnectable)}</div>
      <div data-testid="elements-selectable">{String(elementsSelectable)}</div>
      <div data-testid="selected-nodes">{nodes.filter((node) => node.selected).map((node) => node.id).join(',')}</div>
      <div data-testid="selected-edges">{edges.filter((edge) => edge.selected).map((edge) => edge.id).join(',')}</div>
      <button
        type="button"
        className="react-flow__pane"
        data-testid="trigger-canvas-double-click"
      >
        Trigger canvas double click
      </button>
      <div className="react-flow__pane">
        <div className="react-flow__node" data-node-id="n1">
          <button
            type="button"
            data-testid="trigger-node-double-click"
          >
            Trigger node double click
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onConnect({
          source: 'source-node',
          target: 'target-node',
          sourceHandle: 'source-left',
          targetHandle: 'target-right',
        })}
      >
        Trigger connect
      </button>
      <button
        type="button"
        data-testid="trigger-edge-remove"
        onClick={() => {
          const edgeId = edges[0]?.id;
          if (edgeId) onEdgesChange?.([{ id: edgeId, type: 'remove' }]);
        }}
      >
        Trigger edge remove
      </button>
      <button
        type="button"
        data-testid="trigger-node-remove"
        onClick={() => {
          const nodeId = nodes.at(-1)?.id;
          if (nodeId) onNodesChange?.([{ id: nodeId, type: 'remove' }]);
        }}
      >
        Trigger node remove
      </button>
      <button
        type="button"
        data-testid="trigger-node-drag-start"
        onClick={() => onNodeDragStart?.()}
      >
        Trigger node drag start
      </button>
      <button
        type="button"
        data-testid="trigger-node-drag-stop"
        onClick={() => onNodeDragStop?.()}
      >
        Trigger node drag stop
      </button>
      <button
        type="button"
        data-testid="trigger-selection"
        onClick={() => onSelectionChange?.({
          nodes: nodes.filter((n) => n.id === 'n1').map((n) => ({ id: n.id })),
          edges: [],
        })}
      >
        Trigger selection
      </button>
      <button
        type="button"
        data-testid="trigger-pane-click"
        onClick={() => onPaneClick?.()}
      >
        Trigger pane click
      </button>
      <button
        type="button"
        data-testid="trigger-node-context-menu"
        onClick={() => {
          const event = {
            clientX: 120,
            clientY: 80,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
          };
          onNodeContextMenu?.(event, { id: 'n1' });
          if (!event.stopPropagation.mock.calls.length) onPaneContextMenu?.(event);
        }}
      >
        Trigger node context menu
      </button>
      <button
        type="button"
        data-testid="trigger-edge-context-menu"
        onClick={() => {
          const event = {
            clientX: 140,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
          };
          onEdgeContextMenu?.(event, { id: 'e1' });
          if (!event.stopPropagation.mock.calls.length) onPaneContextMenu?.(event);
        }}
      >
        Trigger edge context menu
      </button>
      <button
        type="button"
        data-testid="trigger-pane-context-menu-over-node"
        onClick={() => {
          const target = document.createElement('div');
          target.className = 'react-flow__node';
          const event = {
            clientX: 160,
            clientY: 100,
            preventDefault: vi.fn(),
            target,
          };
          onPaneContextMenu?.(event);
        }}
      >
        Trigger pane context menu over node
      </button>
      <button
        type="button"
        data-testid="trigger-pane-context-menu-over-edge"
        onClick={() => {
          const target = document.createElement('div');
          target.className = 'react-flow__edge';
          const event = {
            clientX: 180,
            clientY: 110,
            preventDefault: vi.fn(),
            target,
          };
          onPaneContextMenu?.(event);
        }}
      >
        Trigger pane context menu over edge
      </button>
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' },
  useReactFlow: () => ({
    screenToFlowPosition: mocks.screenToFlowPosition,
    fitView: mocks.fitView,
    getViewport: mocks.getViewport,
    getInternalNode: mocks.getInternalNode,
    setCenter: mocks.setCenter,
    viewportInitialized: true,
  }),
  useUpdateNodeInternals: () => mocks.updateNodeInternals,
  applyNodeChanges: vi.fn((changes, nodes) => nodes),
  applyEdgeChanges: vi.fn((changes, edges) => edges),
}));

vi.mock('../../../hooks/useCanvasHighlighting', () => ({
  useCanvasHighlighting: () => ({
    selectedLoop: null,
    highlightSets: mocks.highlightSets,
    degreesMap: mocks.degreesMap,
  }),
}));

vi.mock('../../../hooks/useRFNodeEdgeBuilder', () => ({
  useRFNodeEdgeBuilder: (...args: unknown[]) => mocks.useRFNodeEdgeBuilder(...args),
}));

function resetStores() {
  window.sessionStorage?.removeItem?.('sketchy_diagram');
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
  useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });
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

function makeNodeState(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  };
}

describe('mergeRFNodesWithLocalState', () => {
  it('preserves measured size and selection for matching ids', () => {
    const prevLocalNodes = [
      makeNodeState('n1', {
        position: { x: 0, y: 0 },
        data: { label: 'Old' },
        selected: true,
        measured: { width: 160, height: 90 },
        width: 160,
        height: 90,
      }),
    ];
    const rfNodes = [
      makeNodeState('n1', {
        position: { x: 200, y: 120 },
        data: { label: 'New' },
        draggable: false,
      }),
    ];

    const result = mergeRFNodesWithLocalState(prevLocalNodes as never[], rfNodes as never[]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'n1',
      position: { x: 200, y: 120 },
      data: { label: 'New' },
      draggable: false,
      selected: true,
      measured: { width: 160, height: 90 },
      width: 160,
      height: 90,
    });
  });

  it('uses fresh dimensions for annotation nodes', () => {
    const prevLocalNodes = [
      makeNodeState('a1', {
        type: 'annotation-rect',
        width: 20,
        height: 20,
        measured: { width: 20, height: 20 },
        selected: true,
      }),
    ];
    const rfNodes = [
      makeNodeState('a1', {
        type: 'annotation-rect',
        width: 120,
        height: 80,
      }),
    ];

    const result = mergeRFNodesWithLocalState(prevLocalNodes as never[], rfNodes as never[]);

    expect(result[0]).toMatchObject({
      id: 'a1',
      type: 'annotation-rect',
      width: 120,
      height: 80,
      selected: true,
    });
    expect(result[0].measured).toBeUndefined();
  });

  it('does not inherit measurements for new ids', () => {
    const prevLocalNodes = [
      makeNodeState('n1', {
        measured: { width: 160, height: 90 },
        width: 160,
        height: 90,
        selected: true,
      }),
    ];
    const rfNodes = [
      makeNodeState('n2', {
        position: { x: 20, y: 40 },
        data: { label: 'Fresh' },
      }),
    ];

    const result = mergeRFNodesWithLocalState(prevLocalNodes as never[], rfNodes as never[]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'n2',
      position: { x: 20, y: 40 },
      data: { label: 'Fresh' },
      selected: false,
    });
    expect(result[0].measured).toBeUndefined();
    expect(result[0].width).toBeUndefined();
    expect(result[0].height).toBeUndefined();
  });

  it('drops nodes that are no longer present', () => {
    const prevLocalNodes = [
      makeNodeState('n1', { selected: true }),
      makeNodeState('n2', { selected: false }),
    ];
    const rfNodes = [
      makeNodeState('n2', {
        position: { x: 50, y: 75 },
        data: { label: 'Kept' },
      }),
    ];

    const result = mergeRFNodesWithLocalState(prevLocalNodes as never[], rfNodes as never[]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'n2',
      position: { x: 50, y: 75 },
      data: { label: 'Kept' },
      selected: false,
    });
  });
});

describe('DiagramCanvas', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mocks.useRFNodeEdgeBuilder.mockImplementation(() => ({
      rfNodes: mocks.rfNodes,
      rfEdges: mocks.rfEdges,
      defaultEdgeOptions: mocks.defaultEdgeOptions,
      activeTheme: mocks.activeTheme,
    }));
    mocks.screenToFlowPosition.mockReturnValue({ x: 200, y: 100 });
    mocks.getViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });
    mocks.getInternalNode.mockReturnValue(undefined);
  });

  it('offers to switch routing to fixed when moving an edge anchor in continuous optimize mode', async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({
      addEdge: vi.fn(() => ({ success: false, reason: 'dynamic-edge-move' })),
    });

    render(<DiagramCanvas />);

    await user.click(screen.getByRole('button', { name: 'Trigger connect' }));

    expect(mocks.toast.warning).toHaveBeenCalledWith(
      'Edge anchors can\'t be changed while routing is set to "Optimize Continuously".',
      expect.objectContaining({
        duration: 6000,
        action: expect.objectContaining({ label: 'Switch to Fixed' }),
      }),
    );

    // Execute the action callback
    const call = mocks.toast.warning.mock.calls[0];
    call[1].action.onClick();

    expect(useDiagramStore.getState().diagram.settings.edgeRoutingMode).toBe('fixed');
  });

  it('passes highlight data to useRFNodeEdgeBuilder', () => {
    render(<DiagramCanvas />);

    expect(mocks.useRFNodeEdgeBuilder).toHaveBeenLastCalledWith(
      mocks.highlightSets,
      null,
      mocks.degreesMap,
    );
  });

  it('treats node+edge deletions from separate RF callbacks as a single undo step', async () => {
    const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
    useDiagramStore.getState().addEdge(id1, id2);

    mocks.rfNodes = [
      { id: id1, position: { x: 0, y: 0 }, data: {} } as never,
      { id: id2, position: { x: 0, y: 100 }, data: {} } as never,
    ];
    mocks.rfEdges = [
      { id: 'e1', source: id1, target: id2 } as never,
    ];
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        edges: [{ ...state.diagram.edges[0], id: 'e1' }],
      },
    }));

    render(<DiagramCanvas />);

    fireEvent.click(screen.getByTestId('trigger-edge-remove'));
    fireEvent.click(screen.getByTestId('trigger-node-remove'));

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });

    useDiagramStore.getState().undo();

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
    expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
  });

  it('clears RF selection when requestClearSelection fires', async () => {
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
      { id: 'n2', position: { x: 0, y: 100 }, data: {} } as never,
    ];
    mocks.rfEdges = [
      { id: 'e1', source: 'n1', target: 'n2' } as never,
    ];

    render(<DiagramCanvas />);

    // Programmatically select via store trigger
    useUIStore.getState().selectGraphObject({ kind: 'node', id: 'n1' });

    await waitFor(() => {
      expect(screen.getByTestId('selected-nodes')).toHaveTextContent('n1');
    });

    // Trigger clear selection
    useUIStore.getState().requestClearSelection();

    await waitFor(() => {
      expect(screen.getByTestId('selected-nodes')).toHaveTextContent('');
    });
    expect(screen.getByTestId('selected-edges')).toHaveTextContent('');
  });

  it('does not infinite loop when onSelectionChange fires (regression)', async () => {
    const user = userEvent.setup();
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
      { id: 'n2', position: { x: 0, y: 100 }, data: {} } as never,
    ];
    mocks.rfEdges = [
      { id: 'e1', source: 'n1', target: 'n2' } as never,
    ];

    render(<DiagramCanvas />);

    // Simulate RF firing onSelectionChange (like a drag-select would)
    // This previously caused "Maximum update depth exceeded"
    await user.click(screen.getByTestId('trigger-selection'));

    // If we get here without crashing, the loop is fixed.
    // Verify the store received the selection.
    expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
  });

  it('clears the selected loop when canvas selection changes', async () => {
    const user = userEvent.setup();
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
      { id: 'n2', position: { x: 0, y: 100 }, data: {} } as never,
    ];

    useUIStore.setState({ selectedLoopId: 'loop-1' });

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-selection'));

    expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
    expect(useUIStore.getState().selectedLoopId).toBeNull();
  });

  it('clears the selected loop when the pane is clicked', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ selectedLoopId: 'loop-1' });

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-pane-click'));

    expect(useUIStore.getState().selectedLoopId).toBeNull();
  });

  it('syncs store-driven node and edge selections into React Flow state', async () => {
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
      { id: 'n2', position: { x: 0, y: 100 }, data: {} } as never,
    ];
    mocks.rfEdges = [
      { id: 'e1', source: 'n1', target: 'n2' } as never,
    ];

    render(<DiagramCanvas />);

    useUIStore.getState().selectGraphObject({ kind: 'node', id: 'n2' });
    await waitFor(() => {
      expect(screen.getByTestId('selected-nodes')).toHaveTextContent('n2');
    });
    expect(screen.getByTestId('selected-edges')).toHaveTextContent('');

    useUIStore.getState().selectGraphObject({ kind: 'edge', id: 'e1' });
    await waitFor(() => {
      expect(screen.getByTestId('selected-edges')).toHaveTextContent('e1');
    });
    expect(screen.getByTestId('selected-nodes')).toHaveTextContent('');
  });

  it('refreshes node internals with the latest node ids when edgeRefresh is queued before rerender', () => {
    const rafQueue: Array<{ id: number; callback: FrameRequestCallback }> = [];
    const cancelledIds = new Set<number>();
    let nextFrameId = 1;

    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      rafQueue.push({ id, callback });
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      cancelledIds.add(id);
    }));

    try {
      mocks.rfNodes = [
        { id: 'old-node', position: { x: 0, y: 0 }, data: {} } as never,
      ];

      const { rerender } = render(<DiagramCanvas />);

      act(() => {
        uiEvents.emit('edgeRefresh');
      });

      mocks.rfNodes = [
        { id: 'new-node', position: { x: 100, y: 100 }, data: {} } as never,
      ];

      rerender(<DiagramCanvas />);

      act(() => {
        while (rafQueue.length > 0) {
          const next = rafQueue.shift()!;
          if (!cancelledIds.has(next.id)) {
            next.callback(0);
          }
        }
      });

      expect(mocks.updateNodeInternals).toHaveBeenCalledWith(['new-node']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('recenters on a chat-focused node when it is off-screen and preserves zoom', async () => {
    mocks.rfNodes = [
      { id: 'n1', position: { x: 1400, y: 900 }, data: {} } as never,
    ];
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'n1', type: 'entity', position: { x: 1400, y: 900 }, data: { label: 'Far', tags: [], junctionType: 'or' } },
        ],
        edges: [],
      },
    }));
    mocks.getViewport.mockReturnValue({ x: 0, y: 0, zoom: 1.75 });

    render(<DiagramCanvas />);

    useUIStore.getState().focusGraphObject({ kind: 'node', id: 'n1' });

    await waitFor(() => {
      expect(mocks.setCenter).toHaveBeenCalledWith(
        1400 + 160 / 2,
        900 + 60 / 2,
        { zoom: 1.75 },
      );
    });
  });

  it('does not recenter on a chat-focused node that is already visible', async () => {
    const focusHandler = vi.fn();
    uiEvents.on('viewportFocus', focusHandler);

    mocks.rfNodes = [
      { id: 'n1', position: { x: 120, y: 80 }, data: {} } as never,
    ];
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'n1', type: 'entity', position: { x: 120, y: 80 }, data: { label: 'Near', tags: [], junctionType: 'or' } },
        ],
        edges: [],
      },
    }));

    render(<DiagramCanvas />);

    useUIStore.getState().focusGraphObject({ kind: 'node', id: 'n1' });

    // Confirm the event was emitted, then verify setCenter was not called
    await waitFor(() => {
      expect(focusHandler).toHaveBeenCalledTimes(1);
    });
    expect(mocks.setCenter).not.toHaveBeenCalled();

    uiEvents.off('viewportFocus', focusHandler);
  });

  it('recenters on a chat-focused loop when part of the loop is off-screen', async () => {
    useDiagramStore.getState().setFramework('cld');
    mocks.rfNodes = [
      { id: 'n1', position: { x: 900, y: 100 }, data: {} } as never,
      { id: 'n2', position: { x: 1200, y: 100 }, data: {} } as never,
    ];
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'n1', type: 'entity', position: { x: 900, y: 100 }, data: { label: 'Loop A', tags: [], junctionType: 'or' } },
          { id: 'n2', type: 'entity', position: { x: 1200, y: 100 }, data: { label: 'Loop B', tags: [], junctionType: 'or' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', polarity: 'positive' },
          { id: 'e2', source: 'n2', target: 'n1', polarity: 'positive' },
        ],
      },
    }));

    render(<DiagramCanvas />);

    useUIStore.getState().focusGraphObject({ kind: 'loop', id: 'n1>n2' });

    await waitFor(() => {
      expect(mocks.setCenter).toHaveBeenCalledWith(1130, 130, { zoom: 1 });
    });
  });

  it('keeps a node context menu targeted to the node when pane fallback would also run', async () => {
    const user = userEvent.setup();
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
    ];

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-node-context-menu'));

    expect(useUIStore.getState().contextMenu).toEqual({
      x: 120,
      y: 80,
      nodeId: 'n1',
      edgeId: undefined,
    });
  });

  it('keeps an edge context menu targeted to the edge when pane fallback would also run', async () => {
    const user = userEvent.setup();
    mocks.rfEdges = [
      { id: 'e1', source: 'n1', target: 'n2' } as never,
    ];

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-edge-context-menu'));

    expect(useUIStore.getState().contextMenu).toEqual({
      x: 140,
      y: 90,
      nodeId: undefined,
      edgeId: 'e1',
    });
  });

  it('does not open the canvas menu when the pane handler fires over a node', async () => {
    const user = userEvent.setup();

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-pane-context-menu-over-node'));

    expect(useUIStore.getState().contextMenu).toBeNull();
  });

  it('does not open the canvas menu when the pane handler fires over an edge', async () => {
    const user = userEvent.setup();

    render(<DiagramCanvas />);

    await user.click(screen.getByTestId('trigger-pane-context-menu-over-edge'));

    expect(useUIStore.getState().contextMenu).toBeNull();
  });

  it('creates a node when double-clicking on the canvas pane', () => {
    const addNode = vi.fn();
    useDiagramStore.setState({ addNode });

    render(<DiagramCanvas />);

    fireEvent.doubleClick(screen.getByTestId('trigger-canvas-double-click'), {
      clientX: 320,
      clientY: 180,
    });

    expect(mocks.screenToFlowPosition).toHaveBeenCalledWith({ x: 320, y: 180 });
    expect(addNode).toHaveBeenCalledWith({ x: 200, y: 100 });
  });

  it('does not create a node when double-clicking on a node', () => {
    const addNode = vi.fn();
    useDiagramStore.setState({ addNode });

    render(<DiagramCanvas />);

    fireEvent.doubleClick(screen.getByTestId('trigger-node-double-click'), {
      clientX: 320,
      clientY: 180,
    });

    expect(mocks.screenToFlowPosition).not.toHaveBeenCalled();
    expect(addNode).not.toHaveBeenCalled();
  });

  it('disables React Flow zoom on double click', () => {
    render(<DiagramCanvas />);

    expect(screen.getByTestId('zoom-on-double-click')).toHaveTextContent('false');
  });

  it('disables React Flow node interactions while placing an annotation', () => {
    useUIStore.getState().setPendingAnnotationTool('rect');

    render(<DiagramCanvas />);

    expect(screen.getByTestId('selection-on-drag')).toHaveTextContent('false');
    expect(screen.getByTestId('pan-on-drag')).toHaveTextContent('false');
    expect(screen.getByTestId('nodes-draggable')).toHaveTextContent('false');
    expect(screen.getByTestId('nodes-connectable')).toHaveTextContent('false');
    expect(screen.getByTestId('elements-selectable')).toHaveTextContent('false');
  });

  it('ignores accidental non-empty selection right after creating a node with pane double-click', async () => {
    const user = userEvent.setup();
    const addNode = vi.fn();
    useDiagramStore.setState({ addNode });
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
      { id: 'n2', position: { x: 0, y: 100 }, data: {} } as never,
    ];

    render(<DiagramCanvas />);

    fireEvent.doubleClick(screen.getByTestId('trigger-canvas-double-click'), {
      clientX: 320,
      clientY: 180,
    });
    await user.click(screen.getByTestId('trigger-selection'));

    expect(addNode).toHaveBeenCalledWith({ x: 200, y: 100 });
    expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    expect(screen.getByTestId('selected-nodes')).toHaveTextContent('');
  });

  it('creates a node when double-tapping on the canvas pane with touch', () => {
    vi.useFakeTimers();
    const addNode = vi.fn();
    useDiagramStore.setState({ addNode });

    render(<DiagramCanvas />);

    const pane = screen.getByTestId('trigger-canvas-double-click');

    fireEvent.pointerDown(pane, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 300,
      clientY: 160,
    });
    fireEvent.pointerUp(pane, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 300,
      clientY: 160,
    });
    vi.advanceTimersByTime(120);
    fireEvent.pointerDown(pane, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 302,
      clientY: 162,
    });
    fireEvent.pointerUp(pane, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 302,
      clientY: 162,
    });

    expect(mocks.screenToFlowPosition).toHaveBeenCalledWith({ x: 302, y: 162 });
    expect(addNode).toHaveBeenCalledWith({ x: 200, y: 100 });

    vi.useRealTimers();
  });

  it('opens the node context menu on a touch long press', () => {
    vi.useFakeTimers();
    mocks.rfNodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} } as never,
    ];

    render(<DiagramCanvas />);

    const nodeTarget = screen.getByTestId('trigger-node-double-click');
    fireEvent.pointerDown(nodeTarget, {
      pointerType: 'touch',
      pointerId: 7,
      clientX: 150,
      clientY: 96,
    });
    vi.advanceTimersByTime(600);

    expect(useUIStore.getState().contextMenu).toEqual({
      x: 150,
      y: 96,
      nodeId: 'n1',
      edgeId: undefined,
    });

    fireEvent.pointerUp(nodeTarget, {
      pointerType: 'touch',
      pointerId: 7,
      clientX: 150,
      clientY: 96,
    });
    vi.useRealTimers();
  });
});
