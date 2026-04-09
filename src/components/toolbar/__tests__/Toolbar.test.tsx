import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toolbar from '../Toolbar';
import { createEmptyDiagram } from '../../../core/types';
import { getOptimizedEdgePlacements } from '../../../store/diagram-helpers';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useSettingsStore, PROVIDERS } from '../../../store/settings-store';
import { useUIStore } from '../../../store/ui-store';
import { uiEvents } from '../../../store/ui-events';
import { getWebStorage } from '../../../utils/web-storage';

const rfMocks = vi.hoisted(() => ({
  getInternalNode: vi.fn(() => undefined),
}));

const mocks = vi.hoisted(() => ({
  runElkAutoLayout: vi.fn(),
  saveSkyFile: vi.fn(),
  loadSkyFile: vi.fn(),
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      getInternalNode: rfMocks.getInternalNode,
    }),
  };
});

vi.mock('../../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: mocks.runElkAutoLayout,
}));

vi.mock('../../../core/persistence/sky-io', () => ({
  saveSkyFile: mocks.saveSkyFile,
  loadSkyFile: mocks.loadSkyFile,
}));

function resetStores() {
  getWebStorage('localStorage')?.removeItem('sketchy-settings');
  getWebStorage('sessionStorage')?.removeItem('sketchy_diagram');
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useChatStore.setState({
    messages: [],
    loading: false,
    streamingContent: '',
    aiModifiedNodeIds: new Set(),
  });
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    contextMenu: null,
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
  useSettingsStore.setState({
    provider: PROVIDERS[0].id,
    openaiApiKey: '',
    baseUrl: PROVIDERS[0].baseUrl,
    model: 'gpt-4o',
    settingsOpen: false,
    availableModels: [],
    modelsLoading: false,
    modelsError: null,
  });
}

