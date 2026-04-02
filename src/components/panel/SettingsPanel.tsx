import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [nameDraft, setNameDraft] = useState(diagramName);

  useEffect(() => {
    if (selectedLoopId && !loops.some((loop) => loop.id === selectedLoopId)) {
      setSelectedLoop(null);
    }
  }, [loops, selectedLoopId, setSelectedLoop]);

  useEffect(() => {
    // Keep the name draft aligned when the diagram name changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNameDraft(diagramName);
  }, [diagramName]);

  const handleNameBlur = useCallback(() => {
    if (nameDraft !== diagramName) {
      setDiagramName(nameDraft);
    }
  }, [diagramName, nameDraft, setDiagramName]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  return (
    <div className="section-stack">
      <p className="section-heading">Diagram</p>

      {/* Diagram name */}
      <div className="section-stack gap-field">
        <p className="section-label">Name</p>
        <input
          className="input-text"
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          placeholder="Untitled Diagram"
          aria-label="Diagram name"
        />
      </div>


      {framework.allowsCycles && (
        <div className="section-stack gap-section">
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
