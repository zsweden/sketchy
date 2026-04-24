import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MultiNodePanel from '../MultiNodePanel';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import { resetRecentColorsForTests } from '../../../store/color-history-store';

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
  resetRecentColorsForTests();
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [], edges: [] } }));
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    contextMenu: null,
    sidePanelOpen: true,
  });
}

function addTwoNodes() {
  const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
  const id2 = useDiagramStore.getState().addNode({ x: 100, y: 0 });
  return [id1, id2];
}

function getSelectedNodes(ids: string[]) {
  const nodes = useDiagramStore.getState().diagram.nodes;
  return nodes.filter((n) => ids.includes(n.id));
}

describe('MultiNodePanel', () => {
  beforeEach(() => {
    resetStores();
  });

  it('renders header with the selection count', () => {
    const ids = addTwoNodes();
    render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
    expect(screen.getByText('2 nodes selected')).toBeInTheDocument();
  });

  describe('Tags', () => {
    it('shows an Add and Remove button per framework tag', () => {
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      expect(screen.getByRole('button', { name: /Add Undesirable Effect to all selected/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Undesirable Effect from all selected/ })).toBeInTheDocument();
    });

    it('disables Add when all selected nodes already have the tag', async () => {
      const ids = addTwoNodes();
      useDiagramStore.getState().addNodesTag(ids, 'ude');
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      expect(screen.getByRole('button', { name: /Add Undesirable Effect to all selected/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Remove Undesirable Effect from all selected/ })).not.toBeDisabled();
    });

    it('disables Remove when no selected nodes have the tag', () => {
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      expect(screen.getByRole('button', { name: /Remove Undesirable Effect from all selected/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Add Undesirable Effect to all selected/ })).not.toBeDisabled();
    });

    it('renders a count badge reflecting how many selected have the tag', () => {
      const ids = addTwoNodes();
      useDiagramStore.getState().addNodesTag([ids[0]], 'ude');
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      expect(screen.getByLabelText(/1 of 2 have Undesirable Effect/)).toBeInTheDocument();
    });

    it('applies tag to all selected nodes when Add is clicked', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      await user.click(screen.getByRole('button', { name: /Add Undesirable Effect to all selected/ }));
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.tags).toContain('ude');
      expect(nodes.find((n) => n.id === ids[1])!.data.tags).toContain('ude');
    });

    it('removes tag from all selected nodes when Remove is clicked', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      useDiagramStore.getState().addNodesTag(ids, 'ude');
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      await user.click(screen.getByRole('button', { name: /Remove Undesirable Effect from all selected/ }));
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.tags).not.toContain('ude');
      expect(nodes.find((n) => n.id === ids[1])!.data.tags).not.toContain('ude');
    });
  });

  describe('Junction', () => {
    it('does not render the section when no selected node is eligible', () => {
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      expect(screen.queryByText('Junction Logic')).not.toBeInTheDocument();
    });

    it('renders buttons and applies junction type to eligible nodes only', async () => {
      const user = userEvent.setup();
      const sourceA = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const sourceB = useDiagramStore.getState().addNode({ x: 100, y: 0 });
      const target = useDiagramStore.getState().addNode({ x: 50, y: 100 });
      const lonely = useDiagramStore.getState().addNode({ x: 200, y: 100 });
      useDiagramStore.getState().addEdge(sourceA, target);
      useDiagramStore.getState().addEdge(sourceB, target);

      render(
        <MultiNodePanel
          selectedNodes={getSelectedNodes([target, lonely])}
        />,
      );

      expect(screen.getByText('Junction Logic')).toBeInTheDocument();
      expect(screen.getByText(/Applies to 1 of 2 selected/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'AND' }));

      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === target)!.data.junctionType).toBe('and');
      expect(nodes.find((n) => n.id === lonely)!.data.junctionType).toBe('or');
    });
  });

  describe('Color', () => {
    it('commits background color to all selected on swatch click', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      const { container } = render(
        <MultiNodePanel selectedNodes={getSelectedNodes(ids)} />,
      );
      const bgSection = container.querySelectorAll('.context-menu-colors')[0] as HTMLElement;
      await user.click(bgSection.querySelector('[title="Blue"]') as HTMLElement);

      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.color).toBe('#3B82F6');
      expect(nodes.find((n) => n.id === ids[1])!.data.color).toBe('#3B82F6');
    });

    it('swatch click commits a single undo entry reverting both nodes', () => {
      const ids = addTwoNodes();
      const { container } = render(
        <MultiNodePanel selectedNodes={getSelectedNodes(ids)} />,
      );
      const bgSection = container.querySelectorAll('.context-menu-colors')[0] as HTMLElement;
      fireEvent.click(bgSection.querySelector('[title="Blue"]') as HTMLElement);
      useDiagramStore.getState().undo();
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.color).toBeUndefined();
      expect(nodes.find((n) => n.id === ids[1])!.data.color).toBeUndefined();
    });

    it('previews via native picker while focused and commits on blur', () => {
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);

      const pickerInput = screen.getByLabelText(
        'Custom background color for all selected nodes',
      ) as HTMLInputElement;

      fireEvent.focus(pickerInput);
      fireEvent.change(pickerInput, { target: { value: '#123456' } });

      let nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.color).toBe('#123456');

      fireEvent.blur(pickerInput);

      nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.color).toBe('#123456');
      expect(nodes.find((n) => n.id === ids[1])!.data.color).toBe('#123456');
    });

    it('commits text color to all selected on swatch click', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      const { container } = render(
        <MultiNodePanel selectedNodes={getSelectedNodes(ids)} />,
      );
      const textSection = container.querySelectorAll('.context-menu-colors')[1] as HTMLElement;
      await user.click(textSection.querySelector('[title="Red"]') as HTMLElement);
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.textColor).toBe('#EF4444');
      expect(nodes.find((n) => n.id === ids[1])!.data.textColor).toBe('#EF4444');
    });
  });

  describe('Layout (existing behavior preserved)', () => {
    it('deletes all selected nodes when Delete All is clicked', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      await user.click(screen.getByRole('button', { name: 'Delete All' }));
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('locks all selected nodes when Lock All is clicked', async () => {
      const user = userEvent.setup();
      const ids = addTwoNodes();
      render(<MultiNodePanel selectedNodes={getSelectedNodes(ids)} />);
      await user.click(screen.getByRole('button', { name: /Lock All/ }));
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === ids[0])!.data.locked).toBe(true);
      expect(nodes.find((n) => n.id === ids[1])!.data.locked).toBe(true);
    });
  });
});
