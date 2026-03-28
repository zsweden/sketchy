import { useCallback, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import EdgePanel from './EdgePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);

  const [width, setWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(600, Math.max(240, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  if (!sidePanelOpen) return null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));

  return (
    <div className="side-panel" style={{ width, minWidth: width }}>
      <div
        className={`side-panel-resize ${dragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
      />
      <div className="side-panel-top">
        {selectedNodes.length === 1 ? (
          <NodePanel node={selectedNodes[0]} />
        ) : selectedNodes.length > 1 ? (
          <div className="section-stack">
            <p className="section-heading">
              {selectedNodes.length} nodes selected
            </p>
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => deleteNodes(selectedNodes.map((n) => n.id))}
            >
              Delete All
            </button>
          </div>
        ) : selectedEdges.length === 1 ? (
          <EdgePanel edge={selectedEdges[0]} />
        ) : (
          <SettingsPanel />
        )}
      </div>
      <ChatPanel />
    </div>
  );
}
