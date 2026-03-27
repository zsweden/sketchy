import { useDiagramStore } from '../../store/diagram-store';

export default function SettingsPanel() {
  const settings = useDiagramStore((s) => s.diagram.settings);
  const updateSettings = useDiagramStore((s) => s.updateSettings);
  const diagramName = useDiagramStore((s) => s.diagram.name);
  const setDiagramName = useDiagramStore((s) => s.setDiagramName);
  const framework = useDiagramStore((s) => s.framework);

  return (
    <div className="section-stack">
      <p className="section-heading">Settings</p>

      {/* Diagram name */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Diagram Name</p>
        <input
          className="input-text"
          type="text"
          value={diagramName}
          onChange={(e) => setDiagramName(e.target.value)}
          placeholder="Untitled Diagram"
        />
      </div>

      {/* Framework info */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Framework</p>
        <p className="field-label">{framework.name}</p>
        <p className="field-label" style={{ color: 'var(--text-soft)' }}>
          {framework.description}
        </p>
      </div>

      {/* Layout direction */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Layout Direction</p>
        <select
          className="select-control"
          value={settings.layoutDirection}
          onChange={(e) =>
            updateSettings({
              layoutDirection: e.target.value as 'TB' | 'BT',
            })
          }
        >
          <option value="TB">Top to Bottom</option>
          <option value="BT">Bottom to Top</option>
        </select>
      </div>

      {/* Grid */}
      <div className="control-row split-row">
        <p className="field-label">Show Grid</p>
        <button
          className="toggle-track"
          data-active={settings.showGrid}
          onClick={() => updateSettings({ showGrid: !settings.showGrid })}
          aria-label="Toggle grid"
        >
          <div className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
}
