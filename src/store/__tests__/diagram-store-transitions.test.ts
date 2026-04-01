import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useUIStore } from '../ui-store';

const mocks = vi.hoisted(() => ({
  runElkAutoLayout: vi.fn(),
}));

vi.mock('../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: mocks.runElkAutoLayout,
}));

function resetState() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
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
  });
}

describe('diagram store transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runElkAutoLayout.mockResolvedValue([]);
    resetState();
  });

  it('derives the next document only for supported frameworks', async () => {
    expect(await useDiagramStore.getState().deriveNextDiagram()).toBe(true);
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');

    useDiagramStore.getState().setFramework('stt');
    expect(await useDiagramStore.getState().deriveNextDiagram()).toBe(false);
  });

  it('derives a new document, resets undo state, and requests fit view', async () => {
    const first = useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const second = useDiagramStore.getState().addNode({ x: 0, y: 100 });
    useDiagramStore.getState().updateNodeText(first, 'Root issue');
    useDiagramStore.getState().updateNodeText(second, 'Outcome');
    useDiagramStore.getState().updateNodeTags(second, ['ude']);
    useDiagramStore.getState().addEdge(first, second);

    mocks.runElkAutoLayout.mockResolvedValue([
      { id: first, position: { x: 200, y: 50 } },
      { id: second, position: { x: 200, y: 180 } },
    ]);

    const derived = await useDiagramStore.getState().deriveNextDiagram();

    expect(derived).toBe(true);
    expect(mocks.runElkAutoLayout).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().framework.id).toBe('frt');
    expect(useDiagramStore.getState().diagram.frameworkId).toBe('frt');
    expect(useDiagramStore.getState().diagram.name).toBe('Untitled Diagram_FRT');
    expect(useDiagramStore.getState().diagram.settings.layoutDirection).toBe('BT');
    expect(useDiagramStore.getState().diagram.nodes.find((node) => node.id === first)?.position)
      .toEqual({ x: 200, y: 50 });
    expect(useDiagramStore.getState().canUndo).toBe(false);
    expect(useDiagramStore.getState().canRedo).toBe(false);
    expect(useUIStore.getState().fitViewTrigger).toBe(1);
  });
});
