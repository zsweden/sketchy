import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/settings-store';

export default function SettingsPopover() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const apiKey = useSettingsStore((s) => s.openaiApiKey);
  const setApiKey = useSettingsStore((s) => s.setOpenaiApiKey);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const setBaseUrl = useSettingsStore((s) => s.setBaseUrl);
  const model = useSettingsStore((s) => s.model);
  const setModel = useSettingsStore((s) => s.setModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const modelsLoading = useSettingsStore((s) => s.modelsLoading);
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
        {/* API Key */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">API Key</p>
          <input
            className="input-text"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-... (optional for local models)"
            autoComplete="off"
          />
        </div>

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
              placeholder="gpt-4o or any model name"
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

        {/* Endpoint */}
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">API Endpoint</p>
          <input
            className="input-text"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <p className="field-label" style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>
          Stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
