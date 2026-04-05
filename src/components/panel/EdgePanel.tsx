import { useCallback, useEffect, useState } from 'react';
import type { DiagramEdge, EdgeConfidence, EdgePolarity } from '../../core/types';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { getJunctionOptions } from '../../core/framework-types';
import FormField from '../form/FormField';
import ButtonGroup from '../form/ButtonGroup';

interface Props {
  edge: DiagramEdge;
}

const CONFIDENCE_LEVELS: { value: EdgeConfidence; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const POLARITY_LEVELS: { value: EdgePolarity; label: string; title: string }[] = [
  { value: 'positive', label: '+', title: 'Moves in the same direction' },
  { value: 'negative', label: '-', title: 'Moves in the opposite direction' },
];

export default function EdgePanel({ edge }: Props) {
  const [notes, setNotes] = useState(edge.notes ?? '');

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const framework = useFramework();
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);
  const setEdgePolarity = useDiagramStore((s) => s.setEdgePolarity);
  const setEdgeDelay = useDiagramStore((s) => s.setEdgeDelay);
  const commitEdgeNotes = useDiagramStore((s) => s.commitEdgeNotes);

  useEffect(() => {
    // Keep the notes draft aligned when the selected edge changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(edge.notes ?? '');
  }, [edge.notes]);

  const handleNotesBlur = useCallback(() => {
    const current = edge.notes ?? '';
    if (notes !== current) {
      commitEdgeNotes(edge.id, notes);
    }
  }, [notes, edge.notes, edge.id, commitEdgeNotes]);

  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  const confidence = edge.confidence ?? 'high';
  const polarity = edge.polarity ?? 'positive';
  const delay = edge.delay ?? false;

  return (
    <div className="section-stack">
      <p className="section-heading">Edge</p>

      <FormField label="Connection">
        <p className="field-label">
          {sourceNode?.data.label ?? 'Unknown'} &rarr; {targetNode?.data.label ?? 'Unknown'}
        </p>
      </FormField>

      {framework.supportsEdgePolarity && (() => {
        const isMath = getJunctionOptions(framework).some((o) => o.id === 'add' || o.id === 'multiply');
        const targetOp = targetNode?.data.junctionType;
        return (
          <FormField label={isMath ? 'Sign' : 'Polarity'}>
            <ButtonGroup
              items={POLARITY_LEVELS}
              selected={polarity}
              onSelect={(v) => setEdgePolarity(edge.id, v)}
            />
            <p className="field-label" style={{ marginTop: '-0.25rem' }}>
              {isMath
                ? polarity === 'positive'
                  ? targetOp === 'multiply' ? 'Multiplied into the parent.' : 'Added to the parent.'
                  : targetOp === 'multiply' ? 'Parent is divided by this metric.' : 'Subtracted from the parent.'
                : polarity === 'positive'
                  ? 'If the source rises, the target tends to rise too.'
                  : 'If the source rises, the target tends to fall.'}
            </p>
          </FormField>
        );
      })()}

      {framework.supportsEdgeDelay && (
        <FormField label="Delay">
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
        </FormField>
      )}

      <FormField label="Confidence">
        <ButtonGroup
          items={CONFIDENCE_LEVELS}
          selected={confidence}
          onSelect={(v) => setEdgeConfidence(edge.id, v)}
        />
      </FormField>

      <FormField label="Notes">
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
      </FormField>
    </div>
  );
}
