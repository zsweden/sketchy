import { useCallback, useEffect, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { useEdgeRoutingStore } from '../../store/edge-routing-store';
import { useUIStore } from '../../store/ui-store';
import { DEFAULT_EDGE_ROUTING_CONFIG, type EdgeRoutingPolicy } from '../../core/edge-routing';

const POLICY_OPTIONS: { value: EdgeRoutingPolicy; label: string }[] = [
  { value: 'shared-endpoint-outside-buffer-same-type-only', label: 'Default (buffer + same-type)' },
  { value: 'shared-endpoint-same-type-forgiven', label: 'Forgive same-direction' },
  { value: 'shared-endpoint-outside-buffer', label: 'Buffer only' },
  { value: 'shared-endpoint-anywhere', label: 'Penalize all' },
  { value: 'legacy', label: 'Legacy (forgive all shared)' },
];

function NumberField({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    onChange(parsed);
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const isModified = value !== defaultValue;

  return (
    <div className="section-stack gap-field">
      <p className="section-label" style={{ opacity: isModified ? 1 : 0.6 }}>
        {label}{isModified ? ' *' : ''}
      </p>
      <input
        className="input-text"
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={label}
      />
    </div>
  );
}

export default function EdgeRoutingPanel() {
  const edgeCrossingPenalty = useEdgeRoutingStore((s) => s.edgeCrossingPenalty);
  const edgeNodeOverlapPenalty = useEdgeRoutingStore((s) => s.edgeNodeOverlapPenalty);
  const edgeLengthSquared = useEdgeRoutingStore((s) => s.edgeLengthSquared);
  const flowAlignedBonus = useEdgeRoutingStore((s) => s.flowAlignedBonus);
  const crossingPolicy = useEdgeRoutingStore((s) => s.crossingPolicy);
  const mixedDirectionPenalty = useEdgeRoutingStore((s) => s.mixedDirectionPenalty);
  const setEdgeCrossingPenalty = useEdgeRoutingStore((s) => s.setEdgeCrossingPenalty);
  const setEdgeNodeOverlapPenalty = useEdgeRoutingStore((s) => s.setEdgeNodeOverlapPenalty);
  const setEdgeLengthSquared = useEdgeRoutingStore((s) => s.setEdgeLengthSquared);
  const setFlowAlignedBonus = useEdgeRoutingStore((s) => s.setFlowAlignedBonus);
  const setCrossingPolicy = useEdgeRoutingStore((s) => s.setCrossingPolicy);
  const setMixedDirectionPenalty = useEdgeRoutingStore((s) => s.setMixedDirectionPenalty);
  const resetDefaults = useEdgeRoutingStore((s) => s.resetDefaults);
  const addToast = useUIStore((s) => s.addToast);

  const copySettings = useCallback(() => {
    const config = useEdgeRoutingStore.getState().getConfig();
    const text = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      addToast('Settings copied to clipboard');
    });
  }, [addToast]);

  const hasChanges =
    edgeCrossingPenalty !== DEFAULT_EDGE_ROUTING_CONFIG.edgeCrossingPenalty ||
    edgeNodeOverlapPenalty !== DEFAULT_EDGE_ROUTING_CONFIG.edgeNodeOverlapPenalty ||
    edgeLengthSquared !== DEFAULT_EDGE_ROUTING_CONFIG.edgeLengthSquared ||
    flowAlignedBonus !== DEFAULT_EDGE_ROUTING_CONFIG.flowAlignedBonus ||
    crossingPolicy !== DEFAULT_EDGE_ROUTING_CONFIG.crossingPolicy ||
    mixedDirectionPenalty !== DEFAULT_EDGE_ROUTING_CONFIG.mixedDirectionPenalty;

  return (
    <div className="section-stack">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="section-heading">Edge Routing</p>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={copySettings}
            title="Copy settings"
            aria-label="Copy settings"
            style={{ marginTop: 0 }}
          >
            <Copy size={14} />
          </button>
          {hasChanges && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={resetDefaults}
              title="Reset to defaults"
              aria-label="Reset to defaults"
              style={{ marginTop: 0 }}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="section-stack gap-field">
        <p className="section-label" style={{ opacity: crossingPolicy !== DEFAULT_EDGE_ROUTING_CONFIG.crossingPolicy ? 1 : 0.6 }}>
          Crossing Policy{crossingPolicy !== DEFAULT_EDGE_ROUTING_CONFIG.crossingPolicy ? ' *' : ''}
        </p>
        <select
          className="input-text"
          value={crossingPolicy}
          onChange={(e) => setCrossingPolicy(e.target.value as EdgeRoutingPolicy)}
          aria-label="Crossing Policy"
        >
          {POLICY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <NumberField
        label="Edge Crossing Penalty"
        value={edgeCrossingPenalty}
        defaultValue={DEFAULT_EDGE_ROUTING_CONFIG.edgeCrossingPenalty}
        onChange={setEdgeCrossingPenalty}
      />

      <NumberField
        label="Edge-Node Overlap Penalty"
        value={edgeNodeOverlapPenalty}
        defaultValue={DEFAULT_EDGE_ROUTING_CONFIG.edgeNodeOverlapPenalty}
        onChange={setEdgeNodeOverlapPenalty}
      />

      <NumberField
        label="Mixed-Direction Penalty"
        value={mixedDirectionPenalty}
        defaultValue={DEFAULT_EDGE_ROUTING_CONFIG.mixedDirectionPenalty}
        onChange={setMixedDirectionPenalty}
      />

      <div className="section-stack gap-field">
        <p className="section-label">Edge Length Mode</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={edgeLengthSquared}
            onChange={(e) => setEdgeLengthSquared(e.target.checked)}
          />
          <span className="field-label">Squared Manhattan distance</span>
        </label>
      </div>

      <NumberField
        label="Flow-Aligned Bonus"
        value={flowAlignedBonus}
        defaultValue={DEFAULT_EDGE_ROUTING_CONFIG.flowAlignedBonus}
        onChange={setFlowAlignedBonus}
      />
    </div>
  );
}
