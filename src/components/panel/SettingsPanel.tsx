import { useEffect, useMemo } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { findCausalLoops, labelCausalLoops, summarizeCausalLoops } from '../../core/graph/derived';
import LoopCard from '../form/LoopCard';

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
        <p className="section-label">Name</p>
        <input
          className="input-text"
          type="text"
          value={diagramName}
          onChange={(e) => setDiagramName(e.target.value)}
          placeholder="Untitled Diagram"
          aria-label="Diagram name"
        />
      </div>


      {framework.allowsCycles && (
        <div className="section-stack" style={{ gap: '0.5rem' }}>
          <p className="section-label">Feedback Loops</p>
          <div className="control-row">
            <span className="badge" style={{ backgroundColor: 'color-mix(in srgb, var(--loop-info) 8%, transparent)', color: 'var(--loop-info)' }}>
              {loopSummary.totalLoops} Total
            </span>
            <span className="badge" style={{ backgroundColor: 'color-mix(in srgb, var(--loop-reinforcing) 8%, transparent)', color: 'var(--loop-reinforcing)' }}>
              {loopSummary.reinforcingLoops} Reinforcing
            </span>
            <span className="badge" style={{ backgroundColor: 'color-mix(in srgb, var(--loop-balancing) 8%, transparent)', color: 'var(--loop-balancing)' }}>
              {loopSummary.balancingLoops} Balancing
            </span>
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
            loops.map((loop) => (
              <LoopCard
                key={loop.id}
                loop={loop}
                selected={selectedLoopId === loop.id}
                onSelect={() => setSelectedLoop(selectedLoopId === loop.id ? null : loop.id)}
                nodeLabels={nodeLabels}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
