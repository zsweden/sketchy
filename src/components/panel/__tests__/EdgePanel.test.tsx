import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import EdgePanel from '../EdgePanel';
import { useDiagramStore } from '../../../store/diagram-store';
import type { DiagramEdge } from '../../../core/types';

function resetStores() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
}

function getEdge(id: string): DiagramEdge {
  return useDiagramStore.getState().diagram.edges.find((e) => e.id === id)!;
}

describe('EdgePanel', () => {
  let edgeId: string;

  beforeEach(() => {
    resetStores();
    const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
    useDiagramStore.getState().updateNodeText(sourceId, 'Source Node');
    useDiagramStore.getState().updateNodeText(targetId, 'Target Node');
    useDiagramStore.getState().addEdge(sourceId, targetId);
    edgeId = useDiagramStore.getState().diagram.edges[0].id;
  });

  it('displays source and target node labels', () => {
    render(<EdgePanel edge={getEdge(edgeId)} />);
    expect(screen.getByText(/Source Node/)).toBeInTheDocument();
    expect(screen.getByText(/Target Node/)).toBeInTheDocument();
  });

  it('changes confidence level', async () => {
    const user = userEvent.setup();
    render(<EdgePanel edge={getEdge(edgeId)} />);

    await user.click(screen.getByRole('button', { name: 'Medium' }));
    expect(getEdge(edgeId).confidence).toBe('medium');

    render(<EdgePanel edge={getEdge(edgeId)} />);
    await user.click(screen.getAllByRole('button', { name: 'Low' })[0]);
    expect(getEdge(edgeId).confidence).toBe('low');
  });

  it('updates notes on blur', async () => {
    const user = userEvent.setup();
    render(<EdgePanel edge={getEdge(edgeId)} />);

    const notesField = screen.getByLabelText('Edge notes');
    await user.type(notesField, 'Edge note');
    fireEvent.blur(notesField);

    await waitFor(() => {
      expect(getEdge(edgeId).notes).toBe('Edge note');
    });
  });

  it('does not show polarity controls in CRT', () => {
    render(<EdgePanel edge={getEdge(edgeId)} />);
    expect(screen.queryByText('Polarity')).not.toBeInTheDocument();
  });

  it('does not show delay controls in CRT', () => {
    render(<EdgePanel edge={getEdge(edgeId)} />);
    expect(screen.queryByText('Delay')).not.toBeInTheDocument();
  });

  describe('CLD framework (polarity & delay)', () => {
    beforeEach(() => {
      useDiagramStore.getState().setFramework('cld');
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      edgeId = useDiagramStore.getState().diagram.edges[0].id;
    });

    it('shows polarity controls and changes polarity', async () => {
      const user = userEvent.setup();
      render(<EdgePanel edge={getEdge(edgeId)} />);

      expect(screen.getByText('Polarity')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '-' }));
      expect(getEdge(edgeId).polarity).toBe('negative');
    });

    it('shows delay toggle and toggles delay', async () => {
      const user = userEvent.setup();
      render(<EdgePanel edge={getEdge(edgeId)} />);

      expect(screen.getByText('Delay')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'No Delay' }));
      expect(getEdge(edgeId).delay).toBe(true);
    });
  });
});
