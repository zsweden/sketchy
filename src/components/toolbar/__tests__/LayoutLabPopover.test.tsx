import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import LayoutLabPopover from '../LayoutLabPopover';
import { DEFAULT_ELK_EXPERIMENT_SETTINGS } from '../../../core/layout/elk-options';
import { useDiagramStore } from '../../../store/diagram-store';
import { useSettingsStore } from '../../../store/settings-store';
import { DEFAULT_EDGE_ROUTING_POLICY } from '../../../core/edge-routing';

describe('LayoutLabPopover', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
    useSettingsStore.setState({
      layoutLabOpen: true,
      elkExperimentSettings: DEFAULT_ELK_EXPERIMENT_SETTINGS,
      edgeRoutingExperimentPolicy: DEFAULT_EDGE_ROUTING_POLICY,
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
    fireEvent.change(screen.getByLabelText('ELK node spacing'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('ELK component spacing'), { target: { value: '95' } });

    expect(useSettingsStore.getState().elkExperimentSettings.algorithmOverride).toBe('radial');
    expect(useSettingsStore.getState().elkExperimentSettings.aspectRatio).toBe(3.5);
    expect(useSettingsStore.getState().elkExperimentSettings.nodeSpacing).toBe(55);
    expect(useSettingsStore.getState().elkExperimentSettings.componentSpacing).toBe(95);
  });

  it('updates the edge routing policy', async () => {
    const user = userEvent.setup();
    render(<LayoutLabPopover />);

    await user.selectOptions(screen.getByLabelText('Edge routing policy'), 'shared-endpoint-outside-buffer-same-type-rewarded');

    expect(useSettingsStore.getState().edgeRoutingExperimentPolicy).toBe('shared-endpoint-outside-buffer-same-type-rewarded');
  });

  it('shows the cyclic default engine but still allows overrides', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().setFramework('cld');

    render(<LayoutLabPopover />);

    expect(screen.getByLabelText('ELK engine')).toHaveValue('default');
    expect(screen.getByText('Current page will use force.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('ELK engine'), 'layered');
    expect(useSettingsStore.getState().elkExperimentSettings.algorithmOverride).toBe('layered');
    expect(screen.getByText('Current page will use layered.')).toBeInTheDocument();
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

  it('resets ELK settings and edge routing policy together', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      elkExperimentSettings: {
        ...DEFAULT_ELK_EXPERIMENT_SETTINGS,
        aspectRatio: 4,
      },
      edgeRoutingExperimentPolicy: 'shared-endpoint-anywhere',
    });

    render(<LayoutLabPopover />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(useSettingsStore.getState().elkExperimentSettings).toEqual(DEFAULT_ELK_EXPERIMENT_SETTINGS);
    expect(useSettingsStore.getState().edgeRoutingExperimentPolicy).toBe(DEFAULT_EDGE_ROUTING_POLICY);
  });
});
