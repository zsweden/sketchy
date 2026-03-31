import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { getDerivedIndicators } from '../../core/graph/derived';
import type { EdgeHandleSide as HandleSide } from '../../core/types';

interface EntityNodeData {
  label: string;
  tags: string[];
  junctionType: 'and' | 'or';
  color?: string;
  textColor?: string;
  locked?: boolean;
  highlightState?: 'highlighted' | 'dimmed' | 'none';
  loopKind?: 'reinforcing' | 'balancing';
  [key: string]: unknown;
}

const HANDLE_SIDES: { side: HandleSide; position: Position }[] = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

function EntityNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EntityNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commitNodeText = useDiagramStore((s) => s.commitNodeText);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const framework = useDiagramStore((s) => s.framework);
  const isAiModified = useChatStore((s) => s.aiModifiedNodeIds.has(id));

  const degreesMap = nodeData.degreesMap as Map<string, { indegree: number; outdegree: number }> | undefined;
  const derived = degreesMap
    ? getDerivedIndicators(id, degreesMap, framework.derivedIndicators)
    : [];
  const degrees = degreesMap?.get(id) ?? { indegree: 0, outdegree: 0 };

  useEffect(() => {
    // Keep the inline draft aligned when the store updates this node externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleJunctionToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateNodeJunction(id, nodeData.junctionType === 'and' ? 'or' : 'and');
    },
    [id, nodeData.junctionType, updateNodeJunction],
  );

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (text !== nodeData.label) {
      commitNodeText(id, text);
    }
  }, [text, nodeData.label, id, commitNodeText]);

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

  return (
    <div
      className={[
        'entity-node',
        selected ? 'selected' : '',
        nodeData.highlightState === 'dimmed' ? 'dimmed' : '',
        nodeData.highlightState === 'highlighted' && nodeData.loopKind
          ? `loop-focused loop-${nodeData.loopKind}`
          : '',
      ].join(' ')}
      onDoubleClick={handleDoubleClick}
      style={nodeData.color ? { backgroundColor: nodeData.color } : undefined}
      data-testid={`entity-node-${id}`}
      data-node-id={id}
    >
      {accentColor && (
        <div
          className="entity-node-accent"
          style={{ backgroundColor: accentColor }}
        />
      )}

      {isAiModified && <div className="ai-modified-dot" />}
      {nodeData.locked && (
        <div className="node-lock-indicator" title="Position locked">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="7" width="12" height="8" rx="1.5" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}

      {HANDLE_SIDES.map(({ side, position }) => (
        <Handle
          key={`target-${side}`}
          type="target"
          position={position}
          id={`target-${side}`}
          className={`handle-${side} ${framework.supportsJunctions && degrees.indegree >= 2 ? 'junction-handle nodrag' : ''}`}
          onClick={framework.supportsJunctions && degrees.indegree >= 2 ? handleJunctionToggle : undefined}
          title={framework.supportsJunctions && degrees.indegree >= 2 ? `Junction: ${nodeData.junctionType.toUpperCase()} — click to toggle` : undefined}
        >
          {framework.supportsJunctions && degrees.indegree >= 2 && nodeData.junctionType === 'and' && side === 'top' && (
            <span className="junction-symbol">&</span>
          )}
        </Handle>
      ))}

      <div className="entity-node-body">
        {editing ? (
          <textarea
            ref={textareaRef}
            className="entity-node-textarea nodrag nowheel"
            style={nodeData.textColor ? { color: nodeData.textColor } : undefined}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={Math.max(1, text.split('\n').length)}
            placeholder="Enter text..."
          />
        ) : (
          <div className="entity-node-label" style={nodeData.textColor ? { color: nodeData.textColor } : undefined}>
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

      {HANDLE_SIDES.map(({ side, position }) => (
        <Handle
          key={`source-${side}`}
          type="source"
          position={position}
          id={`source-${side}`}
          className={`handle-${side}`}
        />
      ))}
    </div>
  );
}

export default memo(EntityNode);
