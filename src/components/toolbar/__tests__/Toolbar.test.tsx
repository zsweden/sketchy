import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toolbar from '../Toolbar';
import { createEmptyDiagram } from '../../../core/types';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useSettingsStore, PROVIDERS } from '../../../store/settings-store';
import { useUIStore } from '../../../store/ui-store';

const mocks = vi.hoisted(() => ({
  autoLayout: vi.fn(),
  saveSkyFile: vi.fn(),
  loadSkyFile: vi.fn(),
  elkEngine: vi.fn(),
}));

vi.mock('../../../core/layout', () => ({
  autoLayout: mocks.autoLayout,
  elkEngine: mocks.elkEngine,
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
    mocks.autoLayout.mockResolvedValue([]);
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
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    expect(useUIStore.getState().fitViewTrigger).toBe(1);

    confirmSpy.mockRestore();
  });

  it('switches frameworks through the toolbar selector', async () => {
    const user = userEvent.setup();

    render(<Toolbar />);
    await user.selectOptions(screen.getByLabelText('Framework'), 'frt');

    expect(useDiagramStore.getState().framework.id).toBe('frt');
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');
  });

  it('runs auto-layout and stores the resulting node positions', async () => {
    const user = userEvent.setup();
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    mocks.autoLayout.mockResolvedValue([{ id: nodeId, position: { x: 200, y: 120 } }]);

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

    const edge = useDiagramStore.getState().diagram.edges[0];
    expect(edge.sourceSide).toBe('right');
    expect(edge.targetSide).toBe('right');
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
});
