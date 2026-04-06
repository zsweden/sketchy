import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { getDerivedIndicators } from '../../core/graph/derived';
import { getJunctionOptions } from '../../core/framework-types';
import {
  HANDLE_CORNER_OFFSET,
  VISIBLE_HANDLE_SIDES,
  getBaseHandleSide,
} from '../../core/graph/ports';
import type { CardinalHandleSide, EdgeHandleSide as HandleSide } from '../../core/types';

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

function getVisibleHandleStyle(side: HandleSide): CSSProperties | undefined {
  switch (side) {
    case 'topleft-top':
      return { left: HANDLE_CORNER_OFFSET };
    case 'topleft-left':
      return { top: HANDLE_CORNER_OFFSET };
    case 'topright-top':
      return { left: `calc(100% - ${HANDLE_CORNER_OFFSET}px)` };
    case 'topright-right':
      return { top: HANDLE_CORNER_OFFSET };
    case 'bottomright-right':
      return { top: `calc(100% - ${HANDLE_CORNER_OFFSET}px)` };
    case 'bottomright-bottom':
      return { left: `calc(100% - ${HANDLE_CORNER_OFFSET}px)` };
    case 'bottomleft-bottom':
      return { left: HANDLE_CORNER_OFFSET };
    case 'bottomleft-left':
      return { top: `calc(100% - ${HANDLE_CORNER_OFFSET}px)` };
    default:
      return undefined;
  }
}

function EntityNode({ id, data, selected }: NodeProps) {
  const TOUCH_DOUBLE_TAP_MS = 320;
  const TOUCH_MOVE_TOLERANCE_PX = 14;
  const HANDLE_REVEAL_DISTANCE_PX = 40;
  const nodeData = data as unknown as EntityNodeData;
  const [editing, setEditing] = useState(false);
  const [handlesVisible, setHandlesVisible] = useState(false);
  const [text, setText] = useState(nodeData.label);
  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchPointerId = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTouchTap = useRef<{ timestamp: number; x: number; y: number } | null>(null);

  const commitNodeText = useDiagramStore((s) => s.commitNodeText);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const showActiveAttachments = useDiagramStore((s) => s.diagram.settings.showActiveAttachments);
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
  const activeHandles = nodeData.activeHandles as Set<string> | undefined;

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

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const nodeElement = nodeRef.current;
      if (!nodeElement) return;

      const rect = nodeElement.getBoundingClientRect();
      const isNear = event.clientX >= rect.left - HANDLE_REVEAL_DISTANCE_PX
        && event.clientX <= rect.right + HANDLE_REVEAL_DISTANCE_PX
        && event.clientY >= rect.top - HANDLE_REVEAL_DISTANCE_PX
        && event.clientY <= rect.bottom + HANDLE_REVEAL_DISTANCE_PX;

      setHandlesVisible((current) => (current === isNear ? current : isNear));
    };

    const handlePointerLeave = () => {
      setHandlesVisible(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      setHandlesVisible(true);
    }
    if (e.pointerType !== 'touch' || editing) return;
    touchPointerId.current = e.pointerId;
    touchStart.current = { x: e.clientX, y: e.clientY, moved: false };
  }, [editing]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || touchPointerId.current !== e.pointerId || !touchStart.current) return;
    const movedX = e.clientX - touchStart.current.x;
    const movedY = e.clientY - touchStart.current.y;
    if (Math.hypot(movedX, movedY) > TOUCH_MOVE_TOLERANCE_PX) {
      touchStart.current.moved = true;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || touchPointerId.current !== e.pointerId) return;
    touchPointerId.current = null;

    const touch = touchStart.current;
    touchStart.current = null;
    if (!touch || touch.moved || editing) return;

    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.react-flow__handle, textarea, button')) {
      lastTouchTap.current = null;
      return;
    }

    const now = Date.now();
    const lastTap = lastTouchTap.current;
    if (
      lastTap &&
      now - lastTap.timestamp <= TOUCH_DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= TOUCH_MOVE_TOLERANCE_PX
    ) {
      lastTouchTap.current = null;
      setEditing(true);
      return;
    }

    lastTouchTap.current = { timestamp: now, x: e.clientX, y: e.clientY };
  }, [editing]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (touchPointerId.current !== e.pointerId) return;
    touchPointerId.current = null;
    touchStart.current = null;
  }, []);

  const junctionOptions = getJunctionOptions(framework);
  const isMathJunction = junctionOptions.some((o) => o.id === 'add' || o.id === 'multiply');
  const showJunction = framework.supportsJunctions && (isMathJunction ? degrees.indegree >= 1 : degrees.indegree >= 2);
  const handleJunctionToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).blur();
      const currentIdx = junctionOptions.findIndex((o) => o.id === nodeData.junctionType);
      const nextIdx = (currentIdx + 1) % junctionOptions.length;
      updateNodeJunction(id, junctionOptions[nextIdx].id as EntityNodeData['junctionType']);
    },
    [id, nodeData.junctionType, updateNodeJunction, junctionOptions],
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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

      {showJunction && isMathJunction && (() => {
        const sym = junctionOptions.find((o) => o.id === nodeData.junctionType)?.symbol;
        return sym ? (
          <button
            className="operator-chip nodrag"
            onClick={handleJunctionToggle}
            title={`Operator: ${junctionOptions.find((o) => o.id === nodeData.junctionType)?.label} — click to toggle`}
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
          className={`handle-target handle-${side} ${showJunction ? 'junction-handle nodrag' : ''} ${showActiveAttachments && activeHandles?.has(`target-${side}`) ? 'handle-active' : ''}`}
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

      {VISIBLE_HANDLE_SIDES.map((side) => (
        <Handle
          key={`source-${side}`}
          type="source"
          position={getPositionForBaseSide(getBaseHandleSide(side))}
          id={`source-${side}`}
          style={getVisibleHandleStyle(side)}
          className={`handle-source handle-${side} ${showActiveAttachments && activeHandles?.has(`source-${side}`) ? 'handle-active' : ''}`}
        />
      ))}
    </div>
  );
}

export default memo(EntityNode);
