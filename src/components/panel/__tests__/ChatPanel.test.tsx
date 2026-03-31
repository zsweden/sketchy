import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from '../ChatPanel';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useSettingsStore } from '../../../store/settings-store';
import { useUIStore } from '../../../store/ui-store';

function resetStore() {
  useChatStore.setState({
    messages: [],
    loading: false,
    streamingContent: '',
    aiModifiedNodeIds: new Set(),
    sendMessage: useChatStore.getState().sendMessage,
    cancelStream: useChatStore.getState().cancelStream,
    clearMessages: useChatStore.getState().clearMessages,
    clearAiModified: useChatStore.getState().clearAiModified,
    removeAiModified: useChatStore.getState().removeAiModified,
  });
  // Set a dummy API key so ChatPanel shows the normal empty state
  useSettingsStore.setState({ openaiApiKey: 'sk-test', model: 'gpt-4.1-mini' });
  useDiagramStore.getState().setFramework('cld');
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: [
        { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
        { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Growth', tags: [], junctionType: 'or' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', polarity: 'positive' },
        { id: 'e2', source: 'n2', target: 'n1', polarity: 'positive' },
      ],
    },
  }));
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

describe('ChatPanel', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('renders the empty state by default', () => {
    render(<ChatPanel />);

    expect(screen.getByText('AI Chat')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument();
    expect(
      screen.getByText('Ask questions about your diagram or request changes.'),
    ).toBeInTheDocument();
  });

  it('sends the current prompt on Enter', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    render(<ChatPanel />);

    const input = screen.getByLabelText('Chat input');
    await user.type(input, 'Explain this flow');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(sendMessage).toHaveBeenCalledWith('Explain this flow');
  });

  it('cycles through prompt history with arrow keys', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    render(<ChatPanel />);

    const input = screen.getByLabelText('Chat input');
    await user.type(input, 'First prompt');
    fireEvent.keyDown(input, { key: 'Enter' });
    await user.type(input, 'Second prompt');
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('Second prompt');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('First prompt');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('Second prompt');
  });

  it('includes attached file contents in the outgoing message', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    const { container } = render(<ChatPanel />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['file body'], 'notes.txt', { type: 'text/plain' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Chat input');
    await user.type(input, 'Summarize this');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('[Attached file: notes.txt]'),
    );
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('file body'));
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Summarize this'));
  });

  it('shows stop and clear actions when chat is active', async () => {
    const user = userEvent.setup();
    const cancelStream = vi.fn();
    const clearMessages = vi.fn();

    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: 'Hello' },
        { id: 'a1', role: 'assistant', content: 'Hi there' },
      ],
      loading: true,
      streamingContent: '',
      cancelStream,
      clearMessages,
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(clearMessages).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(cancelStream).toHaveBeenCalledTimes(1);
  });

  it('renders clickable node, edge, and loop mentions and selects them', async () => {
    const user = userEvent.setup();

    useChatStore.setState({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          content: '[Demand][node:n1] reinforces [Demand -> Growth][edge:e1] through [R1][loop:n1>n2].',
        },
      ],
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Demand' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
    expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    expect(useUIStore.getState().selectedLoopId).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Demand -> Growth' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1']);
    expect(useUIStore.getState().selectedLoopId).toBeNull();

    await user.click(screen.getByRole('button', { name: 'R1' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    expect(useUIStore.getState().selectedLoopId).toBe('n1>n2');
  });

  it('renders legacy inline syntax as plain text instead of clickable mentions', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          content: 'Demand[node:n1] reinforces Demand -> Growth[edge:e1].',
        },
      ],
    });

    render(<ChatPanel />);

    expect(screen.queryByRole('button', { name: 'Demand' })).not.toBeInTheDocument();
    expect(screen.getByText('Demand[node:n1] reinforces Demand -> Growth[edge:e1].')).toBeInTheDocument();
  });
});
