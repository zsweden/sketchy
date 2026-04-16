import { memo, useCallback, useEffect, useState } from 'react';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  nodeId: string;
  label: string;
  notes: string;
}

function handleEnterBlur(e: React.KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    (e.target as HTMLTextAreaElement).blur();
  }
}

function NodeTextFields({ nodeId, label, notes }: Props) {
  const commitNodeText = useDiagramStore((s) => s.commitNodeText);
  const commitNodeNotes = useDiagramStore((s) => s.commitNodeNotes);
  const [text, setText] = useState(label);
  const [notesDraft, setNotesDraft] = useState(notes);

  useEffect(() => {
    setText(label);
  }, [label]);

  useEffect(() => {
    setNotesDraft(notes);
  }, [notes]);

  const handleTextBlur = useCallback(() => {
    if (text !== label) commitNodeText(nodeId, text);
  }, [text, label, nodeId, commitNodeText]);

  const handleNotesBlur = useCallback(() => {
    if (notesDraft !== notes) commitNodeNotes(nodeId, notesDraft);
  }, [notesDraft, notes, nodeId, commitNodeNotes]);

  return (
    <>
      <FormField label="Name">
        <textarea
          className="input-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={handleEnterBlur}
          rows={3}
          placeholder="Enter text..."
          aria-label="Node text"
        />
      </FormField>

      <FormField label="Notes">
        <textarea
          className="input-text"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={handleNotesBlur}
          rows={4}
          placeholder="Add notes..."
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          aria-label="Node notes"
        />
      </FormField>
    </>
  );
}

export default memo(NodeTextFields);
