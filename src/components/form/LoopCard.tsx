import type { NamedCausalLoop } from '../../core/graph/derived';

interface Props {
  loop: NamedCausalLoop;
  selected: boolean;
  onSelect: () => void;
  nodeLabels: Map<string, string>;
}

export default function LoopCard({ loop, selected, onSelect, nodeLabels }: Props) {
  return (
    <button
      type="button"
      className="section-stack"
      onClick={onSelect}
      style={{
        gap: '0.25rem',
        width: '100%',
        padding: '0.5rem',
        border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: '0.75rem',
        background: selected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      aria-pressed={selected}
    >
      <div className="control-row gap-md">
        <span
          className="badge"
          style={{
            backgroundColor: loop.kind === 'reinforcing'
              ? 'color-mix(in srgb, var(--loop-reinforcing) 8%, transparent)'
              : 'color-mix(in srgb, var(--loop-balancing) 8%, transparent)',
            color: loop.kind === 'reinforcing'
              ? 'var(--loop-reinforcing)'
              : 'var(--loop-balancing)',
          }}
        >
          {loop.label}
        </span>
        {loop.delayedEdgeCount > 0 && (
          <span className="badge" style={{
            backgroundColor: 'color-mix(in srgb, var(--loop-muted) 8%, transparent)',
            color: 'var(--loop-muted)',
          }}>
            Delay
          </span>
        )}
      </div>
      <p className="field-label">
        {loop.nodeIds.map((nodeId) => nodeLabels.get(nodeId) ?? nodeId).join(' \u2192 ')}
      </p>
    </button>
  );
}
