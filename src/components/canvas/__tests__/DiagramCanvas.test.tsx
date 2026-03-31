import { render, screen, waitFor } from '@testing-library/react';
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
}));

vi.mock('../EntityNode', () => ({
  default: () => null,
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onConnect, onSelectionChange }: {
    nodes: Array<{ id: string; selected?: boolean }>;
    edges: Array<{ id: string; selected?: boolean }>;
    onConnect: (connection: {
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }) => void;
    onSelectionChange?: (params: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> }) => void;
  }) => (
    <div>
      <div data-testid="selected-nodes">{nodes.filter((node) => node.selected).map((node) => node.id).join(',')}</div>
      <div data-testid="selected-edges">{edges.filter((edge) => edge.selected).map((edge) => edge.id).join(',')}</div>
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
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' },
  useReactFlow: () => ({
    screenToFlowPosition: vi.fn(),
    fitView: vi.fn(),
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
});
