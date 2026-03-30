import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import NodePanel from '../NodePanel';
import { useDiagramStore } from '../../../store/diagram-store';
import { useChatStore } from '../../../store/chat-store';
import { useUIStore } from '../../../store/ui-store';
import type { DiagramNode } from '../../../core/types';

function resetStores() {
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
    selectedLoopId: null,
    contextMenu: null,
    toasts: [],
    sidePanelOpen: true,
    interactionMode: 'select',
    fitViewTrigger: 0,
  });
}

function getNode(id: string): DiagramNode {
  return useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
}

describe('NodePanel', () => {
  let nodeId: string;

  beforeEach(() => {
    resetStores();
    nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
  });

  it('renders node text and allows editing', async () => {
    const user = userEvent.setup();
    render(<NodePanel node={getNode(nodeId)} />);

    const textField = screen.getByLabelText('Node text');
    await user.clear(textField);
    await user.type(textField, 'Updated text');
    fireEvent.blur(textField);

    await waitFor(() => {
      expect(getNode(nodeId).data.label).toBe('Updated text');
    });
  });

  it('commits text on Enter key', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().updateNodeText(nodeId, 'Original');
    render(<NodePanel node={getNode(nodeId)} />);

    const textField = screen.getByLabelText('Node text');
    await user.clear(textField);
    await user.type(textField, 'Pressed Enter{Enter}');

    await waitFor(() => {
      expect(getNode(nodeId).data.label).toBe('Pressed Enter');
    });
  });

  it('renders and updates notes', async () => {
    const user = userEvent.setup();
    render(<NodePanel node={getNode(nodeId)} />);

    const notesField = screen.getByLabelText('Node notes');
    await user.type(notesField, 'Some notes');
    fireEvent.blur(notesField);

    await waitFor(() => {
      expect(getNode(nodeId).data.notes).toBe('Some notes');
    });
  });

  it('applies a tag', async () => {
    const user = userEvent.setup();
    render(<NodePanel node={getNode(nodeId)} />);

    await user.click(screen.getByRole('button', { name: 'Undesirable Effect' }));
    expect(getNode(nodeId).data.tags).toEqual(['ude']);
  });

  it('removes a tag when already applied', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().updateNodeTags(nodeId, ['ude']);
    render(<NodePanel node={getNode(nodeId)} />);

    await user.click(screen.getByRole('button', { name: 'Undesirable Effect' }));
    expect(getNode(nodeId).data.tags).toEqual([]);
  });

  it('locks a node', async () => {
    const user = userEvent.setup();
    render(<NodePanel node={getNode(nodeId)} />);

    await user.click(screen.getByText('Unlocked'));
    expect(getNode(nodeId).data.locked).toBe(true);
  });

  it('unlocks a locked node', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().toggleNodeLocked([nodeId], true);
    render(<NodePanel node={getNode(nodeId)} />);

    await user.click(screen.getByText('Locked'));
    expect(getNode(nodeId).data.locked).toBeFalsy();
  });

  it('shows junction controls when indegree >= 2', async () => {
    const sourceA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const sourceB = useDiagramStore.getState().addNode({ x: 100, y: 0 });
    useDiagramStore.getState().addEdge(sourceA, nodeId);
    useDiagramStore.getState().addEdge(sourceB, nodeId);

    render(<NodePanel node={getNode(nodeId)} />);
    expect(screen.getByText('Junction Logic')).toBeInTheDocument();
    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('does not show junction controls when indegree < 2', () => {
    render(<NodePanel node={getNode(nodeId)} />);
    expect(screen.queryByText('Junction Logic')).not.toBeInTheDocument();
  });

  it('shows derived indicators for root cause node', () => {
    // Node with no incoming edges in CRT = root cause
    render(<NodePanel node={getNode(nodeId)} />);
    expect(screen.getByText('Derived Properties')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('clears AI-modified indicator when node is viewed', () => {
    useChatStore.setState({ aiModifiedNodeIds: new Set([nodeId]) });
    render(<NodePanel node={getNode(nodeId)} />);

    expect(useChatStore.getState().aiModifiedNodeIds.has(nodeId)).toBe(false);
  });
});
