import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settings-store';

export default function SettingsPopover() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const apiKey = useSettingsStore((s) => s.openaiApiKey);
  const setApiKey = useSettingsStore((s) => s.setOpenaiApiKey);
  const ref = useRef<HTMLDivElement>(null);

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
      <div className="section-stack" style={{ gap: '0.5rem' }}>
        <p className="section-label">OpenAI API Key</p>
        <input
          className="input-text"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
        />
        <p className="field-label" style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>
          Stored locally in your browser. Never sent to our servers.
        </p>
      </div>
    </div>
  );
}
