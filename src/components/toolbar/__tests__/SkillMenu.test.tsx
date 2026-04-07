import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkillMenu from '../SkillMenu';
import { useDiagramStore } from '../../../store/diagram-store';
import { useChatStore } from '../../../store/chat-store';
import { useUIStore } from '../../../store/ui-store';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      getInternalNode: vi.fn(() => undefined),
    }),
  };
});

function resetStores() {
  useDiagramStore.getState().setFramework('value-stream');
  useDiagramStore.getState().newDiagram();
  useChatStore.setState({
    messages: [],
    loading: false,
    streamingContent: '',
    aiModifiedNodeIds: new Set(),
  });
  useUIStore.setState({ chatPanelMode: 'shared' });
}

describe('SkillMenu', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('prepends diagram snapshot when skill switches frameworks', () => {
    // Add nodes to the VSM diagram before running the skill
    useDiagramStore.getState().addNode({ x: 0, y: 0 });
    useDiagramStore.getState().updateNodeText(
      useDiagramStore.getState().diagram.nodes[0].id,
      'Order Received',
    );

    const sendSpy = vi.spyOn(useChatStore.getState(), 'sendMessage');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SkillMenu />);

    // Open menu and click the skill
    fireEvent.click(screen.getByLabelText('Skills'));
    fireEvent.click(screen.getByText(/Create Team Topology/));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [message] = sendSpy.mock.calls[0];
    expect(message).toContain('SOURCE DIAGRAM');
    expect(message).toContain('Order Received');
    // Framework should have switched to team-topology
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('team-topology');
  });

  it('cancels framework switch when user declines confirm', () => {
    const sendSpy = vi.spyOn(useChatStore.getState(), 'sendMessage');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SkillMenu />);

    fireEvent.click(screen.getByLabelText('Skills'));
    fireEvent.click(screen.getByText(/Create Team Topology/));

    expect(sendSpy).not.toHaveBeenCalled();
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('value-stream');
  });

  it('does not prepend snapshot for same-framework skills', () => {
    // Switch to CRT which has the crt-best-practices skill (no endingFramework)
    useDiagramStore.getState().setFramework('crt');

    const sendSpy = vi.spyOn(useChatStore.getState(), 'sendMessage');

    render(<SkillMenu />);

    fireEvent.click(screen.getByLabelText('Skills'));
    fireEvent.click(screen.getByText('Best Practices Review'));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [message] = sendSpy.mock.calls[0];
    expect(message).not.toContain('SOURCE DIAGRAM');
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('crt');
  });
});
