import { useCallback, useEffect, useState } from 'react';
import type { DiagramEdge, EdgeConfidence } from '../../core/types';
import { useDiagramStore } from '../../store/diagram-store';

interface Props {
  edge: DiagramEdge;
}

const CONFIDENCE_LEVELS: { value: EdgeConfidence; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function EdgePanel({ edge }: Props) {
  const [notes, setNotes] = useState(edge.notes ?? '');

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);
  const updateEdgeNotes = useDiagramStore((s) => s.updateEdgeNotes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);

  useEffect(() => {
    setNotes(edge.notes ?? '');
  }, [edge.notes]);

  const handleNotesBlur = useCallback(() => {
    const current = edge.notes ?? '';
    if (notes !== current) {
      commitToHistory();
      updateEdgeNotes(edge.id, notes);
    }
  }, [notes, edge.notes, edge.id, updateEdgeNotes, commitToHistory]);

  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  const confidence = edge.confidence ?? 'high';

  return (
    <div className="section-stack">
      <p className="section-heading">Edge</p>

      {/* Source / Target */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Connection</p>
        <p className="field-label">
          {sourceNode?.data.label ?? 'Unknown'} &rarr; {targetNode?.data.label ?? 'Unknown'}
        </p>
      </div>

      {/* Confidence */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Confidence</p>
        <div className="control-row">
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level.value}
              className="btn btn-xs"
              style={
                confidence === level.value
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--secondary)' }
              }
              onClick={() => setEdgeConfidence(edge.id, level.value)}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Notes</p>
        <textarea
          className="input-text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={4}
          placeholder="Add notes..."
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          aria-label="Edge notes"
        />
      </div>
    </div>
  );
}
