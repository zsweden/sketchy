import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import MultiNodePanel from './MultiNodePanel';
import EdgePanel from './EdgePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';
import { useSidePanelLayout } from './useSidePanelLayout';

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const chatPanelMode = useUIStore((s) => s.chatPanelMode);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const {
    panelRef,
    width,
    dragging,
    topSectionStyle,
    vDragging,
    onPointerDown,
    onVPointerDown,
  } = useSidePanelLayout(chatPanelMode);

  if (!sidePanelOpen) return null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));
  const isSharedLayout = chatPanelMode === 'shared';

  return (
    <div className="side-panel" style={{ width, minWidth: width }} ref={panelRef}>
      <div
        className={`side-panel-resize ${dragging ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
      />
      <div className="side-panel-top" style={topSectionStyle}>
        {selectedNodes.length === 1 ? (
          <NodePanel node={selectedNodes[0]} />
        ) : selectedNodes.length > 1 ? (
          <MultiNodePanel selectedNodes={selectedNodes} />
        ) : selectedEdges.length === 1 ? (
          <EdgePanel edge={selectedEdges[0]} />
        ) : (
          <SettingsPanel />
        )}
      </div>
      {isSharedLayout && (
        <div
          className={`side-panel-v-resize ${vDragging ? 'dragging' : ''}`}
          onPointerDown={onVPointerDown}
        />
      )}
      <ChatPanel />
    </div>
  );
}
