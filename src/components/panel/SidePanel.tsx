import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);

  if (!sidePanelOpen) return null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));

  return (
    <div className="side-panel">
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
        ) : (
          <SettingsPanel />
        )}
      </div>
      <ChatPanel />
    </div>
  );
}
