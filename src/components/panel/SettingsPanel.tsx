import { useEffect, useMemo } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { findCausalLoops, labelCausalLoops, summarizeCausalLoops } from '../../core/graph/derived';

export default function SettingsPanel() {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const diagramName = useDiagramStore((s) => s.diagram.name);
  const setDiagramName = useDiagramStore((s) => s.setDiagramName);
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);
  const framework = useDiagramStore((s) => s.framework);
  const loops = useMemo(
    () => (framework.allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : []),
    [edges, framework.allowsCycles],
  );
  const loopSummary = summarizeCausalLoops(loops);
  const nodeLabels = new Map(nodes.map((node) => [node.id, node.data.label || node.id]));

  useEffect(() => {
    if (selectedLoopId && !loops.some((loop) => loop.id === selectedLoopId)) {
      setSelectedLoop(null);
    }
  }, [loops, selectedLoopId, setSelectedLoop]);

  return (
    <div className="section-stack">
      <p className="section-heading">Diagram</p>

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


      {framework.allowsCycles && (
        <div className="section-stack" style={{ gap: '0.5rem' }}>
          <p className="section-label">Feedback Loops</p>
          <div className="control-row">
            <span className="badge" style={{ backgroundColor: '#5C8DB515', color: '#5C8DB5' }}>
              {loopSummary.totalLoops} Total
            </span>
            <span className="badge" style={{ backgroundColor: '#4CAF5015', color: '#4CAF50' }}>
              {loopSummary.reinforcingLoops} Reinforcing
            </span>
            <span className="badge" style={{ backgroundColor: '#FB8C0015', color: '#FB8C00' }}>
              {loopSummary.balancingLoops} Balancing
            </span>
            {loopSummary.delayedLoops > 0 && (
              <span className="badge" style={{ backgroundColor: '#8A8A7A15', color: '#8A8A7A' }}>
                {loopSummary.delayedLoops} Delayed
              </span>
            )}
            {selectedLoopId && (
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => setSelectedLoop(null)}
              >
                Show All
              </button>
            )}
          </div>
          {loops.length === 0 ? (
            <p className="field-label">No feedback loops detected yet.</p>
          ) : (
            loops.slice(0, 6).map((loop) => (
              <button
                key={loop.id}
                type="button"
                className="section-stack"
                onClick={() => setSelectedLoop(selectedLoopId === loop.id ? null : loop.id)}
                style={{
                  gap: '0.25rem',
                  width: '100%',
                  padding: '0.5rem',
                  border: selectedLoopId === loop.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  background: selectedLoopId === loop.id ? 'rgba(92, 141, 181, 0.08)' : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                aria-pressed={selectedLoopId === loop.id}
              >
                <div className="control-row" style={{ gap: '0.5rem' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: loop.kind === 'reinforcing' ? '#4CAF5015' : '#FB8C0015',
                      color: loop.kind === 'reinforcing' ? '#4CAF50' : '#FB8C00',
                    }}
                  >
                    {loop.label}
                  </span>
                  {loop.delayedEdgeCount > 0 && (
                    <span className="badge" style={{ backgroundColor: '#8A8A7A15', color: '#8A8A7A' }}>
                      Delay
                    </span>
                  )}
                </div>
                <p className="field-label">
                  {loop.nodeIds.map((nodeId) => nodeLabels.get(nodeId) ?? nodeId).join(' -> ')}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
