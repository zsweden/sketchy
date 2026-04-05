import { useCallback, useEffect, useRef } from 'react';
import { Pipette, Plus, Trash2, Check, Lock, Unlock } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import type { DiagramNode, JunctionType } from '../../core/types';
import { getJunctionOptions } from '../../core/framework-types';
import type { Framework } from '../../core/framework-types';
import {
  normalizeHexColor,
  rememberRecentColor,
} from '../../store/color-history-store';
import { computeNodeDegrees } from '../../core/graph/derived';

const SHARED_COLORS = [
  { id: 'black', label: 'Black', value: '#1A1A1A' },
  { id: 'white', label: 'White', value: '#FFFFFF' },
  { id: 'gray', label: 'Gray', value: '#9CA3AF' },
  { id: 'red', label: 'Red', value: '#EF4444' },
  { id: 'orange', label: 'Orange', value: '#F97316' },
  { id: 'green', label: 'Green', value: '#22C55E' },
  { id: 'blue', label: 'Blue', value: '#3B82F6' },
  { id: 'purple', label: 'Purple', value: '#8B5CF6' },
];

function colorsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a && !b) return true;

  const normalizedA = normalizeHexColor(a);
  const normalizedB = normalizeHexColor(b);
  if (normalizedA && normalizedB) {
    return normalizedA === normalizedB;
  }

  return a === b;
}

function getColorInputValue(color: string | undefined, fallback: string): string {
  return normalizeHexColor(color) ?? fallback;
}


interface NodeMenuProps {
  node: DiagramNode;
  framework: Framework;
  degrees: { indegree: number; outdegree: number } | null;
  closeContextMenu: () => void;
  updateNodeTags: (id: string, tags: string[]) => void;
  updateNodeJunction: (id: string, type: JunctionType) => void;
  previewNodeColor: (id: string, color: string | undefined) => void;
  previewNodeTextColor: (id: string, textColor: string | undefined) => void;
  updateNodeColor: (id: string, color: string | undefined) => void;
  updateNodeTextColor: (id: string, textColor: string | undefined) => void;
  toggleNodeLocked: (ids: string[], locked: boolean) => void;
  deleteNodes: (ids: string[]) => void;
  beginColorPickerInteraction: () => void;
  endColorPickerInteraction: () => void;
  registerCloseActions: (actions: { apply: () => void; cancel: () => void } | null) => void;
}

