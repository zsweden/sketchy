import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSettingsStore, PROVIDERS } from '../../store/settings-store';
import { formatModelDate } from '../../core/ai/model-fetcher';
import { THEMES, type ThemeId } from '../../styles/themes';
import { DROPDOWN_BLUR_DELAY_MS } from '../../constants/timing';
import { useDiagramStore } from '../../store/diagram-store';
import type { LayoutDirection } from '../../core/framework-types';

export default function SettingsPopover() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const provider = useSettingsStore((s) => s.provider);
  const setProvider = useSettingsStore((s) => s.setProvider);
  const apiKey = useSettingsStore((s) => s.openaiApiKey);
  const setApiKey = useSettingsStore((s) => s.setOpenaiApiKey);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const setBaseUrl = useSettingsStore((s) => s.setBaseUrl);
  const model = useSettingsStore((s) => s.model);
  const setModel = useSettingsStore((s) => s.setModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const modelsLoading = useSettingsStore((s) => s.modelsLoading);
  const modelsError = useSettingsStore((s) => s.modelsError);
  const currentProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const keyValid = apiKey.length > 0 && !modelsLoading && !modelsError && availableModels.length > 0;
  const diagramSettings = useDiagramStore((s) => s.diagram.settings);
  const updateDiagramSettings = useDiagramStore((s) => s.updateSettings);
  const runAutoLayout = useDiagramStore((s) => s.runAutoLayout);
  const ref = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const handleDirectionChange = useCallback(
    async (direction: LayoutDirection) => {
      updateDiagramSettings({ layoutDirection: direction });
      await runAutoLayout({ commitHistory: true, fitView: true });
    },
    [updateDiagramSettings, runAutoLayout],
  );

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeSettings();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, closeSettings]);

  if (!open) return null;

  return (
    <div className="settings-popover" ref={ref}>
      {/* Appearance */}
      <div className="settings-section">
        <p className="section-heading">Appearance</p>
        <div className="settings-field">
          <p className="section-label">Theme</p>
          <select
            className="input-text"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            aria-label="Theme"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="control-row split-row">
          <p className="section-label">Show Grid</p>
          <button
            className="toggle-track"
            data-active={diagramSettings.showGrid}
            onClick={() => updateDiagramSettings({ showGrid: !diagramSettings.showGrid })}
            aria-label="Toggle grid"
          >
            <div className="toggle-thumb" />
          </button>
        </div>
        <div className="control-row split-row">
          <p className="section-label">Snap to Grid</p>
          <button
            className="toggle-track"
            data-active={diagramSettings.snapToGrid}
            onClick={() => updateDiagramSettings({ snapToGrid: !diagramSettings.snapToGrid })}
            aria-label="Toggle snap to grid"
          >
            <div className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-divider" />

      {/* Visualization */}
      <div className="settings-section">
        <p className="section-heading">Visualization</p>
        <div className="control-row split-row">
          <p className="section-label">Show Active Attachments</p>
          <button
            className="toggle-track"
            data-active={diagramSettings.showActiveAttachments}
            onClick={() => updateDiagramSettings({ showActiveAttachments: !diagramSettings.showActiveAttachments })}
            aria-label="Toggle active attachments"
          >
            <div className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-divider" />

      {/* Layout */}
      <div className="settings-section">
        <p className="section-heading">Layout</p>
        <div className="settings-field">
          <p className="section-label">Direction</p>
          <select
            className="input-text"
            value={diagramSettings.layoutDirection}
            onChange={(e) => handleDirectionChange(e.target.value as LayoutDirection)}
            aria-label="Layout direction"
          >
            <option value="TB">Top to Bottom</option>
            <option value="BT">Bottom to Top</option>
            <option value="LR">Left to Right</option>
            <option value="RL">Right to Left</option>
          </select>
        </div>
        <div className="settings-field">
          <p className="section-label">Arrow Routing</p>
          <select
            className="input-text"
            value={diagramSettings.edgeRoutingMode}
            onChange={(e) => updateDiagramSettings({ edgeRoutingMode: e.target.value as 'dynamic' | 'fixed' })}
            aria-label="Arrow routing"
          >
            <option value="dynamic">Optimize Continuously</option>
            <option value="fixed">Keep Fixed</option>
          </select>
        </div>
      </div>

      <div className="settings-divider" />

      {/* AI Provider */}
      <div className="settings-section">
        <p className="section-heading">AI Provider</p>
        <div className="settings-field">
          <p className="section-label">Provider</p>
          <select
            className="input-text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            aria-label="Provider"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {currentProvider.requiresKey && (
          <div className="settings-field">
            <p className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              API Key
              {keyValid && <Check size={14} style={{ color: '#22c55e' }} />}
            </p>
            <input
              className="input-text"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              aria-label="API key"
            />
          </div>
        )}

        {provider === 'custom' && (
          <div className="settings-field">
            <p className="section-label">API Endpoint</p>
            <input
              className="input-text"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              aria-label="API endpoint"
            />
          </div>
        )}

        <div className="settings-field">
          <p className="section-label">Model</p>
          <div style={{ position: 'relative' }}>
            <input
              className="input-text"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onFocus={() => setModelDropdownOpen(true)}
              onBlur={() => setTimeout(() => setModelDropdownOpen(false), DROPDOWN_BLUR_DELAY_MS)}
              placeholder="Type or select a model"
              aria-label="Model"
            />
            {modelDropdownOpen && (
              <div className="model-dropdown">
                {modelsLoading ? (
                  <div className="model-dropdown-loading">Loading models...</div>
                ) : availableModels.length > 0 ? (
                  availableModels.map((m) => {
                    const date = formatModelDate(m.created);
                    return (
                      <button
                        key={m.id}
                        className="model-dropdown-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setModel(m.id);
                          setModelDropdownOpen(false);
                        }}
                      >
                        <span>{m.id}</span>
                        {date && <span className="model-dropdown-date">{date}</span>}
                      </button>
                    );
                  })
                ) : (
                  <div className="model-dropdown-loading">No models found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="settings-footer">
        Settings stored locally in your browser.
      </p>
    </div>
  );
}
