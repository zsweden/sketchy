import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagram-store';
import { computeNodeDegrees, getDerivedIndicators } from '../../core/graph/derived';

interface EntityNodeData {
  label: string;
  tags: string[];
  junctionType: 'and' | 'or';
  [key: string]: unknown;
}

function EntityNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EntityNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeText = useDiagramStore((s) => s.updateNodeText);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const framework = useDiagramStore((s) => s.framework);
  const direction = useDiagramStore((s) => s.diagram.settings.layoutDirection);

  const degreesMap = computeNodeDegrees(edges);
  const derived = getDerivedIndicators(id, degreesMap, framework.derivedIndicators);
  const degrees = degreesMap.get(id) ?? { indegree: 0, outdegree: 0 };

  useEffect(() => {
    setText(nodeData.label);
  }, [nodeData.label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (text !== nodeData.label) {
      commitToHistory();
      updateNodeText(id, text);
    }
  }, [text, nodeData.label, id, updateNodeText, commitToHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (e.target as HTMLTextAreaElement).blur();
      }
      // Prevent React Flow from handling keys while editing
      e.stopPropagation();
    },
    [],
  );

  // Determine accent color: user tags > derived indicators > default
  const tagColors = nodeData.tags
    .map((t) => framework.nodeTags.find((nt) => nt.id === t))
    .filter(Boolean);
  const accentColor = tagColors.length > 0
    ? tagColors[0]!.color
    : derived.length > 0
      ? derived[0].color
      : undefined;

  const isTopToBottom = direction === 'TB';

  return (
    <div
      className={`entity-node ${selected ? 'selected' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      {accentColor && (
        <div
          className="entity-node-accent"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <Handle
        type="target"
        position={isTopToBottom ? Position.Top : Position.Bottom}
        id="target"
      />

      {/* Junction indicator */}
      {framework.supportsJunctions && degrees.indegree >= 2 && (
        <div
          className="junction-indicator"
          style={{
            top: isTopToBottom ? -16 : undefined,
            bottom: isTopToBottom ? undefined : -16,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {nodeData.junctionType === 'and' ? (
            <>
              <div
                className="junction-bar"
                style={{
                  width: '40px',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </>
          ) : (
            <span style={{ fontSize: '0.55rem' }}>OR</span>
          )}
        </div>
      )}

      <div className="entity-node-body">
        {editing ? (
          <textarea
            ref={textareaRef}
            className="entity-node-textarea nodrag nowheel"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={Math.max(1, text.split('\n').length)}
            placeholder="Enter text..."
          />
        ) : (
          <div className="entity-node-label">
            {nodeData.label || (
              <span style={{ color: 'var(--text-soft)', fontStyle: 'italic' }}>
                Double-click to edit
              </span>
            )}
          </div>
        )}

        {(tagColors.length > 0 || derived.length > 0) && (
          <div className="entity-node-badges">
            {tagColors.map((tag) => (
              <span
                key={tag!.id}
                className="badge"
                style={{
                  backgroundColor: `${tag!.color}20`,
                  color: tag!.color,
                }}
              >
                {tag!.shortName}
              </span>
            ))}
            {derived.map((ind) => (
              <span
                key={ind.id}
                className="badge"
                style={{
                  backgroundColor: `${ind.color}15`,
                  color: ind.color,
                }}
              >
                {ind.shortName}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={isTopToBottom ? Position.Bottom : Position.Top}
        id="source"
      />
    </div>
  );
}

export default memo(EntityNode);
