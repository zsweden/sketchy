import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from '../ChatPanel';
import { useChatStore } from '../../../store/chat-store';
import { useSettingsStore } from '../../../store/settings-store';

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
});
