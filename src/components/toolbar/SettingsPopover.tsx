import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSettingsStore, PROVIDERS } from '../../store/settings-store';
import { THEMES, type ThemeId } from '../../styles/themes';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { autoLayout, elkEngine } from '../../core/layout';

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
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const moveNodes = useDiagramStore((s) => s.moveNodes);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const ref = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const handleDirectionChange = useCallback(
    async (direction: 'TB' | 'BT') => {
      updateDiagramSettings({ layoutDirection: direction });
      const { nodes, edges } = useDiagramStore.getState().diagram;
      const updates = await autoLayout(
        nodes, edges,
        { direction, cyclic: useDiagramStore.getState().framework.allowsCycles },
        elkEngine,
      );
      if (updates.length > 0) {
        commitToHistory();
        moveNodes(updates);
        requestFitView();
      }
    },
    [updateDiagramSettings, commitToHistory, moveNodes, requestFitView],
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
      <div className="section-stack" style={{ gap: '0.75rem' }}>
        {/* Theme */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
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

        {/* Provider */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
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

        {/* API Key — shown when provider requires one */}
        {currentProvider.requiresKey && (
          <div className="section-stack" style={{ gap: '0.375rem' }}>
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

        {/* Custom Endpoint — shown only for Custom provider */}
        {provider === 'custom' && (
          <div className="section-stack" style={{ gap: '0.375rem' }}>
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

        {/* Model */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Model</p>
          <div style={{ position: 'relative' }}>
            <input
              className="input-text"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onFocus={() => setModelDropdownOpen(true)}
              onBlur={() => setTimeout(() => setModelDropdownOpen(false), 150)}
              placeholder="Type or select a model"
              aria-label="Model"
            />
            {modelDropdownOpen && (
              <div className="model-dropdown">
                {modelsLoading ? (
                  <div className="model-dropdown-loading">Loading models...</div>
                ) : availableModels.length > 0 ? (
                  availableModels.map((m) => (
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
                    </button>
                  ))
                ) : (
                  <div className="model-dropdown-loading">No models found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Layout Direction */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Layout Direction</p>
          <select
            className="input-text"
            value={diagramSettings.layoutDirection}
            onChange={(e) => handleDirectionChange(e.target.value as 'TB' | 'BT')}
            aria-label="Layout direction"
          >
            <option value="TB">Top to Bottom</option>
            <option value="BT">Bottom to Top</option>
          </select>
        </div>

        {/* Arrow Routing */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
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

        {/* Show Grid */}
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

        <p className="field-label" style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>
          Stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
