import { useEffect, useRef } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { computeNodeDegrees } from '../../core/graph/derived';

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
