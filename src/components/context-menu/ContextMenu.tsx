import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { useGraphDerivations } from '../../hooks/useGraphDerivations';
import { useFramework } from '../../store/diagram-store';
import NodeContextMenu from './NodeContextMenu';
import EdgeContextMenu from './EdgeContextMenu';

export default function ContextMenu() {
  const contextMenu = useUIStore((s) => s.contextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const addNode = useDiagramStore((s) => s.addNode);
  const framework = useFramework();
  const { degreesMap } = useGraphDerivations(edges, framework.allowsCycles);

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

  const degrees = node
    ? degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 }
    : null;

  if (!contextMenu) return null;

  const registerNodeCloseActions = (actions: { apply: () => void; cancel: () => void } | null) => {
    nodeCloseActionsRef.current = actions;
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
          degrees={degrees}
          closeContextMenu={closeContextMenu}
          beginColorPickerInteraction={() => { suppressOutsideCloseRef.current = true; }}
          endColorPickerInteraction={() => { suppressOutsideCloseRef.current = false; }}
          registerCloseActions={registerNodeCloseActions}
        />
      ) : edge ? (
        <EdgeContextMenu
          edge={edge}
          closeContextMenu={closeContextMenu}
        />
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
