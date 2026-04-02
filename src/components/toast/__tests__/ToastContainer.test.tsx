import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ToastContainer from '../ToastContainer';
import { useUIStore, type Toast } from '../../../store/ui-store';

function resetStore() {
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

function setToasts(toasts: Toast[]) {
  useUIStore.setState({ toasts });
}

describe('ToastContainer', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders active toasts and dismisses a toast when clicked', async () => {
    const user = userEvent.setup();

    setToasts([
      { id: 'toast-1', message: 'Recovered session', type: 'warning' },
    ]);

    render(<ToastContainer />);

    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent('Recovered session');

    await user.click(toast);

    expect(useUIStore.getState().toasts).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('runs the action handler and dismisses the toast', async () => {
    const user = userEvent.setup();
    const action = vi.fn();

    setToasts([
      {
        id: 'toast-1',
        message: 'Project import warning',
        type: 'warning',
        action: { label: 'Review', onClick: action },
      },
    ]);

    render(<ToastContainer />);

    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().toasts).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
