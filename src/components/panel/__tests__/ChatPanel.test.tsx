import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from '../ChatPanel';
import { findCausalLoops, labelCausalLoops } from '../../../core/graph/derived';
import { useChatStore } from '../../../store/chat-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { resolveFramework } from '../../../store/diagram-helpers';
import { useSettingsStore } from '../../../store/settings-store';
import { useUIStore } from '../../../store/ui-store';
import { buildChatMessageRenderData } from '../../../core/chat/mentions';

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
    chatPanelMode: 'shared',
    interactionMode: 'select',
    fitViewTrigger: 0,
    clearSelectionTrigger: 0,
    selectionSyncTrigger: 0,
    viewportFocusTarget: null,
    viewportFocusTrigger: 0,
  });
}

function createAssistantMessage(id: string, content: string) {
  const { diagram } = useDiagramStore.getState();
  const framework = resolveFramework(diagram.frameworkId);
  const loops = framework.allowsCycles ? labelCausalLoops(findCausalLoops(diagram.edges)) : [];
  const renderData = buildChatMessageRenderData(content, diagram.nodes, diagram.edges, loops);

  return {
    id,
    role: 'assistant' as const,
    content: renderData.normalizedText,
    displayText: renderData.displayText,
    segments: renderData.segments,
  };
}

describe('ChatPanel', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('renders the empty state by default', () => {
    render(<ChatPanel />);

    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument();
    expect(
      screen.getByText('Ask questions about your diagram or request changes.'),
    ).toBeInTheDocument();
  });

  it('updates the chat panel mode from the header controls', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Maximize chat' }));
    expect(useUIStore.getState().chatPanelMode).toBe('max');

    await user.click(screen.getByRole('button', { name: 'Minimize chat' }));
    expect(useUIStore.getState().chatPanelMode).toBe('min');

    await user.click(screen.getByRole('button', { name: 'Share chat and info panel' }));
    expect(useUIStore.getState().chatPanelMode).toBe('shared');
  });

  it('collapses chat content when minimized', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Minimize chat' }));

    expect(screen.queryByLabelText('Chat input')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Ask questions about your diagram or request changes.'),
    ).not.toBeInTheDocument();
  });

  it('sends the current prompt on Enter', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    render(<ChatPanel />);

    const input = screen.getByLabelText('Chat input');
    await user.type(input, 'Explain this flow');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(sendMessage).toHaveBeenCalledWith('Explain this flow', undefined, undefined, undefined);
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
      undefined, undefined, undefined,
    );
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('file body'), undefined, undefined, undefined);
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Summarize this'), undefined, undefined, undefined);
  });

  it('attaches a PDF and sends it as a document', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    const { container } = render(<ChatPanel />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    // Simulate selecting a PDF — FileReader will base64-encode it
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header
    const pdfFile = new File([pdfBytes], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput!, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Chat input');
    await user.type(input, 'Analyze this');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('[Attached PDF: report.pdf]'),
      undefined,
      undefined,
      expect.objectContaining({ filename: 'report.pdf', mediaType: 'application/pdf' }),
    );
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

  it('retries the failed user prompt from an assistant error bubble', async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();

    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: 'Explain this flow' },
        { id: 'a1', role: 'assistant', content: 'Error: network error', retryText: 'Explain this flow' },
      ],
      sendMessage,
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Retry message' }));
    expect(sendMessage).toHaveBeenCalledWith('Explain this flow');
  });

  it('renders clickable node, edge, and loop mentions and selects them', async () => {
    const user = userEvent.setup();

    useChatStore.setState({
      messages: [
        createAssistantMessage(
          'a1',
          '[Demand][node:n1] reinforces [Demand -> Growth][edge:e1] through [R1][loop:n1>n2].',
        ),
      ],
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Demand' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
    expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    expect(useUIStore.getState().selectedLoopId).toBeNull();
    expect(useUIStore.getState().viewportFocusTarget).toEqual({ kind: 'node', id: 'n1' });

    await user.click(screen.getByRole('button', { name: 'Demand -> Growth' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1']);
    expect(useUIStore.getState().selectedLoopId).toBeNull();
    expect(useUIStore.getState().viewportFocusTarget).toEqual({ kind: 'edge', id: 'e1' });

    await user.click(screen.getByRole('button', { name: 'R1' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    expect(useUIStore.getState().selectedLoopId).toBe('n1>n2');
    expect(useUIStore.getState().viewportFocusTarget).toEqual({ kind: 'loop', id: 'n1>n2' });
    expect(useUIStore.getState().viewportFocusTrigger).toBe(3);
  });

  it('renders empty node mentions with a node fallback label', async () => {
    const user = userEvent.setup();

    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          ...state.diagram.nodes,
          { id: 'n3', type: 'entity', position: { x: 0, y: 200 }, data: { label: '', tags: [], junctionType: 'or' } },
        ],
      },
    }));

    useChatStore.setState({
      messages: [
        createAssistantMessage('a1', 'There is one [][node:n3].'),
      ],
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'node' }));
    expect(useUIStore.getState().selectedNodeIds).toEqual(['n3']);
    expect(useUIStore.getState().viewportFocusTarget).toEqual({ kind: 'node', id: 'n3' });
    expect(screen.queryByText('There is one [][node:n3].')).not.toBeInTheDocument();
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

  it('copies rendered assistant text instead of canonical mention markup', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    useChatStore.setState({
      messages: [
        createAssistantMessage(
          'a1',
          '[Demand][node:n1] reinforces [Demand -> Growth][edge:e1] through [R1][loop:n1>n2].',
        ),
      ],
    });

    render(<ChatPanel />);

    await user.click(screen.getByRole('button', { name: 'Copy response' }));

    expect(writeText).toHaveBeenCalledWith('Demand reinforces Demand -> Growth through R1.');
  });

  it('keeps prior assistant mentions visible after the diagram changes', () => {
    useChatStore.setState({
      messages: [
        createAssistantMessage('a1', '[Demand][node:n1] matters here.'),
      ],
    });

    render(<ChatPanel />);

    expect(screen.getByRole('button', { name: 'Demand' })).toBeInTheDocument();

    act(() => {
      useDiagramStore.setState((state) => ({
        diagram: {
          ...state.diagram,
          nodes: state.diagram.nodes.filter((node) => node.id !== 'n1'),
          edges: state.diagram.edges.filter((edge) => edge.source !== 'n1' && edge.target !== 'n1'),
        },
      }));
    });

    expect(screen.getByRole('button', { name: 'Demand' })).toBeInTheDocument();
    expect(screen.queryByText('[Demand][node:n1] matters here.')).not.toBeInTheDocument();
  });

  it('renders streaming assistant content without raw canonical mention syntax', () => {
    useChatStore.setState({
      loading: true,
      streamingContent: 'Added [Demand][node:n1] through [R1][loop:n1>n2].',
    });

    render(<ChatPanel />);

    expect(screen.getByText('Added Demand through R1.')).toBeInTheDocument();
    expect(screen.queryByText('Added [Demand][node:n1] through [R1][loop:n1>n2].')).not.toBeInTheDocument();
  });
});
