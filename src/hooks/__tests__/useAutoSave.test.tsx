import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../useAutoSave';
import { useDiagramStore } from '../../store/diagram-store';

const mocks = vi.hoisted(() => ({
  saveDiagram: vi.fn(),
}));

vi.mock('../../core/persistence/local-storage', () => ({
  saveDiagram: mocks.saveDiagram,
}));

function Harness() {
  useAutoSave();
  return null;
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('debounces diagram saves', () => {
    render(<Harness />);

    act(() => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      vi.advanceTimersByTime(499);
    });

    expect(mocks.saveDiagram).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mocks.saveDiagram).toHaveBeenCalledTimes(1);
    expect(mocks.saveDiagram).toHaveBeenCalledWith(useDiagramStore.getState().diagram);
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

    expect(mocks.saveDiagram).not.toHaveBeenCalled();
  });
});
