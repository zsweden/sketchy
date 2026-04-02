import { useEffect, useRef } from 'react';
import {
  ELK_ALGORITHM_OPTIONS,
  ELK_CYCLE_BREAKING_OPTIONS,
  ELK_LAYERING_STRATEGY_OPTIONS,
  ELK_NODE_PLACEMENT_OPTIONS,
  ELK_WRAPPING_OPTIONS,
} from '../../core/layout/elk-options';
import { useSettingsStore } from '../../store/settings-store';

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function LayoutLabPopover() {
  const open = useSettingsStore((s) => s.layoutLabOpen);
  const closeLayoutLab = useSettingsStore((s) => s.closeLayoutLab);
  const elkSettings = useSettingsStore((s) => s.elkExperimentSettings);
  const updateElkExperimentSettings = useSettingsStore((s) => s.updateElkExperimentSettings);
  const resetElkExperimentSettings = useSettingsStore((s) => s.resetElkExperimentSettings);
  const lastLayoutRun = useSettingsStore((s) => s.lastLayoutRun);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeLayoutLab();
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [closeLayoutLab, open]);

  if (!open) return null;

  const layeredOnly = elkSettings.algorithm !== 'layered';

  return (
    <div className="settings-popover layout-lab-popover" ref={ref}>
      <div className="settings-section">
        <div className="layout-lab-header">
          <div>
            <p className="section-heading">Layout Lab</p>
            <p className="layout-lab-copy">Applies the next time you click Auto-layout.</p>
          </div>
          <button
            className="btn btn-secondary btn-xs"
            onClick={resetElkExperimentSettings}
            type="button"
          >
            Reset
          </button>
        </div>

        <div className="settings-field">
          <p className="section-label">Engine</p>
          <select
            className="input-text"
            value={elkSettings.algorithm}
            onChange={(event) => updateElkExperimentSettings({ algorithm: event.target.value as typeof elkSettings.algorithm })}
            aria-label="ELK engine"
          >
            {ELK_ALGORITHM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <p className="section-label">Aspect Ratio</p>
          <input
            className="input-text"
            type="number"
            min="0.25"
            max="8"
            step="0.25"
            value={elkSettings.aspectRatio}
            onChange={(event) => updateElkExperimentSettings({ aspectRatio: Number.parseFloat(event.target.value) || 0.25 })}
            aria-label="ELK aspect ratio"
          />
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-section">
        <p className="section-heading">Layered Tuning</p>
        <p className="layout-lab-copy">Ignored for force, stress, and radial.</p>

        <div className="settings-field">
          <p className="section-label">Layering</p>
          <select
            className="input-text"
            value={elkSettings.layeringStrategy}
            onChange={(event) => updateElkExperimentSettings({ layeringStrategy: event.target.value as typeof elkSettings.layeringStrategy })}
            aria-label="ELK layering strategy"
            disabled={layeredOnly}
          >
            {ELK_LAYERING_STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <p className="section-label">Node Placement</p>
          <select
            className="input-text"
            value={elkSettings.nodePlacementStrategy}
            onChange={(event) => updateElkExperimentSettings({ nodePlacementStrategy: event.target.value as typeof elkSettings.nodePlacementStrategy })}
            aria-label="ELK node placement strategy"
            disabled={layeredOnly}
          >
            {ELK_NODE_PLACEMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <p className="section-label">Cycle Breaking</p>
          <select
            className="input-text"
            value={elkSettings.cycleBreakingStrategy}
            onChange={(event) => updateElkExperimentSettings({ cycleBreakingStrategy: event.target.value as typeof elkSettings.cycleBreakingStrategy })}
            aria-label="ELK cycle breaking strategy"
            disabled={layeredOnly}
          >
            {ELK_CYCLE_BREAKING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <p className="section-label">Wrapping</p>
          <select
            className="input-text"
            value={elkSettings.wrappingStrategy}
            onChange={(event) => updateElkExperimentSettings({ wrappingStrategy: event.target.value as typeof elkSettings.wrappingStrategy })}
            aria-label="ELK wrapping strategy"
            disabled={layeredOnly}
          >
            {ELK_WRAPPING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="control-row split-row">
          <p className="section-label">Favor Straight Edges</p>
          <button
            className="toggle-track"
            data-active={elkSettings.favorStraightEdges}
            onClick={() => updateElkExperimentSettings({ favorStraightEdges: !elkSettings.favorStraightEdges })}
            aria-label="Toggle favor straight edges"
            disabled={layeredOnly}
          >
            <div className="toggle-thumb" />
          </button>
        </div>

        <div className="control-row split-row">
          <p className="section-label">Feedback Edges</p>
          <button
            className="toggle-track"
            data-active={elkSettings.feedbackEdges}
            onClick={() => updateElkExperimentSettings({ feedbackEdges: !elkSettings.feedbackEdges })}
            aria-label="Toggle feedback edges"
            disabled={layeredOnly}
          >
            <div className="toggle-thumb" />
          </button>
        </div>

        <div className="settings-field">
          <p className="section-label">Straightness Priority</p>
          <input
            className="input-text"
            type="number"
            min="0"
            max="20"
            step="1"
            value={elkSettings.straightnessPriority}
            onChange={(event) => updateElkExperimentSettings({ straightnessPriority: Number.parseInt(event.target.value || '0', 10) || 0 })}
            aria-label="ELK straightness priority"
            disabled={layeredOnly}
          />
        </div>

        <div className="settings-field">
          <p className="section-label">Thoroughness</p>
          <input
            className="input-text"
            type="number"
            min="1"
            max="40"
            step="1"
            value={elkSettings.thoroughness}
            onChange={(event) => updateElkExperimentSettings({ thoroughness: Number.parseInt(event.target.value || '1', 10) || 1 })}
            aria-label="ELK thoroughness"
            disabled={layeredOnly}
          />
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-section">
        <p className="section-heading">Last Run</p>
        {lastLayoutRun ? (
          <>
            <div className="layout-metrics-summary">
              <span>{lastLayoutRun.algorithm}</span>
              <span>{lastLayoutRun.direction}</span>
              <span>{formatNumber(lastLayoutRun.durationMs)} ms</span>
            </div>
            <div className="layout-metrics-grid">
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Score</span>
                <strong>{formatNumber(lastLayoutRun.score)}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Node Overlaps</span>
                <strong>{lastLayoutRun.metrics.nodeOverlaps}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Edge Crossings</span>
                <strong>{lastLayoutRun.metrics.edgeCrossings}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Edge / Node</span>
                <strong>{lastLayoutRun.metrics.edgeNodeOverlaps}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Connector Conflicts</span>
                <strong>{lastLayoutRun.metrics.connectorConflicts}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Edge Length</span>
                <strong>{formatNumber(lastLayoutRun.metrics.totalEdgeLength)}</strong>
              </div>
              <div className="layout-metrics-item">
                <span className="layout-metrics-label">Bounding Area</span>
                <strong>{formatNumber(lastLayoutRun.metrics.boundingArea)}</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="layout-lab-copy">Run Auto-layout to populate the current layout metrics.</p>
        )}
      </div>
    </div>
  );
}
