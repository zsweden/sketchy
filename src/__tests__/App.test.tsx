import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDiagram } from '../core/types';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { getWebStorage } from '../utils/web-storage';

const mocks = vi.hoisted(() => ({
  useAutoSave: vi.fn(),
  useKeyboardShortcuts: vi.fn(),
  loadDiagram: vi.fn(),
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: mocks.useAutoSave,
}));

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: mocks.useKeyboardShortcuts,
}));

vi.mock('../core/persistence/local-storage', () => ({
  loadDiagram: mocks.loadDiagram,
}));

vi.mock('../components/canvas/DiagramCanvas', () => ({
  default: () => <div>Diagram Canvas</div>,
}));

vi.mock('../components/toolbar/Toolbar', () => ({
  default: () => <div>Toolbar</div>,
}));

vi.mock('../components/panel/SidePanel', () => ({
  default: () => <div>Side Panel</div>,
}));

vi.mock('../components/context-menu/ContextMenu', () => ({
  default: () => <div>Context Menu</div>,
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
  Toaster: () => <div>Toaster</div>,
}));

import App from '../App';

function resetStores() {
  getWebStorage('localStorage')?.removeItem('sketchy-settings');
  getWebStorage('sessionStorage')?.removeItem('sketchy_diagram');
  getWebStorage('sessionStorage')?.removeItem('sketchy_chat');
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    contextMenu: null,
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
}

describe('App', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mocks.loadDiagram.mockReturnValue({ diagram: null });
  });

  it('loads the saved diagram on mount and installs app hooks', async () => {
    const saved = {
      ...createEmptyDiagram('crt'),
      name: 'Recovered Diagram',
      nodes: [
        {
          id: 'n1',
          type: 'entity' as const,
          position: { x: 12, y: 34 },
          data: { label: 'Recovered node', tags: [], junctionType: 'or' as const },
        },
      ],
      edges: [],
    };

    mocks.loadDiagram.mockReturnValue({
      diagram: saved,
      error: 'Saved data was corrupted and could not be fully restored',
      warnings: ['Recovered session contained errors and was sanitized.'],
    });

    render(<App />);

    await waitFor(() => {
      expect(useDiagramStore.getState().diagram.name).toBe('Recovered Diagram');
    });

    expect(mocks.useAutoSave).toHaveBeenCalledTimes(1);
    expect(mocks.useKeyboardShortcuts).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'Saved data was corrupted and could not be fully restored',
    );
    expect(mocks.toast.warning).toHaveBeenCalledWith(
      'Recovered session contained errors and was sanitized.',
    );
  });

  it('leaves the default diagram untouched when nothing is stored', () => {
    render(<App />);

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(mocks.toast.warning).not.toHaveBeenCalled();
  });
});
