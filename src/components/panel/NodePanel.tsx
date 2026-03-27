import { useCallback, useEffect, useState } from 'react';
import type { DiagramNode } from '../../core/types';
import { useDiagramStore } from '../../store/diagram-store';
import { computeNodeDegrees, getDerivedIndicators } from '../../core/graph/derived';

interface Props {
  node: DiagramNode;
}

export default function NodePanel({ node }: Props) {
  const [text, setText] = useState(node.data.label);

  const framework = useDiagramStore((s) => s.framework);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const updateNodeText = useDiagramStore((s) => s.updateNodeText);
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);

  const degreesMap = computeNodeDegrees(edges);
  const degrees = degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 };
  const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);

  useEffect(() => {
    setText(node.data.label);
  }, [node.data.label]);

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
    </div>
  );
}