describe('Toolbar', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    rfMocks.getInternalNode.mockReset();
    rfMocks.getInternalNode.mockReturnValue(undefined);
    mocks.runElkAutoLayout.mockResolvedValue([]);
    mocks.saveSkyFile.mockResolvedValue(undefined);
  });

  it('creates a new diagram, clears chat state, and requests fit view', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fitViewHandler = vi.fn();
    uiEvents.on('fitView', fitViewHandler);

    const nodeId = useDiagramStore.getState().addNode({ x: 1, y: 2 });
    useDiagramStore.getState().updateNodeText(nodeId, 'Existing');
    useChatStore.setState({
      messages: [{ id: 'm1', role: 'assistant', content: 'Existing chat' }],
      aiModifiedNodeIds: new Set([nodeId]),
    });

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(fitViewHandler).toHaveBeenCalled();

    uiEvents.off('fitView', fitViewHandler);
    confirmSpy.mockRestore();
  });

  it('switches frameworks through the toolbar selector and clears chat state', async () => {
    const user = userEvent.setup();
    useChatStore.setState({
      messages: [{ id: 'm1', role: 'assistant', content: 'Existing chat' }],
      aiModifiedNodeIds: new Set(['n1']),
    });

    render(<Toolbar />);
    await user.selectOptions(screen.getByLabelText('Framework'), 'frt');

    expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
  });

  it('runs auto-layout and stores the resulting node positions', async () => {
    const user = userEvent.setup();
    const fitViewHandler = vi.fn();
    uiEvents.on('fitView', fitViewHandler);
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    mocks.runElkAutoLayout.mockResolvedValue([{ id: nodeId, position: { x: 200, y: 120 } }]);

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Auto-layout' }));

    await waitFor(() => {
      expect(
        useDiagramStore.getState().diagram.nodes.find((node) => node.id === nodeId)?.position,
      ).toEqual({ x: 200, y: 120 });
    });

    expect(fitViewHandler).toHaveBeenCalled();

    uiEvents.off('fitView', fitViewHandler);
  });

  it('hides layout lab controls from the toolbar', () => {
    render(<Toolbar />);

    expect(screen.queryByRole('button', { name: 'Layout lab' })).not.toBeInTheDocument();
  });

  it('runs auto edges once in fixed mode', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
    const edge1Source = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const edge1Target = useDiagramStore.getState().addNode({ x: -200, y: -200 });
    useDiagramStore.getState().addEdge(edge1Source, edge1Target, {
      sourceHandleId: 'source-bottom',
      targetHandleId: 'target-top',
    });
    const edge2Source = useDiagramStore.getState().addNode({ x: -200, y: 0 });
    const edge2Target = useDiagramStore.getState().addNode({ x: 0, y: -200 });
    useDiagramStore.getState().addEdge(edge2Source, edge2Target, {
      sourceHandleId: 'source-top',
      targetHandleId: 'target-bottom',
    });

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Auto edges' }));

    const placements = getOptimizedEdgePlacements(
      useDiagramStore.getState().diagram.edges,
      useDiagramStore.getState().diagram.nodes,
      useDiagramStore.getState().diagram.settings,
    );
    const expected = placements.get(useDiagramStore.getState().diagram.edges[0].id)!;
    const edge = useDiagramStore.getState().diagram.edges[0];
    expect(edge.sourceSide).toBe(expected.sourceSide);
    expect(edge.targetSide).toBe(expected.targetSide);
  });

  it('disables auto edges in continuous optimize mode', () => {
    useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });

    render(<Toolbar />);

    expect(screen.getByRole('button', { name: 'Auto edges' })).toBeDisabled();
  });

  it('aligns selected node centers horizontally using measured bounds', async () => {
    const user = userEvent.setup();
    const nodeA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const nodeB = useDiagramStore.getState().addNode({ x: 220, y: 120 });
    useUIStore.setState({ selectedNodeIds: [nodeA, nodeB], selectedEdgeIds: [] });
    rfMocks.getInternalNode.mockImplementation((id: string) => {
      if (id === nodeA) return { measured: { width: 160, height: 60 } };
      if (id === nodeB) return { measured: { width: 160, height: 120 } };
      return undefined;
    });

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Align horizontally' }));

    const nodes = useDiagramStore.getState().diagram.nodes;
    const updatedA = nodes.find((node) => node.id === nodeA)!;
    const updatedB = nodes.find((node) => node.id === nodeB)!;

    expect(updatedA.position.x).toBe(0);
    expect(updatedB.position.x).toBe(220);
    expect(updatedA.position.y + 30).toBeCloseTo(updatedB.position.y + 60);
  });

  it('loads a project file, clears chat history, and surfaces warnings', async () => {
    const user = userEvent.setup();
    const loadedDiagram = {
      ...createEmptyDiagram('frt'),
      name: 'Imported',
      nodes: [
        {
          id: 'n-imported',
          type: 'entity' as const,
          position: { x: 10, y: 20 },
          data: { label: 'Imported node', tags: ['injection'], junctionType: 'or' as const },
        },
      ],
      edges: [],
    };

    useChatStore.setState({
      messages: [{ id: 'm1', role: 'assistant', content: 'Stale chat' }],
      aiModifiedNodeIds: new Set(['n-imported']),
    });
    mocks.loadSkyFile.mockResolvedValue({
      diagram: loadedDiagram,
      warnings: ['Imported file had one invalid connection removed.'],
      needsLayout: false,
    });

    const { container } = render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Load' }));

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(['{}'], 'diagram.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.name).toBe('Imported');
    });

    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(mocks.toast.warning).toHaveBeenCalledWith(
      'Imported file had one invalid connection removed.',
    );
  });

  it('confirms before opening the file picker when the diagram has work', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    const nodeId = useDiagramStore.getState().addNode({ x: 1, y: 2 });
    useDiagramStore.getState().updateNodeText(nodeId, 'Existing');

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Load a project? The current in-memory session will be replaced.',
    );
    expect(inputClickSpy).not.toHaveBeenCalled();

    inputClickSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('opens the file picker without confirmation when the diagram is empty', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    inputClickSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('shows save errors and toggles settings and the side panel', async () => {
    const user = userEvent.setup();
    mocks.saveSkyFile.mockRejectedValue(new Error('save failed'));

    render(<Toolbar />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith(
        'Failed to save the project. Try again.',
      );
    });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(useSettingsStore.getState().settingsOpen).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Toggle side panel' }));
    expect(useUIStore.getState().sidePanelOpen).toBe(false);
  });

});
