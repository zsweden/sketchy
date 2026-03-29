import { useCallback, useEffect, useState } from 'react';
import type { DiagramEdge, EdgeConfidence, EdgePolarity } from '../../core/types';
import { useDiagramStore } from '../../store/diagram-store';

interface Props {
  edge: DiagramEdge;
}

const CONFIDENCE_LEVELS: { value: EdgeConfidence; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const POLARITY_LEVELS: { value: EdgePolarity; label: string; hint: string }[] = [
  { value: 'positive', label: '+', hint: 'Moves in the same direction' },
  { value: 'negative', label: '-', hint: 'Moves in the opposite direction' },
];

export default function EdgePanel({ edge }: Props) {
  const [notes, setNotes] = useState(edge.notes ?? '');

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const framework = useDiagramStore((s) => s.framework);
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);
  const setEdgePolarity = useDiagramStore((s) => s.setEdgePolarity);
  const setEdgeDelay = useDiagramStore((s) => s.setEdgeDelay);
  const updateEdgeNotes = useDiagramStore((s) => s.updateEdgeNotes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);

  useEffect(() => {
    // Keep the notes draft aligned when the selected edge changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const polarity = edge.polarity ?? 'positive';
  const delay = edge.delay ?? false;

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

      {framework.supportsEdgePolarity && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Polarity</p>
          <div className="control-row">
            {POLARITY_LEVELS.map((level) => (
              <button
                key={level.value}
                className="btn btn-xs"
                style={
                  polarity === level.value
                    ? { background: 'var(--accent)', color: 'white' }
                    : { background: 'var(--secondary)' }
                }
                title={level.hint}
                onClick={() => setEdgePolarity(edge.id, level.value)}
              >
                {level.label}
              </button>
            ))}
          </div>
          <p className="field-label" style={{ marginTop: '-0.25rem' }}>
            {polarity === 'positive'
              ? 'If the source rises, the target tends to rise too.'
              : 'If the source rises, the target tends to fall.'}
          </p>
        </div>
      )}

      {framework.supportsEdgeDelay && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Delay</p>
          <div className="control-row">
            <button
              className="btn btn-xs"
              style={
                delay
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--secondary)' }
              }
              onClick={() => setEdgeDelay(edge.id, !delay)}
            >
              {delay ? 'Delayed' : 'No Delay'}
            </button>
          </div>
        </div>
      )}

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
