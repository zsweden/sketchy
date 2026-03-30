import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import SidePanel from '../SidePanel';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import { useSettingsStore } from '../../../store/settings-store';

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
  useSettingsStore.setState({ openaiApiKey: 'sk-test' });
}

describe('SidePanel', () => {
  beforeEach(() => {
    resetStores();
  });

  it('shows settings and chat when nothing is selected', () => {
    render(<SidePanel />);

    expect(screen.getByText('Diagram')).toBeInTheDocument();
    expect(screen.getByLabelText('Diagram name')).toBeInTheDocument();
    expect(
      screen.getByText('Ask questions about your diagram or request changes.'),
    ).toBeInTheDocument();
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

  it('returns nothing when the side panel is closed', () => {
    useUIStore.setState({ sidePanelOpen: false });

    const { container } = render(<SidePanel />);

    expect(container).toBeEmptyDOMElement();
  });
});
