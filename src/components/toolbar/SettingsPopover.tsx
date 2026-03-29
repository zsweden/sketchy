import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSettingsStore, PROVIDERS } from '../../store/settings-store';

export default function SettingsPopover() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
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
  const ref = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

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

        <p className="field-label" style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>
          Stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
