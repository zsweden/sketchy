import { useEffect, useRef } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { computeNodeDegrees } from '../../core/graph/derived';

const NODE_COLORS = [
  { id: 'none', label: 'Default', value: undefined },
  { id: 'red', label: 'Red', value: '#FECACA' },
  { id: 'orange', label: 'Orange', value: '#FED7AA' },
  { id: 'amber', label: 'Amber', value: '#FDE68A' },
  { id: 'green', label: 'Green', value: '#BBF7D0' },
  { id: 'teal', label: 'Teal', value: '#99F6E4' },
  { id: 'blue', label: 'Blue', value: '#BFDBFE' },
  { id: 'purple', label: 'Purple', value: '#DDD6FE' },
  { id: 'pink', label: 'Pink', value: '#FBCFE8' },
];

export default function ContextMenu() {
  const contextMenu = useUIStore((s) => s.contextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);

  const framework = useDiagramStore((s) => s.framework);
  const diagram = useDiagramStore((s) => s.diagram);
  const addNode = useDiagramStore((s) => s.addNode);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const updateNodeColor = useDiagramStore((s) => s.updateNodeColor);
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const node = contextMenu.nodeId
    ? diagram.nodes.find((n) => n.id === contextMenu.nodeId)
    : null;

  const edge = contextMenu.edgeId
    ? diagram.edges.find((e) => e.id === contextMenu.edgeId)
    : null;

  const degreesMap = node ? computeNodeDegrees(diagram.edges) : null;
  const degrees = node && degreesMap
    ? degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 }
    : null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {node ? (
        <>
          {/* Tag shortcuts */}
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
                      closeContextMenu();
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

          {/* Color palette */}
          <div className="context-menu-label">Color</div>
          <div className="context-menu-colors">
            {NODE_COLORS.map((c) => (
              <button
                key={c.id}
                className="color-swatch"
                data-active={node.data.color === c.value || (!node.data.color && !c.value)}
                style={{ backgroundColor: c.value ?? 'var(--surface)' }}
                title={c.label}
                onClick={() => {
                  updateNodeColor(node.id, c.value);
                  closeContextMenu();
                }}
              />
            ))}
          </div>

          {/* Junction toggle */}
          {framework.supportsJunctions && degrees && degrees.indegree >= 2 && (
            <>
              <div className="context-menu-separator" />
              <button
                className="context-menu-item"
                onClick={() => {
                  updateNodeJunction(
                    node.id,
                    node.data.junctionType === 'and' ? 'or' : 'and',
                  );
                  closeContextMenu();
                }}
              >
                Junction: {node.data.junctionType === 'and' ? 'AND → OR' : 'OR → AND'}
              </button>
            </>
          )}

          <div className="context-menu-separator" />
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
      ) : edge ? (
        <>
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
            addNode({ x: 0, y: 0 });
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
