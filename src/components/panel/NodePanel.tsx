import { useCallback, useEffect, useState } from 'react';
import type { DiagramNode } from '../../core/types';
import { useDiagramStore } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import {
  computeNodeDegrees,
  findCausalLoops,
  getDerivedIndicators,
} from '../../core/graph/derived';

interface Props {
  node: DiagramNode;
}

export default function NodePanel({ node }: Props) {
  const [text, setText] = useState(node.data.label);
  const [notes, setNotes] = useState(node.data.notes ?? '');

  const framework = useDiagramStore((s) => s.framework);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const updateNodeText = useDiagramStore((s) => s.updateNodeText);
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const updateNodeNotes = useDiagramStore((s) => s.updateNodeNotes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const removeAiModified = useChatStore((s) => s.removeAiModified);

  // Clear the AI-modified green dot when the user views this node
  useEffect(() => {
    removeAiModified(node.id);
  }, [node.id, removeAiModified]);

  const degreesMap = computeNodeDegrees(edges);
  const degrees = degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 };
  const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
  const loops = framework.allowsCycles ? findCausalLoops(edges) : [];
  const nodeLoops = loops.filter((loop) => loop.nodeIds.includes(node.id));
  const nodeLabels = new Map(nodes.map((entry) => [entry.id, entry.data.label || entry.id]));

  useEffect(() => {
    // Keep the text draft aligned when the selected node changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(node.data.label);
  }, [node.data.label]);

  useEffect(() => {
    // Keep the notes draft aligned when the selected node changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(node.data.notes ?? '');
  }, [node.data.notes]);

  const handleNotesBlur = useCallback(() => {
    const current = node.data.notes ?? '';
    if (notes !== current) {
      commitToHistory();
      updateNodeNotes(node.id, notes);
    }
  }, [notes, node.data.notes, node.id, updateNodeNotes, commitToHistory]);

  const handleTextBlur = useCallback(() => {
    if (text !== node.data.label) {
      commitToHistory();
      updateNodeText(node.id, text);
    }
  }, [text, node.data.label, node.id, updateNodeText, commitToHistory]);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (e.target as HTMLTextAreaElement).blur();
      }
    },
    [],
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      const current = node.data.tags;
      const next = current.includes(tagId)
        ? current.filter((t) => t !== tagId)
        : [...current, tagId];
      updateNodeTags(node.id, next);
    },
    [node.id, node.data.tags, updateNodeTags],
  );

  return (
    <div className="section-stack">
      {/* Text */}
      <div className="section-stack" style={{ gap: '0.375rem' }}>
        <p className="section-label">Text</p>
        <textarea
          className="input-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          rows={3}
          placeholder="Enter text..."
          aria-label="Node text"
        />
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
          aria-label="Node notes"
        />
      </div>

      {/* Tags */}
      {framework.nodeTags.length > 0 && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Tags</p>
          <div className="control-row">
            {framework.nodeTags.map((tag) => (
              <button
                key={tag.id}
                className="tag-chip"
                data-active={node.data.tags.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
                style={
                  node.data.tags.includes(tag.id)
                    ? { color: tag.color, borderColor: tag.color }
                    : undefined
                }
                title={tag.description}
              >
                <span
                  className="tag-chip-dot"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Junction */}
      {framework.supportsJunctions && degrees.indegree >= 2 && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Junction Logic</p>
          <div className="control-row">
            <button
              className="btn btn-xs"
              style={
                node.data.junctionType === 'and'
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--secondary)' }
              }
              onClick={() => updateNodeJunction(node.id, 'and')}
            >
              AND
            </button>
            <button
              className="btn btn-xs"
              style={
                node.data.junctionType === 'or'
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--secondary)' }
              }
              onClick={() => updateNodeJunction(node.id, 'or')}
            >
              OR
            </button>
          </div>
          <p className="field-label" style={{ marginTop: '-0.25rem' }}>
            {node.data.junctionType === 'and'
              ? 'All incoming causes required'
              : 'Any single cause is sufficient'}
          </p>
        </div>
      )}

      {/* Derived indicators */}
      {derived.length > 0 && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Derived Properties</p>
          {derived.map((ind) => (
            <div key={ind.id} className="control-row" style={{ gap: '0.5rem' }}>
              <span
                className="badge"
                style={{
                  backgroundColor: `${ind.color}15`,
                  color: ind.color,
                }}
              >
                {ind.shortName}
              </span>
              <span className="field-label">{ind.description}</span>
            </div>
          ))}
        </div>
      )}

      {framework.allowsCycles && (
        <div className="section-stack" style={{ gap: '0.375rem' }}>
          <p className="section-label">Loop Membership</p>
          {nodeLoops.length === 0 ? (
            <p className="field-label">This variable is not part of a detected feedback loop.</p>
          ) : (
            nodeLoops.map((loop, index) => (
              <div key={loop.edgeIds.join('-')} className="section-stack" style={{ gap: '0.25rem' }}>
                <div className="control-row" style={{ gap: '0.5rem' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: loop.kind === 'reinforcing' ? '#4CAF5015' : '#FB8C0015',
                      color: loop.kind === 'reinforcing' ? '#4CAF50' : '#FB8C00',
                    }}
                  >
                    {loop.kind === 'reinforcing' ? `R${index + 1}` : `B${index + 1}`}
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
