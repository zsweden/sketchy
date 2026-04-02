import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import LayoutLabPopover from '../LayoutLabPopover';
import { DEFAULT_ELK_EXPERIMENT_SETTINGS } from '../../../core/layout/elk-options';
import { useDiagramStore } from '../../../store/diagram-store';
import { useSettingsStore } from '../../../store/settings-store';

describe('LayoutLabPopover', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
    useSettingsStore.setState({
      layoutLabOpen: true,
      elkExperimentSettings: DEFAULT_ELK_EXPERIMENT_SETTINGS,
      lastLayoutRun: null,
    });
  });

  it('renders nothing when closed', () => {
    useSettingsStore.setState({ layoutLabOpen: false });
    const { container } = render(<LayoutLabPopover />);
    expect(container).toBeEmptyDOMElement();
  });

  it('updates ELK settings', async () => {
    const user = userEvent.setup();
    render(<LayoutLabPopover />);

    await user.selectOptions(screen.getByLabelText('ELK engine'), 'radial');
    fireEvent.change(screen.getByLabelText('ELK aspect ratio'), { target: { value: '3.5' } });

    expect(useSettingsStore.getState().elkExperimentSettings.algorithm).toBe('radial');
    expect(useSettingsStore.getState().elkExperimentSettings.aspectRatio).toBe(3.5);
  });

  it('locks the engine to force for cyclic frameworks', () => {
    useDiagramStore.getState().setFramework('cld');

    render(<LayoutLabPopover />);

    expect(screen.getByLabelText('ELK engine')).toBeDisabled();
    expect(screen.getByLabelText('ELK engine')).toHaveValue('force');
    expect(screen.getByText('Cyclic diagrams always use Force.')).toBeInTheDocument();
  });

  it('closes on outside click', () => {
    render(<LayoutLabPopover />);

    fireEvent.mouseDown(document.body);
    expect(useSettingsStore.getState().layoutLabOpen).toBe(false);
  });

  it('renders the last run metrics', () => {
    useSettingsStore.setState({
      lastLayoutRun: {
        metrics: {
          nodeOverlaps: 0,
          edgeCrossings: 2,
          edgeNodeOverlaps: 1,
          connectorConflicts: 3,
          totalEdgeLength: 250,
          boundingArea: 1200,
        },
        score: 11260,
        durationMs: 17,
        algorithm: 'stress',
        direction: 'TB',
      },
    });

    render(<LayoutLabPopover />);

    expect(screen.getByText('stress')).toBeInTheDocument();
    expect(screen.getByText('11260')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
