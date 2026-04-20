import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { getDerivedIndicators } from '../../core/graph/derived';
import { getJunctionOptions, getJunctionState } from '../../core/framework-types';
import {
  HANDLE_CORNER_OFFSET,
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
} from '../../core/graph/ports';
import type { CardinalHandleSide, EdgeHandleSide as HandleSide } from '../../core/types';
import { useTouchNodeEditing } from '../../hooks/useTouchNodeEditing';
import { useHandleProximity } from '../../hooks/useHandleProximity';

interface EntityNodeData {
  label: string;
  tags: string[];
  junctionType: 'and' | 'or';
  value?: number;
  unit?: string;
  color?: string;
  textColor?: string;
  locked?: boolean;
  highlightState?: 'highlighted' | 'dimmed' | 'none';
  loopKind?: 'reinforcing' | 'balancing';
  [key: string]: unknown;
}

function formatNodeValue(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 1e6 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function getPositionForBaseSide(side: CardinalHandleSide): Position {
  switch (side) {
    case 'top':
      return Position.Top;
    case 'right':
      return Position.Right;
    case 'bottom':
      return Position.Bottom;
    case 'left':
      return Position.Left;
  }
}

const NEAR = HANDLE_CORNER_OFFSET;
const FAR = `calc(100% - ${HANDLE_CORNER_OFFSET}px)`;
const HANDLE_STYLES: Partial<Record<HandleSide, CSSProperties>> = {
  'topleft-top': { left: NEAR },
  'topleft-left': { top: NEAR },
  'topright-top': { left: FAR },
  'topright-right': { top: NEAR },
  'bottomright-right': { top: FAR },
  'bottomright-bottom': { left: FAR },
  'bottomleft-bottom': { left: NEAR },
  'bottomleft-left': { top: FAR },
};

function getVisibleHandleStyle(side: HandleSide): CSSProperties | undefined {
  return HANDLE_STYLES[side];
}

function EntityNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EntityNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [nodeRef, handlesVisible, setHandlesVisible] = useHandleProximity();
  const touch = useTouchNodeEditing({
    editing,
    onStartEditing: () => setEditing(true),
    onTouchStart: () => setHandlesVisible(true),
  });

  const commitNodeText = useDiagramStore((s) => s.commitNodeText);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const framework = useFramework();
  const isAiModified = useChatStore((s) => s.aiModifiedNodeIds.has(id));
  const connection = useConnection();
  const isConnectionInProgress = connection.inProgress;
  const isConnectionSourceNode = isConnectionInProgress && connection.fromHandle.nodeId === id;

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

  const junctionOptions = getJunctionOptions(framework);
  const junctionState = getJunctionState(framework, degrees.indegree, nodeData.junctionType);
  const showJunction = junctionState !== null;
  const nextJunctionId = junctionState?.next.id;
  const handleJunctionToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).blur();
      if (nextJunctionId) updateNodeJunction(id, nextJunctionId as EntityNodeData['junctionType']);
    },
    [id, nextJunctionId, updateNodeJunction],
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
      ref={nodeRef}
      className={[
        'entity-node',
        selected ? 'selected' : '',
        (handlesVisible || editing) ? 'handles-visible' : '',
        isConnectionInProgress ? 'connection-in-progress' : '',
        isConnectionSourceNode ? 'connection-source-node' : '',
        nodeData.highlightState === 'highlighted' ? 'highlighted' : '',
        nodeData.highlightState === 'dimmed' ? 'dimmed' : '',
        nodeData.highlightState === 'highlighted' && nodeData.loopKind
          ? `loop-focused loop-${nodeData.loopKind}`
          : '',
      ].join(' ')}
      onDoubleClick={handleDoubleClick}
      onPointerDown={touch.handlePointerDown}
      onPointerMove={touch.handlePointerMove}
      onPointerUp={touch.handlePointerUp}
      onPointerCancel={touch.handlePointerCancel}
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

      {junctionState?.isMath && (() => {
        const sym = junctionState.current.symbol;
        return sym ? (
          <button
            className="operator-chip nodrag"
            onClick={handleJunctionToggle}
            title={`Operator: ${junctionState.current.label} — click to toggle`}
          >
            {sym}
          </button>
        ) : null;
      })()}

      {isAiModified && <div className="ai-modified-dot" />}
      {nodeData.locked && (
        <div className="node-lock-indicator" title="Position locked">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="7" width="12" height="8" rx="1.5" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}

      {VISIBLE_HANDLE_SIDES.map((side) => (
        <Handle
          key={`target-${side}`}
          type="target"
          position={getPositionForBaseSide(getBaseHandleSide(side))}
          id={`target-${side}`}
          style={getVisibleHandleStyle(side)}
          className={`handle-target handle-${side} ${showJunction ? 'junction-handle nodrag' : ''}`}
          onClick={showJunction ? handleJunctionToggle : undefined}
          title={showJunction ? `Junction: ${junctionOptions.find((o) => o.id === nodeData.junctionType)?.label ?? nodeData.junctionType} — click to toggle` : undefined}
        >
          {showJunction && side === 'top' && (() => {
            const sym = junctionOptions.find((o) => o.id === nodeData.junctionType)?.symbol;
            return sym ? <span className="junction-symbol">{sym}</span> : null;
          })()}
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
                Double-tap or double-click to edit
              </span>
            )}
          </div>
        )}

        {framework.supportsNodeValues && nodeData.value != null && (
          <div className="entity-node-value">
            {formatNodeValue(nodeData.value, nodeData.unit)}
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
                {tag!.shortName.slice(0, 3)}
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
                {ind.shortName.slice(0, 3)}
              </span>
            ))}
          </div>
        )}
      </div>

      {VISIBLE_HANDLE_SIDES.map((side) => (
        <Handle
          key={`source-${side}`}
          type="source"
          position={getPositionForBaseSide(getBaseHandleSide(side))}
          id={`source-${side}`}
          style={getVisibleHandleStyle(side)}
          className={`handle-source handle-${side}`}
        />
      ))}
    </div>
  );
}

export default memo(EntityNode);
