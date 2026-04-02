import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SidePanel from '../SidePanel';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import { useSettingsStore } from '../../../store/settings-store';
import { getWebStorage } from '../../../utils/web-storage';

const rfMocks = vi.hoisted(() => ({
  getInternalNode: vi.fn(() => undefined),
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

function resetStores() {
  getWebStorage('localStorage')?.removeItem('sketchy-settings');
  getWebStorage('sessionStorage')?.removeItem('sketchy_diagram');
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
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
  useSettingsStore.setState({ openaiApiKey: 'sk-test' });
}

describe('SidePanel', () => {
  beforeEach(() => {
    resetStores();
    rfMocks.getInternalNode.mockReset();
    rfMocks.getInternalNode.mockReturnValue(undefined);
  });

  it('shows settings and chat when nothing is selected', () => {
    render(<SidePanel />);

    expect(screen.getByText('Diagram')).toBeInTheDocument();
    expect(screen.getByLabelText('Diagram name')).toBeInTheDocument();
    expect(
      screen.getByText('Ask questions about your diagram or request changes.'),
    ).toBeInTheDocument();
  });

  it('keeps diagram name edits local until blur', async () => {
    const user = userEvent.setup();
    render(<SidePanel />);

    const nameField = screen.getByLabelText('Diagram name');
    const initialName = useDiagramStore.getState().diagram.name;
    await user.clear(nameField);
    await user.type(nameField, 'Systems Map');

    expect(useDiagramStore.getState().diagram.name).toBe(initialName);

    fireEvent.blur(nameField);

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.name).toBe('Systems Map');
    });
  });

  it('renders the node inspector and persists node edits', async () => {
    const user = userEvent.setup();
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });

    useUIStore.setState({ selectedNodeIds: [nodeId], selectedEdgeIds: [] });
    render(<SidePanel />);

    const textField = screen.getByLabelText('Node text');
    await user.clear(textField);
    await user.type(textField, 'Root cause');
    fireEvent.blur(textField);

    await waitFor(() => {
      expect(
        useDiagramStore.getState().diagram.nodes.find((node) => node.id === nodeId)?.data.label,
      ).toBe('Root cause');
    });

    await user.click(screen.getByRole('button', { name: 'Undesirable Effect' }));
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === nodeId)?.data.tags,
    ).toEqual(['ude']);
  });

  it('renders the edge inspector and updates confidence and notes', async () => {
    const user = userEvent.setup();
    const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
    useDiagramStore.getState().updateNodeText(sourceId, 'Source');
    useDiagramStore.getState().updateNodeText(targetId, 'Target');
    useDiagramStore.getState().addEdge(sourceId, targetId);

    const edgeId = useDiagramStore.getState().diagram.edges[0].id;
    useUIStore.setState({ selectedNodeIds: [], selectedEdgeIds: [edgeId] });

    render(<SidePanel />);

    await user.click(screen.getByRole('button', { name: 'Medium' }));
    expect(useDiagramStore.getState().diagram.edges[0].confidence).toBe('medium');

    const notesField = screen.getByLabelText('Edge notes');
    await user.type(notesField, 'Check this link');
    fireEvent.blur(notesField);

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.edges[0].notes).toBe('Check this link');
    });
  });

  it('shows batch controls for multi-selection and deletes all selected nodes', async () => {
    const user = userEvent.setup();
    const nodeA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const nodeB = useDiagramStore.getState().addNode({ x: 100, y: 0 });

    useUIStore.setState({ selectedNodeIds: [nodeA, nodeB], selectedEdgeIds: [] });
    render(<SidePanel />);

    expect(screen.getByText('2 nodes selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete All' }));

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
  });

  it('aligns selected node centers vertically using measured bounds', async () => {
    const user = userEvent.setup();
    const nodeA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const nodeB = useDiagramStore.getState().addNode({ x: 220, y: 100 });
    useUIStore.setState({ selectedNodeIds: [nodeA, nodeB], selectedEdgeIds: [] });
    rfMocks.getInternalNode.mockImplementation((id: string) => {
      if (id === nodeA) return { measured: { width: 100, height: 60 } };
      if (id === nodeB) return { measured: { width: 220, height: 60 } };
      return undefined;
    });

    render(<SidePanel />);
    await user.click(screen.getByRole('button', { name: 'Align vertically' }));

    const nodes = useDiagramStore.getState().diagram.nodes;
    const updatedA = nodes.find((node) => node.id === nodeA)!;
    const updatedB = nodes.find((node) => node.id === nodeB)!;

    expect(updatedA.position.y).toBe(0);
    expect(updatedB.position.y).toBe(100);
    expect(updatedA.position.x + 50).toBeCloseTo(updatedB.position.x + 110);
  });

  it('returns nothing when the side panel is closed', () => {
    useUIStore.setState({ sidePanelOpen: false });

    const { container } = render(<SidePanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('uses a narrower default width on tablet-sized viewports', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 820,
    });

    const { container } = render(<SidePanel />);

    expect(container.querySelector('.side-panel')).toHaveStyle({
      width: '280px',
      minWidth: '280px',
    });
  });

  it('resizes with pointer dragging', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });

    const { container } = render(<SidePanel />);
    const panel = container.querySelector('.side-panel') as HTMLElement;
    const handle = container.querySelector('.side-panel-resize') as HTMLElement;

    fireEvent.pointerDown(handle, { pointerId: 11, clientX: 700 });
    fireEvent.pointerMove(document, { pointerId: 11, clientX: 600 });
    fireEvent.pointerUp(document, { pointerId: 11, clientX: 600 });

    expect(panel.style.width).toBe('420px');
    expect(panel.style.minWidth).toBe('420px');
  });

  it('switches between max, min, and shared chat layouts', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidePanel />);
    const topPanel = container.querySelector('.side-panel-top') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Maximize chat' }));
    expect(useUIStore.getState().chatPanelMode).toBe('max');
    expect(topPanel).toHaveStyle({ display: 'none' });
    expect(screen.getByLabelText('Chat input')).toBeInTheDocument();
    expect(container.querySelector('.side-panel-v-resize')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Minimize chat' }));
    expect(useUIStore.getState().chatPanelMode).toBe('min');
    expect(topPanel.style.display).toBe('');
    expect(topPanel.style.flex).toBe('1 1 0%');
    expect(screen.queryByLabelText('Chat input')).not.toBeInTheDocument();
    expect(container.querySelector('.side-panel-v-resize')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Share chat and info panel' }));
    expect(useUIStore.getState().chatPanelMode).toBe('shared');
    expect(screen.getByLabelText('Chat input')).toBeInTheDocument();
    expect(topPanel.style.height).toBe('40%');
    expect(container.querySelector('.side-panel-v-resize')).not.toBeNull();
  });
});
