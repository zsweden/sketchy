import { render, screen } from '@testing-library/react';
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
  ReactFlow: ({ onConnect }: { onConnect: (connection: {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }) => void }) => (
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
});
