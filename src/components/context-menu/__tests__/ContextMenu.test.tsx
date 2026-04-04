import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import ContextMenu from '../ContextMenu';
import { useDiagramStore } from '../../../store/diagram-store';
import { resetRecentColorsForTests } from '../../../store/color-history-store';
import { useUIStore } from '../../../store/ui-store';

function resetStores() {
  resetRecentColorsForTests();
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
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
}

function renderContextMenu() {
  return render(
    <ReactFlowProvider>
      <ContextMenu />
    </ReactFlowProvider>,
  );
}

describe('ContextMenu', () => {
  beforeEach(() => {
    resetStores();
  });

  it('renders nothing when context menu is not open', () => {
    const { container } = renderContextMenu();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Add node" when opened on empty canvas', async () => {
    const user = userEvent.setup();
    useUIStore.setState({
      contextMenu: { x: 100, y: 200, nodeId: undefined, edgeId: undefined },
    });
    renderContextMenu();

    expect(screen.getByText('Add node')).toBeInTheDocument();

    await user.click(screen.getByText('Add node'));
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    expect(useDiagramStore.getState().diagram.nodes[0]?.position).toEqual({ x: 100, y: 200 });
    expect(useUIStore.getState().contextMenu).toBeNull();
  });

  // --- Node context menu ---

  describe('node context menu', () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = useDiagramStore.getState().addNode({ x: 50, y: 50 });
      useUIStore.setState({
        contextMenu: { x: 100, y: 200, nodeId, edgeId: undefined },
      });
    });

    it('shows tag options for CRT framework', () => {
      renderContextMenu();
      expect(screen.getByText('Undesirable Effect')).toBeInTheDocument();
    });

    it('applies a tag', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getByText('Undesirable Effect'));
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.tags,
      ).toEqual(['ude']);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('removes a tag when already applied', async () => {
      const user = userEvent.setup();
      useDiagramStore.getState().updateNodeTags(nodeId, ['ude']);
      renderContextMenu();

      await user.click(screen.getByText('Undesirable Effect'));
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.tags,
      ).toEqual([]);
    });

    it('applies a background color immediately on swatch click', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      const purpleSwatches = screen.getAllByTitle('Purple');
      await user.click(purpleSwatches[0]);

      // Color is applied immediately (live preview)
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.color,
      ).toBe('#8B5CF6');
      expect(purpleSwatches[0]).toHaveAttribute('data-active', 'true');

      // Closing commits the history-tracked update
      fireEvent.pointerDown(document.body);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('applies a custom background color immediately on picker change', () => {
      renderContextMenu();

      fireEvent.change(screen.getByLabelText('Custom background color'), {
        target: { value: '#12abef' },
      });

      // Color is applied immediately (live preview)
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.color,
      ).toBe('#12ABEF');

      fireEvent.pointerDown(document.body);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('applies a text color immediately on swatch click', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      const whiteSwatches = screen.getAllByTitle('White');
      // Second White swatch is in the Text Color row
      await user.click(whiteSwatches[1]);

      // Text color is applied immediately (live preview)
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.textColor,
      ).toBe('#FFFFFF');
    });

    it('applies a custom text color immediately on picker change', () => {
      renderContextMenu();

      fireEvent.change(screen.getByLabelText('Custom text color'), {
        target: { value: '#ab12ef' },
      });

      // Text color is applied immediately (live preview)
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.textColor,
      ).toBe('#AB12EF');
    });

    it('cancels pending color changes on Escape', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getAllByTitle('Green')[0]);
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.color,
      ).toBeUndefined();
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('keeps the menu open while the custom color picker is being activated', () => {
      renderContextMenu();

      const picker = screen.getByLabelText('Custom background color');
      fireEvent.pointerDown(picker);
      fireEvent.pointerDown(document.body);

      expect(useUIStore.getState().contextMenu).not.toBeNull();

      fireEvent.blur(picker);
      fireEvent.pointerDown(document.body);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('toggles node lock', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getByText('Unlocked'));
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.locked,
      ).toBe(true);
    });

    it('deletes the node', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getByText('Delete'));
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('shows junction toggle when node has indegree >= 2', async () => {
      const user = userEvent.setup();
      const sourceA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const sourceB = useDiagramStore.getState().addNode({ x: 100, y: 0 });
      useDiagramStore.getState().addEdge(sourceA, nodeId);
      useDiagramStore.getState().addEdge(sourceB, nodeId);

      // Re-open context menu to pick up new edge state
      useUIStore.setState({
        contextMenu: { x: 100, y: 200, nodeId, edgeId: undefined },
      });
      renderContextMenu();

      const junctionButton = screen.getByText(/Junction:/);
      expect(junctionButton).toBeInTheDocument();
      await user.click(junctionButton);
      expect(
        useDiagramStore.getState().diagram.nodes.find((n) => n.id === nodeId)?.data.junctionType,
      ).toBe('and');
    });

    it('does not show junction toggle when indegree < 2', () => {
      renderContextMenu();
      expect(screen.queryByText(/Junction:/)).not.toBeInTheDocument();
    });
  });

  // --- Edge context menu ---

  describe('edge context menu', () => {
    let edgeId: string;

    beforeEach(() => {
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      edgeId = useDiagramStore.getState().diagram.edges[0].id;
      useUIStore.setState({
        contextMenu: { x: 100, y: 200, nodeId: undefined, edgeId },
      });
    });

    it('shows confidence options', () => {
      renderContextMenu();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('changes edge confidence', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getByText('Low'));
      expect(useDiagramStore.getState().diagram.edges[0].confidence).toBe('low');
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('deletes the edge', async () => {
      const user = userEvent.setup();
      renderContextMenu();

      await user.click(screen.getByText('Delete connection'));
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });

    it('does not show polarity in CRT (non-CLD framework)', () => {
      renderContextMenu();
      expect(screen.queryByText('Polarity')).not.toBeInTheDocument();
      expect(screen.queryByText(/Delay/)).not.toBeInTheDocument();
    });

    it('shows polarity and delay options in CLD framework', async () => {
      const user = userEvent.setup();
      useDiagramStore.getState().setFramework('cld');
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      const cldEdgeId = useDiagramStore.getState().diagram.edges[0].id;

      useUIStore.setState({
        contextMenu: { x: 100, y: 200, nodeId: undefined, edgeId: cldEdgeId },
      });
      renderContextMenu();

      expect(screen.getByText('Polarity')).toBeInTheDocument();
      expect(screen.getByText('Positive (+)')).toBeInTheDocument();
      expect(screen.getByText('Negative (-)')).toBeInTheDocument();

      await user.click(screen.getByText('Negative (-)'));
      expect(useDiagramStore.getState().diagram.edges[0].polarity).toBe('negative');
    });

    it('toggles delay on CLD edge', async () => {
      const user = userEvent.setup();
      useDiagramStore.getState().setFramework('cld');
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      const cldEdgeId = useDiagramStore.getState().diagram.edges[0].id;

      useUIStore.setState({
        contextMenu: { x: 100, y: 200, nodeId: undefined, edgeId: cldEdgeId },
      });
      renderContextMenu();

      await user.click(screen.getByText('Add Delay'));
      expect(useDiagramStore.getState().diagram.edges[0].delay).toBe(true);
    });
  });

  // --- Dismissal ---

  it('closes on Escape key', () => {
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    useUIStore.setState({
      contextMenu: { x: 100, y: 200, nodeId, edgeId: undefined },
    });
    renderContextMenu();

    expect(screen.getByText('Delete')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useUIStore.getState().contextMenu).toBeNull();
  });

  it('closes on outside pointer interaction', () => {
    const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    useUIStore.setState({
      contextMenu: { x: 100, y: 200, nodeId, edgeId: undefined },
    });
    renderContextMenu();

    fireEvent.pointerDown(document.body);
    expect(useUIStore.getState().contextMenu).toBeNull();
  });
});
