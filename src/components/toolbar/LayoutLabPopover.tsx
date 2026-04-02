import { useEffect, useRef } from 'react';
import { type EdgeRoutingPolicy } from '../../core/edge-routing';
import {
  ELK_ALGORITHM_OPTIONS,
  ELK_CYCLE_BREAKING_OPTIONS,
  ELK_LAYERING_STRATEGY_OPTIONS,
  ELK_NODE_PLACEMENT_OPTIONS,
  ELK_WRAPPING_OPTIONS,
} from '../../core/layout/elk-options';
import { useDiagramStore } from '../../store/diagram-store';
import { useSettingsStore } from '../../store/settings-store';
import { getDefaultElkAlgorithm, resolveElkAlgorithm } from '../../core/layout/elk-engine';

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const EDGE_ROUTING_POLICY_OPTIONS: Array<{ value: EdgeRoutingPolicy; label: string }> = [
  { value: 'legacy', label: 'Legacy' },
  { value: 'reciprocal-only', label: 'Reciprocal crossings' },
  { value: 'shared-endpoint-outside-buffer', label: 'Shared-endpoint crossings outside node buffer' },
  { value: 'shared-endpoint-outside-buffer-same-type-only', label: 'Outside node buffer, or mixed endpoint direction inside buffer' },
  { value: 'shared-endpoint-outside-buffer-same-type-rewarded', label: 'Reward same endpoint direction inside buffer; penalize mixed or outside' },
  { value: 'shared-endpoint-anywhere', label: 'All shared-endpoint crossings' },
];

export default function LayoutLabPopover() {
  const open = useSettingsStore((s) => s.layoutLabOpen);
  const closeLayoutLab = useSettingsStore((s) => s.closeLayoutLab);
  const elkSettings = useSettingsStore((s) => s.elkExperimentSettings);
  const edgeRoutingPolicy = useSettingsStore((s) => s.edgeRoutingExperimentPolicy);
  const updateElkExperimentSettings = useSettingsStore((s) => s.updateElkExperimentSettings);
  const setEdgeRoutingExperimentPolicy = useSettingsStore((s) => s.setEdgeRoutingExperimentPolicy);
  const resetElkExperimentSettings = useSettingsStore((s) => s.resetElkExperimentSettings);
  const lastLayoutRun = useSettingsStore((s) => s.lastLayoutRun);
  const isCyclicFramework = useDiagramStore((s) => s.framework.allowsCycles === true);
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

  const defaultAlgorithm = getDefaultElkAlgorithm(isCyclicFramework);
  const effectiveAlgorithm = resolveElkAlgorithm(elkSettings.algorithmOverride, isCyclicFramework);
  const layeredOnly = effectiveAlgorithm !== 'layered';

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
            value={elkSettings.algorithmOverride ?? 'default'}
            onChange={(event) => updateElkExperimentSettings({
              algorithmOverride: event.target.value === 'default'
                ? null
                : event.target.value as NonNullable<typeof elkSettings.algorithmOverride>,
            })}
            aria-label="ELK engine"
          >
            <option value="default">Default ({defaultAlgorithm})</option>
            {ELK_ALGORITHM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="layout-lab-copy">Current page will use {effectiveAlgorithm}.</p>
        </div>

        <div className="settings-field">
          <p className="section-label">Edge Routing Policy</p>
          <select
            className="input-text"
            value={edgeRoutingPolicy}
            onChange={(event) => setEdgeRoutingExperimentPolicy(event.target.value as EdgeRoutingPolicy)}
            aria-label="Edge routing policy"
          >
            {EDGE_ROUTING_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="layout-lab-copy">Applies to optimized edge routing only and is not saved with the diagram.</p>
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

        <div className="settings-field">
          <p className="section-label">Node Spacing</p>
          <input
            className="input-text"
            type="number"
            min="0"
            max="400"
            step="5"
            value={elkSettings.nodeSpacing}
            onChange={(event) => updateElkExperimentSettings({ nodeSpacing: Number.parseInt(event.target.value || '0', 10) || 0 })}
            aria-label="ELK node spacing"
          />
        </div>

        <div className="settings-field">
          <p className="section-label">Component Spacing</p>
          <input
            className="input-text"
            type="number"
            min="0"
            max="600"
            step="5"
            value={elkSettings.componentSpacing}
            onChange={(event) => updateElkExperimentSettings({ componentSpacing: Number.parseInt(event.target.value || '0', 10) || 0 })}
            aria-label="ELK component spacing"
          />
        </div>

        <div className="control-row split-row">
          <p className="section-label">Separate Components</p>
          <button
            className="toggle-track"
            data-active={elkSettings.separateConnectedComponents}
            onClick={() => updateElkExperimentSettings({
              separateConnectedComponents: !elkSettings.separateConnectedComponents,
            })}
            aria-label="Toggle separate connected components"
          >
            <div className="toggle-thumb" />
          </button>
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
