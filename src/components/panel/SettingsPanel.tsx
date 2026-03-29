import { useCallback } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { autoLayout, elkEngine } from '../../core/layout';

export default function SettingsPanel() {
  const settings = useDiagramStore((s) => s.diagram.settings);
  const updateSettings = useDiagramStore((s) => s.updateSettings);
  const diagramName = useDiagramStore((s) => s.diagram.name);
  const setDiagramName = useDiagramStore((s) => s.setDiagramName);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const moveNodes = useDiagramStore((s) => s.moveNodes);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const framework = useDiagramStore((s) => s.framework);

  const handleDirectionChange = useCallback(
    async (direction: 'TB' | 'BT') => {
      updateSettings({ layoutDirection: direction });
      const { nodes, edges } = useDiagramStore.getState().diagram;
      const updates = await autoLayout(nodes, edges, { direction }, elkEngine);
      if (updates.length > 0) {
        commitToHistory();
        moveNodes(updates);
        requestFitView();
      }
    },
    [updateSettings, commitToHistory, moveNodes, requestFitView],
  );

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
          aria-label="Diagram name"
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
          onChange={(e) => handleDirectionChange(e.target.value as 'TB' | 'BT')}
          aria-label="Layout direction"
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
