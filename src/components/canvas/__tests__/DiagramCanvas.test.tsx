import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiagramCanvas from '../DiagramCanvas';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';

const mocks = vi.hoisted(() => ({
  degreesMap: new Map(),
  highlightSets: { nodes: new Set<string>(), edges: new Set<string>() },
  rfNodes: [] as never[],
  rfEdges: [] as never[],
  defaultEdgeOptions: {},
  activeTheme: { js: { minimapFallback: '#999' } },
  screenToFlowPosition: vi.fn(() => ({ x: 200, y: 100 })),
  fitView: vi.fn(),
}));

vi.mock('../EntityNode', () => ({
  default: () => null,
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onConnect, onSelectionChange, onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu }: {
    nodes: Array<{ id: string; selected?: boolean }>;
    edges: Array<{ id: string; selected?: boolean }>;
    onConnect: (connection: {
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }) => void;
    onSelectionChange?: (params: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> }) => void;
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
  }) => (
    <div>
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
        <div className="react-flow__node">
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
  }),
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
  useRFNodeEdgeBuilder: () => ({
    rfNodes: mocks.rfNodes,
    rfEdges: mocks.rfEdges,
    defaultEdgeOptions: mocks.defaultEdgeOptions,
    activeTheme: mocks.activeTheme,
  }),
}));

function resetStores() {
  window.sessionStorage?.removeItem?.('sketchy_diagram');
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    toasts: [],
    sidePanelOpen: true,
    interactionMode: 'select',
    fitViewTrigger: 0,
    clearSelectionTrigger: 0,
  });
}

describe('DiagramCanvas', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mocks.screenToFlowPosition.mockReturnValue({ x: 200, y: 100 });
  });

  it('offers to switch routing to fixed when moving an edge anchor in continuous optimize mode', async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({
      addEdge: vi.fn(() => ({ success: false, reason: 'dynamic-edge-move' })),
    });

    render(<DiagramCanvas />);

    await user.click(screen.getByRole('button', { name: 'Trigger connect' }));

    const [toast] = useUIStore.getState().toasts;
    expect(toast).toEqual(expect.objectContaining({
      message: 'Edge anchors can\'t be changed while routing is set to "Optimize Continuously".',
      type: 'warning',
      action: expect.objectContaining({ label: 'Switch to Fixed' }),
    }));

    toast.action?.onClick();

    expect(useDiagramStore.getState().diagram.settings.edgeRoutingMode).toBe('fixed');
  });

  it('clears RF selection when clearSelectionTrigger fires', async () => {
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
});
