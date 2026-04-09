import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import SettingsPanel from '../SettingsPanel';
import { findCausalLoops, labelCausalLoops } from '../../../core/graph/derived';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';

function resetStores() {
  useDiagramStore.getState().setFramework('cld');
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    toasts: [],
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
}

function buildReinforcingLoop() {
  const store = useDiagramStore.getState();
  const a = store.addNode({ x: 0, y: 0 });
  const b = store.addNode({ x: 150, y: 0 });
  const c = store.addNode({ x: 300, y: 0 });

  store.updateNodeText(a, 'Demand');
  store.updateNodeText(b, 'Capacity');
  store.updateNodeText(c, 'Growth');

  store.addEdge(a, b);
  store.addEdge(b, c);
  store.addEdge(c, a);

  const [loop] = labelCausalLoops(findCausalLoops(useDiagramStore.getState().diagram.edges));
  return { loopId: loop.id };
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    resetStores();
  });

  it('shows the current diagram type', () => {
    render(<SettingsPanel />);

    expect(screen.getByText('TYPE')).toBeInTheDocument();
    expect(screen.getByText('Causal Loop Diagram')).toBeInTheDocument();
  });

  it('shows loop summary badges and toggles loop selection', async () => {
    const user = userEvent.setup();
    const { loopId } = buildReinforcingLoop();

    render(<SettingsPanel />);

    expect(screen.getByText('Feedback Loops')).toBeInTheDocument();
    expect(screen.getByText('1 Total')).toBeInTheDocument();
    expect(screen.getByText('1 Reinforcing')).toBeInTheDocument();
    expect(screen.getByText('0 Balancing')).toBeInTheDocument();

    const loopButton = screen.getByRole('button', { name: /R1/i });
    expect(loopButton).toHaveAttribute('aria-pressed', 'false');
    expect(loopButton).toHaveTextContent('Demand');
    expect(loopButton).toHaveTextContent('Capacity');
    expect(loopButton).toHaveTextContent('Growth');

    await user.click(loopButton);

    expect(useUIStore.getState().selectedLoopId).toBe(loopId);
    expect(loopButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(loopButton);

    expect(useUIStore.getState().selectedLoopId).toBeNull();
    expect(loopButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears a stale selected loop when the loop disappears', async () => {
    const { loopId } = buildReinforcingLoop();
    const edgeId = useDiagramStore.getState().diagram.edges[0].id;

    useUIStore.setState({ selectedLoopId: loopId });

    render(<SettingsPanel />);

    expect(screen.getByRole('button', { name: /R1/i })).toHaveAttribute('aria-pressed', 'true');

    act(() => {
      useDiagramStore.getState().batchApply({ removeEdgeIds: [edgeId] });
    });

    await waitFor(() => {
      expect(useUIStore.getState().selectedLoopId).toBeNull();
    });

    expect(screen.getByText('No feedback loops detected yet.')).toBeInTheDocument();
  });
});
