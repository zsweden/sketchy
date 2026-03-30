import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPopover from '../SettingsPopover';
import { useSettingsStore } from '../../../store/settings-store';
import { useDiagramStore } from '../../../store/diagram-store';
import { useUIStore } from '../../../store/ui-store';
import { THEMES } from '../../../styles/themes';

vi.mock('../../../core/layout', () => ({
  autoLayout: vi.fn().mockResolvedValue([]),
  elkEngine: {},
}));

function resetStores() {
  window.localStorage?.removeItem?.('sketchy-settings');
  useSettingsStore.setState({
    settingsOpen: true,
    provider: 'openai',
    theme: 'figma-dark',
    openaiApiKey: '',
    baseUrl: '',
    model: '',
    availableModels: [],
    modelsLoading: false,
    modelsError: null,
  });
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useUIStore.setState({ fitViewTrigger: 0 });
}

describe('SettingsPopover', () => {
  beforeEach(() => {
    resetStores();
  });

  it('renders nothing when settings are closed', () => {
    useSettingsStore.setState({ settingsOpen: false });
    const { container } = render(<SettingsPopover />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all theme options', () => {
    render(<SettingsPopover />);
    const themeSelect = screen.getByLabelText('Theme');
    expect(themeSelect).toBeInTheDocument();

    for (const theme of THEMES) {
      expect(screen.getByText(theme.name)).toBeInTheDocument();
    }
  });

  it('changes theme', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Theme'), 'nord');
    expect(useSettingsStore.getState().theme).toBe('nord');
  });

  it('toggles grid visibility', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    const gridToggle = screen.getByLabelText('Toggle grid');
    const initialGrid = useDiagramStore.getState().diagram.settings.showGrid;
    await user.click(gridToggle);
    expect(useDiagramStore.getState().diagram.settings.showGrid).toBe(!initialGrid);
  });

  it('toggles snap-to-grid', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    const snapToggle = screen.getByLabelText('Toggle snap to grid');
    expect(useDiagramStore.getState().diagram.settings.snapToGrid).toBe(false);
    await user.click(snapToggle);
    expect(useDiagramStore.getState().diagram.settings.snapToGrid).toBe(true);
  });

  it('changes layout direction', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Layout direction'), 'TB');
    expect(useDiagramStore.getState().diagram.settings.layoutDirection).toBe('TB');
  });

  it('changes arrow routing mode', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Arrow routing'), 'dynamic');
    expect(useDiagramStore.getState().diagram.settings.edgeRoutingMode).toBe('dynamic');
  });

  it('switches AI provider', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    expect(useSettingsStore.getState().provider).toBe('anthropic');
  });

  it('shows API key field when provider requires it', () => {
    render(<SettingsPopover />);
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('hides API key field for providers that do not require it', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'ollama');
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });

  it('shows API endpoint field for custom provider', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'custom');
    expect(screen.getByLabelText('API endpoint')).toBeInTheDocument();
  });

  it('closes on outside click', () => {
    render(<SettingsPopover />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(useSettingsStore.getState().settingsOpen).toBe(false);
  });
});
