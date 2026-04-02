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

const mocks = vi.hoisted(() => ({
  runElkAutoLayout: vi.fn(),
  saveSkyFile: vi.fn(),
  loadSkyFile: vi.fn(),
}));

vi.mock('../../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: mocks.runElkAutoLayout,
}));

vi.mock('../../../core/persistence/sky-io', () => ({
  saveSkyFile: mocks.saveSkyFile,
  loadSkyFile: mocks.loadSkyFile,
}));

function resetStores() {
  window.localStorage?.removeItem?.('sketchy-settings');
  window.sessionStorage?.removeItem?.('sketchy_diagram');
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
    toasts: [],
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
    fitViewTrigger: 0,
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
    mocks.runElkAutoLayout.mockResolvedValue([]);
    mocks.saveSkyFile.mockResolvedValue(undefined);
  });

  it('creates a new diagram, clears chat state, and requests fit view', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const nodeId = useDiagramStore.getState().addNode({ x: 1, y: 2 });
    useDiagramStore.getState().updateNodeText(nodeId, 'Existing');
    useChatStore.setState({
      messages: [{ id: 'm1', role: 'assistant', content: 'Existing chat' }],
      aiModifiedNodeIds: new Set([nodeId]),
    });

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(useUIStore.getState().fitViewTrigger).toBe(1);

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

    expect(useDiagramStore.getState().framework.id).toBe('frt');
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
  });

  it('runs auto-layout and stores the resulting node positions', async () => {
    const user = userEvent.setup();
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    mocks.runElkAutoLayout.mockResolvedValue([{ id: nodeId, position: { x: 200, y: 120 } }]);

    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Auto-layout' }));

    await waitFor(() => {
      expect(
        useDiagramStore.getState().diagram.nodes.find((node) => node.id === nodeId)?.position,
      ).toEqual({ x: 200, y: 120 });
    });

    expect(useUIStore.getState().fitViewTrigger).toBe(1);
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
        files: [new File(['{}'], 'diagram.sky', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.name).toBe('Imported');
    });

    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(useUIStore.getState().toasts).toContainEqual(
      expect.objectContaining({
        message: 'Imported file had one invalid connection removed.',
        type: 'warning',
      }),
    );
  });

  it('shows save errors and toggles settings and the side panel', async () => {
    const user = userEvent.setup();
    mocks.saveSkyFile.mockRejectedValue(new Error('save failed'));

    render(<Toolbar />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(useUIStore.getState().toasts).toContainEqual(
        expect.objectContaining({
          message: 'Failed to save the project. Try again.',
          type: 'error',
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(useSettingsStore.getState().settingsOpen).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Toggle side panel' }));
    expect(useUIStore.getState().sidePanelOpen).toBe(false);
  });

  it('derives the next document, clears chat state, and requests fit view', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const cause = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const effect = useDiagramStore.getState().addNode({ x: 0, y: 100 });
    useDiagramStore.getState().updateNodeText(cause, 'Root cause');
    useDiagramStore.getState().updateNodeText(effect, 'Churn increases');
    useDiagramStore.getState().updateNodeTags(effect, ['ude']);
    useDiagramStore.getState().addEdge(cause, effect);
    useChatStore.setState({
      messages: [{ id: 'm1', role: 'assistant', content: 'Old chat' }],
      aiModifiedNodeIds: new Set([cause]),
    });
    mocks.runElkAutoLayout.mockResolvedValue([
      { id: cause, position: { x: 140, y: 40 } },
      { id: effect, position: { x: 140, y: 180 } },
    ]);

    render(<Toolbar />);

    expect(screen.getByRole('button', { name: 'to FRT' })).toHaveAttribute(
      'title',
      'Create FRT draft from current CRT',
    );

    await user.click(screen.getByRole('button', { name: 'to FRT' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');
    });
    expect(useDiagramStore.getState().diagram.name).toBe('Untitled Diagram_FRT');
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(useUIStore.getState().fitViewTrigger).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.saveSkyFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Untitled Diagram_FRT' }),
    );

    confirmSpy.mockRestore();
  });

  it('shows the next document button from the active framework even if diagram metadata is stale', () => {
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        frameworkId: 'stt',
      },
    }));

    render(<Toolbar />);

    expect(screen.getByRole('button', { name: 'to FRT' })).toHaveAttribute(
      'title',
      'Create FRT draft from current CRT',
    );
  });

  it('hides next document when there is no canonical transition', () => {
    useDiagramStore.getState().setFramework('stt');

    render(<Toolbar />);

    expect(screen.queryByRole('button', { name: /^to /i })).not.toBeInTheDocument();
  });
});