function NodeContextMenu({
  node,
  framework,
  degrees,
  closeContextMenu,
  updateNodeTags,
  updateNodeJunction,
  previewNodeColor,
  previewNodeTextColor,
  updateNodeColor,
  updateNodeTextColor,
  toggleNodeLocked,
  deleteNodes,
  beginColorPickerInteraction,
  endColorPickerInteraction,
  registerCloseActions,
}: NodeMenuProps) {
  const originalColorRef = useRef(node.data.color);
  const originalTextColorRef = useRef(node.data.textColor);

  const nodeBackgroundColors = SHARED_COLORS;
  const nodeTextColors = SHARED_COLORS;

  const setBackgroundColor = useCallback((color: string | undefined) => {
    previewNodeColor(node.id, color);
  }, [node.id, previewNodeColor]);

  const setTextColor = useCallback((color: string | undefined) => {
    previewNodeTextColor(node.id, color);
  }, [node.id, previewNodeTextColor]);

  const commitColors = useCallback(() => {
    if (!colorsMatch(originalColorRef.current, node.data.color)) {
      updateNodeColor(node.id, node.data.color);
      rememberRecentColor('background', node.data.color);
    }
    if (!colorsMatch(originalTextColorRef.current, node.data.textColor)) {
      updateNodeTextColor(node.id, node.data.textColor);
      rememberRecentColor('text', node.data.textColor);
    }
  }, [node.id, node.data.color, node.data.textColor, updateNodeColor, updateNodeTextColor]);

  const revertColors = useCallback(() => {
    previewNodeColor(node.id, originalColorRef.current);
    previewNodeTextColor(node.id, originalTextColorRef.current);
  }, [node.id, previewNodeColor, previewNodeTextColor]);

  useEffect(() => {
    registerCloseActions({
      apply: () => {
        commitColors();
        closeContextMenu();
      },
      cancel: () => {
        revertColors();
        closeContextMenu();
      },
    });

    return () => {
      registerCloseActions(null);
    };
  }, [closeContextMenu, registerCloseActions, commitColors, revertColors]);

  const applyAndClose = useCallback(() => {
    commitColors();
    closeContextMenu();
  }, [closeContextMenu, commitColors]);

  return (
    <>
      {framework.nodeTags.length > 0 && (
        <>
          {framework.nodeTags.map((tag) => {
            const active = node.data.tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                className="context-menu-item"
                onClick={() => {
                  const next = active
                    ? node.data.tags.filter((t) => t !== tag.id)
                    : [...node.data.tags, tag.id];
                  updateNodeTags(node.id, next);
                  applyAndClose();
                }}
              >
                <span
                  className="tag-chip-dot"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
          <div className="context-menu-separator" />
        </>
      )}

      <div className="context-menu-label">Background</div>
      <div className="context-menu-colors">
        <button
          className="color-swatch color-swatch-none"
          data-active={!node.data.color}
          title="Default"
          onClick={() => setBackgroundColor(undefined)}
        />
        {nodeBackgroundColors.map((c) => (
          <button
            key={c.id}
            className="color-swatch"
            data-active={colorsMatch(node.data.color, c.value)}
            style={{ backgroundColor: c.value }}
            title={c.label}
            onClick={() => setBackgroundColor(c.value)}
          />
        ))}
        <label
          className="color-swatch color-picker-trigger"
          title="Pick custom background color"
          style={undefined}
          onPointerDown={beginColorPickerInteraction}
        >
          <Pipette size={12} aria-hidden="true" />
          <input
            type="color"
            className="color-picker-input"
            aria-label="Custom background color"
            value={getColorInputValue(node.data.color, '#F5F5EC')}
            onFocus={beginColorPickerInteraction}
            onBlur={endColorPickerInteraction}
            onChange={(e) => {
              setBackgroundColor(normalizeHexColor(e.target.value));
            }}
          />
        </label>
      </div>

      <div className="context-menu-label">Text Color</div>
      <div className="context-menu-colors">
        <button
          className="color-swatch color-swatch-none"
          data-active={!node.data.textColor}
          title="Default"
          onClick={() => setTextColor(undefined)}
        />
        {nodeTextColors.map((c) => (
          <button
            key={c.id}
            className="color-swatch"
            data-active={colorsMatch(node.data.textColor, c.value)}
            style={{ backgroundColor: c.value }}
            title={c.label}
            onClick={() => setTextColor(c.value)}
          />
        ))}
        <label
          className="color-swatch color-picker-trigger"
          title="Pick custom text color"
          style={undefined}
          onPointerDown={beginColorPickerInteraction}
        >
          <Pipette size={12} aria-hidden="true" />
          <input
            type="color"
            className="color-picker-input"
            aria-label="Custom text color"
            value={getColorInputValue(node.data.textColor, '#1A1A1A')}
            onFocus={beginColorPickerInteraction}
            onBlur={endColorPickerInteraction}
            onChange={(e) => {
              setTextColor(normalizeHexColor(e.target.value));
            }}
          />
        </label>
      </div>
      {framework.supportsJunctions && degrees && (() => {
        const options = getJunctionOptions(framework);
        const isMath = options.some((o) => o.id === 'add' || o.id === 'multiply');
        if (isMath ? degrees.indegree < 1 : degrees.indegree < 2) return null;
        const currentIdx = options.findIndex((o) => o.id === node.data.junctionType);
        const nextIdx = (currentIdx + 1) % options.length;
        const current = options[currentIdx >= 0 ? currentIdx : 0];
        const next = options[nextIdx];
        return (
          <>
            <div className="context-menu-separator" />
            <button
              className="context-menu-item"
              onClick={() => {
                updateNodeJunction(node.id, next.id as JunctionType);
                applyAndClose();
              }}
            >
              {current.label} → {next.label}
            </button>
          </>
        );
      })()}

      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => {
          toggleNodeLocked([node.id], !node.data.locked);
          applyAndClose();
        }}
      >
        {node.data.locked ? <Lock size={14} /> : <Unlock size={14} />}
        {node.data.locked ? 'Locked' : 'Unlocked'}
      </button>
      <button
        className="context-menu-item context-menu-item--danger"
        onClick={() => {
          deleteNodes([node.id]);
          closeContextMenu();
        }}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </>
  );
}

export default function ContextMenu() {
  const contextMenu = useUIStore((s) => s.contextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const { screenToFlowPosition } = useReactFlow();

  const framework = useFramework();
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const addNode = useDiagramStore((s) => s.addNode);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const previewNodeColor = useDiagramStore((s) => s.previewNodeColor);
  const previewNodeTextColor = useDiagramStore((s) => s.previewNodeTextColor);
  const updateNodeColor = useDiagramStore((s) => s.updateNodeColor);
  const updateNodeTextColor = useDiagramStore((s) => s.updateNodeTextColor);
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);
  const setEdgePolarity = useDiagramStore((s) => s.setEdgePolarity);
  const setEdgeDelay = useDiagramStore((s) => s.setEdgeDelay);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);

  const menuRef = useRef<HTMLDivElement>(null);
  const suppressOutsideCloseRef = useRef(false);
  const nodeCloseActionsRef = useRef<{ apply: () => void; cancel: () => void } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e: PointerEvent) => {
      if (suppressOutsideCloseRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (nodeCloseActionsRef.current?.apply) {
          nodeCloseActionsRef.current.apply();
        } else {
          closeContextMenu();
        }
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (nodeCloseActionsRef.current?.cancel) {
          nodeCloseActionsRef.current.cancel();
        } else {
          closeContextMenu();
        }
      }
    };

    document.addEventListener('pointerdown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, closeContextMenu]);

  const node = contextMenu?.nodeId
    ? nodes.find((n) => n.id === contextMenu.nodeId)
    : null;

  const edge = contextMenu?.edgeId
    ? edges.find((e) => e.id === contextMenu.edgeId)
    : null;

  const degreesMap = node ? computeNodeDegrees(edges) : null;
  const degrees = node && degreesMap
    ? degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 }
    : null;

  if (!contextMenu) return null;

  const registerNodeCloseActions = (actions: { apply: () => void; cancel: () => void } | null) => {
    nodeCloseActionsRef.current = actions;
  };

  const beginColorPickerInteraction = () => {
    suppressOutsideCloseRef.current = true;
  };

  const endColorPickerInteraction = () => {
    suppressOutsideCloseRef.current = false;
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {node ? (
        <NodeContextMenu
          key={node.id}
          node={node}
          framework={framework}
          degrees={degrees}
          closeContextMenu={closeContextMenu}
          updateNodeTags={updateNodeTags}
          updateNodeJunction={updateNodeJunction}
          previewNodeColor={previewNodeColor}
          previewNodeTextColor={previewNodeTextColor}
          updateNodeColor={updateNodeColor}
          updateNodeTextColor={updateNodeTextColor}
          toggleNodeLocked={toggleNodeLocked}
          deleteNodes={deleteNodes}
          beginColorPickerInteraction={beginColorPickerInteraction}
          endColorPickerInteraction={endColorPickerInteraction}
          registerCloseActions={registerNodeCloseActions}
        />
      ) : edge ? (
        <>
          {/* Polarity */}
          {framework.supportsEdgePolarity && (
            <>
              <div className="context-menu-label">Polarity</div>
              {([
                { value: 'positive' as const, label: 'Positive (+)' },
                { value: 'negative' as const, label: 'Negative (-)' },
              ]).map((p) => {
                const current = edge.polarity ?? 'positive';
                return (
                  <button
                    key={p.value}
                    className="context-menu-item"
                    onClick={() => {
                      setEdgePolarity(edge.id, p.value);
                      closeContextMenu();
                    }}
                  >
                    {p.label}
                    {current === p.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </button>
                );
              })}
              <div className="context-menu-separator" />
            </>
          )}

          {/* Delay */}
          {framework.supportsEdgeDelay && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  setEdgeDelay(edge.id, !edge.delay);
                  closeContextMenu();
                }}
              >
                {edge.delay ? 'Remove Delay' : 'Add Delay'}
                {edge.delay && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
              <div className="context-menu-separator" />
            </>
          )}

          {/* Confidence */}
          <div className="context-menu-label">Confidence</div>
          {(['high', 'medium', 'low'] as const).map((level) => {
            const current = edge.confidence ?? 'high';
            return (
              <button
                key={level}
                className="context-menu-item"
                onClick={() => {
                  setEdgeConfidence(edge.id, level);
                  closeContextMenu();
                }}
              >
                <span
                  className="confidence-line-preview"
                  data-level={level}
                />
                {level.charAt(0).toUpperCase() + level.slice(1)}
                {current === level && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
          <div className="context-menu-separator" />
          <button
            className="context-menu-item context-menu-item--danger"
            onClick={() => {
              deleteEdges([edge.id]);
              closeContextMenu();
            }}
          >
            <Trash2 size={14} />
            Delete connection
          </button>
        </>
      ) : (
        <button
          className="context-menu-item"
          onClick={() => {
            addNode(screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }));
            closeContextMenu();
          }}
        >
          <Plus size={14} />
          Add node
        </button>
      )}
    </div>
  );
}
