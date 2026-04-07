import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../useAutoSave';
import { useDiagramStore } from '../../store/diagram-store';

// No mock needed — saveDiagram writes to real sessionStorage (available in jsdom).

function Harness() {
  useAutoSave();
  return null;
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('debounces diagram saves', () => {
    render(<Harness />);

    act(() => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      vi.advanceTimersByTime(499);
    });

    expect(sessionStorage.getItem('sketchy_diagram')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const stored = sessionStorage.getItem('sketchy_diagram');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.nodes).toHaveLength(1);
  });

  it('clears the pending save when the hook unmounts', () => {
    const view = render(<Harness />);

    act(() => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
    });

    view.unmount();

    act(() => {
      vi.runAllTimers();
    });

    expect(sessionStorage.getItem('sketchy_diagram')).toBeNull();
  });
});
